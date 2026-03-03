import type { ChannelId, ChannelSettings } from '../../shared/channel'
import type { TaskManager } from '../agent/task-manager'
import type { Channel } from './channel'
import { TelegramChannel } from './telegram-channel'
import { WhatsAppChannel } from './whatsapp-channel'
import { DiscordChannel } from './discord-channel'
import { SignalChannel } from './signal-channel'
import { SlackChannel } from './slack-channel'

export class ChannelManager {
  private channels = new Map<ChannelId, Channel>()

  constructor(taskManager: TaskManager) {
    this.channels.set('telegram', new TelegramChannel(taskManager))
    this.channels.set('whatsapp', new WhatsAppChannel(taskManager))
    this.channels.set('discord', new DiscordChannel(taskManager))
    this.channels.set('signal', new SignalChannel(taskManager))
    this.channels.set('slack', new SlackChannel(taskManager))
  }

  async startAll(): Promise<void> {
    for (const ch of this.channels.values()) {
      try {
        await ch.start()
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

  getChannel(id: ChannelId): Channel {
    const ch = this.channels.get(id)
    if (!ch) throw new Error(`Unknown channel: ${id}`)
    return ch
  }

  getAllSettings(): ChannelSettings[] {
    return Array.from(this.channels.values()).map((ch) => ch.getSettings())
  }
}
