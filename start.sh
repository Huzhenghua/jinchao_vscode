#!/data/data/com.termux/files/usr/bin/bash

cd ~/jinchao

# 邮箱配置保存在项目根目录的 .env 中，由 config.js 统一读取。

# 保留启动脚本的执行权限
chmod 700 "$0" 2>/dev/null

echo "🚀 启动烬潮博客..."
npm start
