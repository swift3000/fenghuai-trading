/**
 * 收款边界逻辑回归测试（连云端真实环境）
 * 重点：已登记未确认的 pending 收款必须占额，防止多笔待确认收款累计超出剩余欠款
 * 运行：node tests/e2e-receivable-test.js  （会自建测试订单并清理，不污染真实数据）
 */
const cloudbase = require("@cloudbase/node-sdk")
const fs = require("fs"), path = require("path")
const env = {}
for (const l of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim() }
const app = cloudbase.init({ secretId: env.CLOUDBASE_SECRET_ID, secretKey: env.CLOUDBASE_SECRET_KEY, envId: env.CLOUDBASE_ENV_ID })
const db = app.database()
const QA_OID = "oo0s93SW9A4V4iO1ANyA3eqzxVIA"; // QA impersonation: real admin (only effective when cloud fn env QA_IMPERSONATE=1)
const invoke = (n, d) => app.callFunction({ name: n, data: Object.assign({}, d, { qaAsOpenid: QA_OID }) }).then(r => r.result)
let total = 0, passed = 0
const check = (name, pass, detail) => { total++; if (pass) passed++; console.log((pass ? "✅" : "❌") + " " + name + (detail && !pass ? " — " + String(detail).slice(0, 120) : "")) }
const mkOrder = async (name) => (await invoke("orders", { action: "create", customerName: name, totalAmount: 100, items: [{ name: "测试品", piece_qty: 1, zero_qty: 0, price_piece: 100, pricing_mode: "case", unit: "包", amount: 100 }] })).data._id
const cleanup = async (oids) => { for (const o of oids) { await invoke("orders", { action: "delete", orderId: o }) } }
;(async () => {
  const oids = []
  try {
    // 场景1：一次性结清（80实收 + 20折价 = 100），之后任何收款都应被拦截
    const o1 = await mkOrder("回归-结清"); oids.push(o1)
    let r = await invoke("receivable", { action: "collect", orderId: o1, amount: 80, paymentMethod: "cash", discount: 20 })
    check("结清单：登记80+折价20 成功", r.code === 0, JSON.stringify(r))
    r = await invoke("receivable", { action: "collect", orderId: o1, amount: 1, paymentMethod: "cash" })
    check("结清单：再收1元被拦截(剩余¥0.00)", r.code === 4002 && /0\.00/.test(r.message), JSON.stringify(r))
    r = await invoke("receivable", { action: "collect", orderId: o1, amount: 50, paymentMethod: "cash" })
    check("结清单：再收50元被拦截", r.code === 4002, JSON.stringify(r))

    // 场景2：分笔收款，待确认收款也要占额
    const o2 = await mkOrder("回归-分笔"); oids.push(o2)
    r = await invoke("receivable", { action: "collect", orderId: o2, amount: 30, paymentMethod: "cash" })
    check("分笔单：先收30 成功", r.code === 0, JSON.stringify(r))
    r = await invoke("receivable", { action: "collect", orderId: o2, amount: 70, paymentMethod: "cash" })
    check("分笔单：再收70(恰好补满剩余70) 放行", r.code === 0, JSON.stringify(r))
    r = await invoke("receivable", { action: "collect", orderId: o2, amount: 1, paymentMethod: "cash" })
    check("分笔单：补满后再收1 被拦截", r.code === 4002, JSON.stringify(r))

    // 场景3：确认收款后订单转 paid，实收/折价落库正确
    const o3 = await mkOrder("回归-确认"); oids.push(o3)
    await invoke("receivable", { action: "collect", orderId: o3, amount: 80, paymentMethod: "cash", discount: 20 })
    const pc = await invoke("receivable", { action: "pendingConfirm" })
    const mine = (pc.data || []).filter(p => p.orderId === o3 || p.order_id === o3)
    check("确认单：待确认列表含该笔", mine.length === 1, JSON.stringify(mine).slice(0, 80))
    const cp = await invoke("receivable", { action: "confirmPayment", paymentId: mine[0]._id, orderId: o3 })
    check("确认单：确认收款成功", cp.code === 0, JSON.stringify(cp))
    const det = await invoke("orders", { action: "detail", orderId: o3 })
    const o = det.data
    check("确认单：订单转 paid 且 实收80 折价20", o.payment_status === 'paid' && (o.received_amount || o.receivedAmount) === 80 && (o.total_discount || o.totalDiscount) === 20, 'status=' + o.payment_status + ' rec=' + (o.received_amount||o.receivedAmount) + ' disc=' + (o.total_discount||o.totalDiscount))
  } catch (e) {
    check("测试异常: " + e.message, false)
  } finally {
    await cleanup(oids).catch(() => {})
  }
  console.log(`\n汇总: ${passed}/${total} 通过`)
  process.exit(passed === total ? 0 : 1)
})().catch(e => { console.error("FATAL", e.message); process.exit(1) })
