#!/usr/bin/env node
/**
 * 成员邀请 + 角色权限开关 实测（登录态=管理员）
 *  A. members 页诊断（count:0）
 *  B. 依次邀请 4 角色（auth.getInviteCode）
 *  C. 云端核对待激活邀请 doc
 *  D. 权限开关：关 sorter.receivable:collect -> 读回验证；尝试关 admin.member:manage -> 验证锁定
 *  E. 清理
 * 每个云调用包 20s 超时，避免慢调用挂起整个流程。
 */
const path=require('path'),fs=require('fs'),os=require('os');
const PROJECT=path.resolve(__dirname,'..');
const AUTOMATOR_LIB=process.env.WX_AUTOMATOR_LIB||path.join(os.homedir(),'.codex','skills','wechat-devtools-automator','scripts','lib');
const {launchSession}=require(path.join(AUTOMATOR_LIB,'devtools_client.js'));
const {delay}=require(path.join(AUTOMATOR_LIB,'common.js'));
const cb=require(path.join(PROJECT,'node_modules','@cloudbase','node-sdk'));
const env={};
fs.readFileSync(path.join(PROJECT,'.env'),'utf8').split('\n').forEach(l=>{const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);if(m)env[m[1]]=m[2].trim();});
const db=cb.init({secretId:env.CLOUDBASE_SECRET_ID,secretKey:env.CLOUDBASE_SECRET_KEY,envId:env.CLOUDBASE_ENV_ID}).database();

let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  \u2713 '+m);}else{fail++;console.log('  \u2717 '+m);}};
// 带超时的云调用（在 App 上下文执行 wx.cloud.callFunction）
function cfCall(name,data,ms=20000){
  return (sess)=>new Promise((resolve)=>{
    let done=false;
    const t=setTimeout(()=>{if(!done){done=true;resolve({__timeout:true});}},ms);
    sess.evaluate((nm,d)=>new Promise((res)=>{
      wx.cloud.callFunction({name:nm,data:d,success:(r)=>res(r.result),fail:(e)=>res({__fail:e.errMsg})});
    }),name,data).then(v=>{if(!done){done=true;clearTimeout(t);resolve(v);}})
      .catch(e=>{if(!done){done=true;clearTimeout(t);resolve({__err:e.message});}});
  });
}

const createdInvites=[];
(async()=>{
  console.log('PROJECT '+PROJECT);
  const session=await launchSession({projectPath:PROJECT,trustProject:true,timeoutMs:40000});
  await delay(5000);

  // A
  await session.evaluate((m,u)=>new Promise(r=>{try{wx[m]({url:u,fail:()=>r('FAIL')});setTimeout(()=>r('ok'),3000);}catch(e){r('THROW');}}),'navigateTo','/pages/members/members');
  await delay(4500);
  const mem=await session.evaluate(()=>{const p=getCurrentPages()[getCurrentPages().length-1];return{route:p.route,count:(p.data.members||[]).length,roles:(p.data.members||[]).map(m=>m.role)};});
  console.log('A) members 页: '+JSON.stringify(mem));
  ok(mem.route==='pages/members/members','成员管理页可访问');
  ok(mem.count>=1,'成员列表含当前管理员（count='+mem.count+'）');

  // B
  for(const role of ['orderer','sorter','warehouse','admin']){
    const r=await cfCall('auth',{action:'getInviteCode',role,name:'测试'+role,phone:'13800000000'})(session);
    if(r&&r.code===0&&r.data){
      createdInvites.push({code:r.data.inviteCode,role,docId:r.data._id});
      ok(true,'邀请 '+role+' -> '+r.data.inviteCode+(r.data.inviteQr?'（含二维码）':'（无二维码,降级码）'));
    }else{
      ok(false,'邀请 '+role+' 结果异常: '+JSON.stringify(r).slice(0,120));
    }
  }

  // C
  await delay(1500);
  const pending=await db.collection('users').where({inviteStatus:'pending'}).get();
  const byRole={};pending.data.forEach(d=>byRole[d.role]=(byRole[d.role]||0)+1);
  console.log('C) 云端待激活邀请 '+pending.data.length+' 条');
  ['orderer','sorter','warehouse','admin'].forEach(role=>ok((byRole[role]||0)>=1,'云端存在 '+role+' 待激活邀请'));
  const sm=pending.data.find(d=>d.role==='sorter')||pending.data[0];
  if(sm) ok(!!sm.inviteCode&&!!sm.role,'邀请 doc 含 inviteCode+role（样本 '+sm.role+'/'+sm.inviteCode+'）');

  // D
  const before=await cfCall('users',{action:'perm-config'})(session);
  console.log('D) 初始 sorter.receivable:collect = '+(before.data&&before.data.sorter?before.data.sorter.includes('receivable:collect'):null));
  const sav1=await cfCall('users',{action:'save-perm',role:'sorter',permissions:(before.data.sorter||[]).filter(k=>k!=='receivable:collect')})(session);
  ok(sav1.code===0,'save-perm 关 sorter.receivable:collect 成功');
  const after=await cfCall('users',{action:'perm-config'})(session);
  ok(after.data.sorter.indexOf('receivable:collect')<0,'读回验证：sorter 已无 receivable:collect（开关生效）');
  const sav2=await cfCall('users',{action:'save-perm',role:'admin',permissions:(before.data.admin||[]).filter(k=>k!=='member:manage')})(session);
  const after2=await cfCall('users',{action:'perm-config'})(session);
  ok(after2.data.admin.includes('member:manage'),'member:manage 锁定项：试图关闭仍被强制保留');

  // E
  for(const it of createdInvites){try{await db.collection('users').doc(it.docId).remove();}catch(e){}}
  for(const role of ['admin','orderer','sorter','warehouse']) await cfCall('users',{action:'reset-perm',role})(session);
  await delay(800);
  const left=await db.collection('users').where({inviteStatus:'pending'}).get();
  ok(left.data.length===0,'清理完成：无残留待激活邀请（剩 '+left.data.length+'）');

  console.log('\n==== 结果：通过 '+pass+'，失败 '+fail+' ====');
  await session.close();
  process.exit(fail?1:0);
})().catch(e=>{console.error('FATAL '+e.message);process.exit(1);});
