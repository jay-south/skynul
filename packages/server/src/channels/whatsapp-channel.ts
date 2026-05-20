import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ChannelId, ChannelSettings } from '@skynul/shared'
import WAWebJS from 'whatsapp-web.js'
import { Channel } from './channel'

const { Client, LocalAuth } = WAWebJS

type WhatsAppState = {
  enabled: boolean
  paired: boolean
  pairedChatId: string | null
  phoneNumber: string | null
}

const DEFAULT_STATE: WhatsAppState = {
  enabled: false,
  paired: false,
  pairedChatId: null,
  phoneNumber: null
}

function getDataDir(): string {
  return process.env.SKYNUL_DATA_DIR ?? join(require('node:os').homedir(), '.skynul')
}

export class WhatsAppChannel extends Channel {
  readonly id: ChannelId = 'whatsapp'
  private state: WhatsAppState = { ...DEFAULT_STATE }
  private client: InstanceType<typeof Client> | null = null
  private qrCode: string | null = null
  private lastError: string | null = null

  async start(): Promise<void> {
    this.state = await this.loadState()
    if (!this.state.enabled) return

    const sessionPath = join(getDataDir(), 'channels', 'whatsapp-session')
    await mkdir(sessionPath, { recursive: true })

    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: sessionPath }),
      puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
    })

    this.client.on('qr', (qr: string) => {
      this.qrCode = qr
    })

    this.client.on('ready', () => {
      this.qrCode = null
      this.lastError = null
      if (!this.state.paired) {
        this.state.paired = true
        void this.saveState()
      }
    })

    this.client.on('auth_failure', (msg: string) => {
      this.lastError = msg
    })

    this.client.on('disconnected', (reason: string) => {
      this.state.paired = false
      this.lastError = reason
      void this.saveState()
    })

    this.client.on('message', (msg: WAWebJS.Message) => {
      void this.handleIncoming(msg)
    })

    try {
      await this.client.initialize()
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
    this.qrCode = null
  }

  getSettings(): ChannelSettings {
    const isReady = this.client?.info !== undefined
    return {
      id: 'whatsapp',
      enabled: this.state.enabled,
      status: isReady ? 'connected' : this.state.enabled ? 'connecting' : 'disconnected',
      paired: this.state.paired,
      pairingCode: this.qrCode,
      error: this.lastError,
      hasCredentials: false,
      meta: { pairedChatId: this.state.pairedChatId, phoneNumber: this.state.phoneNumber }
    }
  }

  async setEnabled(enabled: boolean): Promise<ChannelSettings> {
    this.state.enabled = enabled
    await this.saveState()
    if (enabled) await this.start()
    else await this.stop()
    return this.getSettings()
  }

  async setCredentials(_creds: Record<string, string>): Promise<void> {}

  async generatePairingCode(): Promise<string> {
    return this.qrCode ?? 'waiting-for-qr'
  }

  async unpair(): Promise<void> {
    if (this.client) {
      try {
        await this.client.logout()
      } catch {
        /* ignore */
      }
    }
    this.state.paired = false
    this.state.pairedChatId = null
    this.state.phoneNumber = null
    this.qrCode = null
    await this.saveState()
  }

  protected async sendMessage(text: string): Promise<void> {
    if (!this.client || !this.state.pairedChatId) return
    await this.client.sendMessage(this.state.pairedChatId, text)
  }

  private async handleIncoming(msg: WAWebJS.Message): Promise<void> {
    if (msg.fromMe) return
    const chatId = msg.from
    const body = msg.body?.trim()
    if (!body) return

    if (!this.state.pairedChatId) {
      this.state.pairedChatId = chatId
      this.state.paired = true
      await this.saveState()
      await this.client?.sendMessage(
        chatId,
        '✅ Vinculado! Mandame un mensaje para crear una tarea.'
      )
      return
    }

    if (chatId !== this.state.pairedChatId) return

    // TODO: send commands to Rust server via stdout
    this.emitIncoming(chatId, body)
    await this.client?.sendMessage(chatId, '✅ Tarea enviada!')
  }

  private settingsPath(): string {
    return join(getDataDir(), 'channels', 'whatsapp.json')
  }

  private async loadState(): Promise<WhatsAppState> {
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
