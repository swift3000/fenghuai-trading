#!/usr/bin/env node
/**
 * 全业务流程端到端自动化测试（管理员单登录态 + 云函数 QA 身份钩子模拟各角色）
 * 前置：7 个业务云函数带环境变量 QA_IMPERSONATE='1'（仅测试环境；生产置空→钩子惰性）。
 * 链路：下单员下单 → 分拣员确认分拣 → 库管确认出库(填大/中/小件) → 下单员登记收款 → 库管确认收款
 *       → 校验订单最终状态/实收 → 库单导出含物流件数 → 清理测试数据
 * 判定：每步返回 code=0 且业务字段正确；收款两步分离（登记=下单员/分拣员，确认=库管/管理员）。
 */
const path=require('path'),fs=require('fs'),os=require('os');
const PROJECT=path.resolve(__dirname,'..');
const LIB=process.env.WX_AUTOMATOR_LIB||path.join(os.homedir(),'.codex','skills','wechat-devtools-automator','scripts','lib');
const {launchSession}=require(path.join(LIB,'devtools_client.js'));
const {delay}=require(path.join(LIB,'common.js'));
const cb=require(path.join(PROJECT,'node_modules','@cloudbase','node-sdk'));
const pm=require(path.join(PROJECT,'cloudfunctions','auth','perm-matrix-shared.js'));
const env={};
fs.readFileSync(path.join(PROJECT,'.env'),'utf8').split('\n').forEach(l=>{const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);if(m)env[m[1]]=m[2].trim();});
const db=cb.init({secretId:env.CLOUDBASE_SECRET_ID,secretKey:env.CLOUDBASE_SECRET_KEY,envId:env.CLOUDBASE_ENV_ID}).database();
const DEVTOOLS_OPENID='oo0s93SW9A4V4iO1ANyA3eqzxVIA';
const BOOT_NAME='QA e2eflow bootstrap';
// T50: 云端 admin 自举（对齐 T48）。getOrder 以 devtools 真实身份读 orders.detail（需 order:view），
// T46 删占位管理员后该账号无 users 记录 -> 401 -> 读断言全失败。测试前幂等 upsert 临时 admin，退出自清理（双出口）。
async function ensureCloudAdmin(openid){
  const c=await db.collection('users').where({openid}).get();
  for(const u of c.data){
    if(u.role==='admin'){ return {created:false}; }
    if(u.name===BOOT_NAME){ await db.collection('users').where({openid}).update({role:'admin',permissions:pm.defaultPermsForRole('admin')}); return {created:false}; }
  }
  await db.collection('users').add({openid,name:BOOT_NAME,role:'admin',status:'active',permissions:pm.defaultPermsForRole('admin'),createdBy:'qa-e2eflow-test',createdAt:new Date(),updatedAt:new Date()});
  return {created:true};
}
async function cleanupBootAdmin(){
  try{ const c=await db.collection('users').where({name:BOOT_NAME}).get(); for(const u of c.data){ await db.collection('users').doc(u._id).remove(); } }catch(e){ console.warn('  (自清理) 失败: '+e.message); }
}

let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  \u2713 '+m);}else{fail++;console.log('  \u2717 '+m);}};
const QA={orderer:'qa_e2e_orderer',sorter:'qa_e2e_sorter',warehouse:'qa_e2e_warehouse'};
const CUST={_id:'1aeaf3576a7ee3870058bead57f09341',name:'万友',region:'汉阴'};

