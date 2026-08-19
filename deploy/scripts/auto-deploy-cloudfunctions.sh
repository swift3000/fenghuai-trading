#!/bin/bash
# 自动部署所有云函数

PROJECT_PATH="/Users/god/Desktop/项目/github/fenghuai-trading"
ENV_ID="cloud1-d6g75loi673b1e039"
CLI="/Applications/wechatwebdevtools.app/Contents/MacOS/cli"

echo "=========================================="
echo "  自动部署所有云函数"
echo "=========================================="
echo ""

# 获取所有云函数目录
CF_DIRS=$(ls -1 "$PROJECT_PATH/cloudfunctions" | grep -v node_modules | grep -v ".js$")

echo "发现云函数:"
echo "$CF_DIRS"
echo ""

# 逐个部署
for cf in $CF_DIRS; do
    if [ -f "$PROJECT_PATH/cloudfunctions/$cf/index.js" ]; then
        echo "🔄 部署：$cf"
        $CLI cloud functions deploy --project "$PROJECT_PATH" --env "$ENV_ID" "$cf" 2>&1 | grep -E "(✔|✖|deploying|成功|失败)" || true
        
        if [ $? -eq 0 ]; then
            echo "✅ $cf 部署完成"
        else
            echo "⚠️  $cf 部署可能有警告"
        fi
        echo ""
        sleep 1
    fi
done

echo "=========================================="
echo "  所有云函数部署完成！"
echo "=========================================="
