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
 * Supports a minimal subset: "M H * * *" (daily) and "M H * * D" (weekly DOW 0-6).
 * For anything more advanced the user supplies `frequency: 'custom'` and we brute-force
 * minute-by-minute from `afterMs` (max 7 days forward).
 */
export function nextCronTime(cronExpr: string, afterMs: number): number {
  const parts = cronExpr.trim().split(/\s+/)
  if (parts.length !== 5) return afterMs + 86_400_000 // fallback: +1 day

  const [minStr, hourStr, , , dowStr] = parts
  const minute = parseInt(minStr, 10)
  const hour = parseInt(hourStr, 10)

  if (isNaN(minute) || isNaN(hour)) return afterMs + 86_400_000

  const after = new Date(afterMs)

  // Weekly case: specific day-of-week
  if (dowStr !== '*') {
    const targetDow = parseInt(dowStr, 10) // 0 = Sunday
    if (isNaN(targetDow)) return afterMs + 86_400_000

    for (let dayOff = 0; dayOff <= 7; dayOff++) {
      const candidate = new Date(after)
      candidate.setDate(candidate.getDate() + dayOff)
      candidate.setHours(hour, minute, 0, 0)
      if (candidate.getDay() === targetDow && candidate.getTime() > afterMs) {
        return candidate.getTime()
      }
    }
    // Shouldn't reach here, but fallback
    return afterMs + 7 * 86_400_000
  }

  // Daily case: "M H * * *"
  const today = new Date(after)
  today.setHours(hour, minute, 0, 0)
  if (today.getTime() > afterMs) return today.getTime()

  // Tomorrow
  const tomorrow = new Date(after)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(hour, minute, 0, 0)
  return tomorrow.getTime()
}

export class ScheduleRunner {
  private timer: ReturnType<typeof setInterval> | null = null
  private taskManager: TaskManager

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
    try {
      const schedules = await loadSchedules()
      const now = Date.now()
      let dirty = false

      for (const sched of schedules) {
        if (!sched.enabled) continue
        if (sched.nextRunAt > now) continue

        // Time to run this schedule
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
