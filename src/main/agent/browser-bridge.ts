/**
 * BrowserBridge — relay-only CDP connection via Chrome Extension.
 * No playwright-core dependency.
 */

import type { CdpRelay } from './cdp-relay'

export type PageElement = {
  tag: string
  type?: string
  selector: string
  text?: string
  interactive?: boolean
}

export type PageInfo = {
  url: string
  title: string
  text: string
  elements: PageElement[]
}

export class BrowserBridge {
  private relay: CdpRelay

  constructor(relay: CdpRelay) {
    this.relay = relay
  }

  get isConnected(): boolean {
    return this.relay.isExtensionConnected
  }

  /** Create a new tab for the task; never use or close the user's current tab. Call once at task start. */
  async ensureTaskTab(): Promise<void> {
    await this.relay.sendCommand('taskStart')
  }

  async getPageInfo(): Promise<PageInfo> {
    if (!this.relay.isExtensionConnected) {
      throw new Error('Chrome extension not connected')
    }
    try {
      const result = (await this.relay.sendCommand('getPageInfo')) as {
        url?: string
        title?: string
        text?: string
        elements?: PageElement[]
      }
      const elements = result.elements ?? []
      return {
        url: result.url ?? '',
        title: result.title ?? '',
        text: result.text ?? '',
        elements: Array.isArray(elements) ? elements.slice(0, 50) : []
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // Chrome blocks CDP access on chrome:// and other privileged URLs.
      // Instead of failing the whole task, surface a stub page so the agent
      // can immediately navigate to a normal https:// page.
      if (/chrome:\/\//i.test(msg) || /Cannot access a chrome:\/\//i.test(msg)) {
        return {
          url: 'chrome://restricted',
          title: 'Restricted browser page',
          text: '',
          elements: []
        }
      }
      throw e
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
    return typeof result === 'string' ? result : JSON.stringify(result)
  }

  destroy(): void {
    // Relay is shared, don't close it here
  }
}
