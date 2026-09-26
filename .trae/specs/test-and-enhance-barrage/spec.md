# 弹幕功能验证与编辑能力 Spec

## Why
现有弹幕功能只实现了「发文字、白字、随机纵向位置、按文字长度推算飘动时长」这一最小闭环（`barrages` 表 5 个字段、`GET/POST /api/barrages`、`spawnBarrage`），既缺少用户可感知的样式控制，渲染层也存在可复现的稳定性缺陷。用户要求先对弹幕做全面验证（发送、显示、滚动、速度、颜色等），再补齐弹幕编辑能力：修改、删除、样式调整（字体大小、颜色、滚动速度），且编辑后显示效果实时更新。

经代码摸排，与用户要求直接冲突的现状是：

| 用户要求 | 现状 |
| --- | --- |
| 发送 | 已有，但无速率限制、`offsetMs` 无上界校验 |
| 显示 | 已有（按 `offset_ms` 挂到 `timeupdate`），但关闭弹幕后 DOM 无界堆积 |
| 滚动效果 | 已有 CSS 动画，轨道为随机 7 行，无防重叠 |
| 速度控制 | **不存在**（时长由文字长度自动推算，用户不可调） |
| 颜色设置 | **不存在**（`barrages` 表无颜色字段，CSS 固定 `#fff`） |
| 编辑 / 删除 | **不存在**（`GET` 连 `id`、`user_id` 都不返回，前端无从定位） |

## What Changes

### 一、验证（测试）
- 新增弹幕接口层单元测试（复用 `validation.js` 纯函数 + `node --test` 既有模式），覆盖发送/编辑/删除的入参与权限分支
- 新增运行时行为验证：DOM 节点增长、进度回退重刷、弹幕开关、并发发送、样式注入
- 覆盖面：用户场景（未登录 / 普通用户 / 管理员 / 操作他人弹幕）、屏幕尺寸（1440 / 1093 / 1000 / 768 / 640 / 390）、浏览器（Chromium 系 Chrome+Edge、Gecko 系 Firefox）
- **限制声明**：Safari 无法在 Windows 本地运行，报告中标注为「未验证」，不得记为通过
- 产出测试报告 `docs/barrage/test-report.md`（用例、复现步骤、期望/实际、证据、缺陷清单、修复后复测结论）

### 二、缺陷修复（以复现确认为准，不含未复现的推测）
- **关闭弹幕后 DOM 无界堆积**：`timeupdate` 仍持续 `spawnBarrage`，而 `display:none` 的弹幕不触发 `animationend`，元素永不回收；重新开启时集中爆发
- **进度回退批量重刷**：`cursor = 0` 后 `while` 循环会把新时间点之前的全部弹幕一次性 spawn
- **写接口无限流**：`POST /api/barrages` 未挂限流（项目硬约束要求 30 次/15 分钟）
- **`offsetMs` 无上界/下界校验**：可写入负值或超大值，导致弹幕永不出现或开局刷屏

### 三、数据模型
`barrages` 表新增 4 列，沿用现有 `PRAGMA table_info` + `ALTER TABLE ADD COLUMN` 迁移模式：

| 列 | 类型 | 默认 | 取值约束 |
| --- | --- | --- | --- |
| `color` | TEXT NOT NULL | `#ffffff` | 12 色白名单 |
| `font_size` | INTEGER NOT NULL | `25` | 18 / 25 / 32 |
| `speed` | TEXT NOT NULL | `'normal'` | `slow` / `normal` / `fast` |
| `updated_at` | DATETIME | NULL | 编辑时间 |

### 四、接口
- `GET /api/barrages/:videoId`：返回值补充 `id`、`user_id`、`color`、`font_size`、`speed`、`updated_at`，以及由会话计算的 `isOwn`、`canEdit`
- 新增 `PATCH /api/barrages/:id`：改内容 / 颜色 / 字号 / 速度，字段可选、部分更新
- 新增 `DELETE /api/barrages/:id`：硬删除
- 权限：发送者本人，或管理员（`users.role === 'admin'`，或邮箱等于 `JINCHAO_ADMIN_EMAIL`）；越权返回 403
- 限流：新建 `barrageLimiter`（30 次 / 15 分钟），统一挂到 POST / PATCH / DELETE
- 校验：所有样式入参走服务端白名单强校验（不信任前端），颜色必须以白名单值写入内联样式，避免 CSS 注入

