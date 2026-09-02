
const path=require('path'),fs=require('fs');
const PROJECT='/Users/god/Desktop/项目/github/fenghuai-trading';
const env={};fs.readFileSync(path.join(PROJECT,'.env'),'utf8').split('\n').forEach(l=>{const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);if(m)env[m[1]]=m[2].trim();});
const cb=require(path.join(PROJECT,'node_modules','@cloudbase','node-sdk'));
const app=cb.init({secretId:env.CLOUDBASE_SECRET_ID,secretKey:env.CLOUDBASE_SECRET_KEY,envId:env.CLOUDBASE_ENV_ID});
const db=app.database();
const ADMIN='oo0s93SW9A4V4iO1ANyA3eqzxVIA';
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  PASS '+m);}else{fail++;console.log('  FAIL '+m);}};
const C=async(fn,d)=>{try{const r=await app.callFunction({name:fn,data:d});return (r&&r.result)||{};}catch(e){return {__err:e.message,code:-1};}};
(async()=>{
  console.log('== T63-1 products/delete 不存在 → 4004');
  const r1=await C('products',{action:'delete',productId:'nonexistent_xyz',qaAsOpenid:ADMIN});
  ok(r1.code===4004,'got '+r1.code+' '+(r1.message||''));
  const r1b=await C('products',{action:'delete',qaAsOpenid:ADMIN});
  ok(r1b.code===4001,'缺参 → 4001, got '+r1b.code);

  console.log('== T63-2 customers/update 不存在 → 4004');
  const r2=await C('customers',{action:'update',customerId:'nonexistent_xyz',name:'x',qaAsOpenid:ADMIN});
  ok(r2.code===4004,'got '+r2.code+' '+(r2.message||''));

  console.log('== T63-3 paymentHistory 缺 customerId → 1001');
  const r3=await C('receivable',{action:'paymentHistory',qaAsOpenid:ADMIN});
  ok(r3.code===1001,'got '+r3.code+' '+(r3.message||''));

  console.log('== T63-4 import-data/sync-data 错误带 code');
  const r4a=await C('import-data',{action:'verify'});
  ok(r4a.code===403,'import-data 无权限 → code=403, got '+r4a.code);
  const r4b=await C('sync-data',{action:'sync-all'});
  ok(r4b.code===403,'sync-data 无权限 → code=403, got '+r4b.code);
  // import-data/sync-data 用真实 OPENID 做 admin 门禁，不吃 QA 仿冒钩子：
  // 非 admin 直调恒 403（安全门禁，已验证）；admin+未知操作分支(code:1001)无法经 node-sdk 直调触达，属测试通道限制
  const r4c=await C('import-data',{action:'no-such-action'});
  ok(r4c.code===403,'import-data 非admin 未知操作 → 403 门禁, got '+r4c.code);

  console.log('== T63-5 report/summary 非法 reportTab → 1001');
  const r5=await C('report',{action:'summary',reportTab:'bogus_tab',qaAsOpenid:ADMIN});
  ok(r5.code===1001,'got '+r5.code+' '+(r5.message||''));

  console.log('== T63-6 exportSingleOrder/printOrder 不存在 → 4004');
  const r6a=await C('orders',{action:'exportSingleOrder',orderId:'nonexistent_xyz',qaAsOpenid:ADMIN});
  ok(r6a.code===4004,'exportSingleOrder got '+r6a.code);
  const r6b=await C('orders',{action:'printOrder',orderId:'nonexistent_xyz',qaAsOpenid:ADMIN});
  ok(r6b.code===4004,'printOrder got '+r6b.code);

  console.log('== T63-7 订单前缀可配置（默认乾多多）');
  const cfg=await C('system',{action:'getAiConfig',qaAsOpenid:ADMIN});
  ok(cfg.code===0 && cfg.data && typeof cfg.data.orderPrefix==='string','getAiConfig 返回 orderPrefix='+cfg.data&&cfg.data.orderPrefix);
  // 造一单验证前缀=配置值
  const cust=await C('customers',{action:'create',name:'TEST_T63前缀客户',contact:'qa',phone:'13800003333',region:'陕西',qaAsOpenid:ADMIN});
  const cid=cust.data&&(cust.data._id||cust.data.customerId);
  if(!cid){ ok(false,'造客户失败 '+JSON.stringify(cust).slice(0,120)); }
  else{
    const o=await C('orders',{action:'create',customerId:cid,customerName:'TEST_T63前缀客户',qaAsOpenid:ADMIN,
      items:[{piece_qty:1,package_qty:0,price_piece:10,pricing_mode:'piece'}],totalAmount:10});
    const oid=o.data&&(o.data._id||o.data.orderId);
    const on=o.data&&o.data.orderNo;
    ok(!!oid && /^乾多多-\d{8}-\d{4}$/.test(on||''),'新单 orderNo='+on+'（默认前缀乾多多）');
    // 改前缀再造单
    const up=await C('system',{action:'updateAiConfig',orderPrefix:'丰淮商贸',qaAsOpenid:ADMIN});
    ok(up.code===0,'updateAiConfig orderPrefix 成功 code='+up.code);
    const o2=await C('orders',{action:'create',customerId:cid,customerName:'TEST_T63前缀客户',qaAsOpenid:ADMIN,
      items:[{piece_qty:1,package_qty:0,price_piece:10,pricing_mode:'piece'}],totalAmount:10});
    const on2=o2.data&&o2.data.orderNo;
    ok(/^丰淮商贸-\d{8}-\d{4}$/.test(on2||''),'改前缀后新单 orderNo='+on2);
    // 恢复默认
    await C('system',{action:'updateAiConfig',orderPrefix:'乾多多',qaAsOpenid:ADMIN});
    // 清理
    try{
      await db.collection('orders').doc(oid).remove();
      if(o2.data&&o2.data._id) await db.collection('orders').doc(o2.data._id).remove();
      await db.collection('customers').doc(cid).remove();
      console.log('  已清理 2 单 + 1 客户');
    }catch(e){ console.log('  清理告警 '+e.message); }
  }

  console.log('== T63-9 collect amount 归一（传 10.005 → 按 10.01 落库口径不 1001）');
  const cust2=await C('customers',{action:'create',name:'TEST_T63归一客户',contact:'qa',phone:'13800004444',region:'陕西',qaAsOpenid:ADMIN});
  const cid2=cust2.data&&(cust2.data._id||cust2.data.customerId);
  if(cid2){
    const o3=await C('orders',{action:'create',customerId:cid2,customerName:'TEST_T63归一客户',qaAsOpenid:ADMIN,
      items:[{piece_qty:1,package_qty:0,price_piece:20,pricing_mode:'piece'}],totalAmount:20});
    const oid3=o3.data&&(o3.data._id||o3.data.orderId);
    const r9=await C('receivable',{action:'collect',orderId:oid3,amount:'10.005',paymentMethod:'cash',note:'T63归一回归',qaAsOpenid:ADMIN});
    ok(r9.code===0,'amount=10.005 归一后通过 code='+r9.code+' '+(r9.message||''));
    // 落库值应=10.01
    const p=await db.collection('payments').where({orderId:oid3,client_token:/^auto_/}).limit(5).get().catch(()=>({data:[]}));
    const p2=await db.collection('payments').where({order_id:oid3}).limit(5).get().catch(()=>({data:[]}));
    const rows=[].concat(p.data||[],p2.data||[]);
    const rec=rows.find(x=>x.amount!=null);
    ok(rec && Number(rec.amount)===10.01,'落库 amount='+(rec&&rec.amount)+'（应 10.01）');
    // 清理
    try{
      for(const x of rows){ if(String(x.note||'').indexOf('T63归一')>=0) await db.collection('payments').doc(x._id).remove(); }
      await db.collection('orders').doc(oid3).remove();
      await db.collection('customers').doc(cid2).remove();
      console.log('  已清理');
    }catch(e){ console.log('  清理告警 '+e.message); }
  } else ok(false,'造归一客户失败');

  console.log('\n结果: '+pass+' 通过, '+fail+' 失败');
  process.exit(fail?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});

