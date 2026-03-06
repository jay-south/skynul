/**
 * TaskManager — CRUD for tasks + orchestrates TaskRunners.
 * One runner per task, each with its own WindowsBridge.
 * Persists tasks to userData/tasks.json (strips screenshot data for size).
 */

import { randomBytes } from 'crypto'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { EventEmitter } from 'events'
import type { BrowserWindow } from 'electron'
import { tmpdir } from 'os'
import type { Task, TaskCreateRequest } from '../../shared/task'
import type { PolicyState } from '../../shared/policy'
import { TaskRunner } from './task-runner'
import type { CdpRelay } from './cdp-relay'
import { saveMemory, searchMemories, formatMemoriesForPrompt, closeMemoryDb } from './task-memory'
import { loadSkills, getActiveSkillPrompts } from '../skill-store'
import type { TaskEnvelopeInternal } from './task-envelope'
import { validateChainPlanRestrictOnly } from './task-envelope'
import { TaskEnvelopeStore } from './task-envelope-store'
import { routeV1 } from './router/router-v1'
import { isInternalTask } from './task-public'
import { DEFAULT_POLICY } from '../../shared/policy'

const DEFAULT_MAX_STEPS = 200
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

function getUserDataPath(): string {
  const override = process.env.SKYNUL_TEST_USERDATA
  if (override && typeof override === 'string') return override

  // In plain Node (unit tests), require('electron') returns a string (binary path), not the Electron API.
  // In Electron runtime it returns the API object.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require('electron') as unknown
    const app = (electron as { app?: { getPath?: (name: string) => string } }).app
    if (app?.getPath) return app.getPath('userData')
  } catch {
    // ignore
  }

  // Safe fallback for non-Electron environments.
  return join(tmpdir(), 'skynul-userData')
}

/** Per-mode concurrency limits */
const MAX_CONCURRENT: Record<import('../../shared/task').TaskMode, number> = {
  browser: 5,
  code: 10
}

export class TaskManager extends EventEmitter {
  private tasks = new Map<string, Task>()
  private runners = new Map<string, TaskRunner>()
  private inboxes = new Map<string, Array<{ from: string; message: string }>>()
  private mainWindow: BrowserWindow | null = null
  private persistPath: string
  private internalPersistPath: string
  private internalStore: TaskEnvelopeStore
  private internalEnvelopes = new Map<string, TaskEnvelopeInternal>()
  private persistTimer: ReturnType<typeof setTimeout> | null = null
  private getPolicy: (() => PolicyState) | null = null
  private cdpRelay: CdpRelay | null = null

  constructor() {
    super()
    const userData = getUserDataPath()
    this.persistPath = join(userData, 'tasks.json')
    this.internalPersistPath = join(userData, 'tasks-internal.json')
    this.internalStore = new TaskEnvelopeStore(this.internalPersistPath)
    void this.loadFromDisk()
  }

  /**
   * Set the policy getter so the runner knows which provider to use.
   */
  setPolicyGetter(fn: () => PolicyState): void {
    this.getPolicy = fn
  }

