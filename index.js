/**
 * dsh-sidebar-footer-fold — host half.
 *
 * Adds one small HTTP API for the browser half:
 *   GET  /sidebar-footer-fold/api/archived/list    list archived sessions + on-disk size
 *   POST /sidebar-footer-fold/api/archived/delete  move archived sessions to the Windows Recycle Bin
 *
 * Only archived sessions are eligible. Per session, only session-owned files are touched:
 *   - sessions/<project>/<encoded session id>/   (session content tree)
 *   - storages/session_projcache/sessions/<id>.json  (per-session projection cache)
 * Nothing else (attachments shared by other sessions, other sessions, storages) is deleted.
 * Files are moved to the Recycle Bin (recoverable), never permanently removed.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'

export const name = 'dsh-sidebar-footer-fold'
export const inject = ['webServer']

const WORKSPACE_FILE = join('storages', 'workspace.json')
const PROJCACHE_DIR = join('storages', 'session_projcache', 'sessions')
const SESSIONS_DIR = 'sessions'

/** @param {import('@deepseek-ai/cordis').Context} ctx */
function harnessHome(ctx) {
  try {
    const value = ctx.get('dshHomePath')
    if (typeof value === 'function') {
      const home = value()
      if (typeof home === 'string' && home) return home
    }
    if (typeof value === 'string' && value) return value
  } catch {
    // fall through
  }
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/** Read the workspace domain JSON (archive set + workspace records). */
function readWorkspaceDomain(home) {
  const file = join(home, WORKSPACE_FILE)
  const json = readJson(file)
  return {
    file,
    initialized: json?.global?.initialized === true,
    workspaceIds: json?.global?.workspaceIds ?? [],
    archivedSessionIds: Array.isArray(json?.global?.archivedSessionIds) ? json.global.archivedSessionIds : [],
    workspaces: json?.tables?.workspaces && typeof json.tables.workspaces === 'object' ? json.tables.workspaces : {}
  }
}

/** Persist the workspace domain JSON, preserving unknown fields where possible. */
function writeWorkspaceDomain(domain) {
  const json = {
    unit: { name: 'workspace', version: 2 },
    global: {
      initialized: domain.initialized,
      workspaceIds: domain.workspaceIds,
      archivedSessionIds: domain.archivedSessionIds
    },
    tables: { workspaces: domain.workspaces }
  }
  writeFileSync(domain.file, `${JSON.stringify(json, null, 2)}\n`, 'utf8')
}

/** Read a session's title/cwd/createdAt from its projection cache row. */
function readSessionRecord(home, sessionId) {
  const json = readJson(join(home, PROJCACHE_DIR, `${sessionId}.json`))
  const record = json?.record ?? {}
  const rows = record.rows ?? {}
  return {
    title: rows.title?.val ?? null,
    cwd: record.identity?.cwd,
    createdAt: record.identity?.createdAt ?? null
  }
}

/** DSH projectKey directory naming (matches session-persistence-jsonl). */
function workspaceDirName(cwd) {
  let readable = ''
  let separatorRun = false
  for (let i = 0; i < cwd.length; i++) {
    const ch = cwd[i]
    if (ch === '/' || ch === '\\' || ch === ':') {
      if (!separatorRun) readable += '-'
      separatorRun = true
    } else if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) {
      readable += ch
      separatorRun = false
    } else {
      readable += `~${cwd.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0')}`
      separatorRun = false
    }
  }
  const slug = readable.replace(/^-+/, '') || 'root'
  return `--${slug.slice(0, 251)}--`
}

/** Encode one session id into a safe directory segment. */
function encodeSegment(id) {
  let out = ''
  for (let i = 0; i < id.length; i++) {
    const ch = id[i]
    if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) out += ch
    else out += `~${id.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0')}`
  }
  return out
}

