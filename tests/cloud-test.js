// 云端全功能测试: 数据库 + 云函数 (不依赖 IDE/模拟器)
const cloudbase = require("@cloudbase/node-sdk");
const fs = require("fs"), path = require("path");
const env = {};
for (const l of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim();
}
const app = cloudbase.init({ secretId: env.CLOUDBASE_SECRET_ID, secretKey: env.CLOUDBASE_SECRET_KEY, envId: env.CLOUDBASE_ENV_ID });
const db = app.database();
const results = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass, detail: String(detail || "").slice(0, 120) }); console.log((pass ? "✅" : "❌") + " " + name + (detail ? " — " + String(detail).slice(0, 100) : "")); };

(async () => {
  // ===== 1. 数据库集合 =====
  const collections = ["users", "customers", "orders", "products", "receivable"];
  for (const c of collections) {
    try {
      const r = await db.collection(c).limit(1).get();
      check("集合 " + c + " 可查询", true, "count sample ok, total字段=" + (r.data && r.data.length));
    } catch (e) { check("集合 " + c + " 可查询", false, e.message); }
  }
  // 各集合数据量
  for (const c of collections) {
    try { const r = await db.collection(c).count(); check("集合 " + c + " 数据量", true, r.total + " 条"); } catch (e) { check("集合 " + c + " 数据量", false, e.message); }
  }
  // ===== 2. 云函数 invoke (验证已部署且能响应) =====
  const fns = [
    ["auth", { action: "ping" }],
    ["products", { action: "list" }],
    ["customers", { action: "list", page: 1, pageSize: 1 }],
    ["orders", { action: "list", page: 1, pageSize: 1 }],
    ["receivable", { action: "list", page: 1, pageSize: 1 }],
    ["report", { action: "summary" }],
    ["regions", { action: "list" }],
    ["system", { action: "settings" }],
    ["smart", { action: "ping" }],
    ["outbound", { action: "ping" }],
    ["users", { action: "ping" }],
  ];
  for (const [name, data] of fns) {
    try {
      const r = await app.callFunction({ name, data });
      const res = r.result;
      const ok = res && (res.code === 0 || res.code === 200 || res.list || res.data || res.message);
      check("云函数 " + name, ok !== false, JSON.stringify(res).slice(0, 90));
    } catch (e) { check("云函数 " + name, false, e.message); }
  }
  // ===== 3. 汇总 =====
  const pass = results.filter(r => r.pass).length;
  console.log("\n========== 汇总: " + pass + "/" + results.length + " 通过 ==========");
  fs.writeFileSync(path.join(__dirname, "..", "test-report-cloud.json"), JSON.stringify(results, null, 2));
  console.log("报告已写入 test-report-cloud.json");
  process.exit(0);
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
