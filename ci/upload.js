// 乾多多小程序 CI 上传（不依赖 IDE 扫码，走 miniprogram-ci）
const ci = require('miniprogram-ci')
const appid = 'wxe4ab72773abd200f'
const version = process.env.CI_VERSION || '0.1.0'
const desc = process.env.CI_DESC || ('CI 自动上传 ' + new Date().toLocaleString('zh-CN'))
const robot = Number(process.env.CI_ROBOT || 1)

const project = new ci.Project({
  appid,
  type: 'miniProgram',
  projectPath: process.cwd(),
  privateKeyPath: 'ci/private.wxe4ab72773abd200f.key',
  // 项目根即小程序根，混入大量非运行时文件，必须全部忽略
  ignores: [
    'node_modules/**/*',
    'scripts/**/*',
    'tests/**/*',
    'cloudfunctions/**/*',
    'ci/**/*',
    'docs/**/*',
    'loop_project/**/*',
    'deploy/**/*',
    '.local/**/*',
    '**/*.md',
    '**/*.sh',
    '**/*.log',
    '**/*.jsonl',
    'output/**/*',
    'screenshots/**/*',
    '.workbuddy/**/*',
    '.env',
    '.DS_Store',
    'b7fbab622776d6a24ac2ff94bb759960/**/*',
    'project.private.config.json',
    '临时/**/*',
    '头像/**/*',
    'package.json',
    'package-lock.json'
  ]
})

;(async () => {
  const res = await ci.upload({
    project,
    version,
    desc,
    robot,
    setting: { es6: true, es7: true, minify: true, autoPrefixWXSS: true }
  })
  console.log('UPLOAD_OK')
  console.log('version:', res.version)
  console.log('size:', res.size)
})().catch(e => {
  console.error('UPLOAD_ERR:', e.message || e)
  process.exit(1)
})
