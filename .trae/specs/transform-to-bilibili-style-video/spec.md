# 烬潮博客 → 哔哩哔哩风格视频站 改造 Spec

## Why
当前项目是文章/视频/文件混合的博客平台，用户希望以"哔哩哔哩"为参照，把核心体验重塑为视频社区。视频应占据首页和详情页的主导位置，UI 风格、导航结构、播放体验都需贴近 B 站的设计语言。

## What Changes

### UI / 设计
- 全站配色改为 B 站风格：主色 `#fb7299`（B 粉）、背景深色模式友好
- 首页重构：视频瀑布流/卡片网格为第一屏，文章与文件降为辅助板块（折叠或移至"专栏"页）
- 视频详情页重构：左侧大播放器 + 右侧信息栏（标题、UP主、统计），B 站式横版布局；评论、推荐视频列在下方
- 视频卡片：封面大图 + 时长角标 + 播放量/UP主信息，B 站列表风格
- 导航栏：B 站式，顶部固定，搜索框居中，右侧头像/登录/上传入口
- 深色模式：CSS 变量化，默认浅色，可切换深色（B 站黑底粉）

### 功能
- **新增 UP 主主页**：B 站风格个人空间（粉丝数、关注数、投稿列表、动态），替代现有 `/profile.html`
- **新增关注/粉丝系统**：用户可关注其他 UP 主，"我的关注"页展示关注动态
- **弹幕系统**：视频详情页支持发送/显示简单弹幕（前端本地渲染，存储到 `barrages` 表）
- **视频分类/分区**：视频上传时可选分区（科技、游戏、生活、音乐、学习等），首页按分区 Tab 过滤
- **推荐视频流**：首页基于"最近发布 + 播放量"的简单算法推荐
- **播放体验增强**：B 站式进度条、画质切换提示（已有 HLS，补 MP4 fallback）、投屏/全屏快捷键

### 数据库
- 新增 `barrages` 表（视频弹幕）
- 新增 `follows` 表（关注关系）
- 新增 `video_categories` 关联（视频分区）
- `users` 表增加 `follower_count`、`following_count` 计数（或子查询计算）

### API
- `GET /api/follows/:userId` 关注动态
- `POST /api/follows/:userId` 关注 / 取消关注（toggle）
- `GET /api/users/:id/follow-status` 是否已关注
- `GET /api/barrages/:videoId` 获取弹幕
- `POST /api/barrages` 发送弹幕
- `GET /api/videos?category=xxx` 分区过滤
- `POST /api/videos` 支持 `category` 字段

### 导航与路由
- 首页 `/` → 视频为主
- 新页面：`/explore.html`（发现页）、`/following.html`（关注页）、`/space.html?user=xx`（UP 主主页）
- 保留原有 `/browse.html`（全部视频）、`/search.html`
- `/dashboard.html` 改名为"个人中心"，保留投稿管理

## Impact
- **Affected specs**: 全站 UI、导航、视频模块、用户社交模块
- **Affected code**:
  - `public/css/style.css` — 全站样式重写（配色、布局、卡片）
  - `public/js/app.js` — 视频卡片、弹幕、关注、分区过滤逻辑
  - `public/*.html` — 首页/详情页/浏览页/搜索页 布局重构，新增 explore/following/space 页
  - `server.js` — 新增关注、弹幕、分区 API，视频上传支持 category
  - `database.js` — 新增表
  - 不影响：认证、邮件、好友/私信、文件下载密码保护

## ADDED Requirements

### Requirement: UP 主主页
用户 SHALL 能访问 `/space.html?user=xx` 查看他人主页，包含头像、昵称、简介、粉丝数/关注数/获赞数、投稿视频列表、关注按钮。

#### Scenario: 访问他人主页
- **WHEN** 用户点击任意视频卡片上的 UP 主头像或昵称
- **THEN** 跳转到 `/space.html?user=<id>`，展示该 UP 主信息与投稿列表
- **AND** 显示"关注"按钮（若已关注显示"已关注"）

### Requirement: 关注/被关注系统
用户 SHALL 能关注/取消关注其他用户，并查看"我的关注"动态流。

#### Scenario: 关注 UP 主
- **WHEN** 用户点击关注按钮
- **THEN** 后端写入 `follows` 表，按钮切换为"已关注"，返回关注结果

#### Scenario: 查看关注动态
- **WHEN** 用户访问 `/following.html`
- **THEN** 展示所有已关注用户的最新投稿视频列表（按时间倒序）

### Requirement: 弹幕系统
用户 SHALL 能在视频播放页发送弹幕，弹幕在视频区域横向飘过，后端持久化。

#### Scenario: 发送弹幕
- **WHEN** 用户在视频下方弹幕输入框发送内容
- **THEN** 弹幕立即出现在当前播放进度位置（前端本地渲染），同时 POST 到后端保存
- **AND** 刷新页面后从后端加载历史弹幕

### Requirement: 视频分区
视频 SHALL 在上传时可选择分区，首页支持按分区 Tab 过滤。

#### Scenario: 按分区浏览
- **WHEN** 用户在首页点击"科技"分区 Tab
- **THEN** 视频列表仅展示该分区内容

### Requirement: 首页视频优先
首页 SHALL 以视频为主要内容，文章和文件降为次要板块。

#### Scenario: 打开首页
- **WHEN** 用户访问 `/`
- **THEN** 第一屏展示视频推荐流（网格布局），下方为"专栏（文章）"和"资源（文件）"折叠区

### Requirement: B 站风格 UI
全站 SHALL 采用 B 站设计语言：粉色主色、圆角卡片、悬停动效、深色模式支持。

#### Scenario: 颜色与布局
- **WHEN** 用户浏览任意页面
- **THEN** 主色为 `#fb7299`，视频卡片为圆角卡片，播放器为 16:9 宽屏

## MODIFIED Requirements

### Requirement: 视频详情页布局
原详情页为单列竖排，改为 B 站式横版：播放器居左（大屏 70%），右侧标题 + UP 主 + 统计 + 收藏点赞按钮；评论和推荐视频在下方。

### Requirement: 视频卡片样式
原视频卡片为简单列表项，改为 B 站式：封面 16:9 + 时长角标 + 标题（最多 2 行）+ UP 主头像昵称 + 播放量。

### Requirement: 导航栏
原导航为博客式，改为 B 站式：Logo + 搜索框（居中）+ 右侧"发布/消息/动态/登录头像"。

## REMOVED Requirements
（无移除，原有功能全部保留，文章和文件降为次要但不删除）
