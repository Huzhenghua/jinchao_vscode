# Tasks

- [x] Task 1: 建立弹幕测试基线与缺陷复现
  - [x] SubTask 1.1: 编写临时测试数据脚本（临时用户 + 临时视频 + 预置弹幕），脚本放在系统临时目录，测试结束可一键清理
  - [x] SubTask 1.2: 复现 4 处疑似缺陷并留存证据：关闭弹幕后 DOM 堆积、进度回退批量重刷、`POST /api/barrages` 无限流、`offsetMs` 无上下界校验
  - [x] SubTask 1.3: 执行发送/显示/滚动/速度/颜色的功能基线，记录「速度控制」「颜色设置」为缺失能力而非缺陷
  - [x] SubTask 1.4: 产出 `docs/barrage/test-report.md` 初版：用例表（用户场景 × 屏幕尺寸 1440/1093/1000/768/640/390 × 浏览器 Chromium/Firefox）、期望/实际、缺陷清单；Safari 标注为未验证

- [x] Task 2: 后端数据模型与校验层
  - [x] SubTask 2.1: `database.js` 为 `barrages` 表新增 `color` / `font_size` / `speed` / `updated_at` 四列，沿用 `PRAGMA table_info` + `ALTER TABLE` 迁移模式，保证既有数据默认值为 `#ffffff` / `25` / `normal`
  - [x] SubTask 2.2: `validation.js` 新增弹幕入参校验纯函数：内容（trim 后非空、≤100 字）、颜色（12 色白名单）、字号（18/25/32）、速度（slow/normal/fast）、`offsetMs`（整数且落在合理区间）
  - [x] SubTask 2.3: 在 `tests/` 中为上述校验函数补单元测试（合法值通过、越界值被拒、缺失字段取默认），确保 `npm test` 全绿

- [x] Task 3: 后端弹幕接口扩展与加固
  - [x] SubTask 3.1: `GET /api/barrages/:videoId` 返回值补充 `id`、`user_id`、样式字段、`updated_at`，并按会话计算 `isOwn`、`canEdit`
  - [x] SubTask 3.2: 新增 `PATCH /api/barrages/:id`，支持内容/颜色/字号/速度的部分更新，写入 `updated_at`
  - [x] SubTask 3.3: 新增 `DELETE /api/barrages/:id`
  - [x] SubTask 3.4: 权限判定：发送者本人或管理员（`users.role === 'admin'`，或邮箱等于 `JINCHAO_ADMIN_EMAIL`）可写，越权返回 403，未登录返回未登录提示
  - [x] SubTask 3.5: 新增 `barrageLimiter`（30 次 / 15 分钟）并挂到 POST / PATCH / DELETE，修复写接口无限流缺陷

- [x] Task 4: 前端弹幕渲染层重构与缺陷修复
  - [x] SubTask 4.1: 抽取弹幕渲染模块：轨道分配（按可见轨道选最早空闲轨，避免重叠）、单条时长按 `speed` + 文字长度计算、同屏 DOM 上限
  - [x] SubTask 4.2: 维护 `barrageId → DOM 元素` 映射，为后续「实时更新」提供定位能力；自己的弹幕加 `data-barrage-id` 且可点击
  - [x] SubTask 4.3: 修复关闭弹幕后累积：弹幕关闭时不 spawn；开启时按时长上限回收，不集中爆发
  - [x] SubTask 4.4: 修复进度回退重刷：回退时把游标定位到当前时间点，而不是归零后整段补齐
  - [x] SubTask 4.5: 新字段接入：渲染时应用 `color` / `font_size` / `speed`（颜色、字号写入内联样式，速度映射为动画时长）

- [x] Task 5: 前端编辑能力与预设样式
  - [x] SubTask 5.1: 发送栏新增颜色 / 字号 / 速度选择器作为预设样式，选择结果写入 `localStorage` 并在进入页面时回填，发送时随请求提交
  - [x] SubTask 5.2: 新增「我的弹幕」管理面板：按 `offset_ms` 列出可管理弹幕，含空状态、编辑入口、删除入口（删除前二次确认）
  - [x] SubTask 5.3: 实现播放器内就地编辑浮层：点击自己的弹幕 → 暂停该条动画并高亮 → 浮层可改内容/样式 → 保存 / 删除 / 取消，`Esc` 可关闭，取消时回滚样式
  - [x] SubTask 5.4: 实现实时更新：PATCH 成功后同步在屏 DOM 的文本与样式，DELETE 成功后立即移除在屏元素与列表项，并同步本地弹幕缓存
  - [x] SubTask 5.5: 样式与无障碍：复用 `:root` 令牌编写弹幕、浮层、面板样式，补 1000px / 640px 断点与 `prefers-reduced-motion` 降级，操作结果用 `aria-live="polite"` 播报，浮层可键盘操作

