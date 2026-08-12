const fs = require('fs')
const path = require('path')
const envPath = path.join(__dirname, '../.env')
const envVars = {}
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^#=#]+)=(.+)$/)
  if (m) envVars[m[1].trim()] = m[2].trim()
})
const cloud = require('@cloudbase/node-sdk')
const app = cloud.init({ env: envVars.CLOUDBASE_ENV_ID, secretId: envVars.CLOUDBASE_SECRET_ID, secretKey: envVars.CLOUDBASE_SECRET_KEY })
const db = app.database()
const coll = db.collection('products')
async function main() {
  let updated = 0
  const res = await coll.limit(200).get()
  for (const p of res.data) {
    const patch = {}
    if (p.price_zero === undefined && p.price_unit !== undefined) {
      patch.price_zero = p.price_unit
    }
    // clean up accidental nested data field if present
    if (p.data && typeof p.data === 'object' && p.data.price_zero !== undefined) {
      patch.price_zero = p.price_zero !== undefined ? p.price_zero : p.data.price_zero
      // remove nested data field via set to undefined not supported; use update setting data to null
      // We'll set price_zero then remove data by update with remove
    }
    if (Object.keys(patch).length) {
      const upd = await coll.doc(p._id).update(patch)
      updated++
    }
    // remove any stray nested data field
    if (p.data !== undefined) {
      // cloudbase supports remove specific field via update({field: _.remove()})
      const _ = db.command
      await coll.doc(p._id).update({ data: _.remove() })
    }
  }
  console.log('docs processed:', res.data.length, '| updated:', updated)

  // verify
  const withZero = await coll.where({ price_zero: { $exists: true } }).count()
  const withUnit = await coll.where({ price_unit: { $exists: true } }).count()
  const nested = await coll.where({ data: { $exists: true } }).count()
  console.log('with price_zero:', withZero.total)
  console.log('with price_unit:', withUnit.total)
  console.log('with nested data field:', nested.total)
  const sample = await coll.limit(3).get()
  for (const p of sample.data) console.log(p.name, '| zero:', p.price_zero, '| unit:', p.price_unit, '| nested:', p.data)
}
main().catch(e => { console.error('ERR', e); process.exit(1) })
