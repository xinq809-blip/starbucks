#!/bin/bash
# 星巴克进销存 - 自动启动脚本
# 每次 Mac 开机后运行一次即可

cd /Users/jiujiu/inventory-system

# 1. 启动静态服务器
echo "启动服务器..."
pkill -f "serve" 2>/dev/null
nohup npx serve dist -l 5173 --no-clipboard > /tmp/serve.log 2>&1 &
sleep 2

# 2. 启动隧道
echo "创建公网隧道..."
pkill -f "ssh.*serveo" 2>/dev/null
nohup ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -R 80:localhost:5173 serveo.net > /tmp/serveo.log 2>&1 &
sleep 10

# 3. 提取 URL 保存到桌面
URL=$(grep -o 'https://[^ ]*\.serveousercontent\.com' /tmp/serveo.log | head -1)
echo "$URL" > ~/Desktop/进销存地址.txt
echo ""
echo "==========================="
echo "  公网地址: $URL"
echo "  已保存到桌面: 进销存地址.txt"
echo "  密码: starbucks2026"
echo "==========================="