### 五、前端
- **发送前预设样式**：发送栏新增颜色 / 字号 / 速度选择器，作为下一条弹幕的样式；选择结果写入 `localStorage`，下次进入自动回填
- **「我的弹幕」管理面板**：播放器下方可展开面板，按 `offset_ms` 倒序列出自己有权限管理的弹幕，每条可编辑 / 删除，编辑区带实时预览
- **播放器内就地编辑**：自己的弹幕 `pointer-events: auto` 且带 `data-barrage-id`，点击后暂停该条动画并高亮，弹出编辑浮层（内容 / 颜色 / 字号 / 速度 + 保存 / 删除 / 取消），`Esc` 关闭
- **实时更新显示效果**：维护 `barrageId → DOM 元素` 映射；PATCH 成功后立即改写在屏元素的文本与内联样式，删除后立即移除该元素；未在屏的弹幕在下次到达其 `offset_ms` 时按新样式渲染
- **渲染层加固**：轨道分配（按可见轨道挑选最早空闲轨，避免重叠）、同屏 DOM 数量上限、弹幕关闭时停止 spawn
- **无障碍**：浮层与面板可键盘操作、操作结果 `aria-live="polite"` 播报、`prefers-reduced-motion` 下不渲染飘动弹幕但保留面板编辑能力

## Impact
- Affected specs：`transform-to-bilibili-style-video` 的「弹幕系统」需求被本 spec 修改（补齐样式与编辑能力）；本 spec 的验证结论会反向修订该 spec 中关于弹幕的表述
- Affected code：
  - `database.js` — `barrages` 表迁移
  - `validation.js` — 新增弹幕入参校验纯函数（可单测）
  - `server.js` — 弹幕接口扩展、权限判定、限流、管理员判定
  - `public/js/app.js` — 弹幕渲染层重构、预设样式、管理面板、就地编辑、实时更新
  - `public/css/style.css` — 弹幕样式变量化、编辑浮层、管理面板（复用 `:root` 令牌）
  - `tests/` — 新增弹幕测试用例
  - `docs/barrage/test-report.md` — 测试报告（新增）
- 不影响：视频上传与转码、认证与会话、评论、关注、文件、个人中心

## ADDED Requirements

### Requirement: 弹幕样式属性
系统 SHALL 为每条弹幕持久化 `color`、`font_size`、`speed` 三个样式属性，并在渲染时应用；属性取值 SHALL 限定在白名单内，服务端 SHALL 对写入值做强制校验。

#### Scenario: 发送带样式的弹幕
- **WHEN** 已登录用户在发送栏选择颜色 `#00cd00`、字号 `32`、速度 `fast` 后发送弹幕
- **THEN** 后端以该组样式写入 `barrages`，前端立即以该样式飘出
- **AND** 刷新页面后从 `GET /api/barrages/:videoId` 加载出的该条弹幕样式保持一致

#### Scenario: 非法样式被拒绝或归一
- **WHEN** 请求携带 `color: red;background:url(...)`、`fontSize: 999`、`speed: 'turbo'`
- **THEN** 后端不将这些值写入数据库，返回校验错误或归一化为默认值（`#ffffff` / `25` / `normal`）

### Requirement: 发送前预设样式
系统 SHALL 允许用户在发送弹幕前预设颜色、字号、滚动速度，并记住该预设供后续发送复用。

#### Scenario: 预设样式被记住
- **WHEN** 用户选择速度 `slow` 并发送一条弹幕，随后刷新页面
- **THEN** 发送栏的速度选择器仍为 `slow`

### Requirement: 弹幕编辑
系统 SHALL 允许弹幕发送者本人与管理员修改弹幕的内容、颜色、字号、滚动速度；无权限者 SHALL 被拒绝。

#### Scenario: 本人编辑成功
- **WHEN** 弹幕发送者提交 `PATCH /api/barrages/:id`，携带新的内容与样式
- **THEN** 后端更新对应行并写入 `updated_at`，返回成功
- **AND** 在屏的该条弹幕立即以新内容与新样式显示，无需刷新页面

#### Scenario: 越权编辑被拒绝
- **WHEN** 非发送者且非管理员的用户提交 `PATCH /api/barrages/:id`
- **THEN** 后端返回 403 且数据库不被修改

#### Scenario: 管理员编辑他人弹幕
- **WHEN** 管理员对他人弹幕提交 `PATCH /api/barrages/:id`
- **THEN** 编辑成功

#### Scenario: 未登录编辑
- **WHEN** 未登录会话提交 `PATCH /api/barrages/:id`
- **THEN** 返回未登录提示，不修改数据

### Requirement: 弹幕删除
系统 SHALL 允许弹幕发送者本人与管理员删除弹幕，删除后 SHALL 立即从播放器画面与列表中移除。

#### Scenario: 本人删除成功
- **WHEN** 发送者提交 `DELETE /api/barrages/:id`
- **THEN** 该行被删除，播放器内在屏的对应弹幕元素立即移除，管理面板中该项消失

