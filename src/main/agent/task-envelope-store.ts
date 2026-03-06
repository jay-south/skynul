import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname } from 'path'
import type { TaskEnvelopeInternal } from './task-envelope'

export type TaskEnvelopeInternalMap = Record<string, TaskEnvelopeInternal>

export class TaskEnvelopeStore {
  constructor(private readonly filePath: string) {}

  async loadAll(): Promise<TaskEnvelopeInternalMap> {
    try {
      const raw = await readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== 'object') return {}
      return parsed as TaskEnvelopeInternalMap
    } catch {
      return {}
    }
  }

  async saveAll(map: TaskEnvelopeInternalMap): Promise<void> {
    try {
      await mkdir(dirname(this.filePath), { recursive: true })
      await writeFile(this.filePath, JSON.stringify(map, null, 2), 'utf8')
    } catch {
      // Non-critical
    }
  }
}
