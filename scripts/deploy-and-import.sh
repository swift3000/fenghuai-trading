#!/bin/bash

# 部署并导入数据脚本

echo "=== 开始部署 import-data 云函数 ==="

# 进入云函数目录
cd /Users/god/Desktop/项目/github/fenghuai-trading/cloudfunctions/import-data

# 安装依赖
echo "安装依赖..."
npm install

# 部署云函数（使用 cloud1 环境）
echo "部署云函数..."
echo "cloud1" | cloudbase fn deploy import-data --force

echo "=== 部署完成 ==="
echo ""
echo "请在微信开发者工具中运行以下代码来导入数据："
echo ""
echo "云函数控制台调用："
echo "1. 打开微信开发者工具"
echo "2. 进入云开发控制台"
echo "3. 找到 import-data 云函数"
echo "4. 调用云函数，传入参数：{\"action\": \"import-all\"}"
echo ""
echo "或者在小程序代码中调用："
echo "wx.cloud.callFunction({"
echo "  name: 'import-data',"
echo "  data: { action: 'import-all' }"
echo "})"
