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
  private tabId: number | null = null

  constructor(relay: CdpRelay) {
    this.relay = relay
  }

  get isConnected(): boolean {
    return this.relay.isExtensionConnected
  }

  /** Create a new tab for the task; never use or close the user's current tab. Call once at task start. */
  async ensureTaskTab(): Promise<void> {
    const res = (await this.relay.sendCommand('taskStart')) as { tabId: number }
    this.tabId = res.tabId
  }

  /** Reuse an existing task tab (e.g. shared root tab for sub-agents). */
  useExistingTab(tabId: number): void {
    this.tabId = tabId
  }

  get activeTabId(): number | null {
    return this.tabId
  }

  /** Send a command scoped to this bridge's tab. */
  private cmd(action: string, params?: Record<string, unknown>): Promise<unknown> {
    return this.relay.sendCommand(action, { ...params, tabId: this.tabId })
  }

  async getPageInfo(frameId?: string): Promise<PageInfo> {
    if (!this.relay.isExtensionConnected) {
      throw new Error('Chrome extension not connected')
    }
    try {
      const result = (await this.cmd('getPageInfo', { frameId })) as {
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

  async click(selector: string, frameId?: string): Promise<void> {
    await this.cmd('click', { selector, frameId })
  }

  async type(selector: string, text: string, frameId?: string): Promise<void> {
    await this.cmd('type', { selector, text, frameId })
  }

  async navigate(url: string): Promise<void> {
    await this.cmd('navigate', { url })
    await new Promise((r) => setTimeout(r, 2500))
  }

  async pressKey(key: string): Promise<void> {
    await this.cmd('pressKey', { key })
  }

  async evaluate(script: string, frameId?: string): Promise<string> {
    const result = await this.cmd('evaluate', { js: script, frameId })
    return typeof result === 'string' ? result : JSON.stringify(result)
  }

  async screenshot(): Promise<string> {
    const result = (await this.cmd('screenshot')) as { data?: string }
    return result?.data ?? ''
  }

  async uploadFile(selector: string, filePaths: string[], frameId?: string): Promise<void> {
    await this.cmd('uploadFile', { selector, filePaths, frameId })
  }

  async getFrames(): Promise<
    Array<{ id: string; url: string; name: string; parentId: string | null }>
  > {
    const result = await this.cmd('getFrames')
    return result as Array<{ id: string; url: string; name: string; parentId: string | null }>
  }

  async saveSnapshot(): Promise<Record<string, unknown>> {
    if (!this.relay.isExtensionConnected) {
      throw new Error('Chrome extension not connected')
    }
    return (await this.cmd('snapshotSave')) as Record<string, unknown>
  }

  async restoreSnapshot(snapshot: Record<string, unknown>): Promise<void> {
    if (!this.relay.isExtensionConnected) {
      throw new Error('Chrome extension not connected')
    }
    await this.cmd('snapshotRestore', { snapshot })
  }

  destroy(): void {
    // Relay is shared, don't close it here
  }
}