#### Scenario: 删除越权
- **WHEN** 非发送者且非管理员提交 `DELETE /api/barrages/:id`
- **THEN** 返回 403，且该弹幕仍存在

### Requirement: 我的弹幕管理面板
系统 SHALL 在视频详情页提供「我的弹幕」管理面板，按时间轴列出当前用户可以管理的弹幕（本人弹幕；管理员为全部），并提供编辑与删除入口。

#### Scenario: 打开管理面板
- **WHEN** 已登录用户在视频详情页点击「我的弹幕」
- **THEN** 面板展开并列出该视频中自己发送的弹幕，每条显示时间点、内容、样式摘要
- **AND** 列表为空时显示空状态文案

#### Scenario: 未登录访问
- **WHEN** 未登录用户点击「我的弹幕」
- **THEN** 提示先登录，不发起需要鉴权的写请求

### Requirement: 播放器内就地编辑
系统 SHALL 支持直接点击播放器中自己发送的弹幕进入编辑，且编辑期间该条弹幕 SHALL 暂停飘动以便操作。

#### Scenario: 点击自己的弹幕
- **WHEN** 用户点击正在飘过的本人弹幕
- **THEN** 该条弹幕动画暂停并高亮，弹出编辑浮层
- **AND** 点击他人弹幕无编辑行为

#### Scenario: 取消编辑
- **WHEN** 用户按 `Esc` 或点击「取消」
- **THEN** 浮层关闭，该条弹幕恢复飘动且样式回滚为保存前的值

### Requirement: 编辑后实时更新
系统 SHALL 保证编辑/删除后显示效果实时同步，无需刷新页面。

#### Scenario: 编辑在屏弹幕
- **WHEN** 用户保存对某条正在屏上飘动的弹幕的编辑
- **THEN** 该 DOM 节点的文本与颜色/字号/时长在同一帧内更新

#### Scenario: 编辑未在屏弹幕
- **WHEN** 用户编辑一条当前不在屏上的弹幕
- **THEN** 播放进度再次经过其 `offset_ms` 时，按新样式渲染

### Requirement: 弹幕写接口限流
系统 SHALL 对弹幕写接口（发送、编辑、删除）实施速率限制，防止刷弹幕与滥用。

#### Scenario: 超过限制
- **WHEN** 同一来源在 15 分钟内发起超过 30 次弹幕写请求
- **THEN** 后续请求被拒绝并返回「请求过于频繁，请稍后再试」

### Requirement: 弹幕渲染稳定性
系统 SHALL 保证弹幕渲染过程中 DOM 节点数量有界，且弹幕关闭状态下不产生累积。

#### Scenario: 关闭弹幕后长时间播放
- **WHEN** 用户关闭弹幕并持续播放超过 1 分钟
- **THEN** 弹幕层中不新增累积元素，重新开启时不会集中爆发

#### Scenario: 进度回退
- **WHEN** 用户把播放进度从 60s 拖回 10s
- **THEN** 只会补齐 10s 之后到当前时间的弹幕，不会把 0~60s 的全部弹幕一次性刷出

#### Scenario: 轨道不重叠
- **WHEN** 同一时间点附近有多条弹幕
- **THEN** 弹幕分配到不同纵向轨道，不出现大面积文字重叠

### Requirement: 弹幕专项测试与报告
系统 SHALL 提供可重复执行的弹幕测试，并产出包含用例、期望/实际、缺陷清单与复测结论的测试报告。

#### Scenario: 运行测试
- **WHEN** 执行 `npm test`
- **THEN** 弹幕相关单元测试全部通过，且不影响既有 `validation.test.js`

#### Scenario: 报告可追溯
- **WHEN** 阅读 `docs/barrage/test-report.md`
- **THEN** 每个用例均有可复现步骤与结论，未覆盖项（如 Safari）被明确标注为未验证

## MODIFIED Requirements

### Requirement: 弹幕系统（修订自 `transform-to-bilibili-style-video`）
原需求为「用户能在视频播放页发送弹幕，弹幕在视频区域横向飘过，后端持久化」。现修订为：用户 SHALL 能在视频播放页以自定义的颜色、字号、滚动速度发送弹幕；弹幕按 `offset_ms` 挂接到播放进度横向飘过；发送者本人与管理员 SHALL 能对已发送弹幕进行修改与删除，并即时看到更新后的显示效果。

### Requirement: 获取视频弹幕接口
`GET /api/barrages/:videoId` 原返回 `content`、`offset_ms`、`created_at`、`username`、`avatarUrl`。现 SHALL 额外返回 `id`、`user_id`、`color`、`font_size`、`speed`、`updated_at`、`isOwn`、`canEdit`，以支撑前端定位与权限展示。

## REMOVED Requirements
（无。既有弹幕发送、按进度挂接、弹幕开关等能力全部保留）
