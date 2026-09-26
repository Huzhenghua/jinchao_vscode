# 弹幕功能测试报告（定稿版）

- 报告版本：**v2（定稿）**（2026-09-26）
- 被测系统：烬潮博客平台（Node.js + Express + better-sqlite3）
- 测试类型：功能基线 + 缺陷复现 + 缺陷修复复测 + 新能力验证（静态分析 + 接口实测 + 真实浏览器实测）
- 闭环说明：本报告覆盖完整一轮「基线复现 → 缺陷修复 → 功能实现 → 全量复测 → 新缺陷再修复」：v1 建立基线并复现 D1~D4；Task 2~5 完成数据模型、接口、权限、限流与前端编辑能力；Task 6 全量复测时发现阻塞性缺陷 D5，Task 7 修复后再次全量复测；收尾阶段清理全部临时夹具。
- 清理说明：v1 的测试夹具（测试用户 id 13/14、测试视频 id 11、弹幕 id 64~83）已在收尾阶段全部清理，数据库无残留。清理输出 `[清理完成] 视频 1 个，用户 2 个，弹幕 20 条`；清理后核查为 `users_test=0 / videos_test=0 / barrages_test=0`，剩余弹幕仅 `user_id=4` 的 2 条与测试无关的历史数据。

---

## 1. 测试环境

| 项目 | 内容 |
| --- | --- |
| 操作系统 | Microsoft Windows 11 家庭版 中文版，build 26200（NT 10.0.26200.0） |
| Node.js | v24.18.0 |
| npm | 11.16.0 |
| 服务地址 | http://localhost:3000 （本地开发服务） |
| 数据库 | `d:\github_clone\jinchao_vscode\jinchao.db`（better-sqlite3） |
| 会话存储 | express-session 默认 MemoryStore（服务重启即清空） |
| 浏览器 1（Chromium 系） | Chrome/151.0.7922.34（本机 Playwright 内置 Chromium 构建，`ms-playwright/chromium-1234`），CDP 协议 1.3 |
| 浏览器 2（Chromium 系） | Microsoft Edge `Edg/153.0.4234.48` |
| 浏览器 3（Gecko 系） | Firefox 142.0.1（Playwright 内置 Gecko 构建 firefox-1495），已实测 |
| 浏览器 4 | Safari —— **未验证（Windows 平台无 Safari）** |
| 浏览器驱动方式 | Chromium 系（Chrome 151）直接以 `--remote-debugging-port` 启动浏览器，用 Node 内置 WebSocket 发送 CDP 指令（无第三方依赖）；Edge 153 同为 CDP；Firefox 侧通过 Playwright 1.56.1 的 `firefox` 通道驱动（`playwright.firefox.launch()`，非 CDP） |

浏览器探测结果：`Get-Command chrome, msedge, firefox` 均未命中 PATH；注册表 `StartMenuInternet` 仅有「360安全浏览器 / Internet Explorer / Microsoft Edge」；常见安装路径仅存在 `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`。因此 Chromium 系使用本机 Playwright 内置 Chromium 构建，**操作系统层面仍未安装 Firefox 发行版**；Gecko 系改用 Playwright 1.56.1 内置 Gecko 构建（`ms-playwright/firefox-1495`，Firefox 142.0.1）驱动，实测结果见第 7.1 节。

### 临时测试脚本（均位于系统临时目录，不在仓库内）

| 文件 | 用途 |
| --- | --- |
| `%TEMP%\barrage-test-data.js` | 测试数据 `setup` / `list` / `cleanup` |
| `%TEMP%\barrage-cdp.js` | CDP 驱动封装（启动浏览器、建页、evaluate、视口/媒体模拟） |
| `%TEMP%\barrage-browser-tests.js` | 浏览器实测主脚本（`chromium` 全量 / `edge` 复测） |
| `%TEMP%\barrage-d4-frontend.js` | D4 前端表现专项观测 |
| `%TEMP%\barrage-db-check.js` / `barrage-inventory.js` | 数据库写入与数据清单核查 |
| `%TEMP%\barrage-browser-chromium.json` / `-edge.json` | 浏览器实测原始输出 |
| `%TEMP%\barrage-lane-setup.js` | 轨道几何自适应夹具 `setup` / `cleanup` / `list`（直连 `jinchao.db`，含关联行清理） |
| `%TEMP%\barrage-lane-test.js` | 轨道几何自适应 Chromium 验证主脚本（L1~L7） |
| `%TEMP%\barrage-lane-result.json` | 轨道验证原始输出 |
| `%TEMP%\barrage-lane-console-check.js` | 首页 console 对照（用于确认全页唯一 404 为 `/favicon.ico`） |

> 上述脚本全部位于系统临时目录，不进入仓库；报告中的原始输出即来自这些脚本的运行结果。

---

## 2. 测试数据与夹具清理

v1 阶段的夹具（**现已清理，仅作证据可追溯**）：

| 类型 | 值 |
| --- | --- |
| 普通用户 A | id=**13**，邮箱 `barrage_a@test.local`，用户名 `弹幕测试A`，密码 `Test@12345`，role=`user` |
| 普通用户 B | id=**14**，邮箱 `barrage_b@test.local`，用户名 `弹幕测试B`，密码 `Test@12345`，role=`user` |
| 测试视频 | id=**11**，标题 `弹幕测试视频-Task1`，经 `POST /api/videos` 以外部链接发布（未上传文件、未触发 FFmpeg），source_url=`http://localhost:3000/uploads/videos/1790356806630-x2vw36x8t3c-converted.mp4` |
| 详情页入口 | `http://localhost:3000/detail.html?type=video&id=11` |

预置弹幕（20 条，id=**64 ~ 83**）：

| id | offset_ms | 内容类别 | 所属用户 |
| --- | --- | --- | --- |
| 64 | 0 | 基础 | A |
| 65 | 3000 | 3 秒 | B |
| 66 | 10000 | 10 秒 | A |
| 67 | 30000 | 30 秒 | B |
| 68 | 60000 | 60 秒 | A |
| 69 | 0 | 100 字极限（`'弹'.repeat(100)`） | B |
| 70 | 0 | emoji 样例 `弹幕测试 emoji 🎉🎊🚀😀` | A |
| 71 | 0 | XSS 注入 `<img src=x onerror=alert(1)>` | B |
| 72 | 0 | XSS 注入 `<script>alert('xss')</script>` | A |
| 73 | 0 | 纯空格 `"   "` | B |
| 74 ~ 83 | 0 | 重复内容 `重复弹幕-重复内容` ×10 | A/B 交替 |

按 offset 分组：offset=0 共 **16 条**；3000/10000/30000/60000 各 1 条；**总计 20 条**。

### 清理方法与收尾结果

```powershell
node "$env:TEMP\barrage-test-data.js" cleanup
node "$env:TEMP\barrage-test-data.js" list
```

`cleanup` 会按测试邮箱与测试视频标题删除用户、视频、该视频全部弹幕及关联行（点赞/评论/收藏/浏览历史/通知/关注/私信/会话等）。

- 收尾清理输出：`[清理完成] 视频 1 个，用户 2 个，弹幕 20 条`
- 清理后核查：`users_test=0`、`videos_test=0`、`barrages_test=0`
- 全表剩余弹幕：仅 `user_id=4` 的 2 条与本次测试无关的历史数据

> 说明：v1 阶段曾用旧夹具（video id=10、用户 11/12、弹幕 4~23）采集证据，验证 `cleanup` 时输出 `[清理完成] 视频 1 个，用户 2 个，弹幕 60 条`，随后重建为 video id=11；两个夹具在本轮收尾阶段均已清理干净。报告中出现的 id 仅用于证据可追溯。

---

## 3. 测试范围

**范围内**：弹幕发送（接口 + UI）、历史弹幕显示与播放进度挂接、真实播放/暂停行为、减动效偏好、滚动方向与实际位移、时长公式、轨道分布与重叠、XSS 转义、六档视口横向滚动、Chromium 系双浏览器一致性、弹幕飘动可见性、编辑/删除链路（返回字段 / 权限 / 实时更新 / 在屏与不在屏）、样式白名单与 CSS 注入面、深色模式对比度、键盘可达性。

