#!/usr/bin/env node
/**
 * T59-R10 CSV 公式注入回归（graph测试 R10 真端到端，2026-08-31）
 * 背景：R10 发现旧 /tmp 一次性测试的注入断言是假阴性（客户名 = 号不在开头，
 *   sanitizeCell 按规则不转义，断言落空）——防注入逻辑本身有效，但回归套件
 *   从未真正验证过注入转义。本脚本把断言修正为【单元格以 = / + 开头】的真注入向量，
 *   走真实云函数链路（customers/orders/report 均 callFunction，非桩）。
 * 前置：QA_IMPERSONATE=1（qa-toggle.js on），与 order-state-guard-test.js 同档。
 * 用例：
 *   1. 无 report:export 权限用户 export/exportLedger → 403
 *   2. 造 =cmd / +cmd 开头客户名 + 各挂一条订单（report customer tab 只聚合有订单客户）
 *   3. report export(customer) 真实导出：注入单元格被 ' 前缀转义；全表无裸 =/+/@ 开头单元格
 *   4. exportLedger / exportReceivable 导出链路 code=0（统一走带防护的 toCSV 出口）
 *   5. 清理 TEST 客户/订单 + 残留归零断言
 */
const path=require('path'),fs=require('fs');
const PROJECT=path.resolve(__dirname,'..');
const cb=require(path.join(PROJECT,'node_modules','@cloudbase','node-sdk'));
const env={};
fs.readFileSync(path.join(PROJECT,'.env'),'utf8').split('\n').forEach(l=>{const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);if(m)env[m[1]]=m[2].trim();});
const app=cb.init({secretId:env.CLOUDBASE_SECRET_ID,secretKey:env.CLOUDBASE_SECRET_KEY,envId:env.CLOUDBASE_ENV_ID});
const db=app.database();
const ADMIN_OPENID='oo0s93SW9A4V4iO1ANyA3eqzxVIA'; // devtools 登录态 admin（对齐 wx-role-sim-test.js）
const QA_NOEXPORT='qa_noexport_csv_001';
const INJ1='=cmdTEST_CSV_INJ'; // 必须 = 开头才是真实 Excel 公式注入向量
const INJ2='+cmdTEST_CSV_INJ';
const INJ_RE=db.RegExp({regexp:'cmdTEST_CSV_INJ',options:'i'});
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  \u2713 '+m);}else{fail++;console.log('  \u2717 '+m);}};
const C=async (fn,d)=>{try{const r=await app.callFunction({name:fn,data:d});return (r&&r.result)||{};}catch(e){return {__err:e.message,code:-1};}};
const lines=s=>String(s||'').split('\n');
const created={orders:[],customers:[]};

