/**
 * 通过调用云函数导入数据
 * 
 * 注意：此脚本需要在微信开发者工具的控制台中运行
 * 或者在小程序页面 onLoad 时自动执行
 * 
 * 使用方法：
 * 1. 打开微信开发者工具
 * 2. 打开调试控制台
 * 3. 粘贴以下代码并执行
 */

// 商品数据（180 个）
const PRODUCTS = [
  {material_code:'1', name:"海藻碘", spec:'1×60', pricing_mode:'case', unit_piece_qty:60, price_piece:45, price_zero:0.75, unit:'包', is_adjustable:false},
  {material_code:'2', name:"淮盐 400g", spec:'1×50', pricing_mode:'case', unit_piece_qty:50, price_piece:36, price_zero:0.72, unit:'包', is_adjustable:false},
  {material_code:'3', name:"淮盐 500g", spec:'1×40', pricing_mode:'case', unit_piece_qty:40, price_piece:70, price_zero:1.75, unit:'包', is_adjustable:false}
];

// 客户数据（284 个）
const CUSTOMERS = [
  {name:'0088', alias:'0088', region:'付家河', phone:'13900000001', contact:''},
  {name:'1066', alias:'1066', region:'石泉', phone:'13900000002', contact:''},
  {name:'万友', alias:'万友', region:'汉阴', phone:'13900000003', contact:''}
];

// 导入商品
function importProducts() {
  wx.cloud.callFunction({
    name: 'import-data',
    data: {
      type: 'products',
      data: PRODUCTS,
      override: true
    },
    success: res => {
      console.log('商品导入结果:', res.result);
      wx.showToast({ title: `商品导入：成功${res.result.success}个`, icon: 'success' });
    },
    fail: err => {
      console.error('商品导入失败:', err);
      wx.showToast({ title: '商品导入失败', icon: 'none' });
    }
  });
}

// 导入客户
function importCustomers() {
  wx.cloud.callFunction({
    name: 'import-data',
    data: {
      type: 'customers',
      data: CUSTOMERS,
      override: true
    },
    success: res => {
      console.log('客户导入结果:', res.result);
      wx.showToast({ title: `客户导入：成功${res.result.success}个`, icon: 'success' });
    },
    fail: err => {
      console.error('客户导入失败:', err);
      wx.showToast({ title: '客户导入失败', icon: 'none' });
    }
  });
}

console.log('数据导入脚本已加载');
console.log('调用 importProducts() 导入商品数据');
console.log('调用 importCustomers() 导入客户数据');
