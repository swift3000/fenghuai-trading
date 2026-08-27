#!/usr/bin/env node
/**
 * T52 P3-1：清除 regions 集合历史脏数据（一次性脚本，幂等可重跑）
 * 根因：早期 node-sdk doc().set 口径混用，写入 {data:{...}} 嵌套结构 + 一条 {status:1} 孤儿
 * 影响面核验（2026-08-27 全仓 rg）：
 *   - regions 云函数：无前端调用方
 *   - customers 云函数 type:'regions'：前端不消费
 *   - 报表页区域选项：来自订单 customerRegion 快照，不读此集合
 * 客户区域数据独立存于 customers.region（名称字符串），删除不丢业务数据
 * 备份：docs/reports/backups/regions-删除前备份-20260827.json（12 条全量）
 * 幂等：空集合时 count=0 直接退出 0，可重复执行
 */
const path = require('path'), fs = require('fs');
const PROJECT = path.resolve(__dirname, '..');
const cb = require(path.join(PROJECT, 'node_modules/@cloudbase/node-sdk'));
const env = {};
fs.readFileSync(path.join(PROJECT, '.env'), 'utf8').split('\n').forEach(l => { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].trim(); });
const db = cb.init({ secretId: env.CLOUDBASE_SECRET_ID, secretKey: env.CLOUDBASE_SECRET_KEY, envId: env.CLOUDBASE_ENV_ID }).database();
(async () => {
  const before = await db.collection('regions').count();
  if (before.total === 0) { console.log('regions 集合已为空，无需清洗（幂等退出）'); process.exit(0); }
  let deleted = 0;
  for (;;) {
    const batch = await db.collection('regions').limit(100).get();
    if (!batch.data.length) break;
    for (const it of batch.data) {
      await db.collection('regions').doc(it._id).remove();
      deleted++;
    }
  }
  const after = await db.collection('regions').count();
  console.log(`清洗完成：删除 ${deleted} 条，剩余 ${after.total} 条`);
  if (after.total !== 0) { console.error('❌ 残留未清干净，请复查'); process.exit(1); }
  console.log('✅ regions 集合已清空（备份见 docs/reports/backups/regions-删除前备份-20260827.json）');
})().catch(e => { console.error('清洗失败', e); process.exit(2); });