**不在范围内**：弹幕审核/举报联动、HLS 播放链路、并发/压力测试（除 D3 的连发与限流阈值验证外）、移动端真机、读屏软件实测、服务端性能剖析、Safari 兼容性（Firefox / Gecko 系见第 7.1 节）。

---

## 4. 用例表（TC-01 ~ TC-25，v1 基线用例）

| 编号 | 用例 | 步骤 | 期望 | 实际 | 结论 |
| --- | --- | --- | --- | --- | --- |
| TC-01 | 正常发送 | 登录 A，`POST /api/barrages` `{videoId:11,content:"正常发送基线",offsetMs:1000}` | 200 且 `success:true`，入库 offset_ms=1000 | `{"success":true,"message":"弹幕发送成功"}` HTTP 200，入库 offset_ms=1000 | 通过 |
| TC-02 | 未登录发送 | 不带 Cookie 调用同一接口 | 拒绝发送 | `{"success":false,"message":"请先登录"}` HTTP 200 | 通过 |
| TC-03 | 空内容 | `content:""` | 400 拒绝 | `{"success":false,"message":"弹幕内容不能为空且不超过100字"}` HTTP 400 | 通过 |
| TC-04 | 101 字 | `content:'弹'.repeat(101)` | 400 拒绝 | 同上，HTTP 400 | 通过 |
| TC-05 | videoId 非整数 | `videoId:"abc"` | 400 拒绝 | `{"success":false,"message":"视频不存在"}` HTTP 400 | 通过 |
| TC-06 | videoId 非法值 | `videoId:-1` | 400 拒绝 | HTTP 400 同上 | 通过 |
| TC-07 | videoId 不存在 | `videoId:999999` | 404 拒绝 | HTTP 404 `视频不存在` | 通过 |
| TC-08 | offsetMs 非数字 | `offsetMs:"abc"` | 归零或拒绝 | 接口返回成功，入库 offset_ms=**0** | 通过（v1 属静默容错，见 D4；D4 修复后改为 HTTP 400 拒绝） |
| TC-09 | UI 发送 | 浏览器登录 A → 详情页输入「UI发送测试弹幕」→ 提交 | toast 成功 + 本地立即飘出该弹幕 | 提交前 17 → 提交后 18 节点，`hasLocal:true`，toast=`弹幕发送成功` | 通过 |
| TC-10 | UI 空内容提交 | 输入框清空后点击发送 | 不发起请求 | 节点数 18 → 18 未变化（被 HTML `required` 拦截） | 通过 |
| TC-11 | 刷新后历史弹幕按 offset 挂接 | 刷新详情页，逐点派发 `timeupdate` 至 t=1/3.5/10.5/30.5/60.5s，统计 `.barrage-layer > .barrage` | 累计条数随进度递增，对应 offset 分组 | 累计 **16 / 17 / 18 / 19 / 20**（与 offset 分组 16+1+1+1+1 完全吻合） | 通过 |
| TC-12 | 真实播放 | Edge 中 `video.play()`，等待 3s | currentTime 前进，弹幕出现 | `duration=8.25`，`currentTime=2.97`，`paused=false`，弹幕节点 0 → **16** | 通过 |
| TC-13 | 暂停行为 | 播放中 `pause()`，等待 1.5s | 无新弹幕产生（timeupdate 停止），且**在屏弹幕位置与视频时刻绑定、完全冻结** | currentTime 冻结在 2.97，节点数保持 16。**改造前**（CSS 关键帧按墙上时钟自走）：已存在弹幕在暂停后仍按真实时间继续动画，与视频时刻脱节；**现在**（时间轴驱动，见第 8 节）：位置由 `video.currentTime` 推算，暂停即冻结 —— 实测 t≈2.0137s 时某条弹幕 `x = 663.0697`，`video.pause()` 后 1.5 秒内三次采样为 `[662.7805, 662.7805, 662.7805]`，最大偏差 **0.29px**（调动帧），`video.paused === true` 且 `currentTime` 不变，同屏 4 条；Firefox 同样三次采样完全相同，偏差 **0** | 通过 |
| TC-14 | 减动效偏好 | `Emulation.setEmulatedMedia` 设为 `prefers-reduced-motion: reduce` 后派发 `timeupdate` | 不渲染弹幕，避免动画堆积 | 媒体查询命中 true，派发后节点数 **0** | 通过（符合代码预期） |
| TC-15 | 滚动方向 | 读取横向位置的写入方式与实际位移方向 | 从右向左飘动 | 现在：横向位置由 JS 每一帧按视频时间写入 `translate`（写入值 = `−progress × travel` 像素，`travel = 图层宽 + 元素宽 + 2`），`progress = (tMs − offsetMs) / durationMs` 由 0 → 1 对应从左边缘进入、直到完全移出；**改造前为 CSS 关键帧动画，已废弃** —— v1 读到的是 `animationName=barrage-move` 与关键帧 `{offset:0,right:100%,left:auto} → {offset:1,right:auto,left:100%}`，该声明本身即 D5 离散跳变的根因（现已修复） | 通过 |
| TC-16 | 时长公式 | 对比每条弹幕的时长（v1 读 CSS `animationDuration`）与 `Math.max(6, Math.min(12, len*0.3+6))` | 完全一致 | 16 条全部 `match:true`（如 len=16→10.8s，len=100→12s，len=19→11.7s） | 通过（基线，v1 无 `speed` 字段时；新版本时长叠加 speed 影响。时间轴驱动改造后时长改以 `durationMs` 参与 `progress` 计算，不再由 CSS `animation-duration` 承担，见第 8 节） |
| TC-17 | 轨道数自适应与重叠 | 同一 offset 的 16 条弹幕同时生成，统计 `style.top` 去重值与两两完全重合（dx=0 且 dy=0）对数 | 轨道数按图层高度动态提升，同刻 16 条应尽量分散到不同轨道 | v1（修复前，百分比硬编码 7 轨 `top = 8 + lane×11%`）：样本出现 **6 个**不同轨道（8/19/30/52/63/74%），其中 **4 个轨道发生重叠**（如 top=52% 承载 7 条）；专项复现另测得 16 条同刻弹幕有 **10 条挤在 3 条轨道**、完全重合 **12 对** → 现在（自适应轨道，桌面图层高 504px）：轨道数 **14**，`style.top` 去重后 **14 个不同值**（8 ~ 486.4px，步长 **36.8px**），16 条仅 **2 对**完全重合（dx=dy=0），最挤轨道承载 2 条 | 通过（轨道数 7 → 14，完全重合对数 12 → 2；同刻条数仍可能超过轨道数导致少量残留重合，见遗留限制 1） |
| TC-18 | XSS 注入转义 | 关闭弹幕层后派发时间，检查注入样例 | 仅作文本渲染，不产生元素、不执行脚本 | `html img 元素=0`、`script 元素=0`、`alert 调用次数=0`；`textContent` 为原始串，`innerHTML` 为 `&lt;img src=x onerror=alert(1)&gt;` / `&lt;script&gt;alert('xss')&lt;/script&gt;` | 通过 |
| TC-19 | 六档视口横向滚动 | 1440/1093/1000/768/640/390 宽度下测 `documentElement.scrollWidth === clientWidth`（详情页 + 首页） | 无横向滚动条 | 12 组全部 `overflowX:false`（如 1440→1425/1425，390→375/375；差值 15px 为竖向滚动条宽度） | 通过 |
| TC-20 | Chromium(Chrome 151) 全量 | 执行全部浏览器用例 | 与基线一致 | 全部通过，D1/D2 缺陷复现成立 | 通过 |
| TC-21 | Edge 153 复测 | 复测 D1/D2/XSS + 视口 | 与 Chromium 结论一致 | 结论完全一致（D1：20→20；D2：20→38，delta=18；XSS 安全） | 通过 |
| TC-22 | Firefox 验证 | — | 覆盖 Gecko 系 | **已实测**（Playwright 1.56.1 + Firefox 142.0.1 / firefox-1495，夹具：用户 id=15、视频 id=12、弹幕 id=135~140，测后已清理）：**F2** `.barrage-layer` 存在，派发 `timeupdate` 后节点数 t=0s→**3**、1s→**4**、3s→**5**、5s→**6**（与 offset 分组完全吻合）；**F3** 12 次采样 `rect.x` 单调递减 **987.8→801.8**，相邻差值 **−15.8 ~ −18.4** 无跳变，计算样式 `translate=-206.911px`、`transform=none`、`--barrage-travel=1040px`（图层 896px；该条采集于 CSS 关键帧方案时期，改造后 `translate` 由 JS 按视频时间写入）；**F4** `#00cd00`→`rgb(0, 205, 0)`、`font-size: 32px`，normal/fast/slow 的时长（当时读 CSS `animation-duration`）分别 **8.5s / 6s / 11.5s**；**F5** `boundingBox()+mouse.click` 点中在屏弹幕 → 浮层 `role=dialog` 出现、该弹幕冻结（当时为 `animation-play-state=paused`，改造后为 JS 的 `item.__barrage.frozen`）、`activeElement` 为 `INPUT[text][data-barrage-editor-content]`；**F9** 预设写入 `localStorage` 后刷新回填 `#cc0273 / 32 / fast`（3 个 `aria-checked=true`）；**F10** 六档视口 `scrollWidth===clientWidth` 全部成立；**F11** `reducedMotion:'reduce'` 下弹幕节点数 **0**、「我的弹幕」面板仍列出 **5** 条；F13 控制台 console error **0** / pageerror **0** | 通过 |
| TC-23 | Safari 验证 | — | 覆盖 WebKit | **未验证**：Windows 平台无 Safari | 未验证 |
| TC-24 | 管理员场景 | 检查 `users.role` 的服务端使用 | 管理员具备额外能力 | v1：服务端仅 `/api/me` 返回 role（`server.js:1438`），无授权判定；前端仅展示徽标 | **已补齐为正式能力**：新增 `isAdminUser`（`role='admin'` 或邮箱等于 `JINCHAO_ADMIN_EMAIL`），管理员可编辑/删除他人弹幕（见 C 节 C9 与交付物清单） |
| TC-25 | 操作他人弹幕 | 查找编辑/删除接口 | 支持 | v1：`/api/barrages` 仅 GET、POST 两个路由，无编辑/删除 | **已补齐为正式能力**：新增 `PATCH /api/barrages/:id` 与 `DELETE /api/barrages/:id`（见 C 节 C2/C7/C8 与交付物清单） |

