const fs=require('fs');
const ROOT=require('path').resolve(__dirname,'..');const env={};
fs.readFileSync(ROOT+'/.env','utf8').split('\n').forEach(l=>{const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);if(m)env[m[1]]=m[2].trim();});
const cb=require(ROOT+'/node_modules/@cloudbase/node-sdk');
const app=cb.init({secretId:env.CLOUDBASE_SECRET_ID,secretKey:env.CLOUDBASE_SECRET_KEY,envId:env.CLOUDBASE_ENV_ID});
const db=app.database();
const ADMIN='oo0s93SW9A4V4iO1ANyA3eqzxVIA';
const R14=db.RegExp({regexp:'TEST_R14',options:''});
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  PASS '+m);} else {fail++;console.log('  FAIL '+m);} };
const C=async (fn,d)=>{ try{const r=await app.callFunction({name:fn,data:d});return (r&&r.result)||{};}catch(e){return {__err:e.message,code:-1};} };
const cents=n=>Math.round(Number(n||0)*100);
const created={orders:[],customers:[],payments:[]};
async function cleanup(){
  try{
    const pp=await db.collection('payments').where({customer_name:R14}).get();
    for(const x of (pp.data||[])){ await db.collection('payments').doc(x._id).remove().catch(()=>{}); }
    for(const oid of created.orders){ await C('orders',{action:'delete',orderId:oid,qaAsOpenid:ADMIN}); }
    const orem=await db.collection('orders').where({customerName:R14}).get();
    for(const x of (orem.data||[])){ await db.collection('orders').doc(x._id).remove().catch(()=>{}); }
    for(const cid of created.customers){ await C('customers',{action:'delete',customerId:cid,qaAsOpenid:ADMIN}); }
    const crem=await db.collection('customers').where({name:R14}).get();
    for(const x of (crem.data||[])){ await db.collection('customers').doc(x._id).remove().catch(()=>{}); }
  }catch(e){}
}
(async()=>{
  // 基线快照（造数前捕获，供 payment 聚合断言用绝对增量口径）
  const basePay=await db.collection('payments').get();
  let baseCash=0,baseCashN=0,baseWx=0,baseWxN=0;
  (basePay.data||[]).forEach(x=>{ if((x.method||'')==='现金'){baseCash+=cents(x.amount);baseCashN++;} else if((x.method||'')==='微信'){baseWx+=cents(x.amount);baseWxN++;} });

  console.log('== 造数：A(2单:100全结清+200部分收50) / B(1单80全结清) ==');
  const mkCust=async name=>{ const r=await C('customers',{action:'create',name,region:'R14交叉',phone:'13700001111',contact:'qa',qaAsOpenid:ADMIN}); const cid=r.data&&(r.data._id||r.data.customerId); if(cid)created.customers.push(cid); return cid; };
  const mkOrder=async (cid,name,piece,price)=>{ const r=await C('orders',{action:'create',customerId:cid,customerName:name,customerRegion:'R14交叉',qaAsOpenid:ADMIN,items:[{name:'x',spec:'',pricing_mode:'piece',piece_qty:piece,package_qty:0,price_piece:price,price_unit:0}]}); const oid=r.data&&r.data._id; if(oid)created.orders.push(oid); return {oid,orderNo:r.data&&r.data.orderNo}; };
  const A=await mkCust('TEST_R14客户A');
  const B=await mkCust('TEST_R14客户B');
  ok(!!A&&!!B,'两客户创建成功');
  const a1=await mkOrder(A,'TEST_R14客户A',2,50);   // 100
  const a2=await mkOrder(A,'TEST_R14客户A',4,50);   // 200
  const b1=await mkOrder(B,'TEST_R14客户B',1,80);   // 80
  ok(!!a1.oid&&!!a2.oid&&!!b1.oid,'三订单创建成功 '+[a1.orderNo,a2.orderNo,b1.orderNo].join(' '));
  console.log('== 收款流（真实 collect/confirmPayment 云函数）==');
  const doPay=async (oid,amt,method,tag)=>{ const c=await C('receivable',{action:'collect',orderId:oid,amount:amt,paymentMethod:method,clientToken:'r14_'+tag+Date.now(),qaAsOpenid:ADMIN}); if(c.code!==0){ console.log('  ! collect err',tag,JSON.stringify(c).slice(0,150)); return null; } const pid=c.data&&(c.data.paymentId||c.data._id); if(pid)created.payments.push(pid); const cf=await C('receivable',{action:'confirmPayment',paymentId:pid,qaAsOpenid:ADMIN}); if(cf.code!==0){ console.log('  ! confirm err',tag,JSON.stringify(cf).slice(0,150)); return null; } return pid; };
  ok(!!await doPay(a1.oid,100,'现金','a1full'),'A单1 全收100+确认');
  ok(!!await doPay(a2.oid,50,'微信','a2part'),'A单2 部分收50+确认（余额150未结清）');
  ok(!!await doPay(b1.oid,80,'现金','b1full'),'B单1 全收80+确认（结清）');
  console.log('== ① report customer tab（A:2单 300/150/150；B:1单 80/80/0）==');
  const rep=await C('report',{action:'export',reportTab:'customer',timeTab:'all',format:'csv',qaAsOpenid:ADMIN});
  const rows=(rep.data&&rep.data.csvContent||'').split('\n').slice(1);
  const ar=rows.find(l=>l.indexOf('TEST_R14客户A')===0), br=rows.find(l=>l.indexOf('TEST_R14客户B')===0);
  ok(!!ar&&!!br,'A/B 都出现在报表');
  const ac=ar?ar.split(','):[]; const bc=br?br.split(','):[];
  ok(ar&&Number(ac[2])===2&&cents(ac[4])===30000&&cents(ac[5])===15000&&cents(ac[6])===15000,'A 行= 2单 应收300 已收150 欠150（实际 '+(ar||'缺')+'）');
  ok(br&&Number(bc[2])===1&&cents(bc[4])===8000&&cents(bc[5])===8000&&cents(bc[6])===0,'B 行= 1单 应收80 已收80 欠0（实际 '+(br||'缺')+'）');
  const allRows=rows.map(l=>l.split(',')); const sumT=allRows.reduce((s,c)=>s+cents(c[4]),0); const sumP=allRows.reduce((s,c)=>s+cents(c[5]),0); const sumU=allRows.reduce((s,c)=>s+cents(c[6]),0);
  ok(sumT===sumP+sumU,'全表合计守恒 应收=已收+欠（实际 总'+(sumT/100)+' 收'+(sumP/100)+' 欠'+(sumU/100)+'）');
  console.log('== ② receivable dashboard（B 全部paid=已结清；A 有未结清订单≠结清）==');
  const dash=await C('receivable',{action:'dashboard',view:'unsettled',qaAsOpenid:ADMIN});
  const da=((dash.data||{}).customers||[]).find(c=>(c.name||c.customerName)==='TEST_R14客户A');
  ok(!!da&&cents(da.unpaidAmount)===15000&&cents(da.paidAmount)===15000&&da.isSettled!==true,'A 台账 欠150 已收150 未结清');
  const dashAll=await C('receivable',{action:'dashboard',view:'settled',qaAsOpenid:ADMIN});
  const sb=((dashAll.data||{}).customers||[]).find(c=>(c.name||c.customerName)==='TEST_R14客户B');
  ok(!!sb&&cents(sb.unpaidAmount)===0,'B 出现在已结清视图 欠款=0');
  console.log('== ③ payment tab 收款方式聚合（基线'+baseCashN+'现金'+(baseCash/100)+'/'+baseWxN+'微信'+(baseWx/100)+' + 增量 现金2笔180 / 微信1笔50）==');
  const pay=await C('report',{action:'export',reportTab:'payment',timeTab:'all',format:'csv',qaAsOpenid:ADMIN});
  const prows=((pay.data&&pay.data.csvContent)||'').split('\n').slice(1).map(l=>l.split(','));
  const cash=prows.find(c=>c[0]==='现金'); const wechat=prows.find(c=>c[0]==='微信');
  ok(cash&&Number(cash[1])===baseCashN+2&&cents(cash[2])===baseCash+18000,'现金 '+(baseCashN+2)+'笔 '+(baseCash/100+180)+'（实际 '+(cash?cash.join(','):'缺')+'）');
  ok(wechat&&Number(wechat[1])===baseWxN+1&&cents(wechat[2])===baseWx+5000,'微信 '+(baseWxN+1)+'笔 '+(baseWx/100+50)+'（实际 '+(wechat?wechat.join(','):'缺')+'）');
  console.log('== 清理 + 残留归零 + 生产基线回验 ==');
  await cleanup();
  const lc=await db.collection('customers').where({name:R14}).count();
  const lo=await db.collection('orders').where({customerName:R14}).count();
  const lp=await db.collection('payments').where({customer_name:R14}).count();
  ok(lc.total===0&&lo.total===0&&lp.total===0,'残留归零（客户='+lc.total+' 订单='+lo.total+' 收款='+lp.total+'）');
  const bc0=await db.collection('customers').count(); const bo0=await db.collection('orders').count(); const bp0=await db.collection('payments').count();
  ok(bc0.total===282&&bo0.total===1&&bp0.total===1,'生产基线恢复 282/1/1（实际 '+bc0.total+'/'+bo0.total+'/'+bp0.total+'）');
  console.log('RESULT pass='+pass+' fail='+fail);
  process.exit(fail===0?0:1);
})().catch(e=>{ console.log('ERROR '+e.message+'\n'+(e.stack||'')); cleanup().then(()=>process.exit(1)); process.exit(1); });
