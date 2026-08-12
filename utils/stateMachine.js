/**
 * 状态机工具类
 * 订单状态和收款状态的流转校验
 */

const { ORDER_STATUS, PAYMENT_STATUS } = require('../constants/index.js')

/**
 * 订单状态流转规则
 * 定义每个状态可以流转到的目标状态
 */
const ORDER_TRANSITIONS = {
  draft: ['submitted', 'cancelled'],
  submitted: ['sorted', 'rejected', 'cancelled'],
  sorted: ['confirmed', 'rejected'],
  confirmed: ['completed'],
  completed: [],
  cancelled: [],
  rejected: ['draft']
}

/**
 * 收款状态流转规则
 */
const PAYMENT_TRANSITIONS = {
  unpaid: ['pending'],
  pending: ['paid', 'unpaid'],
  paid: ['pending']
}

/**
 * 检查订单状态是否可以流转
 * @param {string} currentStatus - 当前状态
 * @param {string} targetStatus - 目标状态
 * @returns {object} - { valid: boolean, message: string }
 */
function canTransitionOrderStatus(currentStatus, targetStatus) {
  if (!ORDER_STATUS.includes(currentStatus)) {
    return { valid: false, message: `无效的当前状态：${currentStatus}` }
  }
  
  if (!ORDER_STATUS.includes(targetStatus)) {
    return { valid: false, message: `无效的目标状态：${targetStatus}` }
  }
  
  const allowedTransitions = ORDER_TRANSITIONS[currentStatus] || []
  if (!allowedTransitions.includes(targetStatus)) {
    return { 
      valid: false, 
      message: `订单状态无法从 "${currentStatus}" 流转至 "${targetStatus}"` 
    }
  }
  
  return { valid: true, message: '状态流转成功' }
}

/**
 * 检查收款状态是否可以流转
 * @param {string} currentStatus - 当前状态
 * @param {string} targetStatus - 目标状态
 * @returns {object} - { valid: boolean, message: string }
 */
function canTransitionPaymentStatus(currentStatus, targetStatus) {
  if (!PAYMENT_STATUS.includes(currentStatus)) {
    return { valid: false, message: `无效的当前收款状态：${currentStatus}` }
  }
  
  if (!PAYMENT_STATUS.includes(targetStatus)) {
    return { valid: false, message: `无效的目标收款状态：${targetStatus}` }
  }
  
  const allowedTransitions = PAYMENT_TRANSITIONS[currentStatus] || []
  if (!allowedTransitions.includes(targetStatus)) {
    return { 
      valid: false, 
      message: `收款状态无法从 "${currentStatus}" 流转至 "${targetStatus}"` 
    }
  }
  
  return { valid: true, message: '状态流转成功' }
}

/**
 * 获取订单状态的所有可能目标状态
 * @param {string} currentStatus - 当前状态
 * @returns {string[]} - 目标状态数组
 */
function getOrderPossibleTransitions(currentStatus) {
  return ORDER_TRANSITIONS[currentStatus] || []
}

/**
 * 获取收款状态的所有可能目标状态
 * @param {string} currentStatus - 当前状态
 * @returns {string[]} - 目标状态数组
 */
function getPaymentPossibleTransitions(currentStatus) {
  return PAYMENT_TRANSITIONS[currentStatus] || []
}

/**
 * 获取订单状态文本
 * @param {string} status - 状态值
 * @returns {string} - 状态文本
 */
function getOrderStatusText(status) {
  const { ORDER_STATUS_TEXT } = require('../constants/index.js')
  return ORDER_STATUS_TEXT[status] || status
}

/**
 * 获取收款状态文本
 * @param {string} status - 状态值
 * @returns {string} - 状态文本
 */
function getPaymentStatusText(status) {
  const { PAYMENT_STATUS_TEXT } = require('../constants/index.js')
  return PAYMENT_STATUS_TEXT[status] || status
}

/**
 * 获取订单状态颜色
 * @param {string} status - 状态值
 * @returns {string} - 颜色值
 */
function getOrderStatusColor(status) {
  const { ORDER_STATUS_COLOR } = require('../constants/index.js')
  return ORDER_STATUS_COLOR[status] || '#999'
}

/**
 * 获取收款状态颜色
 * @param {string} status - 状态值
 * @returns {string} - 颜色值
 */
function getPaymentStatusColor(status) {
  const { PAYMENT_STATUS_COLOR } = require('../constants/index.js')
  return PAYMENT_STATUS_COLOR[status] || '#999'
}

module.exports = {
  canTransitionOrderStatus,
  canTransitionPaymentStatus,
  getOrderPossibleTransitions,
  getPaymentPossibleTransitions,
  getOrderStatusText,
  getPaymentStatusText,
  getOrderStatusColor,
  getPaymentStatusColor,
  ORDER_TRANSITIONS,
  PAYMENT_TRANSITIONS
}
