#!/usr/bin/env node
/**
 * T53 状态机终态守卫回归（graph测试 V-1/V-2，2026-08-30）
 * 背景：confirmSort/confirmOut 曾无终态守卫——
 *   V-1 (P1): 已取消订单被 confirmSort/confirmOut "复活" 回出库流，穿透"已取消不可变更"红线
 *   V-2 (P2): 已出库订单重复 confirmOut 静默覆盖 ship 件数，污染库单导出
 * 前置：QA_IMPERSONATE=1（qa-toggle.js on）。纯 node-sdk 直调，不占开发者工具。
 * 用例：
 *   1. 造 TEST 订单 → 合法分拣/出库走通（守卫不误伤正常流）
 *   2. cancelled 订单调 confirmSort → 必须 3002 拒绝且状态不变
 *   3. cancelled 订单调 confirmOut  → 必须 3002 拒绝且状态不变
 *   4. 已出库订单重复 confirmOut → code=0 幂等 + 件数不被覆盖
 *   5. 清理 TEST 数据 + data-consistency 复核
 */
const path=require('path'),fs=require('fs');
const PROJECT=path.resolve(__dirname,'..');
const cb=require(path.join(PROJECT,'node_modules','@cloudbase','node-sdk'));
const env={};
fs.readFileSync(path.join(PROJECT,'.env'),'utf8').split('\n').forEach(l=>{const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);if(m)env[m[1]]=m[2].trim();});
const app=cb.init({secretId:env.CLOUDBASE_SECRET_ID,secretKey:env.CLOUDBASE_SECRET_KEY,envId:env.CLOUDBASE_ENV_ID});
const db=app.database();
const ADMIN_OPENID='oo0s93SW9A4V4iO1ANyA3eqzxVIA'; // devtools 登录态 admin（对齐 wx-role-sim-test.js）
const QA_ORDERER='qa_test_orderer_001';
const pm=require(path.join(PROJECT,'cloudfunctions','auth','perm-matrix-shared.js'));
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  \u2713 '+m);}else{fail++;console.log('  \u2717 '+m);}};
const C=async (fn,d)=>{try{const r=await app.callFunction({name:fn,data:d});return (r&&r.result)||{};}catch(e){return {__err:e.message,code:-1};}};