---

## 5. 新增能力验证（编辑 / 删除链路 C1~C10）

### 5.1 原「缺失能力」补齐对照（v1 第 6 节内容修订）

| 能力 | v1 现状 | 本轮补齐位置 |
| --- | --- | --- |
| 用户可调弹幕速度 | 不存在（仅有全局播放速度控件） | `barrages.speed`（`slow`/`normal`/`fast`）+ 发送栏选择器 + 编辑浮层选择器 |
| 弹幕颜色设置 | 不存在（CSS 固定 `#fff`） | `barrages.color`（12 色白名单）+ 选择器 + 内联样式渲染 |
| 弹幕编辑 | 不存在（无 PUT/PATCH） | `PATCH /api/barrages/:id` + 就地编辑浮层 + 管理面板 |
| 弹幕删除 | 不存在（无 DELETE） | `DELETE /api/barrages/:id` + 管理面板删除（二次确认） |
| 管理员权限 | 不存在服务端授权判定 | `isAdminUser`，可编辑/删除他人弹幕 |

### 5.2 用例表（C1~C10，真实浏览器 + 接口实测）

| 编号 | 用例 | 期望 | 实际证据 | 结论 |
| --- | --- | --- | --- | --- |
| C1 | `GET /api/barrages/:videoId` 返回字段 | 每条含定位与样式字段 | 每条均含 `id`、`user_id`、`color`、`font_size`、`speed`、`updated_at`、`isOwn`、`canEdit` | 通过 |
| C2 | 本人 PATCH | 更新成功并写入 `updated_at` | HTTP 200，`updated_at` 被写入，响应返回更新后的完整行 | 通过 |
| C3 | 越权 PATCH | 403 且数据不变 | HTTP 403 `无权修改该弹幕`，复查数据库该行未变 | 通过 |
| C4 | 未登录 PATCH / DELETE | 被拒绝且无副作用 | 返回 `请先登录`；**未登录写请求计数为 0**（请求未产生任何副作用） | 通过 |
| C5 | 实时更新（在屏且同一 DOM） | 同帧改写在屏元素 | PATCH 成功后 `window.__c5el === barrageState.elements.get(id)` 为 `true`，文本与样式当场更新，未重建、无需刷新 | 通过 |
| C6 | 编辑「不在屏」弹幕 | 重新渲染时按新样式 | 改颜色为 `#fe0302` 后 seek 到其时间点，计算样式为 `rgb(254, 3, 2)` | 通过 |
| C7 | 删除后在屏元素移除 | 立即消失 | 删除后播放器内在屏元素立即移除 | 通过 |
| C8 | 删除后列表移除 | 不再返回 | 再次 `GET /api/barrages/:videoId`，返回列表不再包含该 id | 通过 |
| C9 | 管理员编辑/删除他人弹幕 | 允许 | `users.role='admin'` 或邮箱等于 `JINCHAO_ADMIN_EMAIL` 时可编辑/删除他人弹幕 | 通过 |
| C10 | PATCH / DELETE 受速率限制 | 同样受限 | `PATCH` / `DELETE` 均挂载 `barrageLimiter`，超限被拒 | 通过 |

补充用例：**非法样式入参被服务端拒绝** —— 颜色 `#ffffff;}` 这类注入串、字号 `999`、速度 `turbo` 均无法通过校验（归一化或 400），确认无 CSS 注入面。

### 5.3 轨道几何自适应（L1~L3 实测）

**背景**：修复前轨道几何为硬编码百分比（`BARRAGE_LANE_COUNT = 7`、`BARRAGE_LANE_BASE = 8`、`BARRAGE_LANE_STEP = 11`，即 `top = 8 + lane×11%`）。问题有二：① 16 条同刻弹幕在 7 条轨道占满后退化为「取最早空闲轨」，同批 spawn 的占用时刻相同，导致大量弹幕落在同一条轨道上完全重合；② 390px 小屏下图层高度仅约 206px，11% 步长 ≈ 23px 小于最大字号 32px，相邻轨道文字会垂直重叠。

**实现方式（`public/js/app.js`）**
- 轨道上下位置改用**像素**（`item.style.top = '${topPx}px'`），不再用百分比。
- 依据图层实测高度 `barrageState.layer.clientHeight` 与最大可选字号 `Math.max(...BARRAGE_FONT_SIZES) = 32` 动态计算：步长 `step = 32 × 1.15 = 36.8px`；轨道数 `count = floor((图层高 − 首行边距 8) / step) + 1`，并夹在 `[3, 18]` 内。
- **按需重算**：每条弹幕绘制前调用 `syncBarrageLanes()`，比对缓存的 `clientHeight`/`clientWidth`，尺寸变化才重算几何并 `resetBarrageLanes()`（图层高度在视频元数据加载前可能为 0，故不能只在初始化时算一次）；`resize` 监听同样强制重算并重置占用。
- `resetBarrageLanes()` 按**当前**轨道数重建占用数组（长度不再固定 7）。
- 图层高度不可用（`clientHeight <= 0`）时退化为修复前的 7 条 / 百分比布局（`{count:7, base:8, step:11, unit:'percent'}`），不会算出 0 条或 `NaN`。
- `pickBarrageLane` / `occupyBarrageLane` / `spawnBarrage` 语义不变（优先最靠上的空闲轨；全占满时取最早空闲轨），**未引入**排队、延迟或丢弃。

**实测（Chromium 151 / chromium-1234，夹具：用户 id=16、视频 id=13、16 条 `offset_ms=0` 弹幕 id=141~156，字号覆盖 18/25/32）**

| 编号 | 观测项 | 真实实测值 |
| --- | --- | --- |
| L1 | 轨道数提升 | 桌面（图层 896×504px）：`laneCount = 14`，`laneUnit = 'px'`，16 条弹幕 `style.top` 去重后 **14 个不同值**（8 / 44.8 / 81.6 / … / 486.4） |
| L2 | 步长 ≥ 最大字号 | 相邻 `top` 差值恒为 **36.8px**（最小 36.8 ≥ 32）；`laneStep = 36.8` |
| L3 | 完全重合对数下降 | 同屏 16 条两两比较（dx<1px 且 dy<1px）：**2 对**完全重合（精确 dx=dy=0 亦为 2 对），最挤轨道承载 **2 条**（修复前为 12 对、10 条挤在 3 条轨道） |

