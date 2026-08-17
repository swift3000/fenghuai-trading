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
  const s=await launchSession({projectPath:PROJECT,trustProject:true,timeoutMs:90000});
  await delay(4000);
  await s.evaluate(()=>new Promise(r=>{try{wx.navigateTo({url:'/pages/members/members',fail:()=>r('FAIL')});setTimeout(()=>r('ok'),2500);}catch(e){r('THROW');}}));
  await delay(3500);

  // A. 触发真实 loadPermConfig（内部取页面）
  const loaded=await s.evaluate(async()=>{try{const p=getCurrentPages()[getCurrentPages().length-1];await p.loadPermConfig();return {route:p.route,groups:p.data.permGroups.length};}catch(e){return {err:e.message};}});
  console.log('A) loadPermConfig => '+JSON.stringify(loaded));
  ok(loaded.groups===8,'权限矩阵渲染 8 个分组（'+(loaded.err||'')+'）');
  const init=await s.evaluate(()=>{const p=getCurrentPages()[getCurrentPages().length-1];const g=p.data.permGroups[5];const row=g.rows.find(r=>r.key==='receivable:collect');return {route:p.route, on:row.cells[2].on};});
  ok(init.route==='pages/members/members' && init.on===true,'初始 分拣员.登记收款 = 开（默认）');

  // B. UI togglePerm 关闭 分拣员.receivable:collect
  const ri=await s.evaluate(()=>{const p=getCurrentPages()[getCurrentPages().length-1];return p.data.permGroups[5].rows.findIndex(r=>r.key==='receivable:collect');});
  const resB=await s.evaluate(async ri2=>{const p=getCurrentPages()[getCurrentPages().length-1];try{await p.togglePerm({currentTarget:{dataset:{group:'5',row:String(ri2),role:'2'}}});return {done:true};}catch(e){return {err:e.message};}}, ri);
  await delay(1800);
  ok(resB.done===true,'UI togglePerm 调用成功（'+JSON.stringify(resB)+'）');
  const cloudB=await cloudRolePerms();
  ok(cloudB.sorter.indexOf('receivable:collect')<0,'云端核对：分拣员 已无 receivable:collect（经 UI 开关生效）');

  // C. 锁定项 admin.member:manage 点击应被忽略
  const beforeC=await cloudRolePerms();
  ok(beforeC.admin.includes('member:manage'),'点击前 admin.member:manage = 开');
  const lockedRow=await s.evaluate(()=>{const p=getCurrentPages()[getCurrentPages().length-1];return p.data.permGroups[7].rows.findIndex(r=>r.key==='member:manage');});
  const resC=await s.evaluate(async ri3=>{const p=getCurrentPages()[getCurrentPages().length-1];try{await p.togglePerm({currentTarget:{dataset:{group:'7',row:String(ri3),role:'0'}}});return {done:true};}catch(e){return {err:e.message};}}, lockedRow);
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

  console.log('\n==== 结果：通过 '+pass+'，失败 '+fail+' ====');
  await s.close();
  process.exit(fail?1:0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
