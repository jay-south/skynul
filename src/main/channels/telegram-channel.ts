import { Bot } from 'grammy'
import { randomBytes } from 'crypto'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { app } from 'electron'
import type { ChannelId, ChannelSettings } from '../../shared/channel'
import type { TaskManager } from '../agent/task-manager'
import { Channel } from './channel'
import { formatTaskList, formatTaskSummary } from './message-formatter'
import { getSecret, setSecret } from '../secret-store'

type TelegramState = {
  enabled: boolean
  pairedChatId: number | null
  pairingCode: string | null
}

const DEFAULT_STATE: TelegramState = {
  enabled: false,
  pairedChatId: null,
  pairingCode: null
}

export class TelegramChannel extends Channel {
  readonly id: ChannelId = 'telegram'
  private bot: Bot | null = null
  private state: TelegramState = { ...DEFAULT_STATE }

  constructor(taskManager: TaskManager) {
    super(taskManager)
  }

  async start(): Promise<void> {
    this.state = await this.loadState()
    if (!this.state.enabled) return

    const token = await getSecret('telegram.botToken')
    if (!token) {
      console.warn('[TelegramChannel] Enabled but no bot token set')
      return
    }

    this.bot = new Bot(token)
    this.registerCommands()
    this.subscribeToTaskUpdates()

    this.bot.start({
      onStart: () => console.log('[TelegramChannel] Polling started'),
      drop_pending_updates: true
    })
  }

  async stop(): Promise<void> {
    if (this.bot) {
      await this.bot.stop()
      this.bot = null
    }
  }

  getSettings(): ChannelSettings {
    return {
      id: 'telegram',
      enabled: this.state.enabled,
      status: this.bot ? 'connected' : this.state.enabled ? 'error' : 'disconnected',
      paired: this.state.pairedChatId !== null,
      pairingCode: this.state.pairingCode,
      error: null,
      meta: { pairedChatId: this.state.pairedChatId }
    }
  }

  async setEnabled(enabled: boolean): Promise<ChannelSettings> {
    this.state.enabled = enabled
    await this.saveState()
    if (enabled) {
      await this.start()
    } else {
      await this.stop()
    }
    return this.getSettings()
  }

  async setCredentials(creds: Record<string, string>): Promise<void> {
    if (creds.token) {
      await setSecret('telegram.botToken', creds.token.trim())
    }
  }

  async generatePairingCode(): Promise<string> {
    const code = randomBytes(4).toString('hex')
    this.state.pairingCode = code
    await this.saveState()
    return code
  }

  async unpair(): Promise<void> {
    this.state.pairedChatId = null
    this.state.pairingCode = null
    await this.saveState()
  }

  protected async sendMessage(text: string): Promise<void> {
    if (!this.bot || !this.state.pairedChatId) return
    await this.bot.api.sendMessage(this.state.pairedChatId, text, { parse_mode: 'Markdown' })
  }

  private registerCommands(): void {
    if (!this.bot) return

    this.bot.command('pair', async (ctx) => {
      const code = ctx.match?.trim()
      if (!code) {
        await ctx.reply('Usage: /pair <code>')
        return
      }
      if (!this.state.pairingCode) {
        await ctx.reply('No pairing code active. Generate one from Skynul settings.')
        return
      }
      if (code !== this.state.pairingCode) {
        await ctx.reply('Invalid pairing code.')
        return
      }
      this.state.pairedChatId = ctx.chat.id
      this.state.pairingCode = null
      await this.saveState()
      await ctx.reply('Paired successfully! Send me any message to create a task.')
    })

    this.bot.command('unpair', async (ctx) => {
      if (!this.isPaired(ctx.chat.id)) return
      await this.unpair()
      await ctx.reply('Unpaired. You will no longer receive updates.')
    })

    this.bot.command('list', async (ctx) => {
      if (!this.isPaired(ctx.chat.id)) return
      const tasks = this.taskManager.list()
      await ctx.reply(formatTaskList(tasks), { parse_mode: 'Markdown' })
    })

    this.bot.command('status', async (ctx) => {
      if (!this.isPaired(ctx.chat.id)) return
      const taskId = ctx.match?.trim()
      if (!taskId) {
        await ctx.reply('Usage: /status <task_id>')
        return
      }
      const task = this.taskManager.get(taskId)
      if (!task) {
        await ctx.reply('Task not found.')
        return
      }
      await ctx.reply(formatTaskSummary(task), { parse_mode: 'Markdown' })
    })

    this.bot.command('cancel', async (ctx) => {
      if (!this.isPaired(ctx.chat.id)) return
      const taskId = ctx.match?.trim()
      if (!taskId) {
        await ctx.reply('Usage: /cancel <task_id>')
        return
      }
      try {
        this.taskManager.cancel(taskId)
        await ctx.reply(`Task \`${taskId}\` cancelled.`, { parse_mode: 'Markdown' })
      } catch (e) {
        await ctx.reply(`Error: ${e instanceof Error ? e.message : String(e)}`)
      }
    })

    this.bot.on('message:text', async (ctx) => {
      if (!this.isPaired(ctx.chat.id)) {
        await ctx.reply('Not paired. Use /pair <code> first.')
        return
      }
      const prompt = ctx.message.text.trim()
      if (!prompt) return
      try {
        const task = await this.createTaskFromMessage(prompt)
        await ctx.reply(this.formatSummary(task), { parse_mode: 'Markdown' })
      } catch (e) {
        await ctx.reply(`Failed to create task: ${e instanceof Error ? e.message : String(e)}`)
      }
    })
  }

  private isPaired(chatId: number): boolean {
    return this.state.pairedChatId === chatId
  }

  private settingsPath(): string {
    return join(app.getPath('userData'), 'channels', 'telegram.json')
  }

  private async loadState(): Promise<TelegramState> {
    try {
      const raw = await readFile(this.settingsPath(), 'utf8')
      return { ...DEFAULT_STATE, ...JSON.parse(raw) }
    } catch {
      // Try migrating from old location
      try {
        const oldPath = join(app.getPath('userData'), 'telegram.json')
        const raw = await readFile(oldPath, 'utf8')
        const migrated = { ...DEFAULT_STATE, ...JSON.parse(raw) }
        await this.saveStateData(migrated)
        return migrated
      } catch {
        return { ...DEFAULT_STATE }
      }
    }
  }

  private async saveState(): Promise<void> {
    await this.saveStateData(this.state)
  }

  private async saveStateData(data: TelegramState): Promise<void> {
    const file = this.settingsPath()
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, JSON.stringify(data, null, 2), 'utf8')
  }
}