/** Locate a session's content directory anywhere under sessions/. */
function findSessionDir(home, cwd, sessionId) {
  if (typeof cwd === 'string' && cwd) {
    const canonical = join(home, SESSIONS_DIR, workspaceDirName(cwd), encodeSegment(sessionId))
    if (existsSync(canonical)) return canonical
  }
  const root = join(home, SESSIONS_DIR)
  if (!existsSync(root)) return null
  const encoded = encodeSegment(sessionId)
  const flat = join(root, encoded)
  if (existsSync(flat)) return flat
  let projects = []
  try {
    projects = readdirSync(root)
  } catch {
    return null
  }
  for (const project of projects) {
    const candidate = join(root, project, encoded)
    if (existsSync(candidate)) return candidate
  }
  return null
}

function fileBytes(file) {
  try {
    return statSync(file).size
  } catch {
    return 0
  }
}

function dirSize(dir) {
  let total = 0
  let entries = []
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const entry of entries) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) total += dirSize(p)
    else if (entry.isFile()) total += fileBytes(p)
  }
  return total
}

/** Current archive set: live registry state when available, else the durable domain. */
function currentArchived(ctx, home) {
  try {
    const registry = ctx.get('workspaceRegistry')
    if (registry && Array.isArray(registry.state?.archivedSessionIds)) return registry.state.archivedSessionIds
  } catch {
    // fall through
  }
  return readWorkspaceDomain(home).archivedSessionIds
}

/** Build the archived-session listing, grouped by workspace. */
function listArchived(ctx, home) {
  const archived = new Set(currentArchived(ctx, home))
  const domain = readWorkspaceDomain(home)
  const groups = new Map()
  let totalBytes = 0
  let count = 0

  const groupFor = (workspaceId, path) => {
    if (!groups.has(workspaceId)) {
      groups.set(workspaceId, {
        workspaceId,
        title: path ? basename(path) || path : '未分组',
        path: path || '',
        sessions: []
      })
    }
    return groups.get(workspaceId)
  }

  const accounted = new Set()
  const tableEntries = Object.entries(domain.workspaces || {})
  for (const [workspaceId, record] of tableEntries) {
    const path = typeof record?.path === 'string' ? record.path : ''
    for (const sessionId of record?.sessionIds || []) {
      if (!archived.has(sessionId)) continue
      accounted.add(sessionId)
      const meta = readSessionRecord(home, sessionId)
      const dir = findSessionDir(home, meta.cwd || path, sessionId)
      const cache = join(home, PROJCACHE_DIR, `${sessionId}.json`)
      if (!dir && !existsSync(cache)) continue
      const bytes = (dir ? dirSize(dir) : 0) + (existsSync(cache) ? fileBytes(cache) : 0)
      count += 1
      totalBytes += bytes
      groupFor(workspaceId, path).sessions.push({
        id: sessionId,
        title: meta.title || sessionId,
        cwd: meta.cwd || '',
        createdAt: meta.createdAt || null,
        bytes
      })
    }
  }

  // Archived ids that no workspace record accounts for (e.g. accounting drifted).
  for (const sessionId of archived) {
    if (accounted.has(sessionId)) continue
    const meta = readSessionRecord(home, sessionId)
    const dir = findSessionDir(home, meta.cwd, sessionId)
    if (!dir) continue
    const bytes = dirSize(dir) + fileBytes(join(home, PROJCACHE_DIR, `${sessionId}.json`))
    count += 1
    totalBytes += bytes
    groupFor('ungrouped', '').sessions.push({
      id: sessionId,
      title: meta.title || sessionId,
      cwd: meta.cwd || '',
      createdAt: meta.createdAt || null,
      bytes
    })
  }

  const result = [...groups.values()]
    .map((group) => ({
      ...group,
      sessions: group.sessions.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    }))
    .filter((group) => group.sessions.length > 0)

  return { groups: result, count, totalBytes }
}

