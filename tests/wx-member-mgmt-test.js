#!/usr/bin/env node
/**
 * 会员/权限管理自动化测试（管理员邀请、创建、删除、角色切换、禁用、权限矩阵闭环）
 * 前置：8 个云函数（7 业务 + auth）已部署且 QA_IMPERSONATE=1（node tests/qa-toggle.js on）。
 * 覆盖：
 *  1) 邀请流程 auth.getInviteCode → 新用户 login(inviteCode) 绑定激活 → 角色权限即时可用
 *  2) users.add 直接创建（API 口径）
 *  3) users.remove：删普通成员成功 / 删自己 400 / 删管理员 400
 *  4) users.update-role：切换后权限即时变化（业务函数实测）；admin 降级保护 400
 *  5) users.update-status：禁用 → 业务函数 403「账号已被禁用」；启用 → 恢复；非法状态 400
 *  6) perm-config / save-perm / reset-perm 闭环：锁定项 member:manage 仅 admin 可开，非 admin 提交被强制剥离
 *  全程用 qa_mm_ 前缀用户，结尾全量清理（含 pending 邀请文档），恢复 perm_configs 默认。
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
const code=(r)=> (r&&r.code!==undefined)?r.code:(r&&r.__err?'ERR':-999);
const allowed=(r)=> code(r)!==403 && code(r)!==401;
const denied=(r)=> code(r)===403;
const disabledMsg=(r)=> (r&&(r.message||'').indexOf('禁用')>=0);

const NEW_ORDERER='qa_mm_orderer_001';   // 邀请激活目标
const NEW_SORTER='qa_mm_sorter_001';      // users.add 创建目标
const NEW_WH='qa_mm_warehouse_001';       // 角色切换实验目标
const NEW_INV='qa_mm_invitee_001';        // 直接 activateByInvite 目标
const ADMIN='oo0s93SW9A4V4iO1ANyA3eqzxVIA';

(async()=>{
  const s=await launchSession({projectPath:PROJECT,trustProject:true,timeoutMs:90000});
  await delay(4000);
  const rawCall=async (fn,action,oid,data)=>{
    const d=Object.assign({action},data||{}); if(oid) d.qaAsOpenid=oid;
    return s.evaluate(async (fn2,d2)=>{
      try{ const r=await wx.cloud.callFunction({name:fn2,data:d2}); return (r&&r.result)||{}; }
      catch(e){ return {__err:e.message,code:-1}; }
    }, fn, d);
  };
  // 探针：CF 侧 where({openid}) 偶发返回空（新写入文档读延迟），401 时重试，避免假失败
  const callAs=async (fn,action,oid,data)=>{
    let r=await rawCall(fn,action,oid,data);
    let t=0;
    while(oid && code(r)===401 && t<4){ await delay(800); r=await rawCall(fn,action,oid,data); t++; }
    return r;
  };
  const asAdmin=(fn,action,data)=>callAs(fn,action,ADMIN,data);

  // ===== 预清理 + 占位预建（QA 钩子模拟身份必须是已存在文档：真实新用户文档由 auth.login 现场创建，
  // 钩子场景下预建空壳占位，login 时 where(openid) 仍为空→走新建分支，isNewUser=true，文档以 openid 落库）=====
  let all=await db.collection('users').limit(100).get();
  let removed=0;
  for(const u of all.data){ if((u.openid||'').indexOf('qa_mm_')===0 || (u.name||'').indexOf('QA_MM_')===0 || (u.createdBy||'')==='qa_mm'){ await db.collection('users').doc(u._id).remove(); removed++; } }
  console.log('预清理 qa_mm_ 残留: '+removed+' 条');
  // 占位文档：无 openid 字段（login 的 where({openid:qa_mm_x}) 查不到 → 视为新用户）
  for(const oid of [NEW_ORDERER, NEW_SORTER, NEW_WH, NEW_INV]){
    await db.collection('users').add({ data:{ placeholderFor: oid, name:'QA_MM_占位', status:'placeholder', createdAt:new Date() } });
  }
  for(const role of ['orderer','sorter','warehouse','admin']){
    const c=await db.collection('perm_configs').where({role}).get();
    for(const d of c.data){ await db.collection('perm_configs').doc(d._id).remove(); }
  }

  // CF 侧读用户（users.list + 内存过滤）：node-sdk 直读会读到陈旧数据，断言一律走云函数
  const cfFindUser=async oid=>{
    const r=await asAdmin('users','list',{});
    const l=r.data||[];
    return l.find(u=>u.openid===oid)||null;
  };

  console.log('\n【1】邀请流程：getInviteCode → 新用户 login 绑定激活');
  const inv1=await asAdmin('auth','getInviteCode',{role:'orderer',name:'QA_MM_邀请下单员'});
  ok(code(inv1)===0 && !!(inv1.data&&inv1.data.inviteCode),'getInviteCode 生成邀请码（管理员）');
  const inv1Id=inv1.data&&inv1.data._id, inv1Code=inv1.data&&inv1.data.inviteCode;
  const gi0=await callAs('auth','getInviteCode',NEW_ORDERER,{role:'orderer'});
  ok(code(gi0)===403||code(gi0)===401,'非管理员 getInviteCode 被拦截（实际 '+code(gi0)+'）');
  const login1=await callAs('auth','login',NEW_ORDERER,{role:'orderer',name:'QA_MM_下单员',inviteCode:inv1Code});
  ok(code(login1)===0 && login1.data&&login1.data.isNewUser,'新用户携带邀请码 login 成功');
  const u1=await cfFindUser(NEW_ORDERER);
  ok(!!u1 && u1.role==='orderer' && (u1.permissions||[]).indexOf('order:create')>=0,'激活后角色=orderer 且带默认权限');
  ok((u1&&u1.inviteStatus)==='activated','inviteStatus=activated');
  ok(allowed(await callAs('orders','list',NEW_ORDERER,{})),'新用户 orderer 查订单 放行（权限即时可用）');
  ok(denied(await callAs('users','list',NEW_ORDERER,{})),'新用户 orderer 访问成员管理 403');

  console.log('\n【2】users.add 直接创建（管理员 API 口径）');
  const addR=await asAdmin('users','add',{name:'QA_MM_分拣员',phone:'13800000000',role:'sorter'});
  ok(code(addR)===0,'users.add 创建 sorter 成功');
  // add 创建的是无 openid 的「待登录」账号；验证文档权限=sorter 默认
  let all2=await db.collection('users').limit(100).get();
  const added=all2.data.filter(u=>u.name==='QA_MM_分拣员'&&!u.openid);
  ok(added.length>=1 && added[0].role==='sorter' && JSON.stringify(added[0].permissions)===JSON.stringify(pm.defaultPermsForRole('sorter')),'add 文档 role/permissions=sorter 默认');
  const ua0=await callAs('users','add',NEW_SORTER,{name:'x',role:'orderer'});
  ok(code(ua0)===403||code(ua0)===401,'非管理员 users.add 被拦截（实际 '+code(ua0)+'）');

  console.log('\n【3】users.remove 删除保护');
  const addW=await asAdmin('users','add',{name:'QA_MM_删除对象',role:'orderer'});
  const delTarget=(addW.data&&addW.data._id)||null;
  if(delTarget){ await db.collection('users').doc(delTarget).update({openid:'qa_mm_del_001'}); }
  ok(!!delTarget,'准备删除对象（带 openid qa_mm_del_001）');
  if(delTarget){
    ok(code(await asAdmin('users','remove',{userId:delTarget}))===0,'删除普通成员成功');
    const l3=await db.collection('users').limit(100).get();
    ok(!l3.data.some(u=>u._id===delTarget),'数据库已无该成员');
    ok(code(await asAdmin('users','remove',{userId:ADMIN}))===400,'删除自己 400（按 openid 口径）');
    const selfDoc=(await cfFindUser(ADMIN))||{};
    ok(!!selfDoc._id,'管理员文档可查（用于 _id 口径测试）');
    if(selfDoc._id){
      ok(code(await asAdmin('users','remove',{userId:selfDoc._id}))===400,'删除自己 400（前端实际传 _id 口径）');
    }
    const l4=await db.collection('users').limit(100).get();
    const otherAdmin=l4.data.find(u=>u.role==='admin'&&u._id!==ADMIN);
    if(otherAdmin){
      ok(code(await asAdmin('users','remove',{userId:otherAdmin._id}))===400,'删除其他管理员 400');
    } else {
      ok(code(await asAdmin('users','remove',{userId:ADMIN}))===400,'（无第二管理员，复验删自己 400）');
    }
  }

  console.log('\n【4】users.update-role 角色切换即时生效');
  const addWh=await asAdmin('users','add',{name:'QA_MM_切换对象',role:'warehouse'});
  // 该账号无 openid，业务函数无法实测 → 用「给 QA 用户直接写库改 openid」方式：把 add 的账号补一个 openid 后实测
  const whId=addWh.data&&addWh.data._id;
  if(whId){ await db.collection('users').doc(whId).update({openid:NEW_WH}); } // node-sdk update 用顶层字段
  await delay(800);
  ok(allowed(await callAs('receivable','confirmPayment',NEW_WH,{})),'前置：warehouse 确认收款 放行');
  ok(denied(await callAs('receivable','collect',NEW_WH,{})),'前置：warehouse 登记收款 403');
  ok(code(await asAdmin('users','update-role',{userId:ADMIN,role:'orderer'}))===400,'改自己角色 400');
  const selfDoc4=(await cfFindUser(ADMIN))||{};
  if(selfDoc4._id){ ok(code(await asAdmin('users','update-role',{userId:selfDoc4._id,role:'orderer'}))===400,'改自己角色 400（_id 口径）'); }
  const l5=await db.collection('users').limit(100).get();
  const otherAdmin2=l5.data.find(u=>u.role==='admin'&&u._id!==ADMIN);
  if(otherAdmin2){ ok(code(await asAdmin('users','update-role',{userId:otherAdmin2._id,role:'orderer'}))===400,'把其他管理员降级 400'); }
  const r1=await asAdmin('users','update-role',{userId:whId,role:'orderer'});
  ok(code(r1)===0,'warehouse→orderer 切换成功');
  await delay(300);
  ok(allowed(await callAs('receivable','collect',NEW_WH,{})),'切换后：orderer 登记收款 放行（即时）');
  ok(denied(await callAs('receivable','confirmPayment',NEW_WH,{})),'切换后：orderer 确认收款 403（即时）');
  const r2=await asAdmin('users','update-role',{userId:whId,role:'sorter'});
  ok(code(r2)===0,'orderer→sorter 切换成功');
  await delay(300);
  ok(allowed(await callAs('receivable','collect',NEW_WH,{})),'sorter 登记收款 放行');
  ok(allowed(await callAs('outbound','pendingSortList',NEW_WH,{})),'sorter 分拣列表 放行');

  console.log('\n【5】users.update-status 禁用/启用（云端拦截）');
  ok(allowed(await callAs('orders','list',NEW_WH,{})),'前置：sorter 查订单 放行');
  const selfDoc5=(await cfFindUser(ADMIN))||{};
  ok(code(await asAdmin('users','update-status',{userId:ADMIN,status:'disabled'}))===400,'禁用自己 400（openid 口径）');
  if(selfDoc5._id){ ok(code(await asAdmin('users','update-status',{userId:selfDoc5._id,status:'disabled'}))===400,'禁用自己 400（_id 口径）'); }
  ok(code(await asAdmin('users','update-status',{userId:whId,status:'weird'}))===400,'非法状态值 400');
  ok(code(await asAdmin('users','update-status',{userId:whId,status:'disabled'}))===0,'禁用成功');
  await delay(300);
  const d1=await callAs('orders','list',NEW_WH,{});
  ok(code(d1)===403 && disabledMsg(d1),'禁用后：查订单 403「账号已被禁用」（实际 code='+code(d1)+' msg='+(d1&&d1.message)+'）');
  const d2=await callAs('receivable','collect',NEW_WH,{});
  ok(code(d2)===403 && disabledMsg(d2),'禁用后：登记收款 403「账号已被禁用」');
  ok(code(await asAdmin('users','update-status',{userId:whId,status:'active'}))===0,'启用成功');
  await delay(300);
  ok(allowed(await callAs('orders','list',NEW_WH,{})),'启用后：查订单 恢复放行');

  console.log('\n【6】权限矩阵闭环 perm-config / save-perm / reset-perm');
  const pc0=await asAdmin('users','perm-config',{});
  ok(code(pc0)===0 && pc0.data && Array.isArray(pc0.data.sorter),'perm-config 返回各角色有效权限');
  ok((pc0.data.sorter||[]).indexOf('receivable:collect')>=0,'默认：sorter 有 receivable:collect');
  const sorterNoCollect=pm.defaultPermsForRole('sorter').filter(k=>k!=='receivable:collect');
  const sp1=await asAdmin('users','save-perm',{role:'sorter',permissions:sorterNoCollect});
  ok(code(sp1)===0 && (sp1.data&&sp1.data.syncedUsers)>=1,'save-perm 关闭 sorter collect，返回 syncedUsers='+JSON.stringify(sp1.data&&sp1.data.syncedUsers));
  await delay(300);
  ok(denied(await callAs('receivable','collect',NEW_WH,{})),'save-perm 后 sorter（含 qa_mm 用户）立即 403');
  // 锁定项：非 admin 提 member:manage 必须被剥离
  const sp2=await asAdmin('users','save-perm',{role:'warehouse',permissions:pm.defaultPermsForRole('warehouse').concat('member:manage','fake:perm')});
  ok(code(sp2)===0 && (sp2.data.permissions||[]).indexOf('member:manage')<0,'非 admin 提交 member:manage 被强制剥离');
  ok((sp2.data.permissions||[]).indexOf('fake:perm')<0,'非法权限 key 被过滤');
  const pc1=await asAdmin('users','perm-config',{});
  ok((pc1.data.warehouse||[]).indexOf('member:manage')<0,'perm-config：warehouse 无 member:manage');
  ok((pc1.data.admin||[]).indexOf('member:manage')>=0,'perm-config：admin 有 member:manage（锁定）');
  const rp=await asAdmin('users','reset-perm',{role:'warehouse'});
  ok(code(rp)===0,'reset-perm warehouse 成功');
  const rp2=await asAdmin('users','reset-perm',{role:'sorter'});
  ok(code(rp2)===0,'reset-perm sorter 成功');
  await delay(300);
  ok(allowed(await callAs('receivable','collect',NEW_WH,{})),'reset 后 sorter 登记收款 恢复放行');

  console.log('\n【7】checkAuth 权限门（前端鉴权入口）');
  const ca1=await callAs('auth','checkAuth',NEW_WH,{requiredPermission:'receivable:collect'});
  ok(code(ca1)===0 && ca1.data&&ca1.data.hasPermission===true,'checkAuth：sorter 有 collect');
  const ca2=await callAs('auth','checkAuth',NEW_WH,{requiredPermission:'receivable:confirm'});
  ok(code(ca2)===0 && ca2.data&&ca2.data.hasPermission===false,'checkAuth：sorter 无 confirm');
  await asAdmin('users','update-status',{userId:whId,status:'disabled'});
  const ca3=await callAs('auth','checkAuth',NEW_WH,{requiredPermission:'receivable:collect'});
  ok(code(ca3)===403,'checkAuth：禁用用户 403');

  console.log('\n【8】activateByInvite 直连路径 + 过期/无效码');
  const inv2=await asAdmin('auth','getInviteCode',{role:'warehouse',name:'QA_MM_邀请库管'});
  ok(code(inv2)===0,'第二次 getInviteCode（warehouse）');
  const inv2Id=inv2.data&&inv2.data._id, inv2Code=inv2.data&&inv2.data.inviteCode;
  const act=await callAs('auth','activateByInvite',NEW_INV,{inviteCode:inv2Code});
  ok(code(act)===0 && act.data&&act.data.userInfo&&act.data.userInfo.role==='warehouse','activateByInvite 激活为 warehouse（绑定邀请文档）');
  ok(code(await callAs('auth','activateByInvite',NEW_ORDERER,{inviteCode:inv2Code}))===404,'邀请码重复使用 404');
  ok(code(await callAs('auth','activateByInvite',NEW_ORDERER,{inviteCode:'ZZZZZZ'}))===404,'无效邀请码 404');

  // ===== 清理 =====
  console.log('\n清理：删除全部 qa_mm_ 用户 + 清空 perm_configs');
  all=await db.collection('users').limit(100).get();
  let clean=0;
  for(const u of all.data){ if((u.openid||'').indexOf('qa_mm_')===0 || (u.createdBy||'')==='qa_mm' || (u.name||'').indexOf('QA_MM_')===0){ await db.collection('users').doc(u._id).remove(); clean++; } }
  const ids=[inv1Id,inv2Id];
  for(const id of ids){ if(id){ try{ await db.collection('users').doc(id).remove(); }catch(e){} } }
  for(const role of ['orderer','sorter','warehouse','admin']){
    const c=await db.collection('perm_configs').where({role}).get();
    for(const d of c.data){ await db.collection('perm_configs').doc(d._id).remove(); }
  }
  const left=await db.collection('users').limit(100).get();
  const residue=left.data.filter(u=>(u.openid||'').indexOf('qa_mm_')===0).length;
  ok(residue===0,'清理完成，残留 qa_mm_ 用户 = '+residue+'（含删除 '+clean+' 条）');

  console.log('\n==== 结果：通过 '+pass+'，失败 '+fail+' ====');
  await s.close();
  process.exit(fail?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
