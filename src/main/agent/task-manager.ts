/**
 * TaskManager — CRUD for tasks + orchestrates TaskRunners.
 * One runner per task, each with its own WindowsBridge.
 * Persists tasks to userData/tasks.json (strips screenshot data for size).
 */

import { randomBytes } from 'crypto'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { app, type BrowserWindow } from 'electron'
import type {
  Task,
  TaskCreateRequest
} from '../../shared/task'
import type { PolicyState } from '../../shared/policy'
import { TaskRunner } from './task-runner'

const DEFAULT_MAX_STEPS = 200
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const MAX_CONCURRENT_TASKS = 3

export class TaskManager {
  private tasks = new Map<string, Task>()
  private runners = new Map<string, TaskRunner>()
  private mainWindow: BrowserWindow | null = null
  private persistPath: string
  private persistTimer: ReturnType<typeof setTimeout> | null = null
  private getPolicy: (() => PolicyState) | null = null

  constructor() {
    this.persistPath = join(app.getPath('userData'), 'tasks.json')
    void this.loadFromDisk()
  }

  /**
   * Set the policy getter so the runner knows which provider to use.
   */
  setPolicyGetter(fn: () => PolicyState): void {
    this.getPolicy = fn
  }

  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win
  }

  /**
   * Create a new task in pending_approval status.
   */
  create(req: TaskCreateRequest): Task {
    const id = `task_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`
    const task: Task = {
      id,
      prompt: req.prompt,
      status: 'pending_approval',
      capabilities: req.capabilities,
      steps: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      maxSteps: req.maxSteps ?? DEFAULT_MAX_STEPS,
      timeoutMs: req.timeoutMs ?? DEFAULT_TIMEOUT_MS
    }
    this.tasks.set(id, task)
    void this.persistToDisk()
    return task
  }

  /**
   * Approve a task and start running it.
   */
  async approve(taskId: string): Promise<Task> {
    const task = this.getOrThrow(taskId)
    if (task.status !== 'pending_approval') {
      throw new Error(`Cannot approve task in status: ${task.status}`)
    }

    // Rate limit: max concurrent running tasks
    const running = [...this.runners.values()].length
    if (running >= MAX_CONCURRENT_TASKS) {
      throw new Error(`Max ${MAX_CONCURRENT_TASKS} concurrent tasks. Wait for one to finish.`)
    }

    task.status = 'approved'
    task.updatedAt = Date.now()
    this.pushUpdate(task)

    // Start running
    task.status = 'running'
    task.updatedAt = Date.now()
    this.pushUpdate(task)

    const policy = this.getPolicy?.() ?? null
    const provider = policy?.provider.active ?? 'openai'
    const openaiModel = policy?.provider.openaiModel ?? 'gpt-4.1'

    const runner = new TaskRunner(
      task,
      { provider, openaiModel },
      {
        onUpdate: (updated) => {
          this.tasks.set(updated.id, updated)
          this.pushUpdate(updated)
          this.schedulePersist()
        }
      }
    )

    this.runners.set(taskId, runner)

    // Run in background — don't await
    void runner.run().then((final) => {
      this.tasks.set(final.id, final)
      this.runners.delete(taskId)
      void this.persistToDisk() // task reached terminal state — persist immediately
    }).catch((e) => {
      task.status = 'failed'
      task.error = e instanceof Error ? e.message : String(e)
      task.updatedAt = Date.now()
      this.tasks.set(taskId, task)
      this.pushUpdate(task)
      this.runners.delete(taskId)
      void this.persistToDisk() // task failed — persist immediately
    })

    return task
  }

  /**
   * Cancel a running or pending task.
   */
  cancel(taskId: string): Task {
    const task = this.getOrThrow(taskId)

    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      return task
    }

    const runner = this.runners.get(taskId)
    if (runner) {
      runner.abort('Cancelled by user')
      this.runners.delete(taskId)
    }

    task.status = 'cancelled'
    task.updatedAt = Date.now()
    this.tasks.set(taskId, task)
    this.pushUpdate(task)
    void this.persistToDisk()
    return task
  }

  /**
   * Delete a task permanently (cancels it first if running).
   */
  delete(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (!task) return

    // Cancel runner if active
    const runner = this.runners.get(taskId)
    if (runner) {
      runner.abort('Deleted by user')
      this.runners.delete(taskId)
    }

    this.tasks.delete(taskId)
    void this.persistToDisk()
  }

  /**
   * Get a task by ID.
   */
  get(taskId: string): Task | undefined {
    return this.tasks.get(taskId)
  }

  /**
   * List all tasks, most recent first.
   */
  list(): Task[] {
    return [...this.tasks.values()].sort((a, b) => b.createdAt - a.createdAt)
  }

  /**
   * Clean up all running tasks (on app quit).
   */
  destroyAll(): void {
    for (const [id, runner] of this.runners) {
      runner.abort('App shutting down')
      this.runners.delete(id)
    }
    // Synchronous write — guarantees data is on disk before the process exits
    this.persistToDiskSync()
  }

  private getOrThrow(taskId: string): Task {
    const task = this.tasks.get(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)
    return task
  }

  private pushUpdate(task: Task): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('netbot:task:update', { task })
    }
  }

  // ── Persistence ─────────────────────────────────────────────────────

  /** Debounced persist — used during active task execution (many updates/sec). */
  private schedulePersist(): void {
    if (this.persistTimer) return
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      void this.persistToDisk()
    }, 2000)
  }

  /** Async persist — used for important state changes (create, finish, cancel, delete). */
  private async persistToDisk(): Promise<void> {
    try {
      const stripped = this.buildStripped()
      await mkdir(dirname(this.persistPath), { recursive: true })
      await writeFile(this.persistPath, JSON.stringify(stripped, null, 2), 'utf8')
    } catch {
      // Non-critical — tasks still live in memory
    }
  }

  /** Synchronous persist — used on app quit to guarantee write before process exits. */
  private persistToDiskSync(): void {
    try {
      const stripped = this.buildStripped()
      mkdirSync(dirname(this.persistPath), { recursive: true })
      writeFileSync(this.persistPath, JSON.stringify(stripped, null, 2), 'utf8')
    } catch {
      // ignore
    }
  }

  private buildStripped(): object[] {
    return this.list().map((t) => ({
      ...t,
      steps: t.steps.map((s) => ({ ...s, screenshotBase64: '' }))
    }))
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const raw = await readFile(this.persistPath, 'utf8')
      const loaded = JSON.parse(raw) as Task[]
      if (!Array.isArray(loaded)) return

      for (const task of loaded) {
        // Only restore terminal tasks (don't re-run stale running tasks)
        if (
          task.status === 'completed' ||
          task.status === 'failed' ||
          task.status === 'cancelled'
        ) {
          this.tasks.set(task.id, task)
        } else {
          // Mark non-terminal tasks as failed (they were interrupted)
          task.status = 'failed'
          task.error = 'Interrupted by app restart'
          task.updatedAt = Date.now()
          this.tasks.set(task.id, task)
        }
      }
    } catch {
      // No file or invalid JSON — start fresh
    }
  }
}
