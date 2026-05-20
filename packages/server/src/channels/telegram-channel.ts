import { randomBytes } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { ChannelId, ChannelSettings } from '@skynul/shared'
import { Bot, InputFile } from 'grammy'
import { Channel } from './channel'

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

function toHtml(text: string): string {
  let out = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>')
  out = out.replace(/(?<!href=")(https?:\/\/[^\s<]+)/g, '<a href="$1">Link</a>')
  out = out.replace(/\*([^*]+)\*/g, '<b>$1</b>')
  out = out.replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<i>$1</i>')
  return out
}

export class TelegramChannel extends Channel {
  readonly id: ChannelId = 'telegram'
  private bot: Bot | null = null
  private state: TelegramState = { ...DEFAULT_STATE }
  private hasToken = false
  private statusError: string | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null

  async start(): Promise<void> {
    this.state = await this.loadState()
    const token = this.opts.credentials.token
    this.hasToken = !!token
    if (!this.state.enabled || !token) return

    await this.stop()

    try {
      this.bot = new Bot(token)
      this.statusError = null

      this.bot.catch((err) => {
        const msg = err.message ?? String(err)
        console.error('[TelegramChannel] Bot error:', msg)
        this.statusError = msg
      })
      this.registerCommands()

      console.log('[TelegramChannel] Starting bot polling...')
      this.bot
        .start({
          onStart: () => {
            console.log('[TelegramChannel] Polling started OK')
            this.statusError = null
          },
          drop_pending_updates: true
        })
        .catch((e) => {
          const msg = e instanceof Error ? e.message : String(e)
          console.error('[TelegramChannel] Polling stopped:', msg)
          this.statusError = msg
          this.bot = null
          this.scheduleRetry()
        })
    } catch (e) {
      console.error('[TelegramChannel] Failed to start bot:', e)
      this.statusError = e instanceof Error ? e.message : String(e)
      this.bot = null
      this.scheduleRetry()
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer) return
    console.log('[TelegramChannel] Will retry in 30s...')
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      if (this.state.enabled && !this.bot) {
        void this.start()
      }
    }, 30_000)
  }

  async stop(): Promise<void> {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
    if (this.bot) {
      await this.bot.stop()
      this.bot = null
    }
    this.statusError = null
  }

  getSettings(): ChannelSettings {
    return {
      id: 'telegram',
      enabled: this.state.enabled,
      status: this.bot ? 'connected' : this.state.enabled ? 'error' : 'disconnected',
      paired: this.state.pairedChatId !== null,
      pairingCode: this.state.pairingCode,
      error: this.statusError,
      hasCredentials: this.hasToken,
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
      this.opts.credentials.token = creds.token.trim()
      this.hasToken = true
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
    if (!this.state.pairedChatId || !this.bot) return
    try {
      await this.bot.api.sendMessage(this.state.pairedChatId, toHtml(text), { parse_mode: 'HTML' })
    } catch {
      await this.bot.api.sendMessage(this.state.pairedChatId, text)
    }
  }

  protected async sendFile(filePath: string): Promise<void> {
    if (!this.state.pairedChatId || !this.bot) return
    try {
      await this.bot.api.sendDocument(
        this.state.pairedChatId,
        new InputFile(filePath, basename(filePath))
      )
    } catch {
      /* skip */
    }
  }

  private registerCommands(): void {
    if (!this.bot) return

    this.bot.command('pair', async (ctx) => {
      const code = ctx.match?.trim()
      if (!code) {
        await ctx.reply('Uso: /pair <código>')
        return
      }
      if (!this.state.pairingCode) {
        await ctx.reply('No hay código activo. Generá uno desde Skynul.')
        return
      }
      if (code !== this.state.pairingCode) {
        await ctx.reply('Código inválido.')
        return
      }
      this.state.pairedChatId = ctx.chat.id
      this.state.pairingCode = null
      await this.saveState()
      await ctx.reply('✅ Vinculado! Mandame un mensaje para crear una tarea.')
    })

    this.bot.command('unpair', async (ctx) => {
      if (this.state.pairedChatId !== ctx.chat.id) return
      await this.unpair()
      await ctx.reply('Desvinculado.')
    })

    this.bot.command('list', async (ctx) => {
      if (this.state.pairedChatId !== ctx.chat.id) return
      // TODO: request task list from Rust server via stdout
      await ctx.reply('Task list coming soon...')
    })

    this.bot.command('status', async (ctx) => {
      if (this.state.pairedChatId !== ctx.chat.id) return
      // TODO: request task status from Rust server
      await ctx.reply('Task status coming soon...')
    })

    this.bot.command('cancel', async (ctx) => {
      if (this.state.pairedChatId !== ctx.chat.id) return
      // TODO: send cancel to Rust server via stdout
      await ctx.reply('Cancel coming soon...')
    })

    this.bot.on('message:document', async (ctx) => {
      if (this.state.pairedChatId !== ctx.chat.id) return
      try {
        const doc = ctx.message.document
        const file = await ctx.api.getFile(doc.file_id)
        const url = `https://api.telegram.org/file/bot${this.bot?.token}/${file.file_path}`
        const destDir = join(
          process.env.SKYNUL_DATA_DIR || join(require('node:os').homedir(), '.skynul'),
          'received'
        )
        await mkdir(destDir, { recursive: true })
        const destPath = join(destDir, doc.file_name ?? `file_${Date.now()}`)
        const res = await fetch(url)
        if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status}`)
        const ws = createWriteStream(destPath)
        await pipeline(res.body, ws)
        await ctx.reply(`✅ Guardado en: ${destPath}`)
      } catch (e) {
        await ctx.reply(`Error: ${e instanceof Error ? e.message : String(e)}`)
      }
    })

    this.bot.on('message:text', async (ctx) => {
      if (this.state.pairedChatId !== ctx.chat.id) {
        await ctx.reply('No estás vinculado. Usá /pair <código> primero.')
        return
      }
      const prompt = ctx.message.text.trim()
      if (!prompt) return
      // Emit to stdout → Rust server creates the task
      this.emitIncoming(String(ctx.chat.id), prompt)
      await ctx.reply('✅ Tarea enviada!')
    })
  }

  private settingsPath(): string {
    return join(
      process.env.SKYNUL_DATA_DIR || join(require('node:os').homedir(), '.skynul'),
      'channels',
      'telegram.json'
    )
  }

  private async loadState(): Promise<TelegramState> {
    try {
      const raw = await readFile(this.settingsPath(), 'utf8')
      return { ...DEFAULT_STATE, ...JSON.parse(raw) }
    } catch {
      return { ...DEFAULT_STATE }
    }
  }

  private async saveState(): Promise<void> {
    const file = this.settingsPath()
    await require('node:fs/promises').mkdir(require('node:path').dirname(file), { recursive: true })
    await writeFile(file, JSON.stringify(this.state, null, 2), 'utf8')
  }
}
