const cloudbase = require("@cloudbase/node-sdk");
const fs = require("fs"), path = require("path");
const env = {};
for (const l of fs.readFileSync(path.join("/Users/god/Desktop/项目/github/fenghuai-trading/.env"), "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim();
}
const app = cloudbase.init({ secretId: env.CLOUDBASE_SECRET_ID, secretKey: env.CLOUDBASE_SECRET_KEY, envId: env.CLOUDBASE_ENV_ID });
const QA_OID = "oo0s93SW9A4V4iO1ANyA3eqzxVIA"; // QA impersonation: real admin (only effective when cloud fn env QA_IMPERSONATE=1)
const invoke = (name, data) => app.callFunction({ name, data: Object.assign({}, data, { qaAsOpenid: QA_OID }) }).then(r => r.result);
const results = [];
const check = (name, pass, detail) => { results.push({name,pass:!!pass}); console.log((pass?"✅":"❌")+" "+name+(detail?(" — "+String(detail).slice(0,140)):"")); };
const today = new Date().toISOString().slice(0,10);
const ym = today.slice(0,8);

(async () => {
  // T72 修复：创建真实客户（report customer tab 有"无 customerId 孤儿订单不参与聚合"的脏数据防护，
  // 原脚本只传 customerName → 期望值把孤儿单算进去、云函数正确返回 0，假 FAIL）
  const tc = await invoke("customers", { action:"create", name:"区间测试客户", region:"测试区" });
  const tcid = tc && tc.data && (tc.data.customerId||tc.data._id||tc.data.id);
  // ===== 报表自定义区间 =====
  // 1. 本月区间(当月)应有数据
  const sumMonth = await invoke("report", { action:"summary", reportTab:"product", timeTab:"custom", startDate:ym+"01", endDate:today });
  check("报表summary custom 本月区间(有数据)", sumMonth && sumMonth.code===0 && (sumMonth.data.products||[]).length>0, "products="+(sumMonth.data&&sumMonth.data.products||[]).length);
  // 2. 空区间(2020)应0
  const sumEmpty = await invoke("report", { action:"summary", reportTab:"product", timeTab:"custom", startDate:"2020-01-01", endDate:"2020-01-31" });
  check("报表summary custom 空区间=0", sumEmpty && sumEmpty.code===0 && (sumEmpty.data.products||[]).length===0, "products="+(sumEmpty.data&&sumEmpty.data.products||[]).length);
  // 3. 算账一致(客户视图按 order.totalAmount 求和 == 本月订单总额)
  const allOrders = await invoke("orders", { action:"list", timeTab:"all" });
  const orders = (allOrders.data||[]).filter(o=>{ const d=new Date(o.created_at); const iso=d.toISOString().slice(0,10); return iso>=ym+"01" && iso<=today; });
  const expectAmt = Math.round(orders.reduce((s,o)=>s+(o.totalAmount||0),0)*100)/100;
  const sumCust = await invoke("report", { action:"summary", reportTab:"customer", timeTab:"custom", startDate:ym+"01", endDate:today });
  const gotAmt = sumCust && sumCust.data && Math.round((sumCust.data.totalAmount||0)*100)/100;
  check("算账一致: 客户视图custom本月总额 == 本月订单金额和", expectAmt===gotAmt, "期望"+expectAmt+" 实得"+gotAmt);
  // 4. 导出CSV 文件名含区间 + 金额一致
  const exp = await invoke("report", { action:"export", reportTab:"customer", timeTab:"custom", startDate:ym+"01", endDate:today, format:"csv" });
  const d = exp && exp.data || {};
  check("报表导出custom 文件名含区间", /_20\d{2}-\d{2}-\d{2}_20\d{2}-\d{2}-\d{2}_/.test(d.filename||""), d.filename);
  // CSV 各行采购金额之和 == 本月订单totalAmount
  const rows = (d.csvContent||"").split("\n").filter(r=>r).slice(1).map(r=>r.split(","));
  const csvAmt = Math.round(rows.reduce((s,r)=>s+parseFloat(r[4]||0),0)*100)/100;
  check("算账一致: 客户汇总表CSV金额和 == 本月订单金额和", expectAmt===csvAmt, "期望"+expectAmt+" 实得"+csvAmt);
  // ===== 出库库单导出时间范围 =====
  // 创建一个订单并出库填件数, 验证 exportOutbound 三种范围
  const c = await invoke("orders", { action:"create", customerId:tcid, customerName:"区间测试客户", customerRegion:"测试区", totalAmount:100, items:[{material_code:"9",name:"测试品",pricing_mode:"case",piece_qty:2,zero_qty:0,price_piece:50}], orderDate:today });
  const oid = c && c.data && (c.data.orderId||c.data._id);
  check("创建出库测试订单", c && c.code===0, c.message);
  if (oid) {
    await invoke("orders", { action:"confirmSort", orderId:oid });
    await invoke("orders", { action:"confirmOut", orderId:oid, batchMode:false, ship_large:2, ship_medium:0, ship_small:3 });
    // today 范围应含(今天创建今天出库)
    const oToday = await invoke("orders", { action:"exportOutbound", format:"csv", timeTab:"today" });
    check("exportOutbound today 含今日出库", oToday && oToday.code===0 && (oToday.data.count||0)>=1, "count="+(oToday.data&&oToday.data.count));
    const csvT = (oToday.data&&oToday.data.csvContent||"");
    check("库单含大件/中件/小件列", /大件数,中件数,小件数/.test(csvT), csvT.split("\n")[0]);
    // 该单 medium=0 应在行内显示空(0不显示)
    check("库单中件=0不显示(空值,大2/中0/小3)", /2,,3/.test(csvT), csvT.split("\n").slice(-2).join("|"));
    // 空区间
    const oEmpty = await invoke("orders", { action:"exportOutbound", format:"csv", timeTab:"custom", startDate:"2020-01-01", endDate:"2020-01-31" });
    check("exportOutbound custom 空区间=0", oEmpty && oEmpty.code===0 && (oEmpty.data.count||0)===0, "count="+(oEmpty.data&&oEmpty.data.count));
    // 全部范围
    const oAll = await invoke("orders", { action:"exportOutbound", format:"csv", timeTab:"all" });
    check("exportOutbound all 含全部已出库", oAll && oAll.code===0 && (oAll.data.count||0)>=1, "count="+(oAll.data&&oAll.data.count));
    // 清理
    await invoke("orders", { action:"delete", orderId:oid });
  }
  // T72 清理：测试客户
  if (tcid) await invoke("customers", { action:"delete", customerId:tcid });
  const pass = results.filter(r=>r.pass).length;
  console.log("\n汇总: "+pass+"/"+results.length+" 通过");
  process.exit(pass===results.length?0:1);
})().catch(e=>{ console.error("FATAL", e.message); process.exit(1); });
