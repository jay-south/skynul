import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ChannelId, ChannelSettings } from '@skynul/shared'
import type { Message as DiscordMessage } from 'discord.js'
import { Client, Events, GatewayIntentBits } from 'discord.js'
import { Channel } from './channel'

type DiscordState = {
  enabled: boolean
  paired: boolean
  pairedUserId: string | null
  pairedChannelId: string | null
  pairingCode: string | null
}

const DEFAULT_STATE: DiscordState = {
  enabled: false,
  paired: false,
  pairedUserId: null,
  pairedChannelId: null,
  pairingCode: null
}

function getDataDir(): string {
  return process.env.SKYNUL_DATA_DIR ?? join(require('node:os').homedir(), '.skynul')
}

export class DiscordChannel extends Channel {
  readonly id: ChannelId = 'discord'
  private state: DiscordState = { ...DEFAULT_STATE }
  private client: Client | null = null
  private lastError: string | null = null

  async start(): Promise<void> {
    this.state = await this.loadState()
    if (!this.state.enabled) return

    const token = this.opts.credentials.token
    if (!token) return

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
      ]
    })

    this.client.on(Events.ClientReady, () => {
      this.lastError = null
    })

    this.client.on(Events.MessageCreate, (msg: DiscordMessage) => {
      void this.handleIncoming(msg)
    })

    this.client.on(Events.Error, (err: Error) => {
      this.lastError = err.message
    })

    try {
      await this.client.login(token)
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e)
    }
  }

  async stop(): Promise<void> {
    if (this.client) {
      try {
        await this.client.destroy()
      } catch {
        /* ignore */
      }
      this.client = null
    }
  }

  getSettings(): ChannelSettings {
    return {
      id: 'discord',
      enabled: this.state.enabled,
      status: this.client?.isReady()
        ? 'connected'
        : this.state.enabled
          ? 'connecting'
          : 'disconnected',
      paired: this.state.paired,
      pairingCode: this.state.pairingCode,
      error: this.lastError,
      hasCredentials: false,
      meta: { pairedUserId: this.state.pairedUserId, pairedChannelId: this.state.pairedChannelId }
    }
  }

  async setEnabled(enabled: boolean): Promise<ChannelSettings> {
    this.state.enabled = enabled
    await this.saveState()
    if (enabled) await this.start()
    else await this.stop()
    return this.getSettings()
  }

  async setCredentials(creds: Record<string, string>): Promise<void> {
    if (creds.token) this.opts.credentials.token = creds.token.trim()
  }

  async generatePairingCode(): Promise<string> {
    const code = randomBytes(4).toString('hex')
    this.state.pairingCode = code
    await this.saveState()
    return code
  }

  async unpair(): Promise<void> {
    this.state.paired = false
    this.state.pairedUserId = null
    this.state.pairedChannelId = null
    this.state.pairingCode = null
    await this.saveState()
  }

  protected async sendMessage(text: string): Promise<void> {
    if (!this.client || !this.state.pairedChannelId) return
    const channel = await this.client.channels.fetch(this.state.pairedChannelId)
    if (channel?.isTextBased() && 'send' in channel) {
      await (channel as { send: (msg: string) => Promise<unknown> }).send(text)
    }
  }

  private async handleIncoming(msg: DiscordMessage): Promise<void> {
    if (msg.author.bot) return
    const content = msg.content?.trim()
    if (!content) return

    if (content.startsWith('/pair ')) {
      const code = content.slice(6).trim()
      if (!this.state.pairingCode) {
        await msg.reply('No hay código activo.')
        return
      }
      if (code !== this.state.pairingCode) {
        await msg.reply('Código inválido.')
        return
      }
      this.state.paired = true
      this.state.pairedUserId = msg.author.id
      this.state.pairedChannelId = msg.channelId
      this.state.pairingCode = null
      await this.saveState()
      await msg.reply('✅ Vinculado!')
      return
    }

    if (
      !this.state.paired ||
      msg.author.id !== this.state.pairedUserId ||
      msg.channelId !== this.state.pairedChannelId
    )
      return

    // TODO: send commands to Rust server via stdout
    this.emitIncoming(msg.author.id, content)
    await msg.reply('✅ Tarea enviada!')
  }

  private settingsPath(): string {
    return join(getDataDir(), 'channels', 'discord.json')
  }

  private async loadState(): Promise<DiscordState> {
    try {
      const raw = await readFile(this.settingsPath(), 'utf8')
      return { ...DEFAULT_STATE, ...JSON.parse(raw) }
    } catch {
      return { ...DEFAULT_STATE }
    }
  }

  private async saveState(): Promise<void> {
    const file = this.settingsPath()
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, JSON.stringify(this.state, null, 2), 'utf8')
  }
}
