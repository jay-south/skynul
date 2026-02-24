/**
 * BrowserBridge — relay-only CDP connection via Chrome Extension.
 * No playwright-core dependency.
 */

import type { CdpRelay } from './cdp-relay'

export type PageInfo = {
  url: string
  title: string
  text: string
}

export class BrowserBridge {
  private relay: CdpRelay

  constructor(relay: CdpRelay) {
    this.relay = relay
  }

  get isConnected(): boolean {
    return this.relay.isExtensionConnected
  }

  async getPageInfo(): Promise<PageInfo> {
    if (!this.relay.isExtensionConnected) {
      throw new Error('Chrome extension not connected')
    }
    const result = (await this.relay.sendCommand('getPageInfo')) as {
      url?: string
      title?: string
      text?: string
    }
    return {
      url: result.url ?? '',
      title: result.title ?? '',
      text: result.text ?? ''
    }
  }

  async click(selector: string): Promise<void> {
    await this.relay.sendCommand('click', { selector })
  }

  async type(selector: string, text: string): Promise<void> {
    await this.relay.sendCommand('type', { selector, text })
  }

  async navigate(url: string): Promise<void> {
    await this.relay.sendCommand('navigate', { url })
    await new Promise((r) => setTimeout(r, 2500))
  }

  async pressKey(key: string): Promise<void> {
    await this.relay.sendCommand('pressKey', { key })
  }

  async evaluate(script: string): Promise<string> {
    const result = await this.relay.sendCommand('evaluate', { js: script })
    return JSON.stringify(result)
  }

  destroy(): void {
    // Relay is shared, don't close it here
  }
}