> 16 条同刻 > 14 条轨道，理论上最优残留 `16 − 14 = 2` 对重合，实测正好 2 对。

**同一轮 Chromium 实测的配套结论（L4~L7）**
- **L4 飘动仍连续**：取一条在屏弹幕采样 10 次 `getBoundingClientRect().x` = `992 / 970.71 / 944.10 / 917.01 / 889.93 / 863.73 / 839.17 / 814.17 / 788.04 / 761.47`，**单调递减**，相邻差值 `−21.29 ~ −27.09px`（无上百像素离散跳变）。
- **L5 小屏轨道间距**：视口 390×844（图层 366×206px）下重算为 `laneCount = 6`、步长仍 **36.8px**（≥32），16 条弹幕去重后 **6 个不同 top**（8 ~ 192px）；`document.documentElement.scrollWidth === clientWidth`（390 = 390）。
- **L6 不回归**：关闭弹幕后 `off=1 / display=none`、节点数 **0**，关闭状态下推进进度 5 次采样节点数恒为 **0**；重新开启节点数仍为 **0**（无集中爆发）；进度 8s→1s 回退新增 **0**；`boundingBox() + page.mouse.click` 点中一条本人飘动弹幕（id=141）后浮层出现（`role=dialog`）、该弹幕冻结（当时为计算样式 `animation-play-state = paused`；时间轴驱动改造后改由 JS 的 `item.__barrage.frozen` 标记控制）、`class` 含 `is-editing`；改色 `#00cd00` 保存后 `barrageState.elements.get('141') === 点击前元素`（`true`）、样式当场 `rgb(255,255,255) → rgb(0,205,0)`、`isConnected=true`、浮层关闭且冻结解除（当时为 `animation-play-state` 恢复 `running`）。
- **L7 控制台**：与弹幕相关的 console error **0**、pageerror **0**（全页唯一一条 console error 为站点通用的 `/favicon.ico` 404，首页加载同样出现，与本次改动无关）。`node --check public/js/app.js` 通过；`npm test` = **18 passed / 0 failed**。

> L4~L7 采集于轨道几何改造轮次，早于时间轴驱动改造；其中冻结机制的等价结论见第 8.4 节。

---

## 6. 缺陷清单（D1~D5）

### D1 关闭弹幕后 DOM 节点无界堆积 —— **已修复并复测通过**

- **严重程度**：高（长时间观看后内存与 DOM 持续增长；重新开启时集中爆发，可能造成明显卡顿）
- **复现步骤**
  1. 打开 `http://localhost:3000/detail.html?type=video&id=11`
  2. 点击「关闭弹幕」（`layer.dataset.off='1'`，`layer.style.display='none'`）
  3. 让播放进度推进到 60.5s（通过派发 `timeupdate` 覆盖各 offset 弹幕）
  4. 统计 `.barrage-layer > .barrage` 节点数，等待 13 秒（> 最长动画 12s）后再次统计
- **实际（修复前）**：节点数 **20 → 20**，13 秒后仍为 20，`element.remove()` 从未执行；**对照组**（保持弹幕开启）13 秒后节点数为 **0**，证明可见状态下 `animationend` 正常回收
- **根因**：`toggleBarrageLayer` 仅切换 `display`；`setupVideoBarrages` 的 `timeupdate` 回调无条件调用 `spawnBarrage`；`display:none` 元素上的 CSS 动画不运行 → `animationend` 永不触发 → `item.remove()` 永不执行
- **证据（修复前实测输出）**

  ```text
  [结果] D1_关闭弹幕后节点数 = {"等待前":20,"等待时长秒":13,"等待后":20,"结论":"节点未回收（堆积）"}
  [结果] D1_对照组_重新开启后 = {"开启瞬间节点数":20,"开启13秒后节点数":0,"结论":"可见时 animationend 正常回收"}
  ```

  （Chromium 与 Edge 两个浏览器结论一致）
- **修复方案**：`spawnBarrage` 在 `layer.dataset.off === '1'` 时直接早退（与 `prefers-reduced-motion` 的早退写法一致），不再生成节点；关闭与开启弹幕层时都清空弹幕层子节点、重置轨道占用并重算游标，避免开启瞬间集中爆发。
- **复测结论（修复后）**：关闭弹幕状态下持续播放并做 **17 次采样**，`.barrage-layer > .barrage` 节点数**恒为 0**；重新开启后新增 **0**；进度从 8s 回退到 1s 后新增 **0**。（时间轴驱动改造后，节点回收改由 RAF 循环中 `progress` 越界判定，不再依赖 CSS `animationend`，见第 8 节。）

### D2 进度回退触发一次性批量重刷 —— **已修复并复测通过**

- **严重程度**：中（回退进度时瞬间刷出整屏弹幕，画面突兀，且与「按进度播放」的语义不符）
- **复现步骤**：保持弹幕开启，先推进到 65s（覆盖全部 20 条），再单次回退到 10s，统计回退前后节点数
- **实际（修复前）**：`20 → 38`，**单次 `timeupdate` 一次性补挂 18 条**（= offset ≤ 10000 的全部弹幕：16 条 offset=0 + 3000 + 10000）
- **根因**：回退判定 `if (now < lastTime - 0.5) cursor = 0;` 只重置游标为 0，随后 `while (cursor < barrages.length && barrages[cursor].offset_ms <= nowMs)` 会把新时间点之前的全部弹幕一次性 spawn
- **证据（修复前实测输出）**

  ```text
  [结果] D2_从65s回退到10s = {"at65":20,"afterSeek":38,"delta":18,"display":"",
       "结论":"回退触发一次性批量重刷"}
  ```

- **修复方案**：回退时不再把游标归零，改用 `barrageCursorFor(list, nowMs)` 把游标定位到当前时间点对应的索引，只补齐回退点之后到当前时间的弹幕。
- **复测结论（修复后）**：进度 8s→1s 回退新增 **0**，不再出现单次 `timeupdate` 补挂 18 条的情况（基线为 20→38）。

### D3 `POST /api/barrages` 无速率限制 —— **已修复并复测通过**

- **严重程度**：高（可被脚本无限刷屏、导致库表快速膨胀；项目硬约束为 30 次/15 分钟）
- **复现步骤**：登录 A 后，对 `POST http://localhost:3000/api/barrages` 连续快速发送 35 次请求（`{videoId, content:"D3限流测试-N", offsetMs:600000}`）
- **实际（修复前）**：**35/35 全部成功，HTTP 状态码分布 `200x35`，无任何 429**
- **根因**：`server.js` 仅注册了 `codeLimiter` / `authLimiter`，并只挂载在 `/api/send-*-code` 与 `/api/login`、`/api/register`、`/api/reset-password`；弹幕接口未挂任何限流中间件
- **证据（修复前实测输出）**

  ```text
  D3 连续 35 次 POST /api/barrages：成功=35 失败=0
  HTTP 状态码分布: 200x35
  ```

- **修复方案**：新增 `barrageLimiter`（30 次 / 15 分钟，按 IP 计数），并挂到 `POST /api/barrages`、`PATCH /api/barrages/:id`、`DELETE /api/barrages/:id`。
- **复测结论（修复后）**：连续发送时**第 31 次开始被拒绝**，响应 HTTP 200 + `{success:false,message:'请求过于频繁，请稍后再试'}`，响应头 `RateLimit-Limit=30`、`RateLimit-Remaining=0`、`RateLimit-Reset=900`。

### D4 `offsetMs` 无上下界校验 —— **已修复并复测通过**

- **严重程度**：中高（可写入脏数据：负值、超大值、非数字被静默归零）
- **复现步骤**：登录 A，依次 `POST /api/barrages` 传 `offsetMs:-5000`、`offsetMs:99999999999`、`offsetMs:"abc"`，查询数据库与前端表现
- **实际（修复前）**
  - `-5000` 与 `99999999999` **均被写入数据库**（`offset_ms` 极值 `{mn:-5000, mx:99999999999}`）
  - `offsetMs:"abc"` 被静默当作 **0** 写入（`Number(...) || 0`）
  - **前端表现（实测）**：`t=0.1s` 时「D4负值offset」**已出现**（按 `offset_ms ASC` 排序，负值排最前，条件 `offset_ms <= nowMs` 恒成立），即负值等效于 offset=0、在播放起点立即刷出；`t=60s` 时「D4超大值offset」仍未出现（超出视频时长，等于永不出现）
