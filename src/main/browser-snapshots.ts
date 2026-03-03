import { app } from 'electron'
import { join } from 'path'
import { readFile, writeFile } from 'fs/promises'

export type BrowserSnapshot = {
  id: string
  name: string
  url: string
  title: string
  cookies: Array<{
    name: string
    value: string
    domain: string
    path: string
    secure: boolean
    httpOnly: boolean
    sameSite?: string
    expires?: number
  }>
  localStorage: Record<string, string>
  sessionStorage: Record<string, string>
  scrollX: number
  scrollY: number
  createdAt: number
}

function filePath(): string {
  return join(app.getPath('userData'), 'browser-snapshots.json')
}

export async function loadSnapshots(): Promise<BrowserSnapshot[]> {
  try {
    const raw = await readFile(filePath(), 'utf8')
    return JSON.parse(raw) as BrowserSnapshot[]
  } catch {
    return []
  }
}

async function persist(snapshots: BrowserSnapshot[]): Promise<void> {
  await writeFile(filePath(), JSON.stringify(snapshots, null, 2), 'utf8')
}

export async function saveSnapshot(snap: BrowserSnapshot): Promise<void> {
  const snapshots = await loadSnapshots()
  const idx = snapshots.findIndex((s) => s.id === snap.id)
  if (idx !== -1) {
    snapshots[idx] = snap
  } else {
    snapshots.push(snap)
  }
  await persist(snapshots)
}

export async function deleteSnapshot(id: string): Promise<void> {
  const snapshots = (await loadSnapshots()).filter((s) => s.id !== id)
  await persist(snapshots)
}
