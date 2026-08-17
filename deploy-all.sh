#!/bin/bash
PROJECT="/Users/god/Desktop/项目/github/fenghuai-trading"
ENV="cloud1-d6g75loi673b1e039"
CLI="/Applications/wechatwebdevtools.app/Contents/MacOS/cli"

echo "开始部署所有云函数..."
for cf in auth check-customer-fields clear-all-data customers import-data init-db orders outbound products receivable regions report smart system users; do
  echo "部署：$cf"
  $CLI cloud functions deploy --project "$PROJECT" --env "$ENV" "$cf" 2>&1 | tail -3
  sleep 2
done
echo "所有云函数部署完成！"