- **根因**：`const offsetMs = Number(req.body.offsetMs) || 0;` 未做有限性、下界与上界校验
- **证据（修复前实测输出）**

  ```text
  == D4-a 负值 offsetMs=-5000 ==   {"success":true,...}|HTTP:200
  == D4-b 超大值 offsetMs=99999999999 == {"success":true,...}|HTTP:200
  == D4-c offsetMs 非数字 abc ==   {"success":true,...}|HTTP:200

  数据库： {"id":60,"content":"D4负值offset","offset_ms":-5000}
           {"id":61,"content":"D4超大值offset","offset_ms":99999999999}
           {"id":62,"content":"D4非数字offset","offset_ms":0}
           offset_ms 极值 = {"mn":-5000,"mx":99999999999}

  前端： D4 前端表现 t=0.1s: {"总节点数":18,"负值offset弹幕已出现":true,"超大值offset弹幕已出现":false}
         D4 前端表现 t=60s : {"总节点数":24,"负值offset弹幕已出现":true,"超大值offset弹幕已出现":false}
  ```

  （D1/D2 已在 video id=11 上复测一致；D3/D4 证据采集于旧夹具 video id=10，缺陷位于服务端接口实现，与 video id 无关。）
- **修复方案**：`validation.js` 新增 `validateBarrageCreate`，`offsetMs` 必须为整数且落在 `[0, 86400000]`（24h），越界或非整数返回 HTTP 400 `弹幕时间点不合法`；同时样式字段（颜色/字号/速度）按白名单归一化。
- **复测结论（修复后）**：`-5000`、`99999999999`、`'abc'` 三类入参均被 **HTTP 400** 拒绝，数据库不再写入极值。

### D5 弹幕实际上根本不飘动、全程不可见（CSS 关键帧离散插值）—— **已修复并复测通过**

- **严重程度**：**阻塞（功能完全失效）**
- **发现途径**：Task 6 真实浏览器实测发现。静态分析看不出问题——v1 的 TC-15 只检查关键帧声明、TC-17 只检查 `style.top`，两处都误判为通过。
- **现象**：`.barrage` 元素的 `getBoundingClientRect().x` 在元素前半段**恒为 -89**（停在图层左外侧），进度到 **50%** 时瞬间跳到 **992**，元素全程被 `.barrage-layer { overflow: hidden }` 裁剪 —— **用户完全看不到弹幕**。
- **根因**：`public/css/style.css` 的 `@keyframes barrage-move` 写的是 `from { right: 100% } to { left: 100%; right: auto }`。`right` 与 `left` 是互斥的定位属性，浏览器无法在两个不同属性之间插值，于是被降级为**离散动画**（到 50% 直接切换关键帧），而不是连续位移。
- **修复方案（Task 7）**
  - `.barrage` 改为静态 `left: 100%` + `translate: 0 0`；`@keyframes barrage-move` 只动画 `translate: calc(-1 * var(--barrage-travel, 120vw)) 0`。
  - JS 在 `appendChild` 后写入 `--barrage-travel = 图层宽度 + 弹幕自身宽度 + 2`（图层 `clientWidth <= 0` 时退化为 320px）。
  - 刻意选用 `translate` 属性而非 `transform`，避免覆盖 `.barrage-own:hover { transform: scale(1.05) }` 的悬停放大。
  - 编辑浮层预览元素 `.barrage-preview-item` 的 `@keyframes barrage-preview-move` 同样改为可插值的 `left: 100% → -100%` + `translate: 0 → -100%`。
- **复测证据（修复后同一浏览器会话）**

  ```text
  rect.x 13 个采样点:
  912 / 882.9 / 849.6 / 816.3 / 783 / 749.6 / 716.3 / 685.1 / 651.8 / 618.5 / 585.2 / 551.9 / 518.6
  相邻差值 ≈ 29 ~ 33.4（单调递减，稳定）
  ```

  - `rect.x` **单调递减且相邻差值稳定（−29 ~ −33.4）**，证明是连续位移而非跳变。
  - 实际位移量 `travel = 1174px = 896（图层宽）+ 276.3（弹幕宽）+ 2`。
  - 编辑浮层预览元素相对 X 从 838 连续变化到 −20.3。

> **后续变更（时间轴驱动改造）**：D5 的修复方案建立在 CSS `translate` 关键帧之上；后续改造已**删除弹幕的 CSS 关键帧动画**（`@keyframes barrage-move` 移除、`.barrage` 去掉 `animation`），横向位置改由 JS 按 `video.currentTime` 逐帧写入 `translate`，位移与视频时钟一一对应，详见第 8 节。编辑浮层预览元素（`.barrage-preview-item` / `@keyframes barrage-preview-move`）未在本次改造中变更。

---

## 7. 无障碍 / 响应式 / 深色模式复测

| 项目 | 验证方式 | 结论 |
| --- | --- | --- |
| 六档视口无横向溢出 | 1440 / 1093 / 1000 / 768 / 640 / 390 下测 `documentElement.scrollWidth === clientWidth` | 全部为 `true` |
| `prefers-reduced-motion: reduce` | 模拟媒体偏好后派发 `timeupdate`，并尝试打开管理面板与编辑浮层 | 不渲染飘动弹幕（节点数 **0**）；「我的弹幕」管理面板与编辑浮层仍可正常打开与编辑，浮层预览静态可见 |
| 深色模式对比度 | 读取编辑浮层文本计算样式与背景，计算对比度 | **13.64**（远高于 WCAG AA 的 4.5:1） |
| 键盘可达性 | 打开编辑浮层后检查 `document.activeElement`，并测试 `Esc` | 焦点自动落在内容输入框（内容 textarea/input）；`Esc` 可关闭浮层 |
| 语法与单测 | `node --check public/js/app.js`；`npm test` | `node --check` 通过；`npm test` = **18 passed / 0 failed**（原 5 条 validation 测试未被破坏，新增 13 条弹幕校验测试全部通过） |
| 控制台 | 全流程浏览器控制台监听 | 无 console error / pageerror |

### 7.1 Firefox（Gecko）兼容性实测

**驱动方式**：用绝对路径 `require` npx 缓存中的 `playwright@1.56.1`（`C:\Users\27337\AppData\Local\npm-cache\_npx\d537ee5ee2a13f03\node_modules\playwright`，项目本身未安装 playwright），`PLAYWRIGHT_BROWSERS_PATH` 默认指向 `C:\Users\27337\AppData\Local\ms-playwright`，`playwright.firefox.launch()` 启动 `ms-playwright\firefox-1495\firefox\firefox.exe`。`browser.version() = 142.0.1`，UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0`。

**夹具**：临时用 better-sqlite3 直连 `jinchao.db` 插入 1 个普通用户（id=15，`barrage_ff@test.local` / `弹幕FF测试` / bcrypt 哈希的 `Test@12345`）、1 个外链视频（id=12，`弹幕FF测试视频`，`source_url=/uploads/videos/1790356806630-x2vw36x8t3c-converted.mp4`，未上传文件、未触发 FFmpeg）、6 条弹幕（id=135~140，`offset_ms` = 0/0/0/1000/3000/5000，样式 `#ffffff-25-normal`、`#00cd00-32-fast`、`#fe0302-18-slow`、`#89d5ff-25-fast`、`#cc0273-32-slow`、`#ffaa02-18-normal`）。详情页地址 `http://localhost:3000/detail.html?type=video&id=12`。夹具已在验证后全部清理。

