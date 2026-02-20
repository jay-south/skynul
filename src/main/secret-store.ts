import { app, safeStorage } from 'electron'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'

type SecretStoreShape = Record<string, string>

const FILE_NAME = 'secrets.json'

function storePath(): string {
  return join(app.getPath('userData'), FILE_NAME)
}

async function loadRaw(): Promise<SecretStoreShape> {
  try {
    const raw = await readFile(storePath(), 'utf8')
    const parsed = JSON.parse(raw) as SecretStoreShape
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

async function saveRaw(data: SecretStoreShape): Promise<void> {
  const file = storePath()
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

// Values are stored with a prefix so we know how to decode them:
//   "e:<base64>"  → encrypted with safeStorage (when available)
//   "p:<base64>"  → plain base64 fallback (WSL / no keychain)
// Legacy entries without prefix are treated as encrypted for backwards compat.

export async function setSecret(key: string, value: string): Promise<void> {
  const raw = await loadRaw()
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(value)
    raw[key] = 'e:' + encrypted.toString('base64')
  } else {
    raw[key] = 'p:' + Buffer.from(value, 'utf8').toString('base64')
  }
  await saveRaw(raw)
}

export async function hasSecret(key: string): Promise<boolean> {
  const raw = await loadRaw()
  const v = raw[key]
  if (typeof v !== 'string' || v.length === 0) return false
  // A value of "p:" means it was explicitly set to empty string (cleared)
  if (v === 'p:') return false
  return true
}

export async function getSecret(key: string): Promise<string | null> {
  const raw = await loadRaw()
  const v = raw[key]
  if (!v) return null
  try {
    if (v.startsWith('p:')) {
      const b64 = v.slice(2)
      if (!b64) return null
      return Buffer.from(b64, 'base64').toString('utf8')
    }
    // 'e:' prefix or legacy (no prefix) → decrypt with safeStorage
    const b64 = v.startsWith('e:') ? v.slice(2) : v
    const buf = Buffer.from(b64, 'base64')
    return safeStorage.decryptString(buf)
  } catch {
    return null
  }
}
