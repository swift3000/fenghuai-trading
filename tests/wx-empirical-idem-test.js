#!/usr/bin/env node
/**
 * T11 幂等专项验收（闭环"真机验收"项）：
 *  1. 造 TEST 订单 → 同一 clientToken 连续 2 次 collect → payments 只新增 1 条 pending，返回同一 paymentId
 *  2. 同一 paymentId 连续 2 次 confirmPayment → received_amount 只累加 1 次
 *  3. 清理全部 TEST 数据（where 删除，不用 doc 定位）
 *  订单读取统一走云函数 orders/detail（与真实应用同路径；node-sdk 直查 .doc() 在本环境读取不一致，不作断言依据）。
 * 前置：QA 钩子已开（QA_IMPERSONATE=1）。
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
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  \u2713 '+m);}else{fail++;console.log('  \u2717 '+m);}};
const ORDERER='qa_test_orderer_001';
const WARE='qa_test_warehouse_001';
const TAG='TEST_IDEM';
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

// T51c: 云端 admin 自举（对齐 T50）。getOrder 用 devtools 真实身份（无 qaAsOpenid），
// T46 删占位管理员后 401 → 订单读 null → received_amount/payment_status 断言假失败。
const DEVTOOLS_OPENID="oo0s93SW9A4V4iO1ANyA3eqzxVIA";
const BOOT_NAME="QA idem bootstrap";
async function ensureCloudAdmin(openid){
  const c=await db.collection("users").where({openid}).get();
  for(const u of c.data){
    if(u.role==="admin"){ return {created:false}; }
    if(u.name===BOOT_NAME){ await db.collection("users").doc(u._id).update({role:"admin",permissions:pm.defaultPermsForRole("admin")}); return {created:false}; }
  }
  await db.collection("users").add({openid,name:BOOT_NAME,role:"admin",status:"active",permissions:pm.defaultPermsForRole("admin"),createdBy:"qa-idem-test",createdAt:new Date(),updatedAt:new Date()});
  return {created:true};
}
async function cleanupBootAdmin(){
  try{ const c=await db.collection("users").where({name:BOOT_NAME}).get(); for(const u of c.data){ await db.collection("users").doc(u._id).remove(); } }
  catch(e){}
  try{ const q=await db.collection("users").where({name:db.RegExp({regexp:"^QA_"})}).limit(20).get(); for(const u of q.data){ await db.collection("users").doc(u._id).remove(); } }catch(e){}
}

(async()=>{
  const s=await launchSession({projectPath:PROJECT,trustProject:true,timeoutMs:90000});
  await delay(4000);
  const boot=await ensureCloudAdmin(DEVTOOLS_OPENID);
  console.log("  云端 admin 自举: "+(boot.created?"新建临时 admin":"已存在复用"));
  for(const [oid,role] of [[ORDERER,'orderer'],[WARE,'warehouse']]){
    const us=await db.collection('users').where({openid:oid}).limit(1).get();
    if(!us.data.length){
      await db.collection('users').add({openid:oid,name:'QA_'+role,role:role,status:'active',permissions:pm.defaultPermsForRole(role),createdBy:'qa',createdAt:new Date(),updatedAt:new Date()});
    }
  }
  const call=async (fn,data,roleOid)=> s.evaluate(async (fn2,d2,oid)=>{
    try{ const r=await wx.cloud.callFunction({name:fn2,data:Object.assign({},d2,{qaAsOpenid:oid})}); return (r&&r.result)||{}; }
    catch(e){ return {__err:e.message,code:-1}; }
  }, fn, data, roleOid);
  const getOrder=async oid=>{ const r=await call('orders',{action:'detail',orderId:oid},WARE); return (r&&r.code===0&&r.data)?r.data:null; };

  // 先清理历史残留（前几轮失败的 TEST 订单）
  await db.collection('payments').where({client_token:db.RegExp({regexp:TAG})}).remove().catch(()=>{});
  await db.collection('orders').where({customerName:TAG+'_\u5ba2\u6237'}).remove().catch(()=>{});

  const cRes=await call('orders',{action:'create',customerName:TAG+'_\u5ba2\u6237',totalAmount:50,items:[{name:TAG+'_\u5546\u54c1',pricing_mode:'piece',piece_qty:1,package_qty:0,price_piece:50,price_unit:0}]},ORDERER);
  const oid=cRes.data&&cRes.data._id;
  ok(!!oid,'\u9020 TEST \u8ba2\u5355 '+oid+(cRes.message?'\uff08'+cRes.message+'\uff09':''));
  if(!oid){ console.log('==== \u7ed3\u679c\uff1a\u901a\u8fc7 '+pass+'\uff0c\u5931\u8d25 '+fail+' ===='); await cleanupBootAdmin(); process.exit(1); }

  const tok=TAG+'_tok1';
  const c1=await call('receivable',{action:'collect',orderId:oid,amount:50,clientToken:tok},ORDERER);
  const c2=await call('receivable',{action:'collect',orderId:oid,amount:50,clientToken:tok},ORDERER);
  ok(c1.code===0,'\u9996\u6b21 collect \u6210\u529f'+(c1.message?'\uff08'+c1.message+'\uff09':''));
  ok(c2.code===0&&c2.data&&c2.data.reused===true,'\u540c token \u4e8c\u6b21 collect \u547d\u4e2d\u5e42\u7b49\u590d\u7528');
  ok(!!(c1.data&&c2.data&&c1.data.paymentId===c2.data.paymentId),'\u4e24\u6b21\u8fd4\u56de\u540c\u4e00 paymentId');

  const pays=await db.collection('payments').where({order_id:oid}).limit(10).get();
  ok(pays.data.length===1,'payments \u53ea 1 \u6761\uff08\u53cc\u51fb\u4e0d\u91cd\u590d\u767b\u8bb0\uff09 \u5b9e\u9645='+pays.data.length);

  const pid=c1.data&&c1.data.paymentId;
  const f1=await call('receivable',{action:'confirmPayment',paymentId:pid},WARE);
  const f2=await call('receivable',{action:'confirmPayment',paymentId:pid},WARE);
  ok(f1.code===0,'\u9996\u6b21 confirmPayment \u6210\u529f'+(f1.message?'\uff08'+f1.message+'\uff09':''));
  ok(f2.code===0,'\u91cd\u590d confirmPayment \u5e42\u7b49\u8fd4\u56de\u6210\u529f');
  await sleep(400);
  const od=await getOrder(oid);
  const ra=(od&&(od.received_amount||od.receivedAmount))||0;
  ok(Math.round(ra*100)===5000,'\u786e\u8ba4\u540e received_amount=50.00 \u53ea\u7d2f\u52a0 1 \u6b21 \u5b9e\u9645='+ra);
  ok(od&&od.payment_status==='paid','\u7ed3\u6e05\u540e payment_status=paid \u5b9e\u9645='+(od&&od.payment_status));

  // 清理（where 删除，避免 doc 定位在本环境读空）
  await db.collection('payments').where({order_id:oid}).remove().catch(()=>{});
  await db.collection('orders').where({customerName:TAG+'_\u5ba2\u6237'}).remove().catch(()=>{});
  await sleep(200);
  const left=await db.collection('orders').where({customerName:TAG+'_\u5ba2\u6237'}).limit(5).get();
  const leftP=await db.collection('payments').where({client_token:db.RegExp({regexp:TAG})}).limit(5).get();
  ok(left.data.length===0&&leftP.data.length===0,'TEST \u8ba2\u5355+\u6536\u6b3e\u6570\u636e\u5df2\u6e05\u7406 orders='+left.data.length+' pays='+leftP.data.length);

  console.log('==== \u7ed3\u679c\uff1a\u901a\u8fc7 '+pass+'\uff0c\u5931\u8d25 '+fail+' ====');
  await cleanupBootAdmin();
  process.exit(fail?1:0);
})().catch(async e=>{ try{ await cleanupBootAdmin(); }catch(_){}
  console.error('FATAL',e.message);process.exit(1);});