| 编号 | 项目 | 真实观测值 | 结论 |
| --- | --- | --- | --- |
| F1 | 登录 | `login.html` 填表提交 → 跳转 `http://localhost:3000/dashboard.html`；`GET /api/user` = `{"success":true,"user":{"id":15,"username":"弹幕FF测试","role":"user"}}` HTTP 200 | 通过 |
| F2 | 详情页加载 + 进度挂接 | `.barrage-layer` 存在；覆盖 `video.currentTime` getter 并派发 `timeupdate` 后节点数：t=0s→**3**、t=1s→**4**、t=3s→**5**、t=5s→**6**（`barrageState.list.length=6`），累计递增与 offset 分组一致 | 通过 |
| F3 | **飘动可见性（关键）** | 12 次采样 `getBoundingClientRect().x`（间隔 125ms，实际窗口 1648ms）：`987.8 / 969.9 / 952.5 / 936.2 / 920.4 / 902 / 886 / 868.3 / 851.4 / 834.8 / 818.8 / 801.8`；相邻差值 `−17.9 / −17.4 / −16.3 / −15.8 / −18.4 / −16 / −17.7 / −16.9 / −16.6 / −16 / −17`（**单调递减，最大绝对跳变仅 18.4px，无上百像素的离散跳变**）；`getComputedStyle().translate = "-206.911px"`（连续位移中）、`transform = "none"`、`--barrage-travel = 1040px`、图层 `clientWidth = 896`（本条采集于 CSS 关键帧方案时期，当时另有 `animationName = "barrage-move"`、`animationTimingFunction = "linear"`、`animationDuration = "8.5s"`；时间轴驱动改造后该动画已删除，`translate` 改由 JS 按视频时间逐帧写入，见第 8 节） | 通过 |
| F4 | 样式生效 | `#00cd00/32` → 计算 `color = rgb(0, 205, 0)`、`font-size = 32px`；`#fe0302/18` → `rgb(254, 3, 2)` / `18px`；`#cc0273/32` → `rgb(204, 2, 115)` / `32px`；`#ffaa02/18` → `rgb(255, 170, 2)` / `18px`；`#ffffff/25` → `rgb(255, 255, 255)` / `25px`。不同速度的时长互不相同：normal（8.5s）/ fast（6s）/ slow（11.5s）（当时读的是 CSS `animation-duration`；改造后同一时长改以 `durationMs` 参与 `progress` 计算） | 通过 |
| F5 | 就地编辑点击链路 | `boundingBox()` = `{x:843.6, y:280.8, w:102.5, h:28.8}` → `page.mouse.click(中心)` 命中在屏弹幕：`[data-barrage-editor]` 出现且 `role="dialog"`；该弹幕冻结（改造后为 JS 的 `item.__barrage.frozen` 标记；当时为计算样式 `animation-play-state = "paused"`）、`class` 含 `is-editing`、`outline` 为 `2px solid`；`document.activeElement` = `INPUT[text]` 且带 `data-barrage-editor-content` | 通过 |
| F6 | 实时更新（同一 DOM） | 浮层内改内容为 `FFVERIFY-3-EDITED` + 颜色改为 `#ffd302`：保存前 `sameElement === true`、文本与 `rgb(255, 211, 2)` 当场更新；保存后 `sameElement === true`、`isConnected === true`、文本/颜色保持、冻结解除（改造后 `frozen` 复位；当时为 `animation-play-state` 恢复 `running`）；`PATCH /api/barrages/137` HTTP 200 `{"success":true,"message":"弹幕已更新"}`，`GET /api/barrages/12` 返回行 `content="FFVERIFY-3-EDITED"`、`color="#ffd302"`、`updated_at="2026-09-26T04:53:43.012Z"` | 通过 |
| F7 | 取消回滚（Esc） | 打开 id=139 浮层：该弹幕冻结（当时为 `animation-play-state = "paused"`，改造后为 JS 的 `item.__barrage.frozen`），原色 `rgb(204, 2, 115)` → 点选 `#4266be` 后实时预览变 `rgb(66, 102, 190)` → 按 `Esc` 后浮层关闭、颜色**回滚为 `rgb(204, 2, 115)`**、冻结解除（改造后 `frozen` 复位） | 通过 |
| F8 | 删除 | 管理面板点「删除」（`confirm` 自动接受）→ `DELETE /api/barrages/140` HTTP 200 `{"success":true,"message":"弹幕已删除"}`；在屏元素消失、`barrageState.elements.get(140)` 不再存在；面板行由 6→5；`GET /api/barrages/12` 返回 id 列表 `[135,136,137,138,139]` 不再含 140 | 通过 |
| F9 | 预设样式持久化 | 改选颜色 `#cc0273` / 字号 `32` / 速度 `fast` → `localStorage["jinchao:barrage-preset"] = {"color":"#cc0273","fontSize":32,"speed":"fast"}`；刷新页面后工具栏回填 `#cc0273`、`32`、`fast`，三组 `.is-active` 的 `aria-checked` 均为 `true` | 通过 |
| F10 | 六档视口横向滚动 | 1440→1440/1440、1093→1093/1093、1000→1000/1000、768→768/768、640→640/640、390→390/390（`scrollWidth/clientWidth`），6/6 组 `scrollWidth === clientWidth` | 通过 |
| F11 | `prefers-reduced-motion: reduce` | `page.emulateMedia({reducedMotion:'reduce'})` 生效（`matchMedia(...).matches === true`）；推进 `timeupdate` 至 10s 后 `.barrage` 节点数 **0**（无任何在屏节点，`display` 检查因无节点返回 null）；「我的弹幕」面板仍可打开并列出 **5** 条（id 139/138/135/136/137） | 通过 |
| F12 | 关闭弹幕 / 重新开启 | t=5s 时节点数 **5** → 点「关闭弹幕」后 `layer.dataset.off="1"`、`display="none"`、按钮文案变「开启弹幕」、节点数 **0**；关闭状态下推进 t=8s/12s/20s 共 3 次采样节点数**恒为 0**；重新开启后 `off="0"`、`display=""`、节点数仍为 **0**（无集中爆发）；回退到 t=5s 再派发，节点数 **0** | 通过 |
| F13 | 控制台 | 全程 `console` error 计数 **0**、`pageerror` 计数 **0** | 通过 |

**Gecko 侧结论**：本次 F1~F13 全部通过，**未发现 Gecko 特有的不兼容问题**（改造前为 `translate` 属性关键帧在 Gecko 下连续插值；时间轴驱动改造后横向位置改由 JS 逐帧写入 `translate`，Chromium 与 Gecko 结论一致；`prefers-reduced-motion` 模拟生效；`boundingBox()+mouse.click` 可命中移动中的弹幕）。

---

## 8. 时间轴驱动改造（视频时刻一一对应）

### 8.1 需求与动机

原实现的弹幕横向位移由 CSS 关键帧动画承担，动画时钟是**墙上时钟**：动画一旦启动，浏览器便按真实时间自行插值推进，与 `video.currentTime` 无关。由此产生的问题：视频暂停时弹幕仍在继续飘动，弹幕位置与视频时刻脱节；seek、倍速、编辑冻结等场景只能依赖 `animation-play-state`、重挂动画等旁路手段凑合。本次改造的需求为「当视频停止播放的时候，弹幕也停止播放，与视频的时刻一一对应」，即**弹幕位置整体改为由 `video.currentTime` 推算**。

### 8.2 实现方式（`public/js/app.js` / `public/css/style.css`）

1. **逐帧推算位置**：新增 `renderBarrageFrame()`，每帧取 `tMs = video.currentTime * 1000`，对每条在屏弹幕按 `progress = (tMs − offsetMs) / durationMs` 计算进度，写入 `item.style.translate` 的横向位移（值为 `−progress × travel` 像素，`travel = 图层宽 + 元素宽 + 2`）；`progress` 越界即回收该节点。
2. **按当前时刻重建**：新增 `rebuildBarrageFrame()`，在 `seeked` / `loadedmetadata` / `durationchange` / 「重新开启弹幕」/ `resize` 时清空弹幕层，并按当前时刻只重建「仍在飞行窗口内」（`offset_ms <= tMs <= offset_ms + durationMs`）的弹幕，同时把游标定位到第一个未到点的下标。
3. **RAF 驱动循环**：播放由 `requestAnimationFrame` 循环驱动，`play` 启动、`pause` / `ended` 停止并渲染最后一帧；最后一帧的位置依旧由 `video.currentTime` 推算，因此**暂停即冻结**。
4. **轨道占用改基准**：`pickBarrageLane` / `occupyBarrageLane` 的时间基准由 `performance.now()` 改为**视频时间毫秒**，轨道释放与弹幕位移同源。
5. **CSS 侧清理**：`.barrage` 删除 `animation` 声明、改为 `will-change: translate`；删除 `@keyframes barrage-move`；`.barrage.is-editing` 删除 `animation-play-state: paused`（冻结改由 JS 的 `item.__barrage.frozen` 标记控制）。编辑浮层中的 `.barrage-preview-item` 与 `@keyframes barrage-preview-move` **未改动**，仍在用。

