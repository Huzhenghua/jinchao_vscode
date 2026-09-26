# Tasks

## 阶段 1：数据库与后端（API 层）
- [x] Task 1: 数据库新增表与字段
  - [x] 1.1 `database.js` 新增 `follows(user_id, followed_id, created_at)` 表（UNIQUE user_id+followed_id）
  - [x] 1.2 新增 `barrages(video_id, user_id, content, offset_ms, created_at)` 表
  - [x] 1.3 新增 `video_categories(id, name)` 表 + 预置分区数据（科技、游戏、生活、音乐、学习、娱乐、其他）
  - [x] 1.4 `videos` 表新增 `category_id TEXT` 字段（可空）
- [x] Task 2: 后端新增 API
  - [x] 2.1 `server.js` 新增关注接口：`POST /api/follows/:userId`（toggle 关注/取消）、`GET /api/follows/status/:userId`（是否已关注 + 粉丝数）
  - [x] 2.2 `server.js` 新增关注动态：`GET /api/follows`（已关注用户最新视频流）
  - [x] 2.3 `server.js` 新增弹幕接口：`GET /api/barrages/:videoId`（返回最近 N 条 + offset_ms）、`POST /api/barrages`
  - [x] 2.4 `server.js` 视频上传接口支持 `category_id` 字段写入
  - [x] 2.5 `server.js` `GET /api/videos` 支持 `category=xxx` 过滤参数
  - [x] 2.6 `server.js` 新增 `GET /api/videos/recommend`（首页推荐流：播放量加权 + 时间衰减）
  - [x] 2.7 `server.js` `GET /api/users/:id` 返回粉丝数/关注数/获赞数（B 站 UP 主主页数据）
  - 依赖：Task 1

## 阶段 2：UI 设计系统（CSS）
- [x] Task 3: 重写 `style.css` 为 B 站风格
  - [x] 3.1 引入 CSS 变量：主色 `--primary: #fb7299`、背景、文字色；支持深色模式变量
  - [x] 3.2 重写导航栏样式：B 站式 Logo + 搜索框 + 右侧入口
  - [x] 3.3 重写视频卡片样式：16:9 封面 + 时长角标 + 圆角卡片 + 悬停缩放动效
  - [x] 3.4 重写视频详情页样式：播放器左侧 + 信息栏右侧横版布局
  - [x] 3.5 弹幕样式：透明文字 + 飘动动画 + 输入框
  - [x] 3.6 视频分区 Tab 切换样式
  - 依赖：Task 1（需要分区数据）

## 阶段 3：页面重构
- [x] Task 4: 首页 `index.html` 重构
  - [x] 4.1 第一屏改为视频推荐流（网格布局），顶部加分区 Tab
  - [x] 4.2 文章/文件降为下方折叠区
  - [x] 4.3 对接 `loadVideos` 的推荐接口与分区过滤
  - 依赖：Task 2、Task 3
- [x] Task 5: 视频详情页 `detail.html` 重构
  - [x] 5.1 横版布局：左侧播放器 + 右侧标题/UP主/统计/操作
  - [x] 5.2 弹幕层 + 弹幕输入框
  - [x] 5.3 下方推荐视频列表
  - 依赖：Task 2、Task 3
- [x] Task 6: 新增 UP 主主页 `space.html`
  - [x] 6.1 顶部 UP 主信息卡（头像、昵称、简介、粉丝/关注/获赞）
  - [x] 6.2 关注按钮
  - [x] 6.3 投稿视频列表（复用 loadVideos 带 userId）
  - 依赖：Task 2、Task 3
- [x] Task 7: 新增"我的关注"页 `following.html`
  - [x] 7.1 加载关注动态流（已关注用户最新视频）
  - [x] 7.2 未关注时引导关注
  - 依赖：Task 2
- [x] Task 8: 导航与全局样式联动
  - [x] 8.1 更新 `app.js` 的 `updateNavigation` 适配 B 站式导航
  - [x] 8.2 各页面导航统一
  - 依赖：Task 3、Task 4

## 阶段 4：前端交互逻辑
- [x] Task 9: `app.js` 功能增强
  - [x] 9.1 视频卡片渲染为 B 站式（封面大图 + 时长 + UP 主 + 播放量）
  - [x] 9.2 分区 Tab 切换逻辑
  - [x] 9.3 弹幕渲染（Canvas 或 DOM 飘动）+ 发送
  - [x] 9.4 关注按钮 toggle 逻辑
  - [x] 9.5 播放器进度条/画质提示增强
  - 依赖：Task 2、Task 3、Task 4、Task 5
- [x] Task 10: 视频上传表单增加分区选择
  - [x] 10.1 `dashboard.html` 视频表单增加分区下拉
  - [x] 10.2 `app.js` 上传时附带 category_id
  - 依赖：Task 2

## 阶段 5：验证
- [x] Task 11: 运行测试与手动验证
  - [x] 11.1 运行 `npm test` 确认原有测试通过
  - [x] 11.2 启动服务，手动验证：首页视频流、分区切换、视频详情弹幕、关注、UP 主主页、关注动态
  - [x] 11.3 检查深色模式切换
  - 依赖：Task 1-10

# Task Dependencies
- Task 2 依赖 Task 1
- Task 3 依赖 Task 1
- Task 4/5/6/7 依赖 Task 2、Task 3
- Task 8 依赖 Task 3、Task 4
- Task 9 依赖 Task 2、Task 3、Task 4、Task 5
- Task 10 依赖 Task 2
- Task 11 依赖 Task 1-10
