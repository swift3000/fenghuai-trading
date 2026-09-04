/**
 * 全局常量定义
 */

// ============ 系统配置 ============
// 公司名称：用于打印/销售单模板标题、订单号前缀、报表标题
const COMPANY_NAME = '钱多多'

const ORDER_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  SORTED: 'sorted',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected'
}

const ORDER_STATUS_TEXT = {
  draft: '草稿',
  submitted: '待分拣',
  sorted: '已分拣',
  confirmed: '已出库',
  completed: '已完成',
  cancelled: '已取消',
  rejected: '已驳回'
}

const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  PENDING: 'pending',
  PAID: 'paid'
}

const PAYMENT_STATUS_TEXT = {
  unpaid: '未付款',
  pending: '待确认',
  paid: '已结清'
}

const USER_ROLES = {
  ORDERER: 'orderer',
  SORTER: 'sorter',
  WAREHOUSE: 'warehouse',
  ADMIN: 'admin'
}

const USER_ROLE_TEXT = {
  orderer: '下单员',
  sorter: '分拣员',
  warehouse: '库管',
  admin: '管理员'
}

const FONT_SIZE_SCALES = [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3]

module.exports = {
  COMPANY_NAME,
  ORDER_STATUS,
  ORDER_STATUS_TEXT,
  PAYMENT_STATUS,
  PAYMENT_STATUS_TEXT,
  USER_ROLES,
  USER_ROLE_TEXT,
  FONT_SIZE_SCALES
}
