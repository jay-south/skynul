import type { PolicyState, Task, TaskCapabilityId, TaskCreateRequest, TaskMode } from '@skynul/shared'
import { randomBytes } from 'crypto'
import { EventEmitter } from 'events'
import { broadcast } from '../../ws/events'
import * as repo from '../repositories/tasks'
import * as skillRepo from '../repositories/skills'
import { getActiveSkillPrompts } from '../repositories/skill-matching'
import { closeMemoryDb, consolidateMemory, formatFactsForPrompt, formatMemoriesForPrompt, searchFacts, searchMemories } from './task-memory'
import { TaskRunner } from './task-runner'
import { inferAgentRole, pickAgentName } from './utils/naming'

const DEFAULT_MAX_STEPS = 200
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000

const MAX_CONCURRENT: Record<TaskMode, number> = { browser: 5, code: 10 }

export class TaskManager extends EventEmitter {
  private tasks = new Map<string, Task>()
  private runners = new Map<string, TaskRunner>()
  private inboxes = new Map<string, Array<{ from: string; message: string }>>()
  private getPolicy: (() => PolicyState) | null = null

  constructor() {
    super()
  }

  init(): void {
    this.loadFromDb()
  }

  setPolicyGetter(fn: () => PolicyState): void { this.getPolicy = fn }

  create(req: TaskCreateRequest): Task {
    const id = `task_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`
    const agentRole = req.agentRole ?? (req.parentTaskId ? inferAgentRole(req.prompt) : undefined)
    const agentName = req.agentName ?? (req.parentTaskId ? pickAgentName(agentRole ?? 'Agent', id) : undefined)
    const task: Task = {
      id, parentTaskId: req.parentTaskId, agentName, agentRole, prompt: req.prompt,
      attachments: req.attachments, status: 'pending_approval', mode: req.mode ?? 'browser',
      capabilities: req.capabilities, steps: [], createdAt: Date.now(), updatedAt: Date.now(),
      maxSteps: req.maxSteps ?? DEFAULT_MAX_STEPS, timeoutMs: req.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      source: req.source ?? 'desktop'
    }
    this.tasks.set(id, task)
    repo.create(task)
    return task
  }

  async approve(taskId: string): Promise<Task> {
    const task = this.getOrThrow(taskId)
    if (task.status !== 'pending_approval') throw new Error(`Cannot approve task in status: ${task.status}`)

    const running = [...this.runners.entries()].reduce((acc, [id]) => {
      const t = this.tasks.get(id); if (!t) return acc; acc[t.mode] = (acc[t.mode] ?? 0) + 1; return acc
    }, {} as Record<string, number>)
    const limit = MAX_CONCURRENT[task.mode]; const current = running[task.mode] ?? 0
    if (current >= limit) throw new Error(`Max ${limit} concurrent ${task.mode} tasks. Wait for one to finish.`)

    task.status = 'approved'; task.updatedAt = Date.now(); this.pushUpdate(task)
    task.status = 'running'; task.updatedAt = Date.now(); this.pushUpdate(task)

    const policy = this.getPolicy?.() ?? null
    const provider = policy?.provider.active ?? 'chatgpt'
    const openaiModel = policy?.provider.openaiModel ?? 'gpt-4.1'
    const memoryEnabled = policy?.taskMemoryEnabled ?? true

    const memories = memoryEnabled ? searchMemories(task.prompt) : []
    const facts = memoryEnabled ? searchFacts(task.prompt) : []
    const skills = skillRepo.list()
    const memoryContext = formatMemoriesForPrompt(memories) + formatFactsForPrompt(facts) + getActiveSkillPrompts(skills, task.prompt)

    const runner = new TaskRunner(task, {
      provider, openaiModel, memoryContext, taskManager: this, taskId: task.id
    }, {
      onStep: (taskId, step) => {
        const t = this.tasks.get(taskId)
        if (!t) return
        t.steps.push(step)
        t.updatedAt = Date.now()
        this.pushUpdate(t)
        repo.appendStep(taskId, step)
      },
      onComplete: (final) => {
        this.tasks.set(final.id, final)
        this.pushUpdate(final)
        repo.update(final.id, { status: final.status, updatedAt: final.updatedAt, steps: final.steps, usage: final.usage, summary: final.summary, error: final.error })
      }
    })

    this.runners.set(taskId, runner)
    const startTime = Date.now()

    void runner.run().then((final) => {
      this.tasks.set(final.id, final); this.runners.delete(taskId)
      if (memoryEnabled) consolidateMemory(final, provider, Date.now() - startTime)
    }).catch((e) => {
      task.status = 'failed'; task.error = e instanceof Error ? e.message : String(e); task.updatedAt = Date.now()
      this.tasks.set(taskId, task); this.pushUpdate(task); this.runners.delete(taskId)
      if (memoryEnabled) consolidateMemory(task, provider, Date.now() - startTime)
      repo.update(taskId, { status: task.status, updatedAt: task.updatedAt, steps: task.steps, error: task.error })
    })

    return task
  }

