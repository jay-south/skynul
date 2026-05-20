import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ChannelId, ChannelSettings } from '@skynul/shared'
import { Channel } from './channel'

type SignalState = {
  enabled: boolean
  paired: boolean
  phoneNumber: string | null
  apiUrl: string | null
  registeredNumber: string | null
}

const DEFAULT_STATE: SignalState = {
  enabled: false,
  paired: false,
  phoneNumber: null,
  apiUrl: null,
  registeredNumber: null
}

type SignalEnvelope = {
  envelope?: {
    dataMessage?: { message?: string; timestamp?: number }
    sourceNumber?: string
    sourceName?: string
  }
}

const POLL_INTERVAL = 3000

function getDataDir(): string {
  return process.env.SKYNUL_DATA_DIR ?? join(require('node:os').homedir(), '.skynul')
}

export class SignalChannel extends Channel {
  readonly id: ChannelId = 'signal'
  private state: SignalState = { ...DEFAULT_STATE }
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private lastError: string | null = null
  private isConnected = false

  async start(): Promise<void> {
    this.state = await this.loadState()
    if (!this.state.enabled) return

    if (!this.state.apiUrl || !this.state.registeredNumber) return

    try {
      const res = await fetch(`${this.state.apiUrl}/v1/about`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      this.isConnected = true
      this.lastError = null
    } catch (e) {
      this.lastError = `Cannot reach signal-cli API: ${e instanceof Error ? e.message : String(e)}`
      return
    }

    this.startPolling()
  }

  async stop(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    this.isConnected = false
  }

  getSettings(): ChannelSettings {
    return {
      id: 'signal',
      enabled: this.state.enabled,
      status: this.isConnected ? 'connected' : this.state.enabled ? 'connecting' : 'disconnected',
      paired: this.state.paired,
      pairingCode: null,
      error: this.lastError,
      hasCredentials: false,
      meta: {
        phoneNumber: this.state.phoneNumber,
        apiUrl: this.state.apiUrl,
        registeredNumber: this.state.registeredNumber
      }
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
    if (creds.apiUrl) this.state.apiUrl = creds.apiUrl.trim()
    if (creds.registeredNumber) this.state.registeredNumber = creds.registeredNumber.trim()
    await this.saveState()
  }

  async generatePairingCode(): Promise<string> {
    if (!this.state.apiUrl || !this.state.registeredNumber) return 'Configure API URL first'
    try {
      const res = await fetch(`${this.state.apiUrl}/v1/qrcodelink?device_name=Skynul`)
      if (!res.ok) return 'Failed to generate link'
      return 'Device link initiated'
    } catch {
      return 'Cannot reach signal-cli API'
    }
  }

  async unpair(): Promise<void> {
    this.state.paired = false
    this.state.phoneNumber = null
    await this.saveState()
  }

  protected async sendMessage(text: string): Promise<void> {
    if (!this.state.apiUrl || !this.state.registeredNumber || !this.state.phoneNumber) return
    try {
      await fetch(`${this.state.apiUrl}/v2/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          number: this.state.registeredNumber,
          recipients: [this.state.phoneNumber]
        })
      })
    } catch {
      /* skip */
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return
    this.pollTimer = setInterval(() => void this.poll(), POLL_INTERVAL)
  }

  private async poll(): Promise<void> {
    if (!this.state.apiUrl || !this.state.registeredNumber) return
    try {
      const res = await fetch(
        `${this.state.apiUrl}/v1/receive/${encodeURIComponent(this.state.registeredNumber)}`
      )
      if (!res.ok) return
      const envelopes = (await res.json()) as SignalEnvelope[]
      for (const env of envelopes) {
        const msg = env.envelope?.dataMessage?.message?.trim()
        const sender = env.envelope?.sourceNumber
        if (!msg || !sender) continue
        await this.handleIncoming(sender, msg)
      }
    } catch {
      /* retry */
    }
  }

  private async handleIncoming(sender: string, body: string): Promise<void> {
    if (!this.state.paired || !this.state.phoneNumber) {
      this.state.paired = true
      this.state.phoneNumber = sender
      await this.saveState()
      await this.sendMessage('✅ Vinculado!')
      return
    }

    if (sender !== this.state.phoneNumber) return

    // TODO: send commands to Rust server via stdout
    this.emitIncoming(sender, body)
    await this.sendMessage('✅ Tarea enviada!')
  }

  private settingsPath(): string {
    return join(getDataDir(), 'channels', 'signal.json')
  }

  private async loadState(): Promise<SignalState> {
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
