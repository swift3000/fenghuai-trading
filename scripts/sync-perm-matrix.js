#!/usr/bin/env node
/**
 * 权限矩阵一致性校验（防漂移）
 *
 * 单一来源：cloudfunctions/auth/perm-matrix-shared.js
 * 云函数按目录独立部署，users/ 保留同内容副本；前端 utils/perm-matrix.js 复用同一份常量
 * （另加前端专用 PERM_LABELS / ROLE_LABELS 等展示字段）。
 *
 * 校验内容：
 *  1. auth 与 users 的 perm-matrix-shared.js 必须逐字节一致
 *  2. utils/perm-matrix.js 的 PERM_GROUPS / DEFAULT_MATRIX 与 auth 副本完全一致
 *
 * 用法：node scripts/sync-perm-matrix.js（已挂 npm run check:perms，部署云函数前建议执行）
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const AUTH_FILE = path.join(ROOT, 'cloudfunctions/auth/perm-matrix-shared.js')
const USERS_FILE = path.join(ROOT, 'cloudfunctions/users/perm-matrix-shared.js')
const FRONT_FILE = path.join(ROOT, 'utils/perm-matrix.js')

let failed = false
function fail(msg) { failed = true; console.error('FAIL ' + msg) }
function ok(msg) { console.log('OK ' + msg) }

const authSrc = fs.readFileSync(AUTH_FILE, 'utf8')
const usersSrc = fs.readFileSync(USERS_FILE, 'utf8')
const frontSrc = fs.readFileSync(FRONT_FILE, 'utf8')

// 1) auth vs users 逐字节一致
if (authSrc === usersSrc) {
  ok('auth 与 users 的 perm-matrix-shared.js 一致')
} else {
  fail('auth 与 users 的 perm-matrix-shared.js 不一致！同步命令：')
  fail('  cp cloudfunctions/auth/perm-matrix-shared.js cloudfunctions/users/perm-matrix-shared.js')
}

// 2) 提取 PERM_GROUPS / DEFAULT_MATRIX 区块做文本级比对
function extractBlocks(src) {
  const g = src.match(/const PERM_GROUPS = \[[\s\S]*?\n\]\n/)
  const d = src.match(/const DEFAULT_MATRIX = \{[\s\S]*?\n\}\n/)
  return { groups: g ? g[0] : null, matrix: d ? d[0] : null }
}
const a = extractBlocks(authSrc)
const f = extractBlocks(frontSrc)
if (a.groups && f.groups && a.groups === f.groups) {
  ok('PERM_GROUPS 与单一来源一致')
} else {
  fail('PERM_GROUPS 与单一来源不一致！以 auth/perm-matrix-shared.js 为准同步 utils/perm-matrix.js')
}
if (a.matrix && f.matrix && a.matrix === f.matrix) {
  ok('DEFAULT_MATRIX 与单一来源一致')
} else {
  fail('DEFAULT_MATRIX 与单一来源不一致！以 auth/perm-matrix-shared.js 为准同步 utils/perm-matrix.js')
}

process.exit(failed ? 1 : 0)
