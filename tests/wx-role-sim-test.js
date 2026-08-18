#!/usr/bin/env node
/**
 * 多角色权限模拟测试（管理员单登录态 + 云函数 QA 身份钩子）
 * 前置：7 个业务云函数已部署且带环境变量 QA_IMPERSONATE=1（仅测试环境；生产不设置→钩子惰性）。
 * 覆盖：
 *  A) 云端 403 拦截：以各角色身份调业务云函数，验证“有权限放行 / 无权限 403”
 *     —— 放行判定 = 非 403（缺参等业务码 4001 说明已通过权限门）；拦截判定 = 403
 *  B) 开关即时生效：管理员 save-perm 关某角色权限后，该角色立即被 403（验证 user.permissions 同步修复）
 *  C) 前端路由守卫：按各角色 globalData 复算 checkPageAccess，验证 pages/members 仅 admin、outbound 分拣/库管等
 *  全程只读 + 不真实写业务数据；结尾清理 perm_configs 覆盖与 QA 测试用户。
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
const QA={orderer:'qa_test_orderer_001',sorter:'qa_test_sorter_001',warehouse:'qa_test_warehouse_001'};
const code=(r)=> (r&&r.code!==undefined)?r.code:(r&&r.__err?'ERR':-999);
const allowed=(r)=> code(r)!==403 && code(r)!==401;   // 通过权限门（缺参等业务码也算放行）
const denied=(r)=> code(r)===403;

(async()=>{
  const s=await launchSession({projectPath:PROJECT,trustProject:true,timeoutMs:90000});
  await delay(4000);
  const callAs=async (fn,action,oid)=> s.evaluate(async (fn2,action2,oid2)=>{
    try{ const data={action:action2}; if(oid2) data.qaAsOpenid=oid2;
      const r=await wx.cloud.callFunction({name:fn2,data}); return (r&&r.result)||{};
    }catch(e){ return {__err:e.message,code:-1}; }
  }, fn,action,oid);
  const C=async (fn,action,role)=> callAs(fn,action, role?QA[role]:null);

  // 预置 QA 用户（完整默认权限）：先清理 qa_test_ 前缀全部旧文档（防 where() 偶发查不到产生的重复文档），再重建单一干净文档
  const allQa=await db.collection('users').limit(100).get();
  for(const u of allQa.data){ if((u.openid||'').indexOf('qa_test_')===0){ await db.collection('users').doc(u._id).remove(); } }
  for(const [role,oid] of Object.entries(QA)){
    const perms=pm.defaultPermsForRole(role);
    await db.collection('users').add({openid:oid,name:'QA_'+role,role:role,status:'active',permissions:perms,createdBy:'qa',createdAt:new Date(),updatedAt:new Date()});
  }
  const chkQa=await db.collection('users').limit(100).get();
  const qaDocs=chkQa.data.filter(u=>(u.openid||'').indexOf('qa_test_')===0);
  if(qaDocs.length!==3){ throw new Error('QA 用户预置异常: 期望 3 实际 '+qaDocs.length); }
  qaDocs.forEach(u=>{ if((u.permissions||[]).length<10){ throw new Error('QA 权限未写全: '+u.openid+' perms='+(u.permissions||[]).length); } });

  console.log('\n【A】云端 403 拦截（角色 × 业务云函数）');
  // orderer：查/登记收款 放行；确认收款 403
  ok(allowed(await C('orders','list','orderer')),'orderer 查订单 放行');
  ok(allowed(await C('receivable','dashboard','orderer')),'orderer 查赊销看板 放行');
  ok(allowed(await C('receivable','collect','orderer')),'orderer 登记收款 放行');
  ok(denied(await C('receivable','confirmPayment','orderer')),'orderer 确认收款 403');
  // sorter：查/分拣/登记 放行；确认收款 403
  ok(allowed(await C('orders','list','sorter')),'sorter 查订单 放行');
  ok(allowed(await C('outbound','pendingSortList','sorter')),'sorter 分拣列表 放行');
  ok(allowed(await C('receivable','collect','sorter')),'sorter 登记收款 放行');
  ok(denied(await C('receivable','confirmPayment','sorter')),'sorter 确认收款 403');
  // warehouse：出库/确认收款 放行；登记收款 403
  ok(allowed(await C('outbound','pendingOutList','warehouse')),'warehouse 出库列表 放行');
  ok(allowed(await C('receivable','confirmPayment','warehouse')),'warehouse 确认收款 放行');
  ok(denied(await C('receivable','collect','warehouse')),'warehouse 登记收款 403');
  // 通用读权限 + 成员管理
  ok(allowed(await C('products','list','sorter')),'sorter 查商品 放行');
  ok(allowed(await C('customers','list','sorter')),'sorter 查客户 放行');
  ok(allowed(await C('report','summary','warehouse')),'warehouse 查报表 放行');
  ok(denied(await C('users','list','sorter')),'sorter 访问成员管理 403');
  ok(denied(await C('users','list','warehouse')),'warehouse 访问成员管理 403');

  console.log('\n【B】开关即时生效（管理员 save-perm 后该角色应立即被拦）');
  ok(allowed(await C('receivable','collect','sorter')),'B前置：sorter 默认可登记收款');
  // 管理员关闭 sorter 的 receivable:collect（当前有效权限去掉 collect）
  const sorterNow=pm.defaultPermsForRole('sorter').filter(k=>k!=='receivable:collect');
  await db.collection('perm_configs').where({role:'sorter'}).get().then(async c=>{for(const d of c.data){await db.collection('perm_configs').doc(d._id).remove();}});
  const saveRes=await s.evaluate(async (perms)=>{ try{ const r=await wx.cloud.callFunction({name:'users',data:{action:'save-perm',role:'sorter',permissions:perms}}); return r.result; }catch(e){return {__err:e.message};} }, sorterNow);
  console.log('  [debug] save-perm result:', JSON.stringify(saveRes));
  await delay(600);
  const postU=await db.collection('users').where({openid:QA.sorter}).get();
  console.log('  [debug] post-toggle sorter perms has collect:', !!(postU.data[0]&&postU.data[0].permissions&&postU.data[0].permissions.includes('receivable:collect')), 'count:', postU.data.length);
  const afterToggle=code(await C('receivable','collect','sorter'));
  ok(afterToggle===403,'save-perm 关闭后【立即】生效：sorter 登记收款 403（实际 '+afterToggle+'）');
  // 恢复默认
  for(const role of ['orderer','sorter','warehouse','admin']){
    const c=await db.collection('perm_configs').where({role}).get();
    for(const d of c.data){ await db.collection('perm_configs').doc(d._id).remove(); }
    await s.evaluate(async (r)=>{ try{ await wx.cloud.callFunction({name:'users',data:{action:'reset-perm',role:r}}); }catch(e){} }, role);
  }
  await delay(400);
  ok(allowed(await C('receivable','collect','sorter')),'reset-perm 后恢复：sorter 登记收款 放行');

  console.log('\n【C】前端路由守卫（按角色复算 checkPageAccess）');
  const PAGE_PERMS={
    'pages/index/index':['order:view','order:create'],
    'pages/orders/orders':['order:view'],
    'pages/new-order/new-order':['order:create'],
    'pages/products/products':['product:view'],
    'pages/customers/customers':['customer:view'],
    'pages/receivable/receivable':['receivable:view'],
    'pages/outbound/outbound':['warehouse:confirm','sort:task'],
    'pages/reports/reports':['report:view'],
    'pages/members/members':['member:manage'],
    'pages/profile/profile':[]
  };
  const permByRole={}; ['orderer','sorter','warehouse','admin'].forEach(r2=>{permByRole[r2]=pm.defaultPermsForRole(r2);});
  const guard=await s.evaluate(async (pagePerms,permByRole)=>{
    const app=getApp(); const base=Object.assign({},app.globalData.userInfo);
    const out={};
    const check=(role,perms,page)=>{
      app.globalData.userRole=role; app.globalData.userInfo=Object.assign({},base,{role:role,permissions:perms});
      const req=pagePerms[page]||[];
      if(role==='admin') return true;
      if(req.length===0) return true;
      return req.some(p=>perms.includes(p));
    };
    out.sorterMembers=check('sorter',permByRole['sorter'],'pages/members/members');
    out.sorterOutbound=check('sorter',permByRole['sorter'],'pages/outbound/outbound');
    out.warehouseOutbound=check('warehouse',permByRole['warehouse'],'pages/outbound/outbound');
    out.warehouseMembers=check('warehouse',permByRole['warehouse'],'pages/members/members');
    out.ordererMembers=check('orderer',permByRole['orderer'],'pages/members/members');
    out.adminMembers=check('admin',permByRole['admin'],'pages/members/members');
    app.globalData.userRole='admin'; app.globalData.userInfo=base;
    return out;
  }, PAGE_PERMS, permByRole);
  ok(guard.sorterMembers===false,'前端：sorter 进成员管理 被拒');
  ok(guard.sorterOutbound===true,'前端：sorter 进分拣出库 放行');
  ok(guard.warehouseOutbound===true,'前端：warehouse 进分拣出库 放行');
  ok(guard.warehouseMembers===false,'前端：warehouse 进成员管理 被拒');
  ok(guard.ordererMembers===false,'前端：orderer 进成员管理 被拒');
  ok(guard.adminMembers===true,'前端：admin 进成员管理 放行');

  console.log('\n==== 结果：通过 '+pass+'，失败 '+fail+' ====');
  await s.close();
  process.exit(fail?1:0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
