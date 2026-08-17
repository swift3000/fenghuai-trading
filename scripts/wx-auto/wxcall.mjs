#!/usr/bin/env node
/**
 * 微信开发者工具 MCP 调用器
 * 用法: node wxcall.mjs <toolName> '<paramsJson>'
 * 例:   node wxcall.mjs wechat_ide '{"action":"status"}'
 */
import { spawn } from 'child_process'
import { resolve } from 'path'

const MCP_BIN = '/Users/god/.local/bin/wechat-devtools-mcp'
const ENV = {
  ...process.env,
  WECHAT_DEVTOOLS_CLI: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  WECHAT_PROJECT_PATH: '/Users/god/Desktop/项目/github/fenghuai-trading'
}

const tool = process.argv[2]
const paramsJson = process.argv[3] || '{}'

const child = spawn(MCP_BIN, [], { env: ENV, stdio: ['pipe', 'pipe', 'pipe'] })
let buf = ''
let gotResult = false
const timer = setTimeout(() => {
  if (!gotResult) {
    console.error('TIMEOUT')
    child.kill()
    process.exit(1)
  }
}, 120000)

child.stdout.on('data', d => {
  buf += d.toString()
  for (const line of buf.split('\n')) {
    if (!line.trim() || gotResult) continue
    try {
      const msg = JSON.parse(line)
      if (msg.id === 2) {
        gotResult = true
        clearTimeout(timer)
        const text = msg.result?.content?.[0]?.text || JSON.stringify(msg.result)
        console.log(text)
        child.kill()
        process.exit(0)
      }
    } catch (e) { /* partial line */ }
  }
})

child.on('close', () => { if (!gotResult) { clearTimeout(timer); process.exit(1) } })

const init = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'wxcall', version: '1.0' } } })
const initd = JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })
const call = JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: tool, arguments: { params: JSON.parse(paramsJson) } } })

setTimeout(() => {
  child.stdin.write(init + '\n')
  setTimeout(() => {
    child.stdin.write(initd + '\n')
    setTimeout(() => {
      child.stdin.write(call + '\n')
    }, 300)
  }, 300)
}, 500)
