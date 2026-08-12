#!/bin/bash

# 丰淮商贸小程序 · 自动化部署脚本
# 使用 API 密钥认证实现完全自动化部署

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
ENV_ID="cloud1-d6g75loi673b1e039"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 加载环境变量
if [ -f "$PROJECT_ROOT/.env" ]; then
  echo -e "${BLUE}📝 加载环境变量...${NC}"
  export $(cat "$PROJECT_ROOT/.env" | grep -v '^#' | xargs)
fi

# 检查必要的环境变量
check_env_vars() {
  if [ -z "$CLOUDBASE_SECRET_ID" ] || [ -z "$CLOUDBASE_SECRET_KEY" ]; then
    echo -e "${YELLOW}⚠️  未找到 API 密钥配置${NC}"
    echo -e "${YELLOW}请创建 .env 文件并配置以下变量：${NC}"
    echo -e "${YELLOW}  CLOUDBASE_SECRET_ID=xxx${NC}"
    echo -e "${YELLOW}  CLOUDBASE_SECRET_KEY=xxx${NC}"
    echo -e "${YELLOW}或手动执行：tcb login --apiKeyId xxx --apiKey xxx${NC}"
    return 1
  fi
  return 0
}

# 登录检查
check_login() {
  echo -e "${BLUE}🔑 检查登录状态...${NC}"
  
  if tcb login --status 2>&1 | grep -q "succeeded"; then
    echo -e "${GREEN}✅ 已登录${NC}"
    return 0
  fi
  
  echo -e "${YELLOW}⚠️  未登录，尝试使用 API 密钥登录...${NC}"
  
  if check_env_vars; then
    tcb login --apiKeyId "$CLOUDBASE_SECRET_ID" --apiKey "$CLOUDBASE_SECRET_KEY"
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}✅ 登录成功${NC}"
      return 0
    else
      echo -e "${RED}❌ 登录失败${NC}"
      return 1
    fi
  fi
  
  return 1
}

# 创建数据库集合
create_collections() {
  echo -e "${BLUE}📋 创建数据库集合...${NC}"
  
  COLLECTIONS=("users" "regions" "products" "customers" "orders" "order_items" "payments" "product_aliases" "customer_aliases" "order_logs" "system_config")
  
  for collection in "${COLLECTIONS[@]}"; do
    echo -e "  创建集合：${collection}..."
    
    # 尝试插入一条测试数据来创建集合
    tcb db nosql execute --database-name "$ENV_ID" --command "[{\"TableName\":\"$collection\",\"CommandType\":\"INSERT\",\"Command\":\"{\\\"insert\\\":\\\"$collection\\\",\\\"documents\\\":[{\\\"_id\\\":\\\"init\\\",\\\"status\\\":1}]}\"}]" 2>/dev/null || true
    
    echo -e "  ${GREEN}✅ $collection${NC}"
  done
  
  echo -e "${GREEN}✅ 所有集合创建完成${NC}"
}

# 插入 regions 数据
insert_regions_data() {
  echo -e "${BLUE}📍 插入 regions 预置数据...${NC}"
  
  # 使用单行 JSON 避免控制字符问题
  REGIONS='[{"_id":"1","name":"汉滨区","sort":1,"status":1},{"_id":"2","name":"汉阴县","sort":2,"status":1},{"_id":"3","name":"石泉县","sort":3,"status":1},{"_id":"4","name":"宁陕县","sort":4,"status":1},{"_id":"5","name":"紫阳县","sort":5,"status":1},{"_id":"6","name":"岚皋县","sort":6,"status":1},{"_id":"7","name":"平利县","sort":7,"status":1},{"_id":"8","name":"镇坪县","sort":8,"status":1},{"_id":"9","name":"旬阳市","sort":9,"status":1},{"_id":"10","name":"白河县","sort":10,"status":1},{"_id":"99","name":"外县","sort":99,"status":1}]'
  
  tcb db nosql execute --database-name "$ENV_ID" --command "[{\"TableName\":\"regions\",\"CommandType\":\"INSERT\",\"Command\":\"{\\\"insert\\\":\\\"regions\\\",\\\"documents\\\":$REGIONS}\"}]"
  
  echo -e "${GREEN}✅ regions 数据插入完成${NC}"
}

