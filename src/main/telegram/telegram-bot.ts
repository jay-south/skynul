import { Bot } from 'grammy'
import { randomBytes } from 'crypto'
import type { TaskManager } from '../agent/task-manager'
import type { Task } from '../../shared/task'
import {
  loadTelegramSettings,
  saveTelegramSettings,
  type TelegramSettings
} from './telegram-settings'
import {
  formatTaskSummary,
  formatStepUpdate,
  formatTaskComplete,
  formatTaskFailed,
  formatTaskList
} from './telegram-formatter'
import { getSecret } from '../secret-store'

/** Default capabilities for tasks created via Telegram. */
const DEFAULT_CAPABILITIES = [
  'screen.read',
  'input.mouse',
  'input.keyboard',
  'app.launch'
] as const

export class TelegramBot {
  private bot: Bot | null = null
  private settings: TelegramSettings = {
    enabled: false,
    pairedChatId: null,
    pairingCode: null
  }
  private taskManager: TaskManager
  private stepCounters = new Map<string, number>()

  constructor(taskManager: TaskManager) {
    this.taskManager = taskManager
  }

  async start(): Promise<void> {
    this.settings = await loadTelegramSettings()
    if (!this.settings.enabled) return

    const token = await getSecret('telegram.botToken')
    if (!token) {
      console.warn('[TelegramBot] Enabled but no bot token set')
      return
    }

    this.bot = new Bot(token)
    this.registerCommands()
    this.subscribeToTaskUpdates()

    // Start polling (non-blocking)
    this.bot.start({
      onStart: () => console.log('[TelegramBot] Polling started'),
      drop_pending_updates: true
    })
  }

  async stop(): Promise<void> {
    if (this.bot) {
      await this.bot.stop()
      this.bot = null
    }
  }

  /** Generate a new pairing code. Returns it for the UI to display. */
  async generatePairingCode(): Promise<string> {
    const code = randomBytes(4).toString('hex')
    this.settings.pairingCode = code
    await saveTelegramSettings(this.settings)
    return code
  }

  /** Unpair the current chat. */
  async unpair(): Promise<void> {
    this.settings.pairedChatId = null
    this.settings.pairingCode = null
    await saveTelegramSettings(this.settings)
  }

  /** Enable or disable the bot. Starts/stops polling accordingly. */
  async setEnabled(enabled: boolean): Promise<void> {
    this.settings.enabled = enabled
    await saveTelegramSettings(this.settings)

    if (enabled) {
      await this.start()
    } else {
      await this.stop()
    }
  }

  getSettings(): TelegramSettings {
    return { ...this.settings }
  }

  private registerCommands(): void {
    if (!this.bot) return

    this.bot.command('pair', async (ctx) => {
      const code = ctx.match?.trim()
      if (!code) {
        await ctx.reply('Usage: /pair <code>')
        return
      }

      if (!this.settings.pairingCode) {
        await ctx.reply('No pairing code active. Generate one from the Netbot settings.')
        return
      }

      if (code !== this.settings.pairingCode) {
        await ctx.reply('Invalid pairing code.')
        return
      }

      this.settings.pairedChatId = ctx.chat.id
      this.settings.pairingCode = null
      await saveTelegramSettings(this.settings)
      await ctx.reply('Paired successfully! Send me any message to create a task.')
    })

    // All other commands require pairing
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

    // Any other text = create + auto-approve task
    this.bot.on('message:text', async (ctx) => {
      if (!this.isPaired(ctx.chat.id)) {
        await ctx.reply('Not paired. Use /pair <code> first.')
        return
      }

      const prompt = ctx.message.text.trim()
      if (!prompt) return

      try {
        const task = this.taskManager.create({
          prompt,
          capabilities: [...DEFAULT_CAPABILITIES]
        })
        await ctx.reply(formatTaskSummary(task), { parse_mode: 'Markdown' })

        // Auto-approve
        await this.taskManager.approve(task.id)
      } catch (e) {
        await ctx.reply(`Failed to create task: ${e instanceof Error ? e.message : String(e)}`)
      }
    })
  }

  private isPaired(chatId: number): boolean {
    return this.settings.pairedChatId === chatId
  }

  private subscribeToTaskUpdates(): void {
    this.taskManager.on('taskUpdate', (task: Task) => {
      void this.handleTaskUpdate(task)
    })
  }

  private async handleTaskUpdate(task: Task): Promise<void> {
    if (!this.bot || !this.settings.pairedChatId) return

    const chatId = this.settings.pairedChatId

    try {
      if (task.status === 'completed') {
        this.stepCounters.delete(task.id)
        await this.bot.api.sendMessage(chatId, formatTaskComplete(task), {
          parse_mode: 'Markdown'
        })
        return
      }

      if (task.status === 'failed' || task.status === 'cancelled') {
        this.stepCounters.delete(task.id)
        await this.bot.api.sendMessage(chatId, formatTaskFailed(task), {
          parse_mode: 'Markdown'
        })
        return
      }

      // Running: send update every 5th step
      if (task.status === 'running' && task.steps.length > 0) {
        const count = (this.stepCounters.get(task.id) ?? 0) + 1
        this.stepCounters.set(task.id, count)
        if (count % 5 === 0) {
          await this.bot.api.sendMessage(chatId, formatStepUpdate(task), {
            parse_mode: 'Markdown'
          })
        }
      }
    } catch (e) {
      console.warn('[TelegramBot] Failed to send update:', e)
    }
  }
}
