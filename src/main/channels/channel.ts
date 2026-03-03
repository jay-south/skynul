import type { ChannelId, ChannelSettings } from '../../shared/channel'
import type { TaskManager } from '../agent/task-manager'
import type { Task } from '../../shared/task'
import {
  formatTaskSummary,
  formatStepUpdate,
  formatTaskComplete,
  formatTaskFailed
} from './message-formatter'

/** Default capabilities for tasks created via messaging channels. */
export const DEFAULT_CHANNEL_CAPABILITIES = [
  'browser.cdp',
  'app.launch'
] as const

export abstract class Channel {
  abstract readonly id: ChannelId
  protected taskManager: TaskManager
  private stepCounters = new Map<string, number>()

  constructor(taskManager: TaskManager) {
    this.taskManager = taskManager
  }

  abstract start(): Promise<void>
  abstract stop(): Promise<void>
  abstract getSettings(): ChannelSettings
  abstract setEnabled(enabled: boolean): Promise<ChannelSettings>
  abstract setCredentials(creds: Record<string, string>): Promise<void>
  abstract generatePairingCode(): Promise<string>
  abstract unpair(): Promise<void>

  /** Send a text message to the paired user/chat. Subclasses implement this. */
  protected abstract sendMessage(text: string): Promise<void>

  /** Subscribe to task updates and relay them to the channel. */
  protected subscribeToTaskUpdates(): void {
    this.taskManager.on('taskUpdate', (task: Task) => {
      void this.handleTaskUpdate(task)
    })
  }

  private async handleTaskUpdate(task: Task): Promise<void> {
    try {
      if (task.status === 'completed') {
        this.stepCounters.delete(task.id)
        await this.sendMessage(formatTaskComplete(task))
        return
      }

      if (task.status === 'failed' || task.status === 'cancelled') {
        this.stepCounters.delete(task.id)
        await this.sendMessage(formatTaskFailed(task))
        return
      }

      if (task.status === 'running' && task.steps.length > 0) {
        const count = (this.stepCounters.get(task.id) ?? 0) + 1
        this.stepCounters.set(task.id, count)
        if (count % 5 === 0) {
          await this.sendMessage(formatStepUpdate(task))
        }
      }
    } catch (e) {
      console.warn(`[${this.id}] Failed to send update:`, e)
    }
  }

  /** Helper: create + auto-approve a task from an incoming message. */
  protected async createTaskFromMessage(prompt: string): Promise<Task> {
    const task = this.taskManager.create({
      prompt,
      capabilities: [...DEFAULT_CHANNEL_CAPABILITIES]
    })
    await this.taskManager.approve(task.id)
    return task
  }

  /** Helper: format a task summary (reused by subclasses). */
  protected formatSummary(task: Task): string {
    return formatTaskSummary(task)
  }
}
