const cloudbase = require("@cloudbase/node-sdk");
const fs = require("fs"), path = require("path");
const env = {};
for (const l of fs.readFileSync(path.join("/Users/god/Desktop/项目/github/fenghuai-trading/.env"), "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim();
}
const app = cloudbase.init({ secretId: env.CLOUDBASE_SECRET_ID, secretKey: env.CLOUDBASE_SECRET_KEY, envId: env.CLOUDBASE_ENV_ID });
const db = app.database();
const invoke = (name, data) => app.callFunction({ name, data }).then(r => r.result);
const results = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass }); console.log((pass ? "✅" : "❌") + " " + name + (detail ? " — " + String(detail).slice(0, 150) : "")); };
(async () => {
  // 1. 创建测试订单（下单员视角模拟，后台 OPENID 为空跳过权限）
  const createRes = await invoke("orders", { action: "create", customerName: "E2E测试客户", customerRegion: '汉滨区', totalAmount: 92.25, items: [{ material_code: "1", name: "海藻碘", spec: "1×60", pricing_mode: "case", unit_piece_qty: 60, price_piece: 45, price_unit: 0.75, unit: "包", piece_qty: 2, zero_qty: 3 }], orderDate: new Date().toISOString().slice(0, 10) });
  check("创建订单", createRes && createRes.code === 0, JSON.stringify(createRes).slice(0, 120));
  const orderId = createRes && createRes.data && (createRes.data.orderId || createRes.data._id || (createRes.data.order && createRes.data.order._id));
  const orderNo = createRes && createRes.data && createRes.data.orderNo;
  console.log("orderId=", orderId, "orderNo=", orderNo);
  // 2. 详情
  const detailRes = await invoke("orders", { action: "detail", orderId });
  const order = detailRes && detailRes.data;
  check("订单详情含金额与数量", order && (order.totalAmount != null || order.total_amount != null), JSON.stringify(order).slice(0, 150));
  // 3. 分拣确认
  const sortRes = await invoke("orders", { action: "confirmSort", orderId });
  check("分拣确认", sortRes && sortRes.code === 0, JSON.stringify(sortRes).slice(0, 100));
  // 4. 库管确认出库 + 物流件数（大/中/小）
  const outRes = await invoke("orders", { action: "confirmOut", orderId, batchMode: false, ship_large: 1, ship_medium: 1, ship_small: 1 });
  check("库管确认出库(含物流件数)", outRes && outRes.code === 0, JSON.stringify(outRes).slice(0, 100));
  const d2 = await invoke("orders", { action: "detail", orderId });
  const o2 = d2 && d2.data;
    const lg = { big: o2 && o2.ship_large, mid: o2 && o2.ship_medium, small: o2 && o2.ship_small }
  check("详情返回物流件数(ship_large/medium/small)", lg.big === 1 && lg.mid === 1 && lg.small === 1, JSON.stringify(lg));
  check("出库状态 outStatus=done 且 status 派生正确", o2 && o2.outStatus === 'done' && ['confirmed','sorted'].includes(o2.status), 'outStatus=' + (o2 && o2.outStatus) + ' status=' + (o2 && o2.status) + ' sortStatus=' + (o2 && o2.sortStatus));
  // 5. 导出出库单 Excel + CSV（后台调用）
  const exExcel = await invoke("orders", { action: "exportOutbound", format: "excel" });
  check("导出出库单 Excel", exExcel && exExcel.code === 0 && exExcel.data && (exExcel.data.fileID || exExcel.data.fileId), JSON.stringify(exExcel).slice(0, 120));
  const exCsv = await invoke("orders", { action: "exportOutbound", format: "csv" });
  const csv = exCsv && exCsv.data && exCsv.data.csvContent || "";
  check("导出出库单 CSV 含物流包裹列", exCsv && exCsv.code === 0 && /物流|大件/.test(csv), csv.split("\n")[0].slice(0, 120));
  // 6. 单订单导出（销售单）Excel
  const so = await invoke("orders", { action: "exportSingleOrder", orderId, format: "excel" });
  check("单订单销售单 Excel", so && so.code === 0 && so.data && (so.data.fileID || so.data.fileId), JSON.stringify(so).slice(0, 120));
  // 7. 打印数据
  const pr = await invoke("orders", { action: "printOrder", orderId, format: "excel" });
  check("打印送货单", pr && pr.code === 0, JSON.stringify(pr).slice(0, 120));
  // 8. 报表 summary + 三种导出
  const sum = await invoke("report", { action: "summary", reportTab: "product", timeTab: "all" });
  check("报表 summary", sum && sum.code === 0, JSON.stringify(sum).slice(0, 100));
  const r1 = await invoke("report", { action: "export", reportTab: "product", timeTab: "all", format: "csv" });
  check("报表导出 CSV", r1 && r1.code === 0, JSON.stringify(r1).slice(0, 100));
  const r2 = await invoke("report", { action: "exportDailySummary", format: "excel" });
  check("客户汇总表 Excel", r2 && r2.code === 0 && r2.data && (r2.data.fileID || r2.data.fileId), JSON.stringify(r2).slice(0, 100));
  const r3 = await invoke("report", { action: "exportLedger", format: "excel" });
  check("收款台账 Excel", r3 && r3.code === 0, JSON.stringify(r3).slice(0, 100));
  // 9. 收款看板（0 条数据也不该崩）
  const dash = await invoke("receivable", { action: "dashboard" });
  check("收款看板(空数据不崩)", dash && dash.code === 0, JSON.stringify(dash).slice(0, 100));
  const pc = await invoke("receivable", { action: "pendingConfirm" });
  check("待确认收款列表", pc && pc.code === 0, JSON.stringify(pc).slice(0, 80));
  // 10. outbound 双列表
  const ps = await invoke("outbound", { action: "pendingSortList" });
  check("待分拣列表", ps && ps.code === 0, JSON.stringify(ps).slice(0, 80));
  const po = await invoke("outbound", { action: "pendingOutList" });
  check("待出库列表", po && po.code === 0, JSON.stringify(po).slice(0, 80));
  // 11. 删除测试订单
  const del = await invoke("orders", { action: "delete", orderId });
  check("清理测试订单", del && del.code === 0, JSON.stringify(del).slice(0, 80));
  const passed = results.filter(r => r.pass).length;
  console.log(`\n汇总: ${passed}/${results.length} 通过`);
  fs.writeFileSync("/tmp/e2e-results.json", JSON.stringify(results, null, 2));
  process.exit(0);
})().catch(e => { console.error("FATAL", e); process.exit(1); });
