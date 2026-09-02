const path=require('path'),fs=require('fs');
const P='/Users/god/Desktop/项目/github/fenghuai-trading';
const env={};fs.readFileSync(path.join(P,'.env'),'utf8').split('\n').forEach(l=>{const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);if(m)env[m[1]]=m[2].trim();});
const cb=require(path.join(P,'node_modules','@cloudbase','node-sdk'));
const app=cb.init({secretId:env.CLOUDBASE_SECRET_ID,secretKey:env.CLOUDBASE_SECRET_KEY,envId:env.CLOUDBASE_ENV_ID});
const db=app.database();
const fields=['price_unit','price_piece','price_zero'];
const need=v=>{const n=Number(v);return isFinite(n)&&Math.abs(n*100-Math.round(n*100))>1e-9;};
const dry=process.argv.includes('--dry');
(async()=>{
  // 拉全量
  const all=[];let skip=0;
  for(;;){const b=await db.collection('products').skip(skip).limit(100).get();const d=b.data||[];all.push(...d);if(d.length<100)break;skip+=100;}
  const before=all.length;
  const plan=[];
  for(const p of all){
    const patch={};let hit=false;
    for(const k of fields){ if(p[k]!=null&&p[k]!==''&&need(p[k])){ patch[k]=Math.round(Number(p[k])*100)/100; hit=true; } }
    if(hit) plan.push({id:p._id,name:p.name,old:Object.fromEntries(fields.filter(k=>p[k]!=null&&p[k]!=='').map(k=>[k,p[k]])),new:patch});
  }
  console.log('扫描: 商品',before,'需归一文档',plan.length,'字段处',plan.reduce((a,x)=>a+Object.keys(x.new).length,0));
  if(dry){ console.log('DRY-RUN 不落库, 样本',JSON.stringify(plan.slice(0,3))); return; }
  // 落库（node-sdk: doc().set 会整文档覆盖，改用 update 局部更新）
  let written=0;const log=[];
  for(const x of plan){
    // 幂等：写前复读当前值，若已=目标则跳过（where 口径——doc(_id) 对本集合复合 _id 读出 undefined，node-sdk 坑）
    const curQ=await db.collection('products').where({ _id: x.id }).limit(1).get();
    const cur=curQ.data&&curQ.data[0];
    if(!cur){ console.log('  跳过(文档不存在)',x.name); continue; }
    const changed={};
    for(const k of Object.keys(x.new)){ if(cur[k]!==undefined&&need(cur[k])&&Number(cur[k])!==x.new[k]) changed[k]=x.new[k]; }
    if(!Object.keys(changed).length){ continue; } // 已归一，幂等跳过
    await db.collection('products').where({ _id: x.id }).update(changed);
    // 回读校验（已知坑：node-sdk 写后必须回读；where 口径同上）
    const afterQ=await db.collection('products').where({ _id: x.id }).limit(1).get();
    const after=afterQ.data&&afterQ.data[0];
    const ok=Object.keys(changed).every(k=>after[k]===changed[k]);
    if(!ok){ throw new Error('回读校验失败 '+x.name+' '+JSON.stringify({changed,after})); }
    written++; log.push({name:x.name,changed});
  }
  // 条数守恒
  const afterAll=[];skip=0;for(;;){const b=await db.collection('products').skip(skip).limit(100).get();const d=b.data||[];afterAll.push(...d);if(d.length<100)break;skip+=100;}
  // 复扫残留
  let resid=0;for(const p of afterAll)for(const k of fields)if(p[k]!=null&&p[k]!==''&&need(p[k]))resid++;
  fs.writeFileSync(path.join(P,'.local','price-migration-log.json'),JSON.stringify({ts:new Date().toISOString(),written,log},null,1));
  console.log('落库成功',written,'条; 条数守恒',before,'→',afterAll.length,'; 残留超2位',resid);
  console.log('守恒校验', before===afterAll.length?'PASS':'FAIL');
  process.exit(resid===0&&before===afterAll.length?0:1);
})().catch(e=>{console.error('FATAL',e.message);process.exit(2);});
