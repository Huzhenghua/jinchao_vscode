# Checklist

## 数据库与 API
- [x] `follows`、`barrages`、`video_categories` 表已创建，`videos.category_id` 字段已添加
- [x] 关注接口（toggle、status、关注动态）可正常调用
- [x] 弹幕接口（GET/POST）可正常调用
- [x] 视频列表支持 `category` 过滤
- [x] 推荐接口 `/api/videos/recommend` 返回合理排序
- [x] 用户主页接口返回粉丝/关注/获赞数

## UI 设计
- [x] 全站主色为 `#fb7299`（B 粉）
- [x] 视频卡片为 16:9 封面 + 时长角标 + 圆角卡片
- [x] 视频详情页为播放器左侧 + 信息栏右侧横版布局
- [x] 弹幕样式与输入框存在
- [x] 分区 Tab 切换样式存在
- [x] 导航栏为 B 站式（Logo + 搜索 + 右侧入口）
- [x] 深色模式支持

## 页面
- [x] 首页第一屏为视频推荐流，文章/文件为下方折叠区
- [x] 视频详情页弹幕可发送并飘动
- [x] `/space.html?user=xx` UP 主主页可访问，显示信息与投稿
- [x] `/following.html` 关注动态流可访问
- [x] 导航各页面统一

## 交互
- [x] 视频卡片点击跳转详情
- [x] 分区 Tab 切换过滤视频
- [x] 弹幕发送后本地飘动 + 持久化
- [x] 关注按钮 toggle 生效
- [x] 视频上传可选分区
- [x] `npm test` 全部通过