- [x] Task 6: 全量验证与测试报告定稿
  - [x] SubTask 6.1: 运行 `node --check` 与 `npm test`，确认无语法错误、既有与新增测试全部通过
  - [x] SubTask 6.2: 修复后复测 Task 1 全部缺陷用例，确认 4 处缺陷已消除
  - [x] SubTask 6.3: 在真实浏览器中验证编辑与删除链路（本人 / 管理员 / 越权 / 未登录），以及 6 档视口宽度下无横向溢出
  - [x] SubTask 6.4: 更新 `docs/barrage/test-report.md` 为定稿版：补修复前后对比、复测结论、仍然存在的限制
  - [x] SubTask 6.5: 清理所有临时测试数据、临时脚本与演示弹幕，确认数据库与上传目录无残留

- [x] Task 7: 修复弹幕不飘动缺陷（Task 6 验证新发现，阻塞性）
  - [x] SubTask 7.1: 修掉 `@keyframes barrage-move` 的 `right → left` 离散插值：改为静态定位 + 只动画 `translate`（JS 传入像素级位移），恢复真正的横向飘动
  - [x] SubTask 7.2: 同步修掉 `.barrage-preview-move` 同样的离散插值问题，保留其 `transform: translateY(-50%)` 垂直居中
  - [x] SubTask 7.3: 同步修正轨道占用时长估算公式，使其匹配新的位移几何，保证同时间多条弹幕不重叠
  - [x] SubTask 7.4: 浏览器复测飘动可见性、C5/C6/C7 真实点击链路、D1/D2 不回归

- [x] Task 8: 补做 Gecko 系（Firefox）兼容性验证（checklist「浏览器覆盖」检查点未通过补做）
  - [x] SubTask 8.1: 安装 Gecko 系浏览器（Playwright Firefox 构建），补齐本机缺失的 Firefox 环境
  - [x] SubTask 8.2: 在 Firefox 中验证弹幕飘动可见性（连续位移）、发送、编辑浮层点击链路、6 档视口无横向溢出、`prefers-reduced-motion` 降级、控制台无报错
  - [x] SubTask 8.3: 把 Firefox 实测结论回填 `docs/barrage/test-report.md`，并把报告中「Firefox 未验证」的限制条目更新为已验证结论

- [x] Task 9: 纵向轨道数自适应（checklist「轨道不重叠」检查点未完全通过补做，用户已选定方案）
  - [x] SubTask 9.1: 把硬编码的 `BARRAGE_LANE_COUNT = 7` / `BARRAGE_LANE_STEP = 11%` 换成按播放器图层实际高度与最大字号动态计算轨道数与像素步长（设下限与上限，绘制前按需重算）
  - [x] SubTask 9.2: 图层尺寸变化（resize / 进入播放页）时重算轨道几何并重置轨道占用，避免沿用旧几何导致错位
  - [x] SubTask 9.3: 浏览器（Chromium）实测：轨道数由 7 提升、同刻 16 条的完全重合对数显著下降、390px 小屏轨道步长不再小于字号、编辑链路与 D1/D2 不回归
  - [x] SubTask 9.4: 回填 `docs/barrage/test-report.md`：更新轨道相关数据与「同刻超轨道数仍会少量重叠」的遗留限制表述

# Task Dependencies
- Task 3 依赖 Task 2（字段与校验契约）
- Task 4 依赖 Task 2（字段契约），与 Task 3 可并行
- Task 5 依赖 Task 3 与 Task 4
- Task 6 依赖 Task 1 ~ Task 5 全部完成
- Task 7 由 Task 6 的验证结果触发，完成后需重跑 Task 6 的相关用例
- Task 1 与 Task 2 可并行启动
