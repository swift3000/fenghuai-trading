
const path=require('path'),fs=require('fs');
const PROJECT=path.resolve(__dirname,'..');
const cb=require(path.join(PROJECT,'node_modules','@cloudbase','node-sdk'));
const env={};
fs.readFileSync(path.join(PROJECT,'.env'),'utf8').split('\n').forEach(l=>{const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);if(m)env[m[1]]=m[2].trim();});
const app=cb.init({secretId:env.CLOUDBASE_SECRET_ID,secretKey:env.CLOUDBASE_SECRET_KEY,envId:env.CLOUDBASE_ENV_ID});
const db=app.database();
const ADMIN='oo0s93SW9A4V4iO1ANyA3eqzxVIA';
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  PASS '+m);}else{fail++;console.log('  FAIL '+m);}};
const C=async(fn,d)=>{try{const r=await app.callFunction({name:fn,data:d});return (r&&r.result)||{};}catch(e){return {__err:e.message,code:-1};}};

(async()=>{
  console.log('== V1 products 搜索 (action=list)');
  const list=await C('products',{action:'list',searchKey:'TEST',page:1,pageSize:5,qaAsOpenid:ADMIN});
  ok(list.code===0, 'list 正常 code=0 (got '+list.code+' '+(list.message||'')+')');
  const search=await C('products',{action:'list',searchKey:'不存在关键字xyz999',page:1,pageSize:5,qaAsOpenid:ADMIN});
  ok(search.code===0, 'searchKey 搜索不 500 (got '+search.code+')');

  console.log('== A2 products getDetail 不存在 ID');
  const gd=await C('products',{action:'getDetail',productId:'nonexistent_id_123',qaAsOpenid:ADMIN});
  ok(gd.code===4004, 'getDetail 不存在 → 4004 (got '+gd.code+' '+(gd.message||'')+')');

  console.log('== V5 dashboard day 分支');
  const dDay=await C('receivable',{action:'dashboard',timeTab:'day',qaAsOpenid:ADMIN});
  const dAll=await C('receivable',{action:'dashboard',timeTab:'all',qaAsOpenid:ADMIN});
  ok(dDay.code===0&&dAll.code===0,'dashboard day/all 均 code=0');
  const dayCnt=(dDay.data&&(dDay.data.total||(dDay.data.list||[]).length))||0;
  const allCnt=(dAll.data&&(dAll.data.total||(dAll.data.list||[]).length))||0;
  ok(dayCnt<=allCnt,'day 口径 ⊆ all (day='+dayCnt+' all='+allCnt+')');

  console.log('== V2 collect 折价上限 (金额单位=元)');
  const cust=await C('customers',{action:'create',name:'TEST_T62折价客户',contact:'qa',phone:'13800002222',region:'陕西',qaAsOpenid:ADMIN});
  const cid=cust.data&&(cust.data._id||cust.data.customerId);
  const created=[];
  if(!cid){ ok(false,'造客户失败: '+JSON.stringify(cust).slice(0,200)); }
  else{
    const o=await C('orders',{action:'create',customerId:cid,customerName:'TEST_T62折价客户',qaAsOpenid:ADMIN,
      items:[{piece_qty:1,package_qty:0,price_piece:100,pricing_mode:'piece'}],totalAmount:100});
    const oid=o.data&&(o.data._id||o.data.orderId);
    if(!oid){ ok(false,'造订单失败: '+JSON.stringify(o).slice(0,200)); }
    else{
      created.push(oid);
      const bad=await C('receivable',{action:'collect',orderId:oid,amount:80,discount:50,paymentMethod:'cash',note:'T62回归-超上限',qaAsOpenid:ADMIN});
      if(bad.code===403){ console.log('  INFO admin 无 receivable:discount 权限，403 属权限门禁生效；改走纯 amount 超限验证');
        const bad2=await C('receivable',{action:'collect',orderId:oid,amount:101,paymentMethod:'cash',note:'T62回归-超上限',qaAsOpenid:ADMIN});
        ok(bad2.code===4002,'collect 101 超剩余 100 → 4002 (got '+bad2.code+' '+(bad2.message||'')+')');
      } else {
        ok(bad.code===4002,'collect 80+折价50 超剩余100 → 4002 (got '+bad.code+' '+(bad.message||'')+')');
      }
      const good=await C('receivable',{action:'collect',orderId:oid,amount:60,paymentMethod:'cash',note:'T62回归-正常',qaAsOpenid:ADMIN});
      ok(good.code===0,'collect 60 ≤剩余 通过 (got '+good.code+' '+(good.message||'')+')');
      // 补一笔 pending 后验证 pending 占额含 discount 的修复（若有折价权限）
      const badPend=await C('receivable',{action:'collect',orderId:oid,amount:35,discount:10,paymentMethod:'cash',note:'T62回归-pending含折价',qaAsOpenid:ADMIN});
      if(badPend.code===403){ console.log('  INFO 折价权限受限，pending 含折价校验跳过（代码走读确认）'); }
      else ok(badPend.code===4002,'pending 60 占额后 35+10 超剩余40 → 4002 (got '+badPend.code+' '+(badPend.message||'')+')');
    }
  }

  console.log('== V6 exportLedger 日期格式');
  const exp=await C('report',{action:'export',type:'ledger',qaAsOpenid:ADMIN});
  let dateOk=true,sample='';
  const s=JSON.stringify(exp.data||{});
  const m=s.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) [A-Z][a-z]{2} \d{1,2}/);
  if(m){dateOk=false;sample=m[0];}
  ok(exp.code===0,'export ledger code=0 (got '+exp.code+')');
  ok(dateOk,'无美式 "Wed Sep 02" 格式'+(sample?'（发现 '+sample+'）':''));

  // 清理 TEST
  let cleaned=0;
  try{
    if(cid){ await db.collection('customers').doc(cid).remove(); cleaned++; }
    for(const id of created){ try{ await db.collection('orders').doc(id).remove(); cleaned++; }catch(e){} }
  }catch(e){ console.log('  清理告警: '+e.message); }
  // 残留 payments 也清（测试单产生的 pending）
  try{
    for(const id of created){
      const pq=await db.collection('payments').where({orderId:id,client_token:/^auto_/}).limit(100).get().catch(()=>({data:[]}));
      const pq2=await db.collection('payments').where({order_id:id}).limit(100).get().catch(()=>({data:[]}));
      const seen={};
      for(const p of [].concat(pq.data||[],pq2.data||[])){ if(seen[p._id])continue; seen[p._id]=1;
        if(String(p.note||'').indexOf('T62回归')>=0){ await db.collection('payments').doc(p._id).remove(); cleaned++; } }
    }
  }catch(e){ console.log('  payments 清理告警: '+e.message); }
  console.log('  清理 '+cleaned+' 条 TEST 残留');

  console.log('\n结果: '+pass+' 通过, '+fail+' 失败');
  process.exit(fail?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});