(async()=>{
  // 预置 QA 下单员（幂等：存在则复用；对齐 wx-role-sim-test.js 的预置口径）
  const exist=await db.collection('users').where({openid:QA_ORDERER}).limit(1).get();
  if(!exist.data.length){
    await db.collection('users').add({openid:QA_ORDERER,name:'QA_orderer',role:'orderer',status:'active',permissions:pm.defaultPermsForRole('orderer'),createdBy:'qa-state-guard',createdAt:new Date(),updatedAt:new Date()});
  }
  const custRes=await C('customers',{action:'create',name:'TEST_状态机守卫客户',contact:'qa',phone:'13800001111',region:'陕西',qaAsOpenid:QA_ORDERER});
  const cid=custRes.data&&(custRes.data._id||custRes.data.customerId);
  const created=[];
  try{
    if(!cid){ throw new Error('造客户失败: '+JSON.stringify(custRes).slice(0,150)); }
    const o1=await C('orders',{action:'create',customerId:cid,customerName:'TEST_状态机守卫客户',qaAsOpenid:QA_ORDERER,
      items:[{piece_qty:2,package_qty:0,price_piece:10,pricing_mode:'piece'}],totalAmount:20});
    if(o1.code!==0) throw new Error('造订单失败: '+JSON.stringify(o1).slice(0,150));
    const oid=o1.data._id||o1.data.orderId; created.push(oid);

    // 1. 合法流不误伤：submitted → sorted → confirmed
    const s1=await C('orders',{action:'confirmSort',orderId:oid,qaAsOpenid:QA_ORDERER});
    ok(s1.code===0,'合法 confirmSort 放行（submitted→sorted）');
    const o2=await C('orders',{action:'confirmOut',orderId:oid,ship_large:1,ship_medium:0,ship_small:0,qaAsOpenid:QA_ORDERER});
    ok(o2.code===0,'合法 confirmOut 放行（→confirmed）');

    // 2. cancelled 守卫用一条全新未分拣订单（初始 sortStatus/outStatus=pending，断言才干净）
    const oC=await C('orders',{action:'create',customerId:cid,customerName:'TEST_状态机守卫客户',qaAsOpenid:QA_ORDERER,
      items:[{piece_qty:1,package_qty:0,price_piece:10,pricing_mode:'piece'}],totalAmount:10});
    const oidC=oC.data._id||oC.data.orderId; created.push(oidC);
    const ca=await C('orders',{action:'update-status',orderId:oidC,status:'cancelled',reason:'T53 回归',qaAsOpenid:ADMIN_OPENID});
    ok(ca.code===0,'admin 取消订单成功');
    const g1=await C('orders',{action:'confirmSort',orderId:oidC,qaAsOpenid:QA_ORDERER});
    ok(g1.code===3002,'cancelled 订单 confirmSort 被 3002 拒绝（V-1 防复活）');
    // node-sdk doc().get() 返回 {data:[doc]}，取 data[0]
    let r1=(await db.collection('orders').doc(oidC).get()).data[0];
    ok(r1.status==='cancelled','拒绝后状态仍为 cancelled（sortStatus 未动）');
    ok(r1.sortStatus!=='done','sortStatus 未被翻成 done');

    // 3. cancelled 不可 confirmOut
    const g2=await C('orders',{action:'confirmOut',orderId:oidC,ship_large:9,ship_medium:9,ship_small:9,qaAsOpenid:QA_ORDERER});
    ok(g2.code===3002,'cancelled 订单 confirmOut 被 3002 拒绝（V-1 防复活）');
    r1=(await db.collection('orders').doc(oidC).get()).data[0];
    ok(r1.outStatus!=='done','outStatus 未被翻成 done');

    // 4. 已出库订单重复 confirmOut = 幂等，件数不覆盖
    const o3=await C('orders',{action:'create',customerId:cid,customerName:'TEST_状态机守卫客户',qaAsOpenid:QA_ORDERER,
      items:[{piece_qty:3,package_qty:0,price_piece:10,pricing_mode:'piece'}],totalAmount:30});
    const oid2=o3.data._id||o3.data.orderId; created.push(oid2);
    const out1=await C('orders',{action:'confirmOut',orderId:oid2,ship_large:3,ship_medium:2,ship_small:1,qaAsOpenid:QA_ORDERER});
    ok(out1.code===0,'首次 confirmOut 成功');
    const out2=await C('orders',{action:'confirmOut',orderId:oid2,ship_large:9,ship_medium:9,ship_small:9,qaAsOpenid:QA_ORDERER});
    ok(out2.code===0 && out2.data&&out2.data.alreadyOutbound===true,'重复 confirmOut 幂等返回 alreadyOutbound（V-2）');
    const r2=(await db.collection('orders').doc(oid2).get()).data[0];
    ok(r2.ship_large===3 && r2.ship_medium===2 && r2.ship_small===1,'件数未被覆盖（3/2/1 保持，V-2）');
  } finally {
    for(const id of created){
      await db.collection('orders').doc(id).remove().catch(()=>{});
    }
    // 收款流水兜底清理（本用例未收款，防御性）
    const p=await db.collection('payments').where({orderNo:db.RegExp({regexp:'TEST',options:''})}).get().catch(()=>({data:[]}));
    for(const x of p.data){ await db.collection('payments').doc(x._id).remove().catch(()=>{}); }
    if(cid){ await db.collection('customers').doc(cid).remove().catch(()=>{}); }
  }
  // 5. 对账复核
  const audit=require('child_process').spawnSync('node',[path.join(PROJECT,'tests','data-consistency-audit.js')],{encoding:'utf8'});
  const auditOk=(audit.stdout||'').includes('通过 12');
  ok(auditOk,'清理后数据对账 12/12 全绿');
  console.log('\n==== 结果：通过 '+pass+'，失败 '+fail+' ====');
  process.exit(fail?1:0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
