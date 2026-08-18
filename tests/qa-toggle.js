#!/usr/bin/env node
/**
 * QA 身份钩子 开关工具（多角色/全流程自动化测试 与 生产上线 的切换）
 * 用法：
 *   node tests/qa-toggle.js on    # 测试模式：7 个云函数 QA_IMPERSONATE=1（钩子激活，可用 qaAsOpenid 模拟角色）
 *   node tests/qa-toggle.js off   # 生产模式：7 个云函数 QA_IMPERSONATE=空（钩子惰性，真实用户不受影响）★ 上线前必须执行
 *   node tests/qa-toggle.js status # 只读：查看 7 函数线上当前值
 * 原理：tcb fn deploy 会按 cloudbaserc.json 的 envVariables 同步；省略该 key 不会清除线上已有值，
 *       所以用「置空串」而非删除来关闭（钩子判定 ==='1'，空串即惰性）。
 */
const path=require('path'),fs=require('fs'),{execFileSync}=require('child_process');
const PROJECT=path.resolve(__dirname,'..');
const RC=path.join(PROJECT,'cloudbaserc.json');
const FNS=['products','customers','orders','users','receivable','report','outbound'];
const mode=process.argv[2]||'';
const env={};
fs.readFileSync(path.join(PROJECT,'.env'),'utf8').split('\n').forEach(l=>{const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);if(m)env[m[1]]=m[2].trim();});
const ENV_ID=env.CLOUDBASE_ENV_ID;

function setRcValue(val){
  const c=JSON.parse(fs.readFileSync(RC,'utf8'));
  c.functions.forEach(f=>{
    if(FNS.includes(f.name)){ f.envVariables={ QA_IMPERSONATE: val }; }
  });
  fs.writeFileSync(RC, JSON.stringify(c,null,2)+'\n');
}
function deploy(fn){
  try{
    execFileSync('npx',['tcb','fn','deploy',fn,'--force','--env-id',ENV_ID],{stdio:'inherit',cwd:PROJECT,env:{...process.env,TCB_SECRET_ID:env.CLOUDBASE_SECRET_ID,TCB_SECRET_KEY:env.CLOUDBASE_SECRET_KEY}});
  }catch(e){ console.log('  ⚠ 部署失败 '+fn+': '+e.message.slice(0,120)); }
}
if(mode==='on'){ setRcValue('1'); console.log('→ 测试模式：部署 7 函数 QA_IMPERSONATE=1 ...'); FNS.forEach(deploy); console.log('✅ 测试模式已开启，可运行 role-sim / e2e-flow 测试'); }
else if(mode==='off'){ setRcValue(''); console.log('→ 生产模式：部署 7 函数 QA_IMPERSONATE=空 ...'); FNS.forEach(deploy); console.log('✅ 生产模式已生效（钩子惰性），可安全上线'); }
else if(mode==='status'){ console.log('线上 7 函数 QA_IMPERSONATE 当前值：'); FNS.forEach(fn=>{ try{ const out=execFileSync('npx',['tcb','fn','detail',fn,'--env-id',ENV_ID],{cwd:PROJECT,encoding:'utf8',env:{...process.env,TCB_SECRET_ID:env.CLOUDBASE_SECRET_ID,TCB_SECRET_KEY:env.CLOUDBASE_SECRET_KEY}}); const m=out.match(/Environment variables[^\n]*\n?/); console.log('  '+fn+': '+(m?m[0].replace(/\x1b\[[0-9;]*m/g,'').replace(/[│\n]/g,' ').trim():'?')); }catch(e){ console.log('  '+fn+': (err)'); } }); }
else { console.log('用法: node tests/qa-toggle.js <on|off|status>'); process.exit(1); }