/** Move absolute paths to the Windows Recycle Bin (recoverable). */
function recyclePaths(paths) {
  return new Promise((resolve, reject) => {
    if (!paths.length) {
      resolve([])
      return
    }
    const script = [
      "Add-Type -AssemblyName Microsoft.VisualBasic | Out-Null",
      "$ErrorActionPreference='Stop'",
      '$raw=[Console]::In.ReadToEnd()',
      '$list=@($raw | ConvertFrom-Json)',
      '$vb=[Microsoft.VisualBasic.FileIO.FileSystem]',
      '$opt=[Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs',
      '$rb=[Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin',
      '$out=@()',
      'foreach($p in $list){',
      '  try {',
      '    if (Test-Path -LiteralPath $p) {',
      '      $item = Get-Item -LiteralPath $p',
      '      if ($item.PSIsContainer) { $vb::DeleteDirectory($p, $opt, $rb) } else { $vb::DeleteFile($p, $opt, $rb) }',
      '      $out += [pscustomobject]@{ path = [string]$p; ok = $true }',
      '    } else {',
      '      $out += [pscustomobject]@{ path = [string]$p; ok = $true; missing = $true }',
      '    }',
      '  } catch {',
      '    $out += [pscustomobject]@{ path = [string]$p; ok = $false; error = [string]$_.Exception.Message }',
      '  }',
      '}',
      'ConvertTo-Json -InputObject @($out) -Compress'
    ].join('\n')

    let child
    try {
      child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      })
    } catch (error) {
      reject(error)
      return
    }

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', (error) => reject(error))
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`回收站操作失败（PowerShell exit ${code}）：${(stderr || stdout).slice(0, 500)}`))
        return
      }
      const text = stdout.trim()
      if (!text) {
        resolve([])
        return
      }
      try {
        const parsed = JSON.parse(text)
        resolve(Array.isArray(parsed) ? parsed : [parsed])
      } catch (error) {
        reject(new Error(`回收站返回无法解析：${text.slice(0, 300)}`))
      }
    })
    child.stdin.end(JSON.stringify(paths))
  })
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(payload))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.method !== 'POST') {
      resolve(null)
      return
    }
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 256 * 1024) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (!chunks.length) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

/** Remove one session from the durable workspace accounting (registry-free fallback). */
function pruneWorkspaceAccount(home, sessionId) {
  const domain = readWorkspaceDomain(home)
  let changed = false
  for (const [workspaceId, record] of Object.entries(domain.workspaces || {})) {
    const ids = Array.isArray(record?.sessionIds) ? record.sessionIds : []
    if (!ids.includes(sessionId)) continue
    domain.workspaces[workspaceId] = {
      ...record,
      sessionIds: ids.filter((id) => id !== sessionId),
      updatedAt: new Date().toISOString()
    }
    changed = true
  }
  if (changed) writeWorkspaceDomain(domain)
}

/** Try to drop one session from the live workspace registry (preferred path). */
async function detachLiveSession(ctx, home, sessionId) {
  const registry = ctx.get('workspaceRegistry')
  if (!registry) {
    pruneWorkspaceAccount(home, sessionId)
    return
  }
  try {
    const entity = (registry.list?.() ?? []).find((workspace) => (workspace.sessionIds || []).includes(sessionId))
    if (entity && typeof entity.detachSession === 'function') {
      await entity.detachSession(sessionId)
      return
    }
  } catch {
    // fall through to the registry state rewrite below
  }
  try {
    const state = registry.state
    if (state && Array.isArray(state.archivedSessionIds)) {
      // Accounting row is owned by the registry; a state rewrite still keeps
      // the durable domain in sync even when the entity lookup misses.
      await registry.setState({
        ...state,
        archivedSessionIds: state.archivedSessionIds.filter((id) => id !== sessionId)
      })
    }
  } catch {
    // best effort
  }
  pruneWorkspaceAccount(home, sessionId)
}

async function writeArchived(ctx, home, nextArchived) {
  const registry = ctx.get('workspaceRegistry')
  if (registry && typeof registry.setState === 'function') {
    const state = registry.state
    if (state && Array.isArray(state.archivedSessionIds)) {
      await registry.setState({ ...state, archivedSessionIds: nextArchived })
      return
    }
  }
  const domain = readWorkspaceDomain(home)
  domain.archivedSessionIds = nextArchived
  writeWorkspaceDomain(domain)
}

