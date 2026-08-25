#!/usr/bin/env node
/**
 * 权限矩阵 UI 实测：在 App 上下文内调用页面真实 handler(loadPermConfig/togglePerm)，
 * 再和云端 perm_configs 交叉核对。每步 evaluate 内部自取页面实例（函数不能作参数序列化）。
 */
const path=require('path'),fs=require('fs'),os=require('os');
const PROJECT=path.resolve(__dirname,'..');
const LIB=process.env.WX_AUTOMATOR_LIB||path.join(os.homedir(),'.codex','skills','wechat-devtools-automator','scripts','lib');
const {launchSession}=require(path.join(LIB,'devtools_client.js'));
const {delay}=require(path.join(LIB,'common.js'));
const cb=require(path.join(PROJECT,'node_modules','@cloudbase','node-sdk'));
const env={};
fs.readFileSync(path.join(PROJECT,'.env'),'utf8').split('\n').forEach(l=>{const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);if(m)env[m[1]]=m[2].trim();});
const db=cb.init({secretId:env.CLOUDBASE_SECRET_ID,secretKey:env.CLOUDBASE_SECRET_KEY,envId:env.CLOUDBASE_ENV_ID}).database();
const pm=require(path.join(PROJECT,'cloudfunctions','auth','perm-matrix-shared.js'));
// T48: 云端 admin 自举（对齐 T13 自清理模式）。
// 根因：loadPermConfig 走真实 callCloud('users',{action:'perm-config'})，云侧 checkAdmin
// 校验【云侧】openid（开发者工具真实账号）是否为 admin。T46 删占位管理员后该记录不存在
// → 401 → 前端静默 return → permGroups=0 → FATAL。测试前幂等 upsert 临时 admin，测后自清理。
const DEVTOOLS_OPENID='oo0s93SW9A4V4iO1ANyA3eqzxVIA';
const BOOT_NAME='QA permui bootstrap';
let boot={created:false,id:null};
// 注意：node-sdk 的 add/update 用顶层字段（不带 {data:} 包装）；wx-server-sdk 才用 {data:}。两套口径混用会写出 data.data 脏结构（项目已知坑）。
async function ensureCloudAdmin(openid){
  const c=await db.collection('users').where({openid}).get();
  if(c.data&&c.data.length){
    const u=c.data[0];
    if(u.role!=='admin'){ await db.collection('users').doc(u._id).update({role:'admin',permissions:pm.defaultPermsForRole('admin')}); }
    return {created:false,id:u._id};
  }
  const r=await db.collection('users').add({openid,name:BOOT_NAME,role:'admin',status:'active',permissions:pm.defaultPermsForRole('admin'),createdBy:'qa-permui-test',createdAt:new Date(),updatedAt:new Date()});
  return {created:true,id:(r&&r.id)||r._id||null};
}
async function cleanup(){
  try{
    const c=await db.collection('users').where({openid:DEVTOOLS_OPENID}).get();
    for(const d of (c.data||[])){ if(d.name===BOOT_NAME){ await db.collection('users').doc(d._id).remove(); console.log('  (自清理) 已删除临时云端 admin'); } }
  }catch(e){ console.log('  (自清理跳过) '+e.message); }
}
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  \u2713 '+m);}else{fail++;console.log('  \u2717 '+m);}};
async function cloudRolePerms(){
  let byRole={};
  try{const c=await db.collection('perm_configs').get();c.data.forEach(d=>byRole[d.role]=d.permissions);}catch(e){}
  const out={};
  ['admin','orderer','sorter','warehouse'].forEach(role=>{
    out[role]=byRole[role]!=null?pm.mergedPerms(role,byRole[role]):pm.defaultPermsForRole(role);
  });
  return out;
}
const ROLES=['admin','orderer','sorter','warehouse'];
(async()=>{
  boot=await ensureCloudAdmin(DEVTOOLS_OPENID);
  console.log('  云端 admin 自举: '+(boot.created?'新建临时 admin':'已存在复用'));
  const s=await launchSession({projectPath:PROJECT,trustProject:true,timeoutMs:90000});
  await delay(4000);
  // auto-sim may not run onLaunch->wx.cloud.init; idempotent bootstrap (no-op on real launch)
  try{ await s.evaluate(async ()=>{ try{ if(!wx.cloud.config){ wx.cloud.init({env:'cloud1-d6g75loi673b1e039'}); } }catch(e){} return 'ok'; }); await delay(1500); }catch(e){}
  // 登录自举：不依赖开发者工具残留登录态，干净环境也能过（admin 角色才能访问成员/权限矩阵页）
  // 注意：对象须内联在 evaluate 回调内（回调被序列化到小程序上下文执行，取不到 Node 侧变量）
  await s.evaluate(()=>new Promise(r=>{try{const u={openid:'qa_permui_admin',name:'测试',role:'admin',tenantName:'丰淮商贸',permissions:['order:view','order:create','order:edit','order:delete','order:print','order:export','product:view','product:edit','customer:view','customer:edit','sort:task','warehouse:confirm','receivable:view','receivable:collect','receivable:confirm','receivable:discount','report:view','report:export','report:ledger','member:manage']};wx.setStorageSync('currentUser',u);wx.setStorageSync('userInfo',u);wx.setStorageSync('userRole','admin');// 同时写 globalData：onLaunch 只跑一次，reLaunch 不再触发，必须直接置位才能让路由守卫放行
try{const app=getApp();if(app){app.globalData.userInfo=u;app.globalData.userRole='admin';}}catch(e){}
wx.reLaunch({url:'/pages/index/index'});r('ok');}catch(e){r('THROW '+e.message);}}));
  await delay(3500);
  await s.evaluate(()=>new Promise(r=>{try{wx.navigateTo({url:'/pages/members/members',fail:(e)=>r('FAIL '+e.errMsg)});setTimeout(()=>r('ok'),2500);}catch(e){r('THROW');}}));
  await delay(3500);
  // 稳健取页：CDP webview 句柄偶发竞态（末位可能是已销毁页），按 route 找页 + 重试
  let settled=false;
  for(let i=0;i<5;i++){
    settled=await s.evaluate(()=>{const m=getCurrentPages().find(x=>x.route==='pages/members/members');return !!(m&&typeof m.loadPermConfig==='function');});
    if(settled)break;
    await delay(2000);
  }
  if(!settled){ try{await s.close();}catch(e){} await cleanup(); console.log('FATAL members 页未就绪'); process.exit(1); }

  // A. 触发真实 loadPermConfig（内部取页面）
  const loaded=await s.evaluate(async()=>{try{const p=getCurrentPages().find(x=>x.route==='pages/members/members');if(!p)throw new Error('members page not found');await p.loadPermConfig();return {route:p.route,groups:p.data.permGroups.length};}catch(e){return {err:e.message};}});
  console.log('A) loadPermConfig => '+JSON.stringify(loaded));
  ok(loaded.groups===8,'权限矩阵渲染 8 个分组（'+(loaded.err||'')+'）');
  const shape=await s.evaluate(()=>{const p=getCurrentPages().find(x=>x.route==='pages/members/members');if(!p)throw new Error('members page not found');return {cols:p.data.roleCols.map(c=>c.role), orderKeys:p.data.permGroups[0].rows.map(r=>r.key), orderCount:p.data.permGroups[0].count};});
  ok(shape.cols.join(',')==='orderer,sorter,warehouse,admin','列顺序对齐原型：下单员/分拣员/库管/管理员（'+shape.cols.join(',')+'）');
  ok(shape.orderCount===5 && shape.orderKeys.indexOf('order:view')<0,'订单管理 5 项且不含 查看订单（基线权限不展示）');
  const init=await s.evaluate(()=>{const p=getCurrentPages().find(x=>x.route==='pages/members/members');if(!p)throw new Error('members page not found');const g=p.data.permGroups[5];const row=g.rows.find(r=>r.key==='receivable:collect');return {route:p.route, onSorter:row.cells[1].on, onWarehouse:row.cells[2].on};});
  ok(init.route==='pages/members/members' && init.onSorter===true,'初始 分拣员.登记收款 = 开（默认）');
  ok(init.onWarehouse===false,'初始 库管.登记收款 = 关（默认两步分离）');

  // B. UI togglePerm 关闭 分拣员.receivable:collect
  const ri=await s.evaluate(()=>{const p=getCurrentPages().find(x=>x.route==='pages/members/members');if(!p)throw new Error('members page not found');return p.data.permGroups[5].rows.findIndex(r=>r.key==='receivable:collect');});
  const resB=await s.evaluate(async ri2=>{const p=getCurrentPages().find(x=>x.route==='pages/members/members');if(!p)throw new Error('members page not found');try{await p.togglePerm({currentTarget:{dataset:{group:'5',row:String(ri2),role:'1'}}});return {done:true};}catch(e){return {err:e.message};}}, ri);
  await delay(1800);
  ok(resB.done===true,'UI togglePerm 调用成功（'+JSON.stringify(resB)+'）');
  const cloudB=await cloudRolePerms();
  ok(cloudB.sorter.indexOf('receivable:collect')<0,'云端核对：分拣员 已无 receivable:collect（经 UI 开关生效）');

  // C. 锁定项 admin.member:manage 点击应被忽略
  const beforeC=await cloudRolePerms();
  ok(beforeC.admin.includes('member:manage'),'点击前 admin.member:manage = 开');
  const lockedRow=await s.evaluate(()=>{const p=getCurrentPages().find(x=>x.route==='pages/members/members');if(!p)throw new Error('members page not found');return p.data.permGroups[7].rows.findIndex(r=>r.key==='member:manage');});
  const resC=await s.evaluate(async ri3=>{const p=getCurrentPages().find(x=>x.route==='pages/members/members');if(!p)throw new Error('members page not found');try{await p.togglePerm({currentTarget:{dataset:{group:'7',row:String(ri3),role:'3'}}});return {done:true};}catch(e){return {err:e.message};}}, lockedRow);
  await delay(1500);
  const afterC=await cloudRolePerms();
  ok(afterC.admin.includes('member:manage'),'锁定项保护：UI 点 admin.member:manage 被忽略，云端仍为开（'+JSON.stringify(resC)+'）');

  // D. 恢复默认：逐角色删 perm_configs
  for(const role of ROLES){ try{const c=await db.collection('perm_configs').where({role}).get();for(const d of c.data){await db.collection('perm_configs').doc(d._id).remove();}}catch(e){} }
  await delay(800);
  const cloudD=await cloudRolePerms();
  ok(cloudD.sorter.indexOf('receivable:collect')>=0,'reset 后 分拣员.receivable:collect 恢复为开（默认）');
  ok(cloudD.warehouse.indexOf('receivable:collect')<0 && cloudD.warehouse.indexOf('receivable:confirm')>=0,'默认两步分离：库管 无 collect、有 confirm');
  ok(cloudD.orderer.indexOf('receivable:collect')>=0 && cloudD.orderer.indexOf('receivable:confirm')<0,'默认两步分离：下单员 有 collect、无 confirm');

  const code=fail?1:0;
  try{ await s.close(); }catch(e){}
  await cleanup();
  console.log('\n==== 结果：通过 '+pass+'，失败 '+fail+' ====');
  process.exit(code);
})().catch(async e=>{ console.error('FATAL',e.message); try{ await cleanup(); }catch(_){} process.exit(1); });
