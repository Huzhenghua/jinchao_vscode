# Tasks（v2）

## 阶段 1：设计系统与视觉语言
- [x] Task 1: style.css 设计令牌扩展
  - [x] 1.1 排版比例：`--text-xs` ~ `--text-2xl` + 字重令牌，标题/正文应用
  - [x] 1.2 间距刻度：`--space-1` ~ `--space-8`（4px 基准），页面级布局替换硬编码间距
  - [x] 1.3 语义色（`--success/--warning/--danger` 及浅色底）、渐变令牌（`--primary-gradient` + hover 态）、玻璃导航令牌（`--nav-bg/--nav-blur`）
  - [x] 1.4 阴影三级、圆角与 z-index 层级令牌统一
- [x] Task 2: 玻璃拟态导航与渐变设计语言
  - [x] 2.1 导航 `backdrop-filter` 毛玻璃 + 半透明底，滚动加深；不支持时纯色降级
  - [x] 2.2 主按钮/关注按钮/主操作渐变底 + hover 微亮，全站统一
  - [x] 2.3 分区 Tab 胶囊化：渐变激活态 + 滑动过渡
  - 依赖：Task 1
- [x] Task 3: 深色模式切换落地
  - [x] 3.1 app.js 主题初始化（localStorage > prefers-color-scheme > 浅色）+ `toggleTheme()`
  - [x] 3.2 导航栏主题切换按钮（SVG 太阳/月亮）
  - [x] 3.3 深色变量组全组件覆盖校验，补漏（弹幕层/骨架屏/toast/玻璃导航深色态）
  - 依赖：Task 1（可与 Task 2 并行）

## 阶段 2：焦点页面视觉升级
- [x] Task 4: 首页 hero 区与区块节奏
  - [x] 4.1 hero 横幅（渐变背景 + 站点标语/数据概览），移动端等比适配
  - [x] 4.2 `.section-header` 组件（渐变强调条 + 标题 + 更多链接），首页三区块应用
  - [x] 4.3 折叠区交互精修（箭头旋转动画、hover 反馈）
  - 依赖：Task 1、Task 2
- [x] Task 5: 视频卡片与详情页精修
  - [x] 5.1 卡片：封面底部渐变遮罩、时长角标统一、hover 浮起 + 封面微放大、标题 2 行截断、UP 主行排版
  - [x] 5.2 详情页：播放器区暗色沉浸边框、右侧信息卡圆角化、操作按钮组渐变主次
  - [x] 5.3 space 页信息卡与 following 页复用同套卡片规范
  - 依赖：Task 1、Task 2

## 阶段 3：体验组件升级
- [x] Task 6: Toast / 骨架屏 / 空状态三件套
  - [x] 6.1 `showToast(message, type)`：自动消失、多条叠加、浅深两色 + 入出场动画；替换全部 19 处 `window.alert`
  - [x] 6.2 `.skeleton` 骨架样式 + 微光动画（reduced-motion 降级）；首页/浏览/搜索列表初始占位替换"加载中..."
  - [x] 6.3 空状态组件（SVG 图标 + 文案 + 引导按钮）：following 无关注、搜索无结果、收藏/历史为空等场景
  - 依赖：Task 1（可与阶段 2 并行）
- [x] Task 7: 内联 SVG 图标系统
  - [x] 7.1 定义图标集（搜索/铃铛/信封/太阳/月亮/菜单/播放/点赞/收藏/上传/空状态 等 ~12 个）
  - [x] 7.2 替换导航/按钮/Tab/空状态处 emoji，补 `aria-label`
  - [x] 7.3 `updateNavigation()` 动态注入图标同步替换
  - 依赖：Task 1（可与阶段 2/Task 6 并行）

## 阶段 4：导航统一与响应式
- [x] Task 8: 全站导航统一 + 移动端汉堡
  - [x] 8.1 其余 14 页导航结构统一为 `.navbar`（brand + `.nav-center` 搜索 + `#nav-actions`），复用玻璃拟态样式
  - [x] 8.2 `updateNavigation()` 删除旧 `.nav-links` 分支，收敛单一代码路径
  - [x] 8.3 移动端（≤560px）汉堡菜单：动态/通知/私信/投稿/登录注册折叠展开
  - 依赖：Task 2、Task 7
- [x] Task 9: 响应式断点完善 + 可访问性
  - [x] 9.1 三档断点（560/900/1200）复核补齐：网格列数、详情页堆叠、space 信息卡、hero 缩放
  - [x] 9.2 溢出修复：按钮组换行、长标题 `line-clamp`、宽表格横向滚动兜底
  - [x] 9.3 触控目标 ≥44px、hover 降级、`focus-visible` 焦点样式、对比度 AA
  - 依赖：Task 8

## 阶段 5：打磨与验证
- [x] Task 10: 信息层级清理与微动画
  - [x] 10.1 清理全部 HTML 布局类内联样式，迁移为类
  - [x] 10.2 区块入场淡入上移（IntersectionObserver）+ 悬停精修
  - [x] 10.3 全站 `prefers-reduced-motion` 降级（含弹幕动画）
  - 依赖：Task 4、Task 5
- [x] Task 11: 回归与验收
  - [x] 11.1 `npm test` 通过
  - [x] 11.2 手动过全站 17 页：玻璃导航、渐变语言、hero、深色持久、toast、骨架屏、空状态、三档响应式
  - [x] 11.3 既有功能钩子无回归（关注/弹幕/上传/搜索/通知/私信）
  - 依赖：Task 1-10

# Task Dependencies
- Task 2/3 依赖 Task 1，相互可并行
- Task 4/5 依赖 Task 1、Task 2
- Task 6/7 依赖 Task 1，可与阶段 2 并行
- Task 8 依赖 Task 2、Task 7
- Task 9 依赖 Task 8
- Task 10 依赖 Task 4、Task 5
- Task 11 依赖全部