(async()=>{
  const s=await launchSession({projectPath:PROJECT,trustProject:true,timeoutMs:120000});
  await delay(4000);
  const boot=await ensureCloudAdmin(DEVTOOLS_OPENID);
  console.log('  云端 admin 自举: '+(boot.created?'新建临时 admin':'已存在复用'));
  const callAs=async (fn,action,role,data)=> s.evaluate(async (fn2,action2,oid2,d2)=>{
    try{ const d=Object.assign({action:action2},d2||{}); if(oid2) d.qaAsOpenid=oid2;
      const r=await wx.cloud.callFunction({name:fn2,data:d}); return (r&&r.result)||{};
    }catch(e){ return {__err:e.message,code:-1}; }
  }, fn,action, role?QA[role]:null, data);
  const C=(fn,action,role,data)=>callAs(fn,action,role,data);
  // 通过云函数 orders.detail 读订单（与业务侧一致的权威数据源，避免外部 node-sdk 读取的偶发不一致/陈旧）
  const getOrder=async (oid)=>{ const r=await C('orders','detail',null,{orderId:oid}); return (r&&r.code===0&&r.data)?r.data:null; };
  const sleep=async(ms)=>{ await new Promise(res=>setTimeout(res,ms)); };

  // 预置 QA 用户（完整默认权限）
  const allQa=await db.collection('users').limit(100).get();
  for(const u of allQa.data){ if((u.openid||'').indexOf('qa_e2e_')===0){ await db.collection('users').doc(u._id).remove(); } }
  for(const [role,oid] of Object.entries(QA)){
    await db.collection('users').add({openid:oid,name:'E2E_'+role,role:role,status:'active',permissions:pm.defaultPermsForRole(role),createdBy:'qa',createdAt:new Date(),updatedAt:new Date()});
  }

  console.log('\n【1】下单员创建订单（0 件商品应被拦截）');
  let r=await C('orders','create','orderer',{customerId:CUST._id,customerName:CUST.name,customerRegion:CUST.region,totalAmount:0,items:[{name:'淮盐 400g',piece_qty:0,package_qty:0,price_piece:36}]});
  ok(r.code===2001,'0 金额/0 件订单被拦截 code=2001（实际 '+r.code+'）');

  console.log('\n【2】下单员创建有效订单（淮盐 400g × 1 件 = ¥36）');
  r=await C('orders','create','orderer',{customerId:CUST._id,customerName:CUST.name,customerRegion:CUST.region,totalAmount:36,items:[{name:'淮盐 400g',pricing_mode:'case',piece_qty:1,package_qty:0,price_piece:36,price_unit:0}]});
  ok(r.code===0,'创建订单成功');
  const orderId=r.data&&r.data._id; const orderNo=r.data&&r.data.orderNo;
  ok(!!orderId&&/丰淮商贸-\d{8}-\d{4}/.test(orderNo||''),'订单号格式正确：'+orderNo);

  console.log('\n【3】分拣员确认分拣（独立于出库，不依赖出库）');
  r=await C('orders','confirmSort','sorter',{orderId});
  ok(r.code===0,'分拣员 confirmSort 成功');
  await sleep(300); let od=await getOrder(orderId);
  ok(od&&od.sortStatus==='done','订单 sortStatus=done');

  console.log('\n【4】库管确认出库（填 大件2/中件1/小件3，不依赖分拣完成）');
  r=await C('orders','confirmOut','warehouse',{orderId,ship_large:2,ship_medium:1,ship_small:3});
  ok(r.code===0,'库管 confirmOut 成功');
  await sleep(300); od=await getOrder(orderId);
  ok(od&&od.outStatus==='done','订单 outStatus=done');
  ok(od&&od.ship_large===2&&od.ship_medium===1&&od.ship_small===3,'物流件数已写入 大2/中1/小3');
  ok(od&&od.status==='confirmed','分拣+出库均完成 → status=confirmed');

  console.log('\n【5】库管登记收款应被 403（两步分离：库管无 collect 权限）');
  r=await C('receivable','collect','warehouse',{orderId,amount:10,paymentMethod:'cash'});
  ok(r.code===403,'库管 collect 403（实际 '+r.code+'）');

  console.log('\n【6】下单员登记收款 ¥10（未超剩余欠款 ¥36）');
  r=await C('receivable','collect','orderer',{orderId,amount:10,paymentMethod:'cash'});
  ok(r.code===0,'下单员 collect 成功，paymentId='+(r.data&&r.data.paymentId));
  const paymentId=r.data&&r.data.paymentId;
  await sleep(300); od=await getOrder(orderId);
  ok(od&&od.payment_status==='pending','登记后 payment_status=pending（未确认不实收）');

  console.log('\n【7】下单员确认收款应被 403（下单员无 confirm 权限）');
  r=await C('receivable','confirmPayment','orderer',{paymentId});
  ok(r.code===403,'下单员 confirmPayment 403（实际 '+r.code+'）');

  console.log('\n【8】库管确认收款 ¥10');
  r=await C('receivable','confirmPayment','warehouse',{paymentId});
  ok(r.code===0,'库管 confirmPayment 成功');
  await sleep(300); od=await getOrder(orderId);
  ok(od&&(od.received_amount||0)===10,'确认后 received_amount=10');
  ok(od&&od.payment_status==='pending','部分收款(10/36) → payment_status=pending（未结清）');

  console.log('\n【9】库单导出含物流件数（0 件不显示）');
  r=await C('orders','exportOutbound','warehouse',{timeTab:'all',format:'csv'});
  ok(r.code===0,'exportOutbound 成功，count='+(r.data&&r.data.count));
  const csv=r.data&&r.data.csvContent||'';
  ok(/大件数/.test(csv)&&/中件数/.test(csv)&&/小件数/.test(csv),'CSV 表头含 大件数/中件数/小件数');
  const line=(csv.split('\n').filter(x=>x.indexOf(orderNo)>=0));
  ok(line.length>=1 && /2,1,3/.test(line.join(',')) || line.some(x=>x.indexOf('2,1,3')>=0),'订单行物流件数=2,1,3：'+(line[0]||'(none)'));

  console.log('\n【10】补登记剩余 ¥26 并确认 → 结清');
  r=await C('receivable','collect','orderer',{orderId,amount:26,paymentMethod:'cash'});
  ok(r.code===0,'补登记 ¥26 成功');
  const paymentId2=r.data&&r.data.paymentId;
  r=await C('receivable','confirmPayment','warehouse',{paymentId:paymentId2});
  ok(r.code===0,'确认 ¥26 成功');
  await sleep(300); od=await getOrder(orderId);
  ok(od&&(od.received_amount||0)===36&&od.payment_status==='paid','实收 36 且 payment_status=paid（结清）');

  console.log('\n【11】清理测试数据（订单 + 相关 payments + QA 用户 + perm_configs）');
  try{ await db.collection('orders').doc(orderId).remove(); console.log('  - 已删订单'); }catch(e){ console.log('  - 删订单失败 '+e.message); }
  try{ const pays=await db.collection('payments').limit(100).get(); for(const p of pays.data){ if((p.orderId||p.order_id)===orderId){ await db.collection('payments').doc(p._id).remove(); } } console.log('  - 已删订单收款记录'); }catch(e){ console.log('  - 删收款失败 '+e.message); }
  const allQa2=await db.collection('users').limit(100).get();
  for(const u of allQa2.data){ if((u.openid||'').indexOf('qa_e2e_')===0){ await db.collection('users').doc(u._id).remove(); } }
  console.log('  - 已删 QA 用户');
  try{ const pc=await db.collection('perm_configs').limit(100).get(); for(const d of pc.data){ await db.collection('perm_configs').doc(d._id).remove(); } }catch(e){}
  // 校验订单确已删（经云函数 detail 读）
  await sleep(400); const chk=await getOrder(orderId);
  ok(!chk,'订单已从库中删除');

  console.log('\n==== 结果：通过 '+pass+'，失败 '+fail+' ====');
  await cleanupBootAdmin();
  await s.close();
  process.exit(fail>0?1:0);
})().catch(async e=>{ try{ await cleanupBootAdmin(); }catch(_){}
  console.error('FATAL',e.message,e.stack);process.exit(1);});
