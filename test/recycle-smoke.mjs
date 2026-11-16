// 回归测试：只验证宿主侧「移入回收站」脚本本身。
// 覆盖 0.3.4 的两个 bug：
//   1) 中文路径被 PowerShell 以 OEM 代码页解码 → 静默 missing:true（文件其实还在）
//   2) 两个路径（会话目录 + projcache）被当成一个数组传给 DeleteDirectory → 报「不支持给定路径的格式」
// 运行：node test/recycle-smoke.mjs
// 注意：会真的把临时目录移入 Windows 回收站（不是永久删除）。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { __test } from '../index.js'

let failures = 0

async function check(name, targets, expectGone) {
  const result = await __test.recyclePaths(targets)
  const gone = targets.map((target) => !fs.existsSync(target))
  const ok = gone.every((value) => value === expectGone) && !result.some((row) => row?.ok === false)
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  console.log('  result:', JSON.stringify(result))
  console.log('  gone:  ', JSON.stringify(gone))
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sff-smoke-'))

// 1) 英文路径 + 两个目标（会话目录 + projcache 文件）
const asciiDir = path.join(root, 'session-ascii')
fs.mkdirSync(asciiDir)
fs.writeFileSync(path.join(asciiDir, 'session.v4.jsonl.zstd'), Buffer.alloc(4096, 1))
const asciiCache = path.join(root, 'session-ascii-cache.json')
fs.writeFileSync(asciiCache, 'x'.repeat(512))
await check('ascii dir + cache (2 paths)', [asciiDir, asciiCache], true)

// 2) 中文路径 + 两个目标
const cnDir = path.join(root, '电脑日常维护', 'session-中文会话')
fs.mkdirSync(cnDir, { recursive: true })
fs.writeFileSync(path.join(cnDir, 'session.v4.jsonl.zstd'), Buffer.alloc(4096, 2))
const cnCache = path.join(root, '电脑日常维护', '缓存-中文.json')
fs.writeFileSync(cnCache, 'y'.repeat(512))
await check('chinese dir + cache (2 paths)', [cnDir, cnCache], true)

// 3) 单路径：目录
const singleDir = path.join(root, 'session-single')
fs.mkdirSync(singleDir)
fs.writeFileSync(path.join(singleDir, 'session.v4.jsonl.zstd'), Buffer.alloc(1024, 3))
await check('single dir', [singleDir], true)

// 4) 不存在的路径：必须如实返回 missing，不能假成功删掉账目
const missing = path.join(root, '不存在', 'nope.txt')
const missingResult = await __test.recyclePaths([missing])
const missingOk = missingResult.length === 1 && missingResult[0].missing === true && missingResult[0].ok === true
if (!missingOk) failures += 1
console.log(`${missingOk ? 'PASS' : 'FAIL'} missing path is reported as missing`)
console.log('  result:', JSON.stringify(missingResult))

fs.rmSync(root, { recursive: true, force: true })
process.exit(failures === 0 ? 0 : 1)