  setCdpRelay(relay: CdpRelay): void {
    this.cdpRelay = relay
  }

  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win
  }

  /**
   * Create a new task in pending_approval status.
   */
  create(req: TaskCreateRequest): Task {
    return this.createTask(req)
  }

  private createInternal(req: TaskCreateRequest): Task {
    return this.createTask(req, { visibility: 'internal' })
  }

  private createTask(req: TaskCreateRequest, opts?: { visibility?: 'internal' }): Task {
    const id = `task_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`

    const routed = routeV1({
      displayPrompt: req.prompt,
      requestedMode: req.mode,
      userCapabilities: req.capabilities
    })

    const task: Task = {
      id,
      parentTaskId: req.parentTaskId,
      visibility: opts?.visibility,
      prompt: req.prompt,
      status: 'pending_approval',
      mode: req.mode ?? routed.mode,
      capabilities: req.capabilities,
      steps: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      maxSteps: req.maxSteps ?? DEFAULT_MAX_STEPS,
      timeoutMs: req.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      source: req.source ?? 'desktop'
    }

    this.internalEnvelopes.set(task.id, {
      intent: routed.intent,
      mode: task.mode,
      intentCaps: routed.intentCaps,
      contextRefs: routed.contextRefs,
      chainPlan: routed.chainPlan,
      internalPrompt: routed.internalPrompt
    })

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

    if (isInternalTask(task)) {
      throw new Error('Cannot approve internal task')
    }

    const internal = this.internalEnvelopes.get(taskId) ?? null

    // Rate limit: per-mode concurrency
    const running = [...this.runners.entries()].reduce(
      (acc, [id]) => {
        const t = this.tasks.get(id)
        if (!t) return acc
        acc[t.mode] = (acc[t.mode] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>
    )
    const limit = MAX_CONCURRENT[task.mode]
    const current = running[task.mode] ?? 0
    if (current >= limit) {
      throw new Error(`Max ${limit} concurrent ${task.mode} tasks. Wait for one to finish.`)
    }

    // Validate chain plan restrict-only before starting any runners
    if (internal) {
      validateChainPlanRestrictOnly({
        chainPlan: internal.chainPlan,
        parentCaps: task.capabilities
      })
    }

    const effectiveTaskCapabilities = internal
      ? intersectCapabilities(task.capabilities, internal.intentCaps)
      : task.capabilities

    task.status = 'approved'
    task.updatedAt = Date.now()
    this.pushUpdate(task)

    // Start running
    task.status = 'running'
    task.updatedAt = Date.now()
    this.pushUpdate(task)

    const policy = this.getPolicy?.() ?? null
    const provider = policy?.provider.active ?? 'chatgpt'
    const openaiModel = policy?.provider.openaiModel ?? 'gpt-4.1'

    // Search for relevant past task memories (if enabled)
    const memoryEnabled = policy?.taskMemoryEnabled ?? true
    const memories = memoryEnabled ? searchMemories(task.prompt) : []
    const memoryContext = formatMemoriesForPrompt(memories)

    // Load active skills
    const skills = await loadSkills()
    const skillContext = getActiveSkillPrompts(skills, task.prompt)

    const runner = new TaskRunner(
      task,
      {
        provider,
        openaiModel,
        cdpRelay: this.cdpRelay,
        memoryContext: memoryContext + skillContext,
        taskManager: this,
        taskId: task.id,
        policy: {
          workspaceRoot: policy?.workspaceRoot ?? null,
          capabilities: policy?.capabilities ?? DEFAULT_POLICY.capabilities
        },
        effectiveTaskCapabilities,
        executionPrompt: internal?.internalPrompt
      },
      {
        onUpdate: (updated) => {
          this.tasks.set(updated.id, updated)
          this.pushUpdate(updated)
          this.schedulePersist()
        }
      }
    )

    this.runners.set(taskId, runner)

    const startTime = Date.now()

    // Run in background — don't await
    void runner
      .run()
      .then((final) => {
        this.tasks.set(final.id, final)
        this.runners.delete(taskId)
        if (memoryEnabled) this.extractAndSaveMemory(final, provider, Date.now() - startTime)
        void this.persistToDisk()
      })
      .catch((e) => {
        task.status = 'failed'
        task.error = e instanceof Error ? e.message : String(e)
        task.updatedAt = Date.now()
        this.tasks.set(taskId, task)
        this.pushUpdate(task)
        this.runners.delete(taskId)
        if (memoryEnabled) this.extractAndSaveMemory(task, provider, Date.now() - startTime)
        void this.persistToDisk()
      })

    return task
  }

  /**
   * Spawn a sub-task, auto-approve it, and wait for completion.
   * Returns the finished task's id + summary. Timeout 10 min.
   */
  async spawnAndWait(
    prompt: string,
    parentCapabilities: import('../../shared/task').TaskCapabilityId[],
    parentTaskId?: string
  ): Promise<{ taskId: string; summary: string }> {
    const task = this.createInternal({ prompt, capabilities: parentCapabilities, parentTaskId })

    // Auto-approve (starts the runner internally)
    await this.approve(task.id)

    // Wait for terminal status via EventEmitter
    const result = await new Promise<Task>((resolve, reject) => {
      const timeout = setTimeout(
        () => {
          this.cancel(task.id)
          reject(new Error('Sub-task timed out after 10 minutes'))
        },
        10 * 60 * 1000
      )

      const onUpdate = (updated: Task): void => {
        if (updated.id !== task.id) return
        if (
          updated.status === 'completed' ||
          updated.status === 'failed' ||
          updated.status === 'cancelled'
        ) {
          clearTimeout(timeout)
          this.removeListener('taskUpdate', onUpdate)
          resolve(updated)
        }
      }
      this.on('taskUpdate', onUpdate)
    })

    return {
      taskId: result.id,
      summary: result.summary ?? result.error ?? `Sub-task ${result.status}`
    }
  }

  /**
   * Send a message to a running task's inbox. It will see it on its next step.
   */
  sendMessage(targetTaskId: string, fromTaskId: string, message: string): void {
    const target = this.tasks.get(targetTaskId)
    if (!target) throw new Error(`Task not found: ${targetTaskId}`)
    if (target.status !== 'running')
      throw new Error(`Task ${targetTaskId} is not running (status: ${target.status})`)

    let inbox = this.inboxes.get(targetTaskId)
    if (!inbox) {
      inbox = []
      this.inboxes.set(targetTaskId, inbox)
    }
    inbox.push({ from: fromTaskId, message })

    // Add as visible step in the task so it shows in the feed
    const task = this.tasks.get(targetTaskId)!
    task.steps.push({
      index: task.steps.length,
      timestamp: Date.now(),
      screenshotBase64: '',
      action: { type: 'user_message' as const, text: message }
    })
    task.updatedAt = Date.now()
    this.pushUpdate(task)
  }

  /**
   * Drain and return all pending messages for a task. Returns empty array if none.
   */
  drainMessages(taskId: string): Array<{ from: string; message: string }> {
    const inbox = this.inboxes.get(taskId)
    if (!inbox || inbox.length === 0) return []
    this.inboxes.set(taskId, [])
    return inbox
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
    this.internalEnvelopes.delete(taskId)
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
    closeMemoryDb()
  }

  /**
   * Extract learnings from a finished task and persist to memory DB.
   * Uses the task's final summary/error + last few action types as a compact learning.
   */
  private extractAndSaveMemory(task: Task, provider: string, durationMs: number): void {
    if (task.status !== 'completed' && task.status !== 'failed') return

    const outcome = task.status === 'completed' ? 'completed' : 'failed'
    const lastActions = task.steps
      .slice(-5)
      .map((s) => s.action.type)
      .join(', ')
    const summary = task.summary ?? task.error ?? 'No summary'
    const learnings = `${summary}. Steps: ${task.steps.length}. Last actions: ${lastActions}. Duration: ${Math.round(durationMs / 1000)}s.`

    saveMemory({
      taskId: task.id,
      prompt: task.prompt,
      outcome,
      learnings,
      provider,
      durationMs
    })
  }

  private getOrThrow(taskId: string): Task {
    const task = this.tasks.get(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)
    return task
  }

  private pushUpdate(task: Task): void {
    if (!isInternalTask(task) && this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('skynul:task:update', { task })
    }
    this.emit('taskUpdate', task)
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
      await this.persistInternalToDisk()
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
      this.persistInternalToDiskSync()
    } catch {
      // ignore
    }
  }

  private async persistInternalToDisk(): Promise<void> {
    const obj: Record<string, TaskEnvelopeInternal> = {}
    for (const [taskId, internal] of this.internalEnvelopes.entries()) {
      obj[taskId] = internal
    }
    await this.internalStore.saveAll(obj)
  }

  private persistInternalToDiskSync(): void {
    try {
      const obj: Record<string, TaskEnvelopeInternal> = {}
      for (const [taskId, internal] of this.internalEnvelopes.entries()) {
        obj[taskId] = internal
      }
      mkdirSync(dirname(this.internalPersistPath), { recursive: true })
      writeFileSync(this.internalPersistPath, JSON.stringify(obj, null, 2), 'utf8')
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

    try {
      const loadedInternal = await this.internalStore.loadAll()
      for (const [taskId, internal] of Object.entries(loadedInternal)) {
        this.internalEnvelopes.set(taskId, internal)
      }
      // Prune envelopes that don't have a task anymore
      for (const taskId of this.internalEnvelopes.keys()) {
        if (!this.tasks.has(taskId)) this.internalEnvelopes.delete(taskId)
      }
    } catch {
      // Non-critical
    }
  }
}

function intersectCapabilities<T extends string>(a: T[], b: T[]): T[] {
  const bs = new Set(b)
  return a.filter((x) => bs.has(x))
}
