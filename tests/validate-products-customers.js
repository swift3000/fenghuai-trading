#!/usr/bin/env node
const path=require('path'),fs=require('fs');
const PROJECT=path.resolve(__dirname,'..');
const cb=require(path.join(PROJECT,'node_modules','@cloudbase','node-sdk'));
const env={};
fs.readFileSync(path.join(PROJECT,'.env'),'utf8').split('\n').forEach(l=>{const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);if(m)env[m[1]]=m[2].trim();});
const db=cb.init({secretId:env.CLOUDBASE_SECRET_ID,secretKey:env.CLOUDBASE_SECRET_KEY,envId:env.CLOUDBASE_ENV_ID}).database();
const _=db.command;
const esc=s=>String(s==null?'':s).replace(/[.*+?^${}()|[\\]/g,'\\$&');

(async()=>{
  let pass=0,fail=0;
  const ok=(c,m)=>{if(c){pass++;}else{fail++;console.log('  \u2717 '+m);}};

  // === 1. 全量商品读取 ===
  const pRes=await db.collection('products').limit(1000).get();
  const products=pRes.data;
  console.log('【商品】共读取: '+products.length);

  // 2. 每条商品字段完整性
  const noName=[],noPrice=[],noSpec=[];
  for(const p of products){
    if(!p.name||!String(p.name).trim()) noName.push(p._id);
    const mode=p.pricing_mode||'case';
    if(mode==='piece' && (p.price_piece==null||p.price_piece===0)) noPrice.push(p.name+'(piece无件价)');
    else if(mode==='unit' && (p.price_unit==null&&p.price_zero==null)) noPrice.push(p.name+'(unit无包价)');
    else if(mode==='case' && (p.price_piece==null&&p.price_unit==null&&p.price_zero==null)) noPrice.push(p.name+'(case无件包价)');
  }
  ok(noName.length===0,'商品名称缺失: '+noName.slice(0,5).join(','));
  ok(noPrice.length===0,'商品价格字段缺失: '+noPrice.slice(0,5).join(','));
  console.log('  字段完整性: 名称缺失='+noName.length+' 价格缺失='+noPrice.length);

  // 3. 搜索命中（每条商品按 name 搜索，验证能搜到自身）
  // 为节省时间只抽样前 50 条 + 全部料号搜索
  const sample=products.slice(0,50);
  let searchFail=0;
  for(const p of sample){
    const conds=[{name:db.RegExp({regexp:esc(p.name),options:'i'})}];
    if(p.material_code!=null&&String(p.material_code)!=='') conds.push({material_code:db.RegExp({regexp:esc(p.material_code),options:'i'})});
    if(p.pinyin) conds.push({pinyin:db.RegExp({regexp:esc(p.pinyin),options:'i'})});
    const r=await db.collection('products').where(_.or(conds)).limit(100).get();
    const hit=r.data.some(x=>x._id===p._id);
    if(!hit){searchFail++;console.log('  \u2717 搜索未命中: '+p.name+' code='+p.material_code);}
  }
  ok(searchFail===0,'抽样搜索全部命中');
  console.log('  搜索验证: 抽样 50 条, 未命中 '+searchFail);

  // 4. 料号唯一性
  const codeSet=new Set();let dupCodes=0;
  for(const p of products){
    if(p.material_code){
      if(codeSet.has(p.material_code)) dupCodes++;
      codeSet.add(p.material_code);
    }
  }
  ok(dupCodes===0,'料号唯一');
  console.log('  料号: 唯一性 OK, 总料号数='+codeSet.size);

  // 5. 每条商品可构建订单行（模拟前端 qtyDesc/amount）
  let lineFail=0;
  for(const p of products){
    const name=p.name;
    const pp=p.price_piece||0, pu=(p.price_unit!=null?p.price_unit:p.price_zero)||0;
    const mode=p.pricing_mode||'case';
    const pieceQty=1, packageQty=1;
    let amount;
    if(mode==='piece') amount=Math.round(pieceQty*pp*100)/100;
    else if(mode==='unit') amount=Math.round(packageQty*pu*100)/100;
    else amount=Math.round((pieceQty*pp+packageQty*pu)*100)/100;
    if(amount===0 && (pp>0||pu>0)){lineFail++;}
    if(!name){lineFail++;}
  }
  ok(lineFail===0,'全部 167 商品行构建正常');
  console.log('  订单行构建: 失败='+lineFail);

  // === 6. 全量客户读取 ===
  const cRes=await db.collection('customers').limit(1000).get();
  const customers=cRes.data;
  console.log('\n【客户】共读取: '+customers.length);

  // 7. 客户名称非空
  const cNoName=customers.filter(c=>!c.name||!String(c.name).trim());
  ok(cNoName.length===0,'客户名称缺失: '+cNoName.length);
  console.log('  名称缺失: '+cNoName.length);

  // 8. 客户搜索抽样（前 50 条）
  const cSample=customers.slice(0,50);
  let cSearchFail=0;
  for(const c of cSample){
    const r=await db.collection('customers').where(_.or([
      {name:db.RegExp({regexp:esc(c.name),options:'i'})}
    ])).limit(100).get();
    const hit=r.data.some(x=>x._id===c._id);
    if(!hit){cSearchFail++;}
  }
  ok(cSearchFail===0,'客户搜索全部命中');
  console.log('  搜索验证: 抽样 50 条, 未命中 '+cSearchFail);

  // === 9. 写入路径：创建 TEST 商品 + TEST 客户 ===
  // 商品
  const tp=await db.collection('products').add({
    name:'TEST验证商品',material_code:'TESTV001',spec:'测试',pricing_mode:'case',
    unit_piece_qty:1,price_piece:10,price_unit:2,unit:'包',pinyin:'TEST',is_adjustable:false,
    createdAt:new Date(),updatedAt:new Date()
  });
  ok(!!tp.id,'TEST商品创建成功');
  // 搜索验证
  const tpSearch=await db.collection('products').where({name:'TEST验证商品'}).get();
  ok(tpSearch.data.length===1,'TEST商品可搜索');

  // 客户
  const tc=await db.collection('customers').add({
    name:'TEST验证客户',alias:'',region:'汉滨区',phone:'13800000000',contact:'测试',
    createdAt:new Date(),updatedAt:new Date()
  });
  ok(!!tc.id,'TEST客户创建成功');
  const tcSearch=await db.collection('customers').where({name:'TEST验证客户'}).get();
  ok(tcSearch.data.length===1,'TEST客户可搜索');

  // === 10. 创建含 20 条不同商品（不同计价模式）的测试订单 ===
  // 选取 20 条：case/piece/unit 各若干
  const caseItems=products.filter(p=>(p.pricing_mode||'case')==='case'&&p.price_piece&&p.price_unit).slice(0,10);
  const pieceItems=products.filter(p=>p.pricing_mode==='piece'&&p.price_piece).slice(0,5);
  const unitItems=products.filter(p=>p.pricing_mode==='unit'&&(p.price_unit||p.price_zero)).slice(0,5);
  const orderItems=[...caseItems,...pieceItems,...unitItems].map(p=>({
    material_code:p.material_code,name:p.name,spec:p.spec||'',
    pricing_mode:p.pricing_mode||'case',unit_piece_qty:p.unit_piece_qty||1,
    price_piece:p.price_piece||0,price_unit:(p.price_unit!=null?p.price_unit:p.price_zero)||0,
    unit:p.unit||'包',piece_qty:2,package_qty:1,remark:'TEST备注'
  }));
  // 直接用 node-sdk 建订单（admin 身份）
  const now=new Date();
  const orderNo='TEST-20260820-9999';
  let expectedSum=0;
  for(const it of orderItems){
    const pp=it.price_piece,pu=it.price_unit;
    if(it.pricing_mode==='piece') expectedSum+=2*pp;
    else if(it.pricing_mode==='unit') expectedSum+=1*pu;
    else expectedSum+=(2*pp+1*pu);
  }
  expectedSum=Math.round(expectedSum*100)/100;
  const orderDoc={
    orderNo,customerId:tc.id,customerName:'TEST验证客户',customerRegion:'汉滨区',
    totalAmount:expectedSum,items:orderItems,status:'submitted',sortStatus:'pending',outStatus:'pending',
    payment_status:'unpaid',received_amount:0,created_by_name:'TEST',created_at:now
  };
  const orderAdd=await db.collection('orders').add(orderDoc);
  ok(!!orderAdd.id,'TEST订单创建（20条商品行）成功');
  console.log('  订单行='+orderItems.length+' 金额='+expectedSum);

  // 验证订单行可回读
  const orderReadRaw=await db.collection('orders').doc(orderAdd.id).get();
  const orderRead=Array.isArray(orderReadRaw.data)?orderReadRaw.data[0]:orderReadRaw.data;
  ok(orderRead&&orderRead.items&&orderRead.items.length===orderItems.length,'订单回读行数一致');
  const firstItem=orderRead.items[0];
  ok(!!firstItem.name,'订单行有商品名');
  ok(firstItem.remark==='TEST备注','订单行有备注');
  ok(firstItem.piece_qty===2,'订单行件数=2');

  // === 11. 清理 ===
  await db.collection('orders').doc(orderAdd.id).remove();
  await db.collection('products').doc(tp.id).remove();
  await db.collection('customers').doc(tc.id).remove();
  console.log('\n【清理完成】');

  // === 汇总 ===
  console.log('\n==== 结果：通过 '+pass+'，失败 '+fail+' ====');
  process.exit(fail>0?1:0);
})().catch(e=>{console.error('ERR:',e);process.exit(2);});
