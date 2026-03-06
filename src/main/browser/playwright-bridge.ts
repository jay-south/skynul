import type { Page } from 'playwright-core'

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

  async navigate(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' })
  }

  async click(selector: string, _frameId?: string): Promise<void> {
    await this.page.locator(selector).first().click({ timeout: 30_000 })
  }

  async type(selector: string, text: string, _frameId?: string): Promise<void> {
    const loc = this.page.locator(selector).first()
    await loc.click({ timeout: 30_000 })
    try {
      await this.page.keyboard.press('Control+A')
    } catch {
      // ignore
    }
    try {
      await this.page.keyboard.press('Backspace')
    } catch {
      // ignore
    }
    await this.page.keyboard.type(text, { delay: 5 })
  }

  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key)
  }

  async evaluate(script: string, _frameId?: string): Promise<string> {
    const val = await this.page.evaluate((expr) => {
      // eslint-disable-next-line no-eval
      return (0, eval)(expr)
    }, script)
    return typeof val === 'string' ? val : JSON.stringify(val)
  }

  async screenshot(): Promise<string> {
    const buf = await this.page.screenshot({ type: 'png', fullPage: false })
    return buf.toString('base64')
  }

  async uploadFile(selector: string, filePaths: string[], _frameId?: string): Promise<void> {
    await this.page.setInputFiles(selector, filePaths)
  }

  /**
   * AI-optimized page snapshot — returns a compact text representation of the page
   * with interactive element references the model can use for click/type actions.
   * Uses Playwright's accessibility snapshot as a lightweight alternative to screenshots.
   */
  async snapshot(): Promise<{ url: string; title: string; snapshot: string }> {
    const url = this.page.url()
    const title = await this.page.title().catch(() => '')

    // Try Playwright's built-in ariaSnapshot (compact, LLM-friendly).
    try {
      const snap = await this.page.locator('body').ariaSnapshot({ timeout: 10_000 })
      if (snap && snap.length > 20) {
        return { url, title, snapshot: snap.slice(0, 12_000) }
      }
    } catch {
      // fallback below
    }

    // Fallback: build a text snapshot from the DOM.
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
