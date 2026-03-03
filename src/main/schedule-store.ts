import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { app } from 'electron'
import { randomBytes } from 'crypto'
import type { Schedule } from '../shared/schedule'

function filePath(): string {
  return join(app.getPath('userData'), 'schedules.json')
}

export async function loadSchedules(): Promise<Schedule[]> {
  try {
    const raw = await readFile(filePath(), 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function saveSchedules(schedules: Schedule[]): Promise<void> {
  const f = filePath()
  await mkdir(dirname(f), { recursive: true })
  await writeFile(f, JSON.stringify(schedules, null, 2), 'utf8')
}

export function createScheduleId(): string {
  return `sched_${randomBytes(4).toString('hex')}`
}
