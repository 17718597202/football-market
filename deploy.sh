#!/bin/bash

# ==========================================
# Yuce-Market 一键生产环境部署脚本
# ==========================================

set -e # 遇到错误立即停止

echo "🚀 开始全自动部署 Yuce-Market 最新版本..."

# 1. 获取最新代码
echo -e "\n📦 [1/5] 拉取最新代码..."
git fetch origin main
git reset --hard origin/main

# 2. 安装项目依赖
echo -e "\n📦 [2/5] 安装/更新依赖包..."
npm install

# 3. 数据库同步 (核心步骤：防止数据库结构报错)
echo -e "\n🗄️ [3/5] 更新 SQLite 数据库与 Prisma Client..."
npx prisma db push
npx prisma generate

# 4. 构建 Next.js 生产版本
echo -e "\n🔨 [4/5] 构建前端生产包 (这可能需要几分钟)..."
npm run build

# 5. 重启 PM2 常驻进程
echo -e "\n♻️ [5/5] 重启所有 PM2 守护进程..."
pm2 restart all || echo "⚠️ 警告: 重启失败，可能是您之前没有启动过 pm2 服务，请手动检查。"

echo -e "\n✅ 部署大功告成！您的服务器已经运行着完美的 Web3 原生代码啦！"
