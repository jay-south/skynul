import type { Page, Frame } from 'playwright-core'

type PageWithSnapshot = Page & {
  _snapshotForAI?: (opts?: { timeout?: number; track?: string }) => Promise<{ full?: string }>
}

export type PageInfo = {
  url: string
  title: string
  text: string
  elements: Array<{
    tag: string
    selector: string
    text?: string
    type?: string
    interactive?: boolean
  }>
}

export class PlaywrightBridge {
  constructor(private page: Page) {}

  get rawPage(): Page {
    return this.page
  }

  /**
   * Resolve a locator — supports aria-ref IDs (e.g. "e5") and CSS selectors.
   * aria-ref works across iframes automatically.
   */
  private resolveLocator(selector: string, frameId?: string) {
    // aria-ref pattern from snapshot (e.g. "e5", "f1e1", "f2e12")
    if (/^(f\d+)?e\d+$/.test(selector)) {
      return this.page.locator(`aria-ref=${selector}`)
    }
    if (frameId) {
      const frame = this.resolveFrame(frameId)
      return frame.locator(selector).first()
    }
    return this.page.locator(selector).first()
  }

  private resolveFrame(frameId?: string): Frame {
    if (!frameId) return this.page.mainFrame()
    const frames = this.page.frames()
    const idx = Number(frameId)
    if (!Number.isNaN(idx) && idx >= 0 && idx < frames.length) return frames[idx]
    const match = frames.find(
      (f) => f.name() === frameId || f.url().includes(frameId)
    )
    return match ?? this.page.mainFrame()
  }

  async navigate(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' })
  }

  async click(selector: string, frameId?: string): Promise<void> {
    const loc = this.resolveLocator(selector, frameId)
    try {
      await loc.click({ timeout: 8_000 })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (
        msg.includes('outside of the viewport') ||
        msg.includes('not visible') ||
        msg.includes('intercepts pointer events')
      ) {
        await loc.scrollIntoViewIfNeeded({ timeout: 3_000 }).catch(() => {})
        await loc.click({ timeout: 5_000, force: true })
      } else {
        throw e
      }
    }
  }

