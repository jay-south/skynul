import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    stdio: 'pipe',
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...opts
  })

  if (res.error) throw res.error
  if (res.status !== 0) {
    const out = [res.stdout, res.stderr].filter(Boolean).join('\n')
    throw new Error(`Command failed (${cmd} ${args.join(' ')}):\n${out}`)
  }
  return (res.stdout || '').trim()
}

function getArg(name) {
  const i = process.argv.indexOf(name)
  if (i === -1) return null
  return process.argv[i + 1] ?? null
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function parseVersion(v) {
  // Supports: 1.2.3 or 1.2.3-alpha.4
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z]+)\.(\d+))?$/)
  if (!m) return null
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    preId: m[4] ?? null,
    preNum: m[5] != null ? Number(m[5]) : null
  }
}

function formatVersion({ major, minor, patch, preId, preNum }) {
  const base = `${major}.${minor}.${patch}`
  if (!preId) return base
  return `${base}-${preId}.${preNum ?? 1}`
}

function nextPreVersion(current, preId) {
  const cur = parseVersion(current)
  if (!cur) throw new Error(`Unsupported version format: ${current}`)

  if (cur.preId === preId && typeof cur.preNum === 'number') {
    return formatVersion({ ...cur, preId, preNum: cur.preNum + 1 })
  }

  // If we're not currently on this preId, start at .1 keeping base.
  return formatVersion({ ...cur, preId, preNum: 1 })
}

const repoRoot = process.cwd()
const pkgPath = path.join(repoRoot, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

const explicitVersion = getArg('--version')
const preId = getArg('--pre') ?? 'alpha'
const doPush = hasFlag('--push')

const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
if (branch !== 'main') {
  throw new Error(`Refusing to cut a release from branch '${branch}'. Switch to 'main'.`)
}

const dirty = run('git', ['status', '--porcelain=v1', '-uall'])
if (dirty) {
  throw new Error('Working tree is not clean. Commit or stash changes before cutting a release.')
}

const currentVersion = String(pkg.version ?? '')
if (!currentVersion) throw new Error('package.json is missing version')

const nextVersion = explicitVersion ?? nextPreVersion(currentVersion, preId)
const tag = `v${nextVersion}`

const existing = run('git', ['tag', '--list', tag])
if (existing) {
  throw new Error(`Tag already exists: ${tag}`)
}

pkg.version = nextVersion
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

run('git', ['add', 'package.json'])
run('git', ['commit', '-m', `chore(release): ${tag}`])
run('git', ['tag', '-a', tag, '-m', `chore(release): ${tag}`])

if (doPush) {
  run('git', ['push', 'origin', 'main'], { stdio: 'inherit' })
  run('git', ['push', 'origin', tag], { stdio: 'inherit' })
} else {
  process.stdout.write(`Created ${tag}. Next:\n  git push origin main\n  git push origin ${tag}\n`)
}
