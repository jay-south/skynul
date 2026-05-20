import type { ChannelId, ChannelSettings, TaskSource } from '@skynul/shared'
import type { Channel, ChannelOpts } from './channel'
import { DiscordChannel } from './discord-channel'
import { SignalChannel } from './signal-channel'
import { SlackChannel } from './slack-channel'
import { TelegramChannel } from './telegram-channel'
import { WhatsAppChannel } from './whatsapp-channel'

type ChannelInit = {
  enabled: boolean
  credentials: Record<string, string>
}

export class ChannelManager {
  private channels = new Map<ChannelId, Channel>()
  private autoApprove = true
  private onTaskUpdate:
    | ((task: {
        id: string
        status: string
        summary?: string
        error?: string
        source?: TaskSource
      }) => void)
    | null = null

  constructor(init?: Record<string, ChannelInit>) {
    if (!init) return

    const channelClasses: Record<string, new (opts: ChannelOpts) => Channel> = {
      telegram: TelegramChannel,
      whatsapp: WhatsAppChannel,
      discord: DiscordChannel,
      signal: SignalChannel,
      slack: SlackChannel
    }

    for (const [id, cfg] of Object.entries(init)) {
      const Cls = channelClasses[id]
      if (!Cls) continue
      const ch = new Cls({
        enabled: cfg.enabled,
        credentials: cfg.credentials,
        autoApprove: this.autoApprove,
        onTaskUpdate: (task) => this.onTaskUpdate?.(task)
      })
      this.channels.set(id as ChannelId, ch)
    }
  }

  setAutoApprove(val: boolean): void {
    this.autoApprove = val
  }

  setTaskUpdateHandler(
    fn: (task: {
      id: string
      status: string
      summary?: string
      error?: string
      source?: TaskSource
    }) => void
  ): void {
    this.onTaskUpdate = fn
  }

  async startAll(): Promise<void> {
    for (const ch of this.channels.values()) {
      try {
        if (ch.getSettings().enabled) await ch.start()
      } catch (e) {
        console.warn(`[ChannelManager] Failed to start ${ch.id}:`, e)
      }
    }
  }

  async stopAll(): Promise<void> {
    for (const ch of this.channels.values()) {
      try {
        await ch.stop()
      } catch (e) {
        console.warn(`[ChannelManager] Failed to stop ${ch.id}:`, e)
      }
    }
  }

  getChannel(id: ChannelId): Channel | undefined {
    return this.channels.get(id)
  }

  getAllSettings(): ChannelSettings[] {
    return Array.from(this.channels.values()).map((ch) => ch.getSettings())
  }

  /** Relay a task update to the appropriate channel. */
  async relayTaskUpdate(task: {
    id: string
    status: string
    summary?: string
    error?: string
    source?: TaskSource
  }): Promise<void> {
    if (!task.source) return
    const ch = this.channels.get(task.source as ChannelId)
    if (ch) await ch.handleTaskUpdate(task)
  }
}