(async()=>{
  // 预置无导出权限用户（仅 receivable:view，幂等复用）
  const ex=await db.collection('users').where({openid:QA_NOEXPORT}).limit(1).get();
  if(!ex.data.length){
    await db.collection('users').add({openid:QA_NOEXPORT,name:'QA_无导出权限',role:'orderer',status:'active',permissions:['receivable:view'],createdBy:'qa-csv-injection',createdAt:new Date(),updatedAt:new Date()});
  }

  console.log('== [1] 权限门禁：无 report:export 用户 → 403 ==');
  const g1=await C('report',{action:'export',reportTab:'customer',timeTab:'all',format:'csv',qaAsOpenid:QA_NOEXPORT});
  ok(g1.code===403,'export 被 403 拒（code='+g1.code+'）');
  const g2=await C('report',{action:'exportLedger',timeTab:'all',format:'csv',qaAsOpenid:QA_NOEXPORT});
  ok(g2.code===403,'exportLedger 被 403 拒（code='+g2.code+'）');

  console.log('== [2] 造注入向量客户 + 挂订单（report customer tab 只聚合有订单客户）==');
  const ids=[];
  for(const inj of [INJ1,INJ2]){
    const cc=await C('customers',{action:'create',name:inj,region:'测试区',phone:'13800000001',contact:'qa',qaAsOpenid:ADMIN_OPENID});
    const cid=cc.data&&(cc.data._id||cc.data.customerId);
    ok(!!cid,'客户创建成功（'+inj+'）');
    if(!cid) continue;
    created.customers.push(cid);
    const oo=await C('orders',{action:'create',customerId:cid,customerName:inj,customerRegion:'测试区',qaAsOpenid:ADMIN_OPENID,
      items:[{name:'注入向量行',spec:'',pricing_mode:'piece',piece_qty:1,package_qty:0,price_piece:10,price_unit:0}]});
    const oid=oo.data&&(oo.data._id||oo.data.orderId);
    ok(!!oid,'订单创建成功（'+oo.data&&oo.data.orderNo+'）');
    if(oid){ created.orders.push(oid); ids.push(oid); }
  }

  console.log('== [3] 真实导出断言：转义生效 + 无裸公式单元格 ==');
  const rep=await C('report',{action:'export',reportTab:'customer',timeTab:'all',format:'csv',qaAsOpenid:ADMIN_OPENID});
  const csv=rep.data&&rep.data.csvContent||'';
  ok(csv.indexOf(INJ1)>-1&&csv.indexOf(INJ2)>-1,'两个注入客户真实出现在导出中');
  ok(csv.indexOf("'"+INJ1)>-1,'= 开头单元格被 \' 前缀转义');
  ok(csv.indexOf("'"+INJ2)>-1,'+ 开头单元格被 \' 前缀转义');
  const bare=lines(csv).some(l=>l.split(',').some(c=>{const t=c.trim();return /^=/.test(t)||/^\+/.test(t)||/^@/.test(t);}));
  ok(!bare,'全表无裸 =/+/@ 开头单元格（Excel 公式注入向量消除）');

  console.log('== [4] 其余导出链路 code=0（统一走带防护的 toCSV 出口）==');
  const ld=await C('report',{action:'exportLedger',timeTab:'all',format:'csv',qaAsOpenid:ADMIN_OPENID});
  ok(ld.code===0,'exportLedger code=0');
  const rc=await C('receivable',{action:'exportReceivable',timeTab:'all',format:'csv',qaAsOpenid:ADMIN_OPENID});
  ok(rc.code===0,'exportReceivable code=0');

  console.log('== [5] 清理 TEST 客户/订单 + 残留归零 ==');
  for(const oid of created.orders){ const d=await C('orders',{action:'delete',orderId:oid,qaAsOpenid:ADMIN_OPENID}); if(d.code!==0) console.log('  ! 订单删除返回',JSON.stringify(d).slice(0,120)); }
  for(const cid of created.customers){ const d=await C('customers',{action:'delete',customerId:cid,qaAsOpenid:ADMIN_OPENID}); if(d.code!==0) console.log('  ! 客户删除返回',JSON.stringify(d).slice(0,120)); }
  // T59-R13：预置的 QA 无导出权限用户也必须清理（否则 data-consistency 审计[7] 报权限快照漂移）
  const qex=await db.collection('users').where({openid:QA_NOEXPORT}).get();
  for(const u of (qex.data||[])){ try{ await db.collection('users').doc(u._id).remove(); }catch(e){ console.log('  ! QA用户删除异常',e.message); } }
  const lc=await db.collection('customers').where({name:INJ_RE}).get();
  const lo=await db.collection('orders').where({customerName:INJ_RE}).get();
  const lq=await db.collection('users').where({openid:QA_NOEXPORT}).get();
  ok((lc.data||[]).length===0&&(lo.data||[]).length===0&&((lq.data||[]).length===0),'残留归零（客户='+(lc.data||[]).length+' 订单='+(lo.data||[]).length+' QA用户='+(lq.data||[]).length+'）');

  console.log('RESULT pass='+pass+' fail='+fail);
  process.exit(fail===0?0:1);
})().catch(e=>{console.log('ERROR '+e.message+'\n'+(e.stack||''));process.exit(1);});