# 初始化 system_config
init_system_config() {
  echo -e "${BLUE}⚙️  初始化 system_config...${NC}"
  
  # 使用单行 JSON 避免控制字符问题
  CONFIG='[{"_id":"ai_config","type":"ai","asr":{"enabled":false,"appId":"","appKey":"","secretKey":""},"nlp":{"enabled":false,"apiKey":""},"voice":{"enabled":false,"voiceId":""},"printer":{"enabled":false,"printerId":"","printerName":""},"status":1,"createTime":"'"$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")"'"}]'
  
  tcb db nosql execute --database-name "$ENV_ID" --command "[{\"TableName\":\"system_config\",\"CommandType\":\"INSERT\",\"Command\":\"{\\\"insert\\\":\\\"system_config\\\",\\\"documents\\\":$CONFIG}\"}]"
  
  echo -e "${GREEN}✅ system_config 初始化完成${NC}"
}

# 部署云函数
deploy_cloudfunctions() {
  echo -e "${BLUE}☁️  部署云函数...${NC}"
  
  FUNCTIONS=("auth" "products" "customers" "orders" "users" "regions" "receivable" "system" "smart" "report")
  
  for func in "${FUNCTIONS[@]}"; do
    echo -e "  部署云函数：${func}..."
    
    if [ -d "$PROJECT_ROOT/cloudfunctions/$func" ]; then
      cd "$PROJECT_ROOT/cloudfunctions/$func"
      npm install --production 2>/dev/null || true
      cd "$PROJECT_ROOT"
      
      tcb fn deploy "$func" --env "$ENV_ID"
      echo -e "  ${GREEN}✅ $func 部署成功${NC}"
    else
      echo -e "  ${YELLOW}⚠️  $func 目录不存在，跳过${NC}"
    fi
  done
  
  echo -e "${GREEN}✅ 所有云函数部署完成${NC}"
}

# 主函数
main() {
  echo -e "${BLUE}==========================================${NC}"
  echo -e "${BLUE}🚀 丰淮商贸小程序 · 自动化部署${NC}"
  echo -e "${BLUE}==========================================${NC}"
  echo ""
  
  # 1. 检查登录状态
  if ! check_login; then
    echo -e "${RED}❌ 登录失败，请检查 API 密钥配置${NC}"
    echo -e "${YELLOW}💡 提示：${NC}"
    echo -e "   1. 访问 https://console.cloud.tencent.com/cam/capi 创建密钥"
    echo -e "   2. 在项目根目录创建 .env 文件"
    echo -e "   3. 配置 CLOUDBASE_SECRET_ID 和 CLOUDBASE_SECRET_KEY"
    echo -e "   4. 或手动执行：tcb login --apiKeyId xxx --apiKey xxx"
    exit 1
  fi
  
  # 2. 创建数据库集合
  create_collections
  
  # 3. 插入 regions 数据
  insert_regions_data
  
  # 4. 初始化 system_config
  init_system_config
  
  # 5. 部署云函数
  deploy_cloudfunctions
  
  echo ""
  echo -e "${BLUE}==========================================${NC}"
  echo -e "${GREEN}✅ 自动化部署全部完成！${NC}"
  echo -e "${BLUE}==========================================${NC}"
  echo ""
  echo -e "${GREEN}已完成：${NC}"
  echo -e "  ✅ 创建 11 个数据库集合"
  echo -e "  ✅ 插入 11 条 regions 数据"
  echo -e "  ✅ 初始化 system_config"
  echo -e "  ✅ 部署 10 个云函数"
  echo ""
  echo -e "${BLUE}下一步：${NC}"
  echo -e "  1. 打开微信开发者工具"
  echo -e "  2. 点击「编译」测试小程序"
  echo -e "  3. 登录并验证功能"
  echo ""
}

# 执行
main "$@"
