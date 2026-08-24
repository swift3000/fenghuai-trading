// T45 数据迁移：孤儿订单 customerId 重挂到同名现存客户（幂等，先备份，守恒校验）
const fs=require('fs');
const env={};
fs.readFileSync('.env','utf8').split(String.fromCharCode(10)).forEach(l=>{const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);if(m)env[m[1]]=m[2].trim();});
const cb=require('@cloudbase/node-sdk');
const app=cb.init({secretId:env.CLOUDBASE_SECRET_ID,secretKey:env.CLOUDBASE_SECRET_KEY,envId:env.CLOUDBASE_ENV_ID});
const db=app.database();
const DRY=process.env.DRY==='1';
async function allDocs(coll,max){const out=[];for(let s=0;s<max;s+=100){const r=await db.collection(coll).skip(s).limit(100).get();out.push(...r.data);if(r.data.length<100)break;}return out;}
(async()=>{
  const customers=await allDocs('customers',3000);
  const orders=await allDocs('orders',1000);
  const payments=await allDocs('payments',1000);
  // 备份
  if(!DRY){
    const dir='docs/reports';
    const stamp='20260824';
    fs.writeFileSync(dir+'/\_backup_customers_'+stamp+'.json',JSON.stringify(customers,null,1));
    fs.writeFileSync(dir+'/\_backup_orders_'+stamp+'.json',JSON.stringify(orders,null,1));
    fs.writeFileSync(dir+'/\_backup_payments_'+stamp+'.json',JSON.stringify(payments,null,1));
    console.log('BACKUP written x3');
  }
  const idSet=new Set(customers.map(c=>c._id));
  const byName={};
  customers.forEach(c=>{(byName[c.name]=byName[c.name]||[]).push(c);});
  let fixed=0, skipAmbig=0, skipNoMatch=0, skipAlready=0;
  for(const o of orders){
    if(o.customerId && idSet.has(o.customerId)) { skipAlready++; continue; }
    const same=byName[o.customerName]||[];
    if(same.length===1){
      const target=same[0]._id;
      if(DRY){ console.log('DRY would repoint',o.orderNo,'->',target,o.customerName); }
      else{
        await db.collection('orders').where({ orderNo: o.orderNo }).update({ customerId: target }); // node-sdk 口径: update 直接传字段, 不用 {data:} (已知坑)
        const chk=(await db.collection('orders').where({ orderNo: o.orderNo }).get()).data[0];
        if(!chk || chk.customerId!==target) throw new Error('repoint verify fail '+o.orderNo);
        console.log('REPOINT',o.orderNo,o.customerName,'->',target.slice(0,8));
      }
      fixed++;
    } else if(same.length>1){ console.log('AMBIG',o.orderNo,o.customerName,same.length); skipAmbig++; }
    else { console.log('NOMATCH',o.orderNo,o.customerName); skipNoMatch++; }
  }
  console.log('SUMMARY fixed='+fixed,'alreadyOK='+skipAlready,'ambig='+skipAmbig,'noMatch='+skipNoMatch,'ordersTotal='+orders.length,'conserved='+(fixed+skipAlready+skipAmbig+skipNoMatch===orders.length));
  console.log('DONE');
})().catch(e=>{console.error('FATAL',e.message,e.stack);process.exit(1);});
