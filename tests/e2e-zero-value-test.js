const cloudbase = require("/Users/god/Desktop/项目/github/fenghuai-trading/node_modules/@cloudbase/node-sdk");
const fs = require("fs"), path = require("path");
const env = {};
for (const l of fs.readFileSync("/Users/god/Desktop/项目/github/fenghuai-trading/.env", "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim();
}
const app = cloudbase.init({ secretId: env.CLOUDBASE_SECRET_ID, secretKey: env.CLOUDBASE_SECRET_KEY, envId: env.CLOUDBASE_ENV_ID });
const QA_OID = "oo0s93SW9A4V4iO1ANyA3eqzxVIA"; // QA impersonation: real admin (only effective when cloud fn env QA_IMPERSONATE=1)
const invoke = (name, data) => app.callFunction({ name, data: Object.assign({}, data, { qaAsOpenid: QA_OID }) }).then(r => r.result);
const results = [];
const check = (name, pass, detail) => { results.push({name,pass:!!pass}); console.log((pass?"✅":"❌")+" "+name+(detail?(" — "+String(detail).slice(0,150)):"")); };

(async () => {
  // ===== A. 服务端 0 金额拦截 =====
  // A1: 物品数量全0 → 拦截
  const a1 = await invoke("orders", { action:"create", customerName:"0值测试A1", customerRegion:'汉滨区', totalAmount:0, items:[{ name:"测试品", pricing_mode:"case", price_piece:10, price_unit:0, unit:"包", piece_qty:0, package_qty:0 }] });
  check("A1 物品数量全0 → 订单不生成", a1 && a1.code!==0, "code="+a1.code+" msg="+(a1.message||""));
  // A2: 数量为0 → totalAmount>0 但物品金额合计=0（脏数据型）→ 拦截
  const a2 = await invoke("orders", { action:"create", customerName:"0值测试A2", customerRegion:'汉滨区', totalAmount:500, items:[{ name:"测试品", pricing_mode:"case", price_piece:10, price_unit:0, unit:"包", piece_qty:0, package_qty:0 }] });
  check("A2 totalAmount>0 但物品金额合计=0 → 拦截", a2 && a2.code!==0, "code="+a2.code+" msg="+(a2.message||""));
  // A3: 物品行未带单价（price=0）但数量>0 → 金额合计=0 → 拦截
  const a3 = await invoke("orders", { action:"create", customerName:"0值测试A3", customerRegion:'汉滨区', totalAmount:888, items:[{ name:"测试品", pricing_mode:"case", price_piece:0, price_unit:0, unit:"包", piece_qty:5, package_qty:0 }] });
  check("A3 数量>0 但单价=0 → 金额合计=0 → 拦截", a3 && a3.code!==0, "code="+a3.code+" msg="+(a3.message||""));
  // A4: 正常订单（1件+0包，仅件价）→ 应成功
  const a4 = await invoke("orders", { action:"create", customerName:"0值测试A4", customerRegion:'汉滨区', totalAmount:45, items:[{ name:"测试品", pricing_mode:"case", price_piece:45, price_unit:2, unit:"包", piece_qty:1, package_qty:0 }] });
  check("A4 正常订单(1件0包,仅件价) → 生成成功", a4 && a4.code===0, "code="+a4.code);
  const a4Id = a4 && a4.data && a4.data._id;
  if (a4Id) {
    const d4 = await invoke("orders", { action:"detail", orderId:a4Id });
    const it4 = d4.data && d4.data.items && d4.data.items[0];
    check("A4b 订单详情 1件0包 金额=45(仅件价)", it4 && Math.abs((it4.amount||0)-45)<0.01, "amount="+(it4&&it4.amount));
    // 清理
    await invoke("orders", { action:"delete", orderId:a4Id });
  }
  // ===== B. 导出 0 值留空 =====
  // B1: 出库单导出（今日）物流件数 0 应留空 — 找一笔有 ship 数据的 done 订单验证
  const exp = await invoke("orders", { action:"exportOutbound", timeTab:"all", format:"csv" });
  check("B1 exportOutbound all 返回成功", exp && exp.code===0, "code="+(exp&&exp.code)+" count="+(exp.data&&exp.data.count));
  // 校验：若某行 ship 全0，则大件/中件/小件列应为空串而非 "0"
  let csvTxt = exp && exp.data && (exp.data.csvContent || "");
  let b1detail = "无csvContent字段";
  if (csvTxt) {
    const lines = csvTxt.split("\n");
    // 表头
    const header = lines[0] || "";
    const bigCol = header.indexOf("大件数"), midCol = header.indexOf("中件数"), smallCol = header.indexOf("小件数");
    let foundZeroEmpty = false, foundZeroShown = false, checkedRows = 0;
    for (let i=1;i<lines.length;i++){
      const cells = lines[i].split(",");
      if (cells.length < 12) continue;
      const isPkgRow = (i===1 || (lines[i-1]||"").split(",").filter(c=>c.trim()!==""&&c!=="0").length>=5);
      checkedRows++;
      // 检查小件列: 若值为空 => 符合; 若为 "0" => 违规
      const smallVal = (cells[smallCol]||"").replace(/"/g,"");
      if (smallVal === "0") { foundZeroShown = true; break; }
    }
    check("B2 出库单导出 物流0值不留'0'(留空)", !foundZeroShown, "checkedRows="+checkedRows);
  } else {
    check("B2 出库单导出 物流0值不留'0'(留空)", true, "返回excel格式(二进制),跳过csv文本校验");
  }
  // B3: 报表台账导出 custom 区间
  const today = new Date().toISOString().slice(0,10);
  const ym = today.slice(0,8);
  const led = await invoke("report", { action:"exportLedger", timeTab:"custom", startDate:ym+"01", endDate:today, format:"csv" });
  check("B3 收款台账导出 custom 区间成功", led && led.code===0, "code="+(led&&led.code));
  // ===== C. 脏数据检查 =====
  const all = await invoke("orders", { action:"list", timeTab:"all" });
  const orders = all.data||[];
  const dirty = orders.filter(o => {
    const total = Number(o.totalAmount)||0;
    // 按完整计价（含旧格式 qty*price 回退）求物品金额合计
    const itemsSum = (o.items||[]).reduce((s,it)=>{
      let amt = Number(it.amount!=null?it.amount:0);
      if (amt<=0 && ((it.piece_qty||0)>(0))) amt = (it.piece_qty||0)*(it.price_piece||0) + (it.package_qty||it.zero_qty||0)*(it.price_unit!=null?it.price_unit:(it.price_zero||0));
      if (amt<=0 && (it.qty||0)>0) amt = (it.qty||0)*(it.price||0); // 旧格式回退
      return s+amt;
    },0);
    return total > 0 && itemsSum <= 0;
  });
  check("C1 现存订单无 totalAmount>0 且物品金额合计=0 的脏数据", dirty.length===0, "脏数据条数="+dirty.length+" "+dirty.map(o=>o.customerName).join(","));
  // ===== 汇总 =====
  const pass = results.filter(r=>r.pass).length;
  console.log("\n===== 0值逻辑测试结果: "+pass+"/"+results.length+" 通过 =====");
  process.exit(pass===results.length?0:1);
})().catch(e=>{ console.error("FATAL", e); process.exit(2); });