  async type(selector: string, text: string, frameId?: string): Promise<void> {
    const loc = this.resolveLocator(selector, frameId)
    try {
      await loc.fill(text, { timeout: 8_000 })
    } catch {
      // Fallback for contenteditable / non-input elements
      try {
        await loc.click({ timeout: 5_000 })
      } catch (clickErr) {
        const msg = clickErr instanceof Error ? clickErr.message : ''
        if (
          msg.includes('outside of the viewport') ||
          msg.includes('not visible') ||
          msg.includes('intercepts pointer events')
        ) {
          await loc.scrollIntoViewIfNeeded({ timeout: 3_000 }).catch(() => {})
          await loc.click({ timeout: 5_000, force: true })
        } else {
          throw clickErr
        }
      }
      await this.page.keyboard.type(text, { delay: 5 })
    }
  }

  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key)
  }

  async evaluate(script: string, frameId?: string): Promise<string> {
    const frame = this.resolveFrame(frameId)
    const val = await frame.evaluate((expr) => {
      // eslint-disable-next-line no-eval
      return (0, eval)(expr)
    }, script)
    return typeof val === 'string' ? val : JSON.stringify(val)
  }

  async screenshot(): Promise<string> {
    const buf = await this.page.screenshot({ type: 'png', fullPage: false })
    return buf.toString('base64')
  }

  async uploadFile(selector: string, filePaths: string[], frameId?: string): Promise<void> {
    const loc = this.resolveLocator(selector, frameId)
    await loc.setInputFiles(filePaths)
  }

  /**
   * AI-optimized page snapshot using Playwright's _snapshotForAI.
   * Returns aria-ref IDs (e.g. e1, e5) that work across iframes.
   * Fallback to ariaSnapshot if _snapshotForAI is unavailable.
   */
  async snapshot(): Promise<{ url: string; title: string; snapshot: string }> {
    const url = this.page.url()
    const title = await this.page.title().catch(() => '')

    // Primary: _snapshotForAI — includes iframes, assigns aria-ref IDs
    const maybePage = this.page as PageWithSnapshot
    if (maybePage._snapshotForAI) {
      try {
        const result = await maybePage._snapshotForAI({ timeout: 10_000, track: 'response' })
        const snap = String(result?.full ?? '')
        if (snap.length > 20) {
          return { url, title, snapshot: snap.slice(0, 16_000) }
        }
      } catch {
        // fallback below
      }
    }

    // Fallback: ariaSnapshot (no aria-ref IDs, no iframe content)
    try {
      const snap = await this.page.locator('body').ariaSnapshot({ timeout: 10_000 })
      if (snap && snap.length > 20) {
        return { url, title, snapshot: snap.slice(0, 14_000) }
      }
    } catch {
      // fallback below
    }

    // Last resort: DOM text snapshot
    const text = await this.page
      .evaluate(() => {
        const lines: string[] = []
        const walk = (el: Element, depth: number): void => {
          const tag = el.tagName?.toLowerCase() || ''
          const role = el.getAttribute('role') || ''
          const label =
            el.getAttribute('aria-label') ||
            el.getAttribute('data-testid') ||
            el.getAttribute('placeholder') ||
            ''
          const innerText = (el as HTMLElement).innerText?.trim()?.slice(0, 80) || ''
          const isInteractive =
            /^(button|a|input|textarea|select)$/.test(tag) ||
            role === 'button' ||
            role === 'link' ||
            role === 'textbox' ||
            el.getAttribute('contenteditable') === 'true'
          if (isInteractive || (innerText && depth < 4)) {
            const indent = '  '.repeat(depth)
            const desc = [tag, role && `role=${role}`, label && `"${label}"`]
              .filter(Boolean)
              .join(' ')
            const textPart = innerText && !label.includes(innerText) ? `: ${innerText}` : ''
            lines.push(`${indent}${desc}${textPart}`)
          }
          if (lines.length < 200) {
            for (const child of el.children) walk(child, depth + 1)
          }
        }
        if (document.body) walk(document.body, 0)
        return lines.join('\n')
      })
      .catch(() => '')

    return { url, title, snapshot: text.slice(0, 12_000) }
  }

  async getPageInfo(): Promise<PageInfo> {
    const url = this.page.url()
    const title = await this.page.title().catch(() => '')
    const text =
      (await this.page
        .evaluate(() => document.body?.innerText?.slice(0, 4000) ?? '')
        .catch(() => '')) || ''
    const elements =
      (await this.page
        .evaluate(() => {
          const els: Array<{
            tag: string
            selector: string
            text?: string
            type?: string
            interactive?: boolean
          }> = []
          const push = (el: Element): void => {
            const tag = (el as HTMLElement).tagName?.toLowerCase() || 'el'
            const t = (el as HTMLElement).innerText?.trim()?.slice(0, 60)
            let selector = tag
            const dt = (el as HTMLElement).getAttribute?.('data-testid')
            if (dt) selector = `[data-testid="${dt}"]`
            else if ((el as HTMLElement).id) selector = `#${(el as HTMLElement).id}`
            else if ((el as HTMLElement).getAttribute?.('aria-label'))
              selector = `${tag}[aria-label="${(el as HTMLElement).getAttribute('aria-label')}"]`
            els.push({ tag, selector, text: t || undefined, interactive: true })
          }
          document
            .querySelectorAll(
              'button, a, input, textarea, [role="button"], [contenteditable="true"]'
            )
            .forEach((el) => {
              if (els.length >= 30) return
              push(el)
            })
          return els
        })
        .catch(() => [])) || []
    return { url, title, text, elements }
  }
}
