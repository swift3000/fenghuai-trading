#!/bin/bash
# 自动部署所有云函数
# 用法:
#   bash deploy/scripts/auto-deploy-cloudfunctions.sh                          # 部署全部
#   bash deploy/scripts/auto-deploy-cloudfunctions.sh orders report receivable # 只部署指定
#
# 说明:
# - 必须带 --names（旧版脚本漏了该参数，CLI 报缺失参数 names/paths，逐函数静默失败）
# - 用 --remote-npm-install 在云端装依赖，本地 node_modules 不打包（规避 50MB 上传限制）
# - 结果判定基于 CLI 汇总表的 success 列，不再用 grep 猜

PROJECT_PATH="/Users/god/Desktop/项目/github/fenghuai-trading"
ENV_ID="cloud1-d6g75loi673b1e039"
CLI="/Applications/wechatwebdevtools.app/Contents/MacOS/cli"

echo "=========================================="
echo "  自动部署所有云函数"
echo "=========================================="
echo ""

# 目标云函数：命令行指定 > 自动发现全部
CF_NAMES=()
for cf in "$@"; do CF_NAMES+=("$cf"); done
if [ ${#CF_NAMES[@]} -eq 0 ]; then
    for d in "$PROJECT_PATH"/cloudfunctions/*/; do
        base=$(basename "$d")
        [ "$base" = "node_modules" ] && continue
        [ -f "$d/index.js" ] && CF_NAMES+=("$base")
    done
fi

echo "发现云函数:"
echo "${CF_NAMES[*]}"
echo ""

FAIL=0
for cf in "${CF_NAMES[@]}"; do
    if [ ! -f "$PROJECT_PATH/cloudfunctions/$cf/index.js" ]; then
        echo "⚠️  $cf 无 index.js，跳过"
        continue
    fi
    echo "🔄 部署：$cf"
    LOG=$(mktemp)
    "$CLI" cloud functions deploy --project "$PROJECT_PATH" --env "$ENV_ID" \
        --names "$cf" --remote-npm-install >"$LOG" 2>&1
    if grep -E "│ *${cf} *│" "$LOG" | grep -q "true"; then
        echo "✅ $cf 部署完成"
    else
        echo "❌ $cf 部署失败，日志末尾："
        tail -8 "$LOG" | sed 's/^/   /'
        FAIL=1
    fi
    rm -f "$LOG"
    echo ""
    sleep 1
done

echo "=========================================="
if [ $FAIL -eq 0 ]; then
    echo "  ✅ 全部部署完成"
else
    echo "  ❌ 存在失败项，见上方日志"
fi
echo "=========================================="
exit $FAIL