/** @param {import('@deepseek-ai/cordis').Context} ctx */
export function apply(ctx) {
  const home = harnessHome(ctx)

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: '/sidebar-footer-fold/api/archived/list',
        handler: async (req, res) => {
          try {
            if (req.method !== 'GET') {
              sendJson(res, 405, { ok: false, error: 'expected GET' })
              return
            }
            sendJson(res, 200, { ok: true, ...listArchived(ctx, home) })
          } catch (error) {
            sendJson(res, 500, { ok: false, error: String(error?.message ?? error) })
          }
        }
      }),
    'dsh-sidebar-footer-fold: archived list'
  )

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: '/sidebar-footer-fold/api/archived/delete',
        handler: async (req, res) => {
          try {
            if (req.method !== 'POST') {
              sendJson(res, 405, { ok: false, error: 'expected POST' })
              return
            }
            const body = await readBody(req)
            const requested = Array.isArray(body?.ids) ? body.ids.filter((id) => typeof id === 'string') : []
            if (!requested.length) {
              sendJson(res, 400, { ok: false, error: 'ids required' })
              return
            }
            const archived = new Set(currentArchived(ctx, home))
            const warnings = []
            const deleted = []
            const succeeded = []

            for (const sessionId of requested) {
              if (!archived.has(sessionId)) {
                warnings.push(`${sessionId}: 不是归档会话，已跳过`)
                continue
              }
              const meta = readSessionRecord(home, sessionId)
              const dir = findSessionDir(home, meta.cwd, sessionId)
              const cache = join(home, PROJCACHE_DIR, `${sessionId}.json`)
              const paths = []
              if (dir) paths.push(dir)
              if (existsSync(cache)) paths.push(cache)
              const bytes = (dir ? dirSize(dir) : 0) + (existsSync(cache) ? fileBytes(cache) : 0)
              if (!paths.length) {
                // Nothing on disk: only accounting is left, safe to clean.
                succeeded.push({ id: sessionId, bytes: 0 })
                deleted.push({ id: sessionId, bytes: 0 })
                continue
              }
              let results
              try {
                results = await recyclePaths(paths)
              } catch (error) {
                warnings.push(`${sessionId}: ${String(error?.message ?? error)}`)
                continue
              }
              const failed = results.filter((row) => row && row.ok === false)
              if (failed.length) {
                for (const row of failed) warnings.push(`${sessionId}: ${row.path} -> ${row.error || '未知错误'}`)
                continue
              }
              succeeded.push({ id: sessionId, bytes })
              deleted.push({ id: sessionId, bytes })
            }

            for (const item of succeeded) {
              try {
                await detachLiveSession(ctx, home, item.id)
              } catch (error) {
                warnings.push(`${item.id}: 会话记账清理失败：${String(error?.message ?? error)}`)
              }
              try {
                ctx.emit('api-session/removed', item.id)
              } catch {
                // best effort
              }
            }

            if (succeeded.length) {
              try {
                await writeArchived(ctx, home, [...archived].filter((id) => !succeeded.some((item) => item.id === id)))
              } catch (error) {
                warnings.push(`归档列表更新失败：${String(error?.message ?? error)}`)
              }
            }

            const freedBytes = deleted.reduce((total, item) => total + item.bytes, 0)
            sendJson(res, 200, {
              ok: true,
              deleted,
              freedBytes,
              warnings,
              ...listArchived(ctx, home)
            })
          } catch (error) {
            sendJson(res, 500, { ok: false, error: String(error?.message ?? error) })
          }
        }
      }),
    'dsh-sidebar-footer-fold: archived delete'
  )
}

// Exposed for local smoke tests (not used at runtime).
export const __test = {
  listArchived,
  recyclePaths,
  findSessionDir,
  readWorkspaceDomain,
  readSessionRecord
}
