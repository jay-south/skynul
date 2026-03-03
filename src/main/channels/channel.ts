import type { ChannelId, ChannelSettings } from '../../shared/channel'
import type { TaskManager } from '../agent/task-manager'
import type { ChannelManager } from './channel-manager'
import type { Task, TaskSource } from '../../shared/task'
import {
  formatTaskSummary,
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
  protected channelManager: ChannelManager | null = null

  constructor(taskManager: TaskManager) {
    this.taskManager = taskManager
  }

  /** Called by ChannelManager after construction to inject back-reference. */
  setChannelManager(cm: ChannelManager): void {
    this.channelManager = cm
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
    console.log(`[${this.id}] taskUpdate: id=${task.id} status=${task.status} source=${task.source}`)

    // Only notify for tasks originated from THIS channel
    if (task.source !== this.id) return

    try {
      if (task.status === 'completed') {
        console.log(`[${this.id}] Sending completion message for task ${task.id}`)
        await this.sendMessage(formatTaskComplete(task))
        return
      }

      if (task.status === 'failed' || task.status === 'cancelled') {
        console.log(`[${this.id}] Sending failure message for task ${task.id}`)
        await this.sendMessage(formatTaskFailed(task))
        return
      }

      // No step-by-step updates — only final results
    } catch (e) {
      console.warn(`[${this.id}] Failed to send update:`, e)
    }
  }

  /** Helper: create a task from an incoming message. Auto-approves if global setting is ON. */
  protected async createTaskFromMessage(prompt: string): Promise<Task> {
    const task = this.taskManager.create({
      prompt,
      capabilities: [...DEFAULT_CHANNEL_CAPABILITIES],
      source: this.id as TaskSource
    })

    const autoApprove = this.channelManager?.isAutoApprove() ?? true
    if (autoApprove) {
      await this.taskManager.approve(task.id)
    } else {
      await this.sendMessage('Tarea creada, aprobala desde la app.')
    }
    return task
  }

  /** Helper: format a task summary (reused by subclasses). */
  protected formatSummary(task: Task): string {
    return formatTaskSummary(task)
  }
}