### 8.3 验证表（Chromium 真实播放 + Firefox 复验）

样例视频时长 8.25s；Chromium 为 Chrome 151（Playwright 内置 chromium-1234），Firefox 为 142.0.1（Playwright 内置 firefox-1495）。

| 验证项 | 方法 | Chromium 实测 | Firefox 实测 | 结论 |
| --- | --- | --- | --- | --- |
| 暂停冻结（核心） | 真实播放中 `video.pause()`，1.5 秒内连续 3 次采样某条在屏弹幕 `rect.x` | t≈2.0137s 时 `x = 663.0697`；`pause()` 后三次采样 `[662.7805, 662.7805, 662.7805]`，最大偏差 **0.29px**（调动帧）；`video.paused === true` 且 `currentTime` 不变；同屏 4 条 | 三次采样完全相同，最大偏差 **0** | 通过 |
| 恢复续播 | 继续 `play()` 后采样 `rect.x` | `[655.16, 619.81, 576.45]`，单调递减、与暂停位置连续（首帧距暂停位置约 **7.6px**），无跳变 | `[663.77, 623.5, 576.25]`，同样单调连续、无跳变 | 通过 |
| seek 重建 | 跳到 t=7.5s 后统计屏上节点与过期弹幕 | 屏上 **5 条**（列表总计 8 条），已过期的两条不在屏（`expiredAbsent=true`），x 位置与各自 offset 推算一致 | 未单独复验 | 通过 |
| 倍速同步 | 相同 **0.6s 墙上时间**内对比 1x / 2x 位移与 `currentTime` 增量 | 1x 位移 **−53.20px**、2x 位移 **−104.22px**，位移比 **1.959**，`currentTime` 增量比 **1.955** | 未单独复验 | 通过 |
| 编辑冻结 | 打开编辑浮层，采样被编辑弹幕与另一条在屏弹幕的 `rect.x` | 被编辑条两次采样 `[827.7629, 827.7629]`（偏差 **0**）；同一时刻另一条 x 变化 **−24.83px**（仍在动）。保存后同一 DOM 元素（`barrageState.elements.get(id)` 引用 `===`）、文本与颜色当场更新；改字号后 `travel` 由旧值重算为 **1265**、`durationMs` 变为 **9850**；关闭浮层后该条恢复运动（**−33.19px**） | 结论一致 | 通过 |
| 关闭 / 开启弹幕 | 关闭后持续播放 6 次采样节点数；重新开启再统计 | 关闭后节点数**恒为 0**；重新开启只出现 **5 条**（飞行窗口内），无集中爆发 | 未单独复验 | 通过 |
| 减动效 | `prefers-reduced-motion: reduce` 下真实播放 1.5s | 节点数 **0**；管理面板仍列出 **8** 条；编辑浮层可正常打开并用 `Esc` 关闭 | 未单独复验 | 通过 |
| 六档视口 | 1440 / 1093 / 1000 / 768 / 640 / 390 下测 `documentElement.scrollWidth === clientWidth` | 全部成立 | 未单独复验 | 通过 |
| 控制台与单测 | 浏览器控制台监听；`node --check public/js/app.js`；`npm test` | console error **0**、pageerror **0**；`node --check` 通过；`npm test` = **18 passed / 0 failed** | console error / pageerror 均为 **0** | 通过 |

### 8.4 与既有缺陷修复的关系

- **天然覆盖 D2（进度回退不重刷）**：`rebuildBarrageFrame()` 只重建「仍在飞行窗口内」（`offset_ms <= tMs <= offset_ms + durationMs`）的弹幕，回退进度时不再把当前时间点之前的全部弹幕一次性补挂。
- **天然覆盖 D1（关闭弹幕不累积）**：弹幕层关闭时清空且不重建，关闭状态下持续播放 6 次采样节点数恒为 0；重新开启只出现飞行窗口内的 5 条，无集中爆发。
- **编辑浮层冻结机制变更**：由 CSS 的 `.barrage.is-editing { animation-play-state: paused }` 改为 JS 的 `item.__barrage.frozen` 标记 —— 冻结时该条弹幕的 `translate` 不再被 RAF 循环改写，因此被编辑条位置偏差为 **0**，而同屏其它弹幕照常运动（−24.83px）。
- **取代 D5 的 CSS 关键帧方案**：D5 当初是用「可插值的 `translate` 关键帧」修好的；本次改造进一步移除弹幕的全部 CSS 动画关键帧，位置改由 JS 按视频时间逐帧写入，位移精度与视频时钟完全一致。

---

## 9. 仍然存在的限制

1. **同一瞬间弹幕条数仍可能超过轨道数，从而残留少量完全重合**：轨道几何已改为按播放器尺寸自适应，实测桌面（图层 896×504px）为 **14** 条轨道、390px 小屏（图层 366×206px）为 **6** 条轨道，步长恒为 32×1.15 = **36.8px**（≥ 最大字号 32px，相邻轨道文字不再垂直重叠）。但**同一瞬间条数仍可能超过轨道数**（如 16 条同刻 > 14 条轨道），此时多出的弹幕会回落到「最早空闲轨」，与同轨同入点的弹幕完全重合——自适应后实测 16 条同刻弹幕仍有 **2 对**完全重合（修复前为 12 对、10 条挤在 3 条轨道）。结论：同轨同入点在任何时长/几何公式下都无法分开；**彻底消除需排队顺延或丢弃弹幕**，用户已明确选择保留内容、接受该残留，故**未实施**。当前的轨道占用时长公式（`duration × 图层宽 / (图层宽 + 弹幕宽)`）经 13 个采样点验证为 **0 例追赶型部分重叠**，判定**保持现状不改**。
2. **调整已有弹幕的速度会改变其 `durationMs`**：改造后时长不再由 CSS `animation-duration` 承担，而是作为 `progress = (tMs − offsetMs) / durationMs` 的分母参与位置推算；在屏元素改速度后，位置会按新的 `progress` 立即重算（不再涉及 CSS 动画时钟，也就不存在动画时钟跳变）。实测改字号后 `travel` 由旧值重算为 **1265**、`durationMs` 变为 **9850**。
3. **标签页切到后台时弹幕会定格**：位置由 `requestAnimationFrame` 驱动，浏览器在标签页切到后台时会节流/暂停 RAF，此时弹幕不再逐帧更新（画面定格）；回到前台后 RAF 循环恢复，位置按 `video.currentTime` 立即归位。这是「位置与视频时刻一一对应」的必然取舍，**不是缺陷**。
4. **视频暂停时发送的弹幕会停在起点**：用户在视频暂停状态下发送弹幕，该条会停在 `progress = 0` 的起点（即刚从右侧进入、尚不可见），恢复播放后才正常飘出。这是「位置与视频时刻一一对应」的直接结果。
5. **Safari 未验证**（Windows 平台无 Safari）。
6. **Firefox 已通过 Playwright 内置 Gecko 构建验证，但非用户手动安装的 Firefox 发行版**：使用 `playwright@1.56.1` 的 `firefox` 通道驱动 `ms-playwright/firefox-1495`（Firefox **142.0.1**）完成 F1~F13 实测（见第 7.1 节），结论与 Chromium 系一致，未发现 Gecko 特有缺陷；本机操作系统层面（PATH / 注册表 / 常见安装路径）仍无 Firefox 发行版，因此「用户自行安装的 Firefox」这一形态未覆盖。Gecko 侧**未覆盖**的项目：时间轴驱动改造中的 seek 重建、倍速同步、关闭/开启弹幕、减动效与六档视口专项（这些仅在 §8.3 表中以 Chromium 实测；暂停冻结、恢复续播、编辑冻结三项已在 Firefox 下以真实播放复验，结论一致）、HLS 播放链路、深色模式对比度与键盘可达性专项复测（这些项目仅在第 7 节表格中于 Chromium 系测过）。
7. **可播放样例视频仅 8.25 秒**：offset 为 10s / 30s / 60s 的预置弹幕无法通过真实播放触达，相关时序用例是通过「覆盖 `video.currentTime` getter + 手动派发 `timeupdate`」驱动真实回调逻辑完成的，非改写被测代码。
8. **express-session 使用内存存储**，服务重启会清空会话；**express-rate-limit 默认内存计数**，服务重启后限流计数归零。
9. `GET /api/barrages/:videoId` 默认返回 `limit=200`、上限 500，超出部分不返回。
10. 测试完成后临时夹具已清理，报告中出现的 id（用户 13/14、视频 11、弹幕 64~83）**已不存在于当前数据库**，保留仅为证据可追溯。Firefox 验证夹具（用户 15、视频 12、弹幕 135~140）同样已在验证后清理：清理输出 `{"cleanedUsers":1,"cleanedVideos":1,"cleanedBarrages":5}`，清理后核查 `users_test=0 / videos_test=0 / barrages_test=0`，且按 user_id/video_id 关联的点赞、评论、收藏、浏览历史、通知、关注、私信、会话、举报、文件、登录尝试计数全部为 0；全表剩余弹幕仍仅为 `user_id=4` 的 2 条历史数据。临时脚本 `%TEMP%\barrage-ff-setup.js`、`%TEMP%\barrage-ff-tests.js`、`%TEMP%\barrage-ff-launch.js`、`%TEMP%\barrage-ff-check.js` 与中间 JSON 均已删除，仓库内无新增文件。
11. **轨道几何自适应验证夹具亦已彻底清理**：夹具为用户 id=**16**（`barrage_lane@test.local`）、视频 id=**13**（标题 `弹幕轨道测试视频`）、弹幕 id=**141~156**（16 条 `offset_ms=0`）。清理输出 `{"cleanedUsers":1,"cleanedVideos":1,"cleanedBarrages":16}`，清理后核查 `users_test=0 / videos_test=0 / barrages_test=0`，且按 `user_id=16` / `video_id=13` 关联的浏览历史、点赞、评论、收藏、通知、私信、关注、好友请求、好友关系、举报、会话、登录尝试计数全部为 0；全表剩余弹幕仍仅有 `user_id=4` 的 2 条历史数据。这些 id 保留在报告中仅为证据可追溯。**时间轴驱动改造的验证夹具同样已清理**：用户 id=**17**（`barrage_sync@test.local`）、视频 id=**14**（标题 `弹幕同步测试视频`）、弹幕 id=**159~166**（8 条、内容前缀 `SYNCVERIFY-`），清理后核查 `users=0 / videosByTitle=0 / barragesLike SYNCVERIFY=0`，关联的 `user_sessions`、`login_attempts`、`view_history` 计数均为 0，临时目录 `%TEMP%\barrage-sync-verify` 已整目录删除。

