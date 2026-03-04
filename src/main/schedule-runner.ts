/**
 * ScheduleRunner — checks every 60 s for schedules whose nextRunAt <= now,
 * creates + auto-approves a task via TaskManager, and advances nextRunAt.
 */

import type { Schedule } from '../shared/schedule'
import type { TaskManager } from './agent/task-manager'
import { loadSchedules, saveSchedules } from './schedule-store'

const TICK_MS = 60_000 // 1 minute

/**
 * Compute the next occurrence of a cron expression AFTER `afterMs`.
 * Supports a practical subset used by the UI:
 * - minute: number | * | * / N step syntax
 * - hour:   number | * | * / N step syntax | a,b
 * - dow:    * | number | a-b
 *
 * We brute-force minute-by-minute from `afterMs` (max 14 days forward).
 */
export function nextCronTime(cronExpr: string, afterMs: number): number {
  const parts = cronExpr.trim().split(/\s+/)
  if (parts.length !== 5) return afterMs + 86_400_000
  const [minStr, hourStr, , , dowStr] = parts

  const parseField = (field: string, min: number, max: number): Set<number> => {
    const out = new Set<number>()
    const f = field.trim()
    if (!f || f === '*') {
      for (let i = min; i <= max; i++) out.add(i)
      return out
    }

    const stepMatch = f.match(/^\*\/(\d+)$/)
    if (stepMatch) {
      const step = parseInt(stepMatch[1], 10)
      if (!isNaN(step) && step > 0) {
        for (let i = min; i <= max; i += step) out.add(i)
        return out
      }
    }

    for (const part of f.split(',')) {
      const p = part.trim()
      if (!p) continue
      const range = p.match(/^(\d+)-(\d+)$/)
      if (range) {
        const a = parseInt(range[1], 10)
        const b = parseInt(range[2], 10)
        if (isNaN(a) || isNaN(b)) continue
        const start = Math.max(min, Math.min(a, b))
        const end = Math.min(max, Math.max(a, b))
        for (let i = start; i <= end; i++) out.add(i)
        continue
      }

      const n = parseInt(p, 10)
      if (!isNaN(n) && n >= min && n <= max) out.add(n)
    }
    return out
  }

  const minutes = parseField(minStr, 0, 59)
  const hours = parseField(hourStr, 0, 23)
  const dows = dowStr === '*' ? null : parseField(dowStr, 0, 6)

  const start = new Date(afterMs)
  start.setSeconds(0, 0)
  start.setMinutes(start.getMinutes() + 1)

  const maxMinutes = 14 * 24 * 60
  for (let i = 0; i < maxMinutes; i++) {
    const c = new Date(start.getTime() + i * 60_000)
    if (!minutes.has(c.getMinutes())) continue
    if (!hours.has(c.getHours())) continue
    if (dows && !dows.has(c.getDay())) continue
    return c.getTime()
  }

  return afterMs + 86_400_000
}

export class ScheduleRunner {
  private timer: ReturnType<typeof setInterval> | null = null
  private taskManager: TaskManager
  private ticking = false
  /** Schedule IDs already triggered this tick cycle — prevents double-fire */
  private recentlyFired = new Set<string>()

  constructor(taskManager: TaskManager) {
    this.taskManager = taskManager
  }

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => void this.tick(), TICK_MS)
    // Also run immediately on start
    void this.tick()
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private async tick(): Promise<void> {
    if (this.ticking) return // prevent overlapping ticks
    this.ticking = true
    try {
      const schedules = await loadSchedules()
      const now = Date.now()
      let dirty = false

      for (const sched of schedules) {
        if (!sched.enabled) continue
        if (sched.nextRunAt > now) continue
        if (this.recentlyFired.has(sched.id)) continue

        // Mark as fired BEFORE running to prevent double-fire
        this.recentlyFired.add(sched.id)
        setTimeout(() => this.recentlyFired.delete(sched.id), 120_000) // clear after 2min

        await this.runSchedule(sched)

        sched.lastRunAt = now
        sched.nextRunAt = nextCronTime(sched.cronExpr, now)
        dirty = true
      }

      if (dirty) {
        await saveSchedules(schedules)
      }
    } catch (e) {
      console.warn('[ScheduleRunner] tick error:', e)
    } finally {
      this.ticking = false
    }
  }

  private async runSchedule(sched: Schedule): Promise<void> {
    try {
      // Create task
      const task = this.taskManager.create({
        prompt: sched.prompt,
        capabilities: sched.capabilities,
        mode: sched.mode
      })

      // Auto-approve it
      await this.taskManager.approve(task.id)

      console.log(`[ScheduleRunner] Triggered schedule "${sched.id}" → task "${task.id}"`)
    } catch (e) {
      console.warn(`[ScheduleRunner] Failed to run schedule "${sched.id}":`, e)
    }
  }
}
