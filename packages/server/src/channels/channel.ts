import type { ChannelId, ChannelSettings, TaskSource } from '@skynul/shared'
import { writeOutput } from '../protocol'

/** Extract file paths from task summary (Windows & WSL paths). */
function extractFilePaths(text: string): string[] {
  const paths: string[] = []
  const re = /(?:[A-Z]:\\[\w\\. -]+\.\w{2,5}|\/mnt\/[a-z]\/[\w/. -]+\.\w{2,5})/gi
  for (;;) {
    const m = re.exec(text)
    if (m === null) break
    paths.push(m[0])
  }
  return paths
}

export type ChannelOpts = {
  enabled: boolean
  credentials: Record<string, string>
  autoApprove?: boolean
  onTaskUpdate?: (task: {
    id: string
    status: string
    summary?: string
    error?: string
    source?: TaskSource
  }) => void
}

export abstract class Channel {
  abstract readonly id: ChannelId
  protected opts: ChannelOpts

  constructor(opts: ChannelOpts) {
    this.opts = opts
  }

  abstract start(): Promise<void>
  abstract stop(): Promise<void>
  abstract getSettings(): ChannelSettings
  abstract setEnabled(enabled: boolean): Promise<ChannelSettings>
  abstract setCredentials(creds: Record<string, string>): Promise<void>
  abstract generatePairingCode(): Promise<string>
  abstract unpair(): Promise<void>

  /** Send a text message to the paired user/chat. */
  protected abstract sendMessage(text: string): Promise<void>

  /** Send a file to the paired user/chat. */
  protected async sendFile(_filePath: string): Promise<void> {}

  /** Notify channel of a task update (called by index.ts when Rust sends updates). */
  async handleTaskUpdate(task: {
    id: string
    status: string
    summary?: string
    error?: string
    source?: TaskSource
  }): Promise<void> {
    if (task.source !== this.id) return

    if (task.status === 'completed' && task.summary) {
      await this.sendMessage(task.summary)
      for (const fp of extractFilePaths(task.summary)) {
        try {
          const wslPath = fp.match(/^[A-Z]:\\/i)
            ? `/mnt/${fp[0].toLowerCase()}${fp.slice(2).replace(/\\/g, '/')}`
            : fp
          const { stat } = await import('node:fs/promises')
          const info = await stat(wslPath)
          if (info.isFile() && info.size <= 50 * 1024 * 1024) {
            await this.sendFile(wslPath)
          }
        } catch {
          /* skip */
        }
      }
    } else if (task.status === 'failed' || task.status === 'cancelled') {
      const msg =
        task.status === 'cancelled'
          ? `⛔ Tarea cancelada`
          : `❌ Tarea fallida: ${task.error ?? 'error desconocido'}`
      await this.sendMessage(msg)
    }
  }

  /** Emit an incoming message to stdout (Rust server will create the task). */
  protected emitIncoming(chatId: string, text: string): void {
    writeOutput({
      type: 'channel_incoming',
      source: this.id as TaskSource,
      chat_id: chatId,
      text
    })
  }
}