---

## 10. 修复后复测总表

| 编号 | 缺陷 | 修复文件 / 位置 | 复测结论 | 日期 |
| --- | --- | --- | --- | --- |
| D1 | 关闭弹幕后 DOM 无界堆积（高） | `public/js/app.js` — `spawnBarrage` 关闭时早退；`toggleBarrageLayer` 清空弹幕层、重置轨道、重算游标 | 关闭状态下 17 次采样节点数恒为 0；重新开启新增 0；8s→1s 回退新增 0 | 2026-09-26 |
| D2 | 进度回退一次性批量重刷（中） | `public/js/app.js` — `setupVideoBarrages` 回退分支改用 `barrageCursorFor(list, nowMs)` | 8s→1s 回退新增 0，不再补挂 18 条（基线 20→38） | 2026-09-26 |
| D3 | `POST /api/barrages` 无速率限制（高） | `server.js` — 新增 `barrageLimiter`（30 次 / 15 分钟，按 IP），挂到 POST / PATCH / DELETE | 第 31 次起被拒；HTTP 200 + `请求过于频繁，请稍后再试`；响应头 Limit=30 / Remaining=0 / Reset=900 | 2026-09-26 |
| D4 | `offsetMs` 无上下界校验（中高） | `validation.js` — 新增 `validateBarrageCreate`，`offsetMs` 为整数且 ∈ [0, 86400000]；样式白名单归一化 | `-5000` / `99999999999` / `'abc'` 均返回 HTTP 400 `弹幕时间点不合法`，数据库不再写入极值 | 2026-09-26 |
| D5 | 弹幕不飘动、全程不可见（阻塞） | `public/css/style.css` — `@keyframes barrage-move` 改为仅动画 `translate`；`public/js/app.js` — 写入 `--barrage-travel`；`style.css` — `barrage-preview-move` 同步修正。**后续变更**：该 CSS 关键帧方案已在时间轴驱动改造中被移除（`@keyframes barrage-move` 删除，弹幕位置改由 JS 按视频时间写入 `translate`，见第 8 节） | `rect.x` 13 个采样点单调递减、相邻差值 −29 ~ −33.4；`travel=1174px`；浮层预览 X 从 838 连续变化到 −20.3 | 2026-09-26 |
| D6（轨道几何） | 纵向轨道几何硬编码（固定 7 轨 / 11% 步长）：同刻弹幕大量完全重合，且 390px 小屏步长 < 最大字号导致相邻轨道文字垂直重叠 | `public/js/app.js` — 新增 `computeBarrageGeometry` / `syncBarrageLanes`；`resetBarrageLanes` 按当前轨道数重建；`spawnBarrage` 改用像素 `top` 并在绘制前按需重算；`resize` 强制重算并重置 | 桌面轨道 7 → **14**、步长 **36.8px**；16 条同刻完全重合 12 → **2 对**；390px 小屏轨道重算为 **6** 条、步长仍 36.8px；高度不可用时退化 7 轨百分比不出 NaN；L4~L7 不回归；`node --check` 通过、`npm test` 18 passed | 2026-09-26 |
| D7（时间轴同步） | 弹幕由「CSS 关键帧按墙上时钟自走」改为「位置由 `video.currentTime` 推算」，实现视频时刻一一对应（暂停即冻结） | `public/js/app.js` — 新增 `renderBarrageFrame` / `rebuildBarrageFrame` 与 RAF 驱动循环（`play` 启动、`pause`/`ended` 停止并渲染末帧），`pickBarrageLane` / `occupyBarrageLane` 时间基准改为视频时间毫秒，编辑冻结改用 `item.__barrage.frozen`；`public/css/style.css` — 删除 `@keyframes barrage-move`、`.barrage` 删除 `animation` 改 `will-change: translate`、`.barrage.is-editing` 删除 `animation-play-state` | 暂停冻结三次采样偏差 ≤ **0.29px**（Firefox **0**）；恢复续播单调连续、首帧距暂停位置约 7.6px；seek 至 7.5s 只留飞行窗口内 **5 条**（过期 2 条不在屏）；0.6s 墙上时间内 1x/2x 位移比 **1.959**（`currentTime` 增量比 1.955）；编辑条冻结偏差 **0** 而同屏另一条仍在动（−24.83px），保存后同 DOM 更新、`travel` 重算 **1265**、`durationMs` **9850**；关闭弹幕 6 次采样节点数恒 **0**、重开只出 **5 条**；减动效节点数 **0**；六档视口无横向溢出；console error **0** / pageerror **0**；`npm test` **18 passed / 0 failed** | 2026-09-26 |

---

## 11. 交付物清单

| 交付物 | 内容 |
| --- | --- |
| `validation.js` | 弹幕校验纯函数 + 三组常量白名单（颜色 12 色 / 字号 18·25·32 / 速度 slow·normal·fast） |
| `database.js` | `barrages` 表 4 列幂等迁移（`color` / `font_size` / `speed` / `updated_at`） |
| `server.js` | `GET /api/barrages/:videoId` 扩展、`PATCH /api/barrages/:id`、`DELETE /api/barrages/:id`、`isAdminUser` 权限判定、`barrageLimiter` 限流 |
| `public/js/app.js` | 弹幕渲染模块、时间轴驱动渲染（`renderBarrageFrame` / `rebuildBarrageFrame` / RAF 循环）、轨道分配、`barrageId → DOM` 映射、发送栏预设样式、我的弹幕管理面板、就地编辑浮层、实时更新 |
| `public/css/style.css` | 弹幕样式（弹幕已移除 CSS 关键帧动画，位置由 JS 按视频时间写入 `translate`）、工具栏、管理面板、编辑浮层、1000px / 640px 断点、`prefers-reduced-motion` 降级 |
| `tests/barrage.test.js` | 13 条弹幕校验单测 |
| `docs/barrage/test-report.md` | 本测试报告 |
| `.trae/specs/test-and-enhance-barrage/` | spec / tasks / checklist |
