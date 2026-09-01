#!/usr/bin/env node
/**
 * T59-R15 性能基线终验（2026-09-01，全局性能预算最小基线）
 * 口径：10 并发 × 核心接口前 5，P95 < 2s 且零错误 + 守恒断言
 * 核心接口（按业务关键度）：report/summary、report/export(customer)、report/exportLedger、
 *   receivable/dashboard、orders/list
 * 前置：QA_IMPERSONATE=1（qa-toggle.js on），纯 callFunction 不占模拟器。
 * 守恒断言：每轮汇总 report/summary 全量聚合 应收=已收+欠款（并发下无错账）。
 */
const path=require('path'),fs=require('fs');
const PROJECT=path.resolve(__dirname,'..');
const cb=require(path.join(PROJECT,'node_modules','@cloudbase','node-sdk'));
const env={};
fs.readFileSync(path.join(PROJECT,'.env'),'utf8').split('\n').forEach(l=>{const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);if(m)env[m[1]]=m[2].trim();});
const app=cb.init({secretId:env.CLOUDBASE_SECRET_ID,secretKey:env.CLOUDBASE_SECRET_KEY,envId:env.CLOUDBASE_ENV_ID});
const ADMIN='oo0s93SW9A4V4iO1ANyA3eqzxVIA';
const CONC=10, WAVE=3; // 10 并发 × 3 轮 × 5 接口
const P95_BUDGET_MS=2000;
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  \u2713 '+m);}else{fail++;console.log('  \u2717 '+m);}};
const CALLS=[
  {name:'report summary', fn:'report', d:{action:'summary',reportTab:'customer',timeTab:'all',qaAsOpenid:ADMIN}},
  {name:'report export', fn:'report', d:{action:'export',reportTab:'customer',timeTab:'all',format:'csv',qaAsOpenid:ADMIN}},
  {name:'report ledger', fn:'report', d:{action:'exportLedger',timeTab:'all',format:'csv',qaAsOpenid:ADMIN}},
  {name:'receivable dashboard', fn:'receivable', d:{action:'dashboard',view:'unsettled',qaAsOpenid:ADMIN}},
  {name:'orders list', fn:'orders', d:{action:'list',timeTab:'all',qaAsOpenid:ADMIN}},
];
const cent=n=>Math.round(Number(n||0)*100);
async function timed(fn,d){ const t0=process.hrtime.bigint(); try{ const r=await app.callFunction({name:fn,data:d}); const ms=Number(process.hrtime.bigint()-t0)/1e6; const res=(r&&r.result)||{}; return {ms, ok:res.code===0, err:res.code===0?null:(res.message||('code='+res.code))}; }catch(e){ const ms=Number(process.hrtime.bigint()-t0)/1e6; return {ms, ok:false, err:e.message}; } }
(async()=>{
  const samples=[]; let errs=0; const errList=[];
  // 预热（每接口 1 次，云函数冷启动/DB 连接建立不计入 P95 采样）
  for(const c of CALLS){ await timed(c.fn,c.d); }
  await new Promise(r=>setTimeout(r,2000));
  for(let wave=0; wave<WAVE; wave++){
    const batch=[];
    for(const c of CALLS) for(let k=0;k<CONC;k++) batch.push(timed(c.fn,c.d));
    const results=await Promise.all(batch);
    results.forEach((r,i)=>{ samples.push({label:CALLS[Math.floor(i/CONC)].name, ms:r.ms}); if(!r.ok){errs++; if(errList.length<5)errList.push(CALLS[Math.floor(i/CONC)].name+' '+r.err);} });
  }
  // 守恒断言：并发跑完后汇总口径 逐客户行 应收=已收+欠（summary 顶层无 paid/unpaid，在 customers 行内）
  const sum=await app.callFunction({name:'report',data:{action:'summary',reportTab:'customer',timeTab:'all',qaAsOpenid:ADMIN}});
  const d=(sum.result&&sum.result.data)||{};
  const custs=d.customers||[];
  const T=custs.reduce((s,c)=>s+cent(c.totalAmount),0), P=custs.reduce((s,c)=>s+cent(c.paidAmount),0), U=custs.reduce((s,c)=>s+cent(c.unpaidAmount),0);
  ok(custs.length>0&&T===P+U,'并发后汇总守恒 应收'+(T/100)+'=已收'+(P/100)+'+欠'+(U/100)+'（'+custs.length+' 客户行）');
  // P95 分接口 + 总
  const pct=(arr,p)=>{ const s=[...arr].sort((a,b)=>a-b); const i=Math.min(s.length-1,Math.ceil(p/100*s.length)-1); return s[Math.max(0,i)]; };
  ok(errs===0,'零错误（'+samples.length+' 次调用, 失败 '+errs+'）'+(errs?' '+errList.join(' | '):''));
  for(const c of CALLS){ const ms=samples.filter(s=>s.label===c.name).map(s=>s.ms); const p95=pct(ms,95); const p50=pct(ms,50);
    ok(p95<P95_BUDGET_MS, c.name+' P95='+p95.toFixed(0)+'ms < 2000ms（P50='+p50.toFixed(0)+'ms, n='+ms.length+'）'); }
  const allMs=samples.map(s=>s.ms);
  console.log('  ℹ 总体 P50='+pct(allMs,50).toFixed(0)+'ms P95='+pct(allMs,95).toFixed(0)+'ms max='+Math.max(...allMs).toFixed(0)+'ms n='+allMs.length);
  console.log('RESULT pass='+pass+' fail='+fail);
  process.exit(fail===0?0:1);
})().catch(e=>{console.log('ERROR '+e.message);process.exit(1);});