  async spawnAndWait(prompt: string, parentCapabilities: TaskCapabilityId[], parentTaskId?: string, agentIdentity?: { agentName?: string; agentRole?: string }): Promise<{ taskId: string; status: Task['status']; output: string; summary?: string; error?: string }> {
    const task = this.create({ prompt, capabilities: parentCapabilities, parentTaskId, agentName: agentIdentity?.agentName, agentRole: agentIdentity?.agentRole })
    await this.approve(task.id)

    const result = await new Promise<Task>((resolve, reject) => {
      const timeout = setTimeout(() => { this.cancel(task.id); reject(new Error('Sub-task timed out after 10 minutes')) }, 10 * 60 * 1000)
      const onUpdate = (updated: Task) => {
        if (updated.id !== task.id) return
        if (updated.status === 'completed' || updated.status === 'failed' || updated.status === 'cancelled') {
          clearTimeout(timeout); this.removeListener('taskUpdate', onUpdate); resolve(updated)
        }
      }
      this.on('taskUpdate', onUpdate)
    })

    const doneStep = [...result.steps].reverse().find((s) => (s.action as any)?.type === 'done') as (import('@skynul/shared').TaskStep & { action: { type: 'done'; summary: string } }) | undefined
    const doneSummary = doneStep?.action?.summary; const status = result.status
    const output = status === 'completed' ? (doneSummary ?? result.summary ?? '') : (result.error ?? doneSummary ?? result.summary ?? '')
    return { taskId: result.id, status, output: output || `Sub-task ${status}`, summary: result.summary ?? undefined, error: result.error ?? undefined }
  }

  sendMessage(targetTaskId: string, fromTaskId: string, message: string): void {
    const target = this.tasks.get(targetTaskId)
    if (!target) throw new Error(`Task not found: ${targetTaskId}`)
    if (target.status !== 'running') throw new Error(`Task ${targetTaskId} is not running (status: ${target.status})`)
    let inbox = this.inboxes.get(targetTaskId)
    if (!inbox) { inbox = []; this.inboxes.set(targetTaskId, inbox) }
    inbox.push({ from: fromTaskId, message })
    const task = this.tasks.get(targetTaskId)!
    task.steps.push({ index: task.steps.length, timestamp: Date.now(), screenshotBase64: '', action: { type: 'user_message' as const, text: message } })
    task.updatedAt = Date.now(); this.pushUpdate(task)
    repo.update(task.id, { steps: task.steps, updatedAt: task.updatedAt })
  }

  drainMessages(taskId: string): Array<{ from: string; message: string }> {
    const inbox = this.inboxes.get(taskId); if (!inbox || inbox.length === 0) return []
    this.inboxes.set(taskId, []); return inbox
  }

  cancel(taskId: string): Task {
    const task = this.getOrThrow(taskId)
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') return task
    const runner = this.runners.get(taskId)
    if (runner) { runner.abort('Cancelled by user'); this.runners.delete(taskId) }
    task.status = 'cancelled'; task.updatedAt = Date.now(); this.tasks.set(taskId, task); this.pushUpdate(task)
    repo.update(taskId, { status: task.status, updatedAt: task.updatedAt }); return task
  }

  delete(taskId: string): void {
    const task = this.tasks.get(taskId); if (!task) return
    const runner = this.runners.get(taskId)
    if (runner) { runner.abort('Deleted by user'); this.runners.delete(taskId) }
    this.tasks.delete(taskId); repo.remove(taskId)
  }

  get(taskId: string): Task | undefined { return this.tasks.get(taskId) }
  list(): Task[] { return [...this.tasks.values()].sort((a, b) => b.createdAt - a.createdAt) }

  destroyAll(): void {
    for (const [id, runner] of this.runners) { runner.abort('App shutting down'); this.runners.delete(id) }
    closeMemoryDb()
  }

  private getOrThrow(taskId: string): Task { const t = this.tasks.get(taskId); if (!t) throw new Error(`Task not found: ${taskId}`); return t }

  private pushUpdate(task: Task): void {
    broadcast({ type: 'task:update', payload: { task } }); this.emit('taskUpdate', task)
  }

  private loadFromDb(): void {
    try {
      const loaded = repo.list()
      for (const task of loaded) {
        if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
          this.tasks.set(task.id, task)
        } else {
          task.status = 'failed'; task.error = 'Interrupted by server restart'; task.updatedAt = Date.now()
          this.tasks.set(task.id, task)
          repo.update(task.id, { status: task.status, updatedAt: task.updatedAt, error: task.error })
        }
      }
    } catch { /* start fresh */ }
  }
}
