# 烬潮博客平台

一个基于 Node.js + Express + SQLite 的社区型博客与内容分享平台，支持用户注册登录、文章发布、文件上传、视频发布、好友系统和私信聊天等功能。

## 项目概览

该项目包含以下核心功能：

- 用户注册与登录
- 邮箱验证码注册/登录
- 文章发布、查看、评论和点赞
- 文件上传与下载（支持密码保护）
- 视频上传、转码与在线播放（支持 HLS）
- 个人资料修改与头像上传
- 好友申请、添加好友与聊天
- 全站搜索和内容筛选

## 技术栈

- Node.js
- Express
- SQLite（better-sqlite3）
- Multer（文件/图片上传）
- bcryptjs（密码加密）
- nodemailer（邮箱验证码）
- FFmpeg（视频转码）
- 前端静态页面 + 原生 JavaScript

## 项目结构

```text
.
├── public/                  # 前端静态资源
│   ├── css/
│   ├── js/
│   ├── *.html
│   └── uploads/
├── tests/                  # 测试文件
├── .env.example            # 环境变量示例
├── config.js               # 应用配置
├── database.js             # SQLite 数据库初始化
├── email.js                # 邮件发送逻辑
├── package.json            # 项目依赖与脚本
├── server.js               # 服务端入口
├── start.sh                # 启动脚本
├── validation.js           # 表单校验逻辑
├── README.md               # 项目说明
├── package-lock.json
├── jinchao.db              # SQLite 数据库文件（运行时生成）
└── .gitignore
```

## 运行要求

- Node.js 18+
- FFmpeg（用于视频转码）
- 可用的 QQ 邮箱或其他 SMTP 邮箱用于验证码发送

### 安装 FFmpeg

Ubuntu / Debian：

```bash
sudo apt update
sudo apt install ffmpeg
```

CentOS / Fedora：

```bash
sudo yum install ffmpeg
```

Termux：

```bash
pkg install ffmpeg
```

## 安装与启动

1. 克隆项目

```bash
git clone https://github.com/Huzhenghua/jinchao_vscode.git
cd jinchao_vscode
```

2. 安装依赖

```bash
npm install
```

3. 配置环境变量

复制示例文件并按实际情况修改：

```bash
cp .env.example .env
```

编辑 `.env`：

```env
JINCHAO_EMAIL_USER=your-email@example.com
JINCHAO_EMAIL_PASS=your-mail-app-password
```

> 如果使用 QQ 邮箱，请填写应用专用密码，而不是 QQ 登录密码。

4. 启动项目

```bash
npm start
```

或者使用启动脚本：

```bash
./start.sh
```

启动后访问：

```text
http://localhost:3000
```

## 默认访问说明

项目默认监听：

- 本机：`http://localhost:3000`
- 局域网：`http://<本机局域网IP>:3000`

## 功能说明

### 1. 用户认证

- 支持邮箱注册
- 支持邮箱验证码登录
- 密码使用 bcrypt 加密存储

### 2. 文章模块

- 发布文章
- 查看文章列表
- 浏览文章详情
- 评论与点赞

### 3. 文件模块

- 上传文件
- 支持文件标题和密码保护
- 下载计数统计

### 4. 视频模块

- 上传本地视频或发布外部视频链接
- 自动 FFmpeg 转码
- 生成 HLS 分片播放
- 视频评论与点赞

### 5. 社交模块

- 好友申请与审批
- 私信聊天
- 用户搜索与资料展示

## 测试

```bash
npm test
```

## 注意事项

- 首次运行时会自动创建 SQLite 数据库文件 `jinchao.db`
- 如果没有安装 FFmpeg，上传视频功能将无法正常工作
- 邮件发送依赖邮箱 SMTP 配置，确保账号和授权码正确
- 生产环境请不要直接使用示例的密钥配置

## 许可证

本项目仅供学习和个人开发使用，具体使用方式请遵循项目实际许可要求。

## 联系方式

如需进一步扩展或二次开发，可直接基于当前项目结构进行修改。
