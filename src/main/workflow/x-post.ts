import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import type { Task } from '../../shared/task'
import type { ProviderId } from '../../shared/policy'
import type { TaskManager } from '../agent/task-manager'
import type { BrowserEngine } from '../browser/engine/browser-engine'
import { getSecret } from '../secret-store'
type BrowserLike = {
  navigate: BrowserEngine['navigate']
  click: BrowserEngine['click']
  type: BrowserEngine['type']
  evaluate: BrowserEngine['evaluate']
  /** Optional: supported by some browser backends. */
  pressKey?: BrowserEngine['pressKey']
  screenshot: BrowserEngine['screenshot']
  uploadFile: BrowserEngine['uploadFile']
  getPageInfo: BrowserEngine['getPageInfo']
}

type CopyOut = { tweet_text: string }
type DesignOut = {
  headline: string
  subline: string
  alt_text: string
  theme?: string
  bg?: string
}

type PlannedOut = {
  tweetText: string
  design: DesignOut
  altText: string
}

function extractJsonObject(text: string): any {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) throw new Error('No JSON object found')
  const slice = text.slice(start, end + 1)
  return JSON.parse(slice)
}

function validateTwoLineTweet(s: string): string {
  const text = (s ?? '').trim()
  if (!text) throw new Error('tweet_text is empty')
  if (text.length > 280) throw new Error(`tweet_text too long (${text.length}/280)`)
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length !== 2)
    throw new Error(`tweet_text must be exactly 2 non-empty lines (got ${lines.length})`)
  return text
}

async function planCopyAndDesign(opts: {
  task: Task
  taskManager: TaskManager
  log: (msg: string) => void
}): Promise<PlannedOut> {
  const { task, taskManager: tm, log } = opts

  log('Planner: spawning Copy + Design')

  const copyPrompt =
    'You MUST respond using the Skynul agent JSON protocol (thought + action).\n' +
    'Return ONE JSON object only. action.type MUST be "done".\n' +
    'action.summary MUST be the minified JSON payload and nothing else (no prose, no markdown).\n' +
    'Payload schema: {"tweet_text": string}.\n' +
    'Constraints: English, EXACTLY 2 non-empty lines, bullish BTC meme vibe, no hashtags, <=280 chars.'

  const designPrompt =
    'You MUST respond using the Skynul agent JSON protocol (thought + action).\n' +
    'Return ONE JSON object only. action.type MUST be "done".\n' +
    'action.summary MUST be the minified JSON payload and nothing else (no prose, no markdown).\n' +
    'Payload schema: {"headline": string, "subline": string, "alt_text": string, "theme"?: string, "bg"?: string}.\n' +
    'Constraints: headline <= 40 chars, subline <= 80 chars. Bullish BTC meme, clean, high contrast.'

  const [copyRes, designRes] = await Promise.all([
    tm.spawnAndWait(copyPrompt, [], task.id, { agentRole: 'Copy' }),
    tm.spawnAndWait(designPrompt, [], task.id, { agentRole: 'Design' })
  ])

  if (copyRes.status !== 'completed') {
    throw new Error(`Copy sub-task failed (${copyRes.taskId}): ${copyRes.output}`)
  }
  if (designRes.status !== 'completed') {
    throw new Error(`Design sub-task failed (${designRes.taskId}): ${designRes.output}`)
  }

  let copy: CopyOut
  let design: DesignOut
  try {
    copy = extractJsonObject(copyRes.output) as CopyOut
  } catch (e) {
    throw new Error(`Copy output not JSON: ${e instanceof Error ? e.message : String(e)}`)
  }
  try {
    design = extractJsonObject(designRes.output) as DesignOut
  } catch (e) {
    throw new Error(`Design output not JSON: ${e instanceof Error ? e.message : String(e)}`)
  }

  const tweetText = validateTwoLineTweet(copy.tweet_text)
  const altText = (design.alt_text ?? '').trim() || 'Bullish Bitcoin meme image.'
  return { tweetText, design, altText }
}

export async function planXPost(opts: {
  task: Task
  taskManager: TaskManager
  log: (msg: string) => void
}): Promise<PlannedOut> {
  return planCopyAndDesign(opts)
}

function absDataUrl(html: string): string {
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
}

function buildMemeHtml(design: DesignOut, bgImageDataUrl?: string): string {
  const headline = (design.headline || 'BTC').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const subline = (design.subline || 'Up only.').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const bg = design.bg || 'linear-gradient(135deg, #0b1020 0%, #141a35 45%, #f7931a 110%)'
  const frameBg = bgImageDataUrl
    ? `linear-gradient(135deg, rgba(11,16,32,.55) 0%, rgba(20,26,53,.55) 55%, rgba(247,147,26,.40) 120%), url("${bgImageDataUrl}")`
    : bg
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Skynul Meme</title>
    <style>
      html, body { height: 100%; margin: 0; }
      body {
        display: grid;
        place-items: center;
        background: #05060a;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      }
      .frame {
        width: 1600px;
        height: 900px;
        background: ${frameBg};
        background-size: cover;
        background-position: center;
        border-radius: 42px;
        position: relative;
        overflow: hidden;
        box-shadow: 0 28px 80px rgba(0,0,0,.55);
      }
      .grain {
        position: absolute; inset: 0;
        background-image: radial-gradient(rgba(255,255,255,.06) 1px, transparent 1px);
        background-size: 3px 3px;
        opacity: 0.15;
        mix-blend-mode: overlay;
      }
      .vignette {
        position: absolute; inset: 0;
        background: radial-gradient(circle at 40% 30%, rgba(0,0,0,.10), rgba(0,0,0,.55) 70%);
        pointer-events: none;
      }
      .btc {
        position: absolute;
        right: -80px;
        top: -120px;
        width: 520px;
        height: 520px;
        border-radius: 50%;
        background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.35), rgba(255,255,255,0) 55%),
                    radial-gradient(circle at 70% 70%, rgba(0,0,0,.35), rgba(0,0,0,0) 60%),
                    #f7931a;
        filter: drop-shadow(0 40px 60px rgba(0,0,0,.4));
      }
      .btc::after {
        content: "BTC";
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        font-size: 320px;
        font-weight: 900;
        color: rgba(11,16,32,.92);
        text-shadow: 0 12px 0 rgba(255,255,255,.15);
      }
      .chart {
        position: absolute;
        left: 90px;
        bottom: 120px;
        width: 980px;
        height: 460px;
        border-radius: 28px;
        background: rgba(0,0,0,.22);
        border: 1px solid rgba(255,255,255,.18);
        backdrop-filter: blur(8px);
        overflow: hidden;
      }
      .chart svg { width: 100%; height: 100%; }
      .text {
        position: absolute;
        left: 90px;
        top: 90px;
        right: 90px;
        color: #fff;
      }
      .headline {
        font-size: 92px;
        font-weight: 900;
        letter-spacing: -0.02em;
        line-height: 1.05;
        text-shadow: 0 10px 30px rgba(0,0,0,.35);
      }
      .subline {
        margin-top: 22px;
        font-size: 34px;
        color: rgba(255,255,255,.86);
        max-width: 980px;
        line-height: 1.25;
      }
      .tag {
        position: absolute;
        left: 90px;
        bottom: 70px;
        padding: 10px 16px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.22);
        background: rgba(0,0,0,.25);
        color: rgba(255,255,255,.82);
        font-weight: 600;
        font-size: 18px;
        letter-spacing: 0.02em;
      }
    </style>
  </head>
  <body>
    <div class="frame">
      <div class="grain"></div>
      <div class="vignette"></div>
      <div class="btc"></div>
      <div class="text">
        <div class="headline">${headline}</div>
        <div class="subline">${subline}</div>
      </div>
      <div class="chart">
        <svg viewBox="0 0 980 460" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M60 390 C 160 330, 240 360, 320 290 C 420 200, 520 250, 620 160 C 720 70, 780 120, 920 40" stroke="rgba(76, 255, 160, 0.95)" stroke-width="14" stroke-linecap="round"/>
          <path d="M920 40 L880 52" stroke="rgba(76, 255, 160, 0.95)" stroke-width="14" stroke-linecap="round"/>
          <path d="M920 40 L900 78" stroke="rgba(76, 255, 160, 0.95)" stroke-width="14" stroke-linecap="round"/>
          <path d="M60 410 H920" stroke="rgba(255,255,255,.14)" stroke-width="2"/>
          <path d="M60 60 V410" stroke="rgba(255,255,255,.14)" stroke-width="2"/>
        </svg>
      </div>
      <div class="tag">BULL MODE • BTC</div>
    </div>
  </body>
</html>`
}

async function openaiGenerateImageBase64(opts: {
  prompt: string
  size: '1024x1024' | '1024x1536' | '1536x1024' | 'auto'
  quality?: 'low' | 'medium' | 'high' | 'auto'
}): Promise<{ b64: string; revisedPrompt?: string }> {
  const apiKey = await getSecret('openai.apiKey')
  if (!apiKey) throw new Error('OpenAI API key not set (openai.apiKey)')

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: opts.prompt,
      size: opts.size,
      quality: opts.quality ?? 'auto'
    })
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`OpenAI images error: ${res.status} ${res.statusText}${txt ? ` - ${txt}` : ''}`)
  }

  const json = (await res.json()) as {
    data?: Array<{ b64_json?: string; revised_prompt?: string }>
  }
  const first = json.data?.[0]
  const b64 = first?.b64_json
  if (!b64) throw new Error('OpenAI images returned empty b64_json')
  return { b64, revisedPrompt: first?.revised_prompt }
}

function looksLikeImageOrVideoPath(p: string): boolean {
  const lower = p.toLowerCase()
  return (
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.mp4') ||
    lower.endsWith('.mov') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.mkv')
  )
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}

async function tryClick(bridge: BrowserLike, selectors: string[]): Promise<string> {
  let lastErr: unknown = null
  for (const sel of selectors) {
    try {
      await bridge.click(sel)
      return sel
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('click failed')
}

async function setComposerText(bridge: BrowserLike, text: string): Promise<void> {
  // Prefer CDP typing over DOM text injection; X uses a contenteditable that can ignore innerText.
  const sels = [
    '[data-testid="tweetTextarea_0"]',
    'div[data-testid="tweetTextarea_0"]',
    'div[role="textbox"]'
  ]
  let lastErr: unknown = null
  for (const sel of sels) {
    try {
      await bridge.type(sel, text)
      return
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('composer textbox not found')
}

async function waitForXComposerReady(opts: {
  bridge: BrowserLike
  log: (m: string) => void
  timeoutMs?: number
}): Promise<void> {
  const { bridge, log } = opts
  const timeoutMs = Math.min(Math.max(opts.timeoutMs ?? 180_000, 15_000), 600_000)

  const textboxSelectors = [
    '[data-testid="tweetTextarea_0"]',
    'div[data-testid="tweetTextarea_0"]',
    'div[role="textbox"]'
  ]

  const started = Date.now()
  let notedLogin = false
  while (Date.now() - started < timeoutMs) {
    let url = ''
    let title = ''
    try {
      const info = await bridge.getPageInfo()
      url = info.url || ''
      title = info.title || ''
    } catch {
      // ignore
    }

    const isLogin =
      url.includes('/i/flow/login') ||
      /log\s*in\s*to\s*x/i.test(title) ||
      /iniciar\s+ses/i.test(title)
    if (isLogin && !notedLogin) {
      notedLogin = true
      log(
        'XAuth: redirected to login. Waiting for you to finish login in the opened Chrome window...'
      )
    }

    try {
      const found = await bridge.evaluate(
        `(() => {\n` +
          `  const sels = ${JSON.stringify(textboxSelectors)};\n` +
          `  for (const s of sels) {\n` +
          `    const el = document.querySelector(s);\n` +
          `    if (el) return s;\n` +
          `  }\n` +
          `  return '';\n` +
          `})()`
      )
      if (typeof found === 'string' && found.trim().length > 0) return
    } catch {
      // ignore
    }

    await sleep(1000)
  }

  const info = await bridge.getPageInfo().catch(() => ({ url: '', title: '' }))
  if (info.url.includes('/i/flow/login') || /log\s*in\s*to\s*x/i.test(info.title)) {
    throw new Error(
      'X login not completed. Finish login in the opened Chrome window and retry the task.'
    )
  }
  throw new Error(`X composer not ready (url=${info.url} title=${info.title})`)
}

async function waitForXPostButtonEnabled(opts: {
  bridge: BrowserLike
  log: (m: string) => void
  timeoutMs?: number
}): Promise<void> {
  const { bridge, log } = opts
  const timeoutMs = Math.min(Math.max(opts.timeoutMs ?? 60_000, 10_000), 600_000)
  const started = Date.now()

  const selectors = [
    '[data-testid="tweetButtonInline"]',
    '[data-testid="tweetButton"]',
    'button[data-testid="tweetButtonInline"]',
    'button[data-testid="tweetButton"]'
  ]

  const tryHandleKeyboardShortcuts = async (): Promise<boolean> => {
    const info = await bridge.getPageInfo().catch(() => ({ url: '', title: '' }))
    const url = info.url || ''
    const title = info.title || ''
    if (!/\/i\/keyboard_shortcuts/i.test(url) && !/keyboard\s*shortcuts/i.test(title)) return false
    log('KeyboardShortcuts: unexpected route; attempting to go back')
    try {
      await bridge.evaluate('history.back()')
    } catch {
      // ignore
    }
    try {
      if (bridge.pressKey) await bridge.pressKey('Escape')
    } catch {
      // ignore
    }
    await sleep(1200)
    return true
  }

  const tryHandleFoundMediaGate = async (): Promise<boolean> => {
    const info = await bridge.getPageInfo().catch(() => ({ url: '', title: '' }))
    const url = info.url || ''
    if (!/\/i\/foundmedia\//i.test(url)) return false

    try {
      const clicked = await bridge.evaluate(
        `(() => {\n` +
          `  const candidates = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"], input[type="button"], input[type="submit"]'));\n` +
          `  const textOf = (el) => (el && (el.innerText || el.textContent || '')).toString().trim();\n` +
          `  const attr = (el, name) => (el && el.getAttribute ? (el.getAttribute(name) || '') : '');\n` +
          `  const labelOf = (el) => {\n` +
          `    const t = textOf(el);\n` +
          `    if (t) return t;\n` +
          `    return attr(el, 'aria-label') || attr(el, 'data-testid') || attr(el, 'value') || '';\n` +
          `  };\n` +
          `  const norm = (s) => (s || '').toLowerCase().replace(/\s+/g,' ').trim();\n` +
          `  const isBad = (n) => n.includes('keyboard') || n.includes('shortcuts');\n` +
          `  const score = (n, testid) => {\n` +
          `    if (!n && !testid) return 0;\n` +
          `    if (isBad(n) || isBad(testid)) return 0;\n` +
          `    const tid = norm(testid);\n` +
          `    if (tid.includes('confirm') || tid.includes('accept') || tid.includes('agree') || tid.includes('primary')) return 95;\n` +
          `    // English + Spanish labels\n` +
          `    if (n === 'i agree' || n === 'agree' || n === 'estoy de acuerdo' || n === 'de acuerdo') return 100;\n` +
          `    if (n.includes('agree') || n.includes('de acuerdo')) return 90;\n` +
          `    if (n === 'continue' || n.includes('continue') || n === 'continuar' || n.includes('continuar')) return 85;\n` +
          `    if (n === 'accept' || n.includes('accept') || n === 'aceptar' || n.includes('aceptar') || n === 'acepto' || n.includes('acepto')) return 80;\n` +
          `    if (n === 'allow' || n.includes('allow') || n === 'permitir' || n.includes('permitir')) return 75;\n` +
          `    if (n === 'ok' || n === 'entendido' || n.includes('entendido') || n.includes('got it')) return 70;\n` +
          `    return 0;\n` +
          `  };\n` +
          `  let best = null;\n` +
          `  let bestScore = 0;\n` +
          `  for (const el of candidates) {\n` +
          `    const lbl = labelOf(el);\n` +
          `    const testid = attr(el, 'data-testid');\n` +
          `    const n = norm(lbl);\n` +
          `    const sc = score(n, testid);\n` +
          `    if (sc > bestScore) { bestScore = sc; best = { el, lbl, testid }; }\n` +
          `  }\n` +
          `  if (best && bestScore >= 60) {\n` +
          `    try { (best.el).click(); return JSON.stringify({ ok: true, text: (best.lbl || '').slice(0, 80), testid: best.testid || '', score: bestScore }); } catch {}\n` +
          `  }\n` +
          `  // Return candidates for debugging\n` +
          `  const tops = candidates.slice(0, 12).map(el => ({\n` +
          `    tag: (el.tagName || '').toLowerCase(),\n` +
          `    text: labelOf(el).slice(0, 80),\n` +
          `    testid: attr(el, 'data-testid').slice(0, 60),\n` +
          `    aria: attr(el, 'aria-label').slice(0, 60)\n` +
          `  }));\n` +
          `  return JSON.stringify({ ok: false, score: bestScore, tops });\n` +
          `})()`
      )
      const o = JSON.parse(clicked || '{}') as any
      if (o.ok) {
        log(
          `FoundMediaGate: clicked "${o.text || 'agree'}"` +
            `${o.testid ? ` (testid=${o.testid})` : ''}` +
            ` (score=${o.score ?? '?'})`
        )
        await sleep(1500)
        return true
      }

      if (Array.isArray(o.tops) && o.tops.length > 0) {
        log(`FoundMediaGate: no match; candidates=${JSON.stringify(o.tops).slice(0, 900)}`)
      }
    } catch (e) {
      log(
        `FoundMediaGate: detected but could not auto-accept (${e instanceof Error ? e.message : String(e)})`
      )
    }

    // If we can't auto-accept, fail with a clear message so the user can click it.
    throw new Error(
      'X is showing a media consent gate (foundmedia). Click the Agree/Continue button in the opened Chrome window, then retry.'
    )
  }

  while (Date.now() - started < timeoutMs) {
    // X sometimes shows interruptions that must be dismissed before posting.
    await tryHandleKeyboardShortcuts().catch((e) => {
      throw e
    })
    await tryHandleFoundMediaGate().catch((e) => {
      throw e
    })

    try {
      const res = await bridge.evaluate(
        `(() => {\n` +
          `  const btnSels = ${JSON.stringify(selectors)};\n` +
          `  const pick = () => {\n` +
          `    for (const s of btnSels) {\n` +
          `      const el = document.querySelector(s);\n` +
          `      if (el) return el;\n` +
          `    }\n` +
          `    return null;\n` +
          `  };\n` +
          `  const b = pick();\n` +
          `  const ariaDisabled = b?.getAttribute?.('aria-disabled') || '';\n` +
          `  const disabled = !!(b && ('disabled' in b) && b.disabled);\n` +
          `  const enabled = !!b && !disabled && ariaDisabled !== 'true';\n` +
          `\n` +
          `  const tb = document.querySelector('[data-testid="tweetTextarea_0"], div[data-testid="tweetTextarea_0"], div[role="textbox"]');\n` +
          `  const tbText = (tb?.innerText || tb?.textContent || '').trim();\n` +
          `\n` +
          `  const attachments = document.querySelectorAll('[data-testid="attachments"], [data-testid="tweetPhoto"], [data-testid="tweetVideo"], img[alt="Image"], video').length;\n` +
          `  const progress = document.querySelectorAll('[role="progressbar"], [data-testid*="progress" i]').length;\n` +
          `\n` +
          `  const alerts = Array.from(document.querySelectorAll('[role="alert"]')).map(n => n?.innerText?.trim?.() || '').filter(Boolean).slice(0, 2);\n` +
          `  return JSON.stringify({ found: !!b, enabled, ariaDisabled, disabled, tbLen: tbText.length, attachments, progress, alerts });\n` +
          `})()`
      )

      const o = JSON.parse(res || '{}') as any
      if (o.enabled) return

      // If we have content but button is disabled, it's usually media processing. Wait.
      // If we have no content, try to focus the textbox again.
      if ((o.tbLen ?? 0) === 0 && (o.attachments ?? 0) === 0) {
        try {
          await bridge.click('div[role="textbox"]')
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }

    await sleep(600)
  }

  const info = await bridge.getPageInfo().catch(() => ({ url: '', title: '' }))
  let diag = ''
  try {
    diag = await bridge.evaluate(
      `(() => {\n` +
        `  const b = document.querySelector('[data-testid="tweetButtonInline"], [data-testid="tweetButton"]');\n` +
        `  const ariaDisabled = b?.getAttribute?.('aria-disabled') || '';\n` +
        `  const disabled = !!(b && ('disabled' in b) && b.disabled);\n` +
        `  const tb = document.querySelector('[data-testid="tweetTextarea_0"], div[data-testid="tweetTextarea_0"], div[role="textbox"]');\n` +
        `  const tbText = (tb?.innerText || tb?.textContent || '').trim();\n` +
        `  const alerts = Array.from(document.querySelectorAll('[role="alert"]')).map(n => n?.innerText?.trim?.() || '').filter(Boolean).slice(0, 4);\n` +
        `  const progress = document.querySelectorAll('[role="progressbar"], [data-testid*="progress" i]').length;\n` +
        `  return JSON.stringify({ ariaDisabled, disabled, tbPreview: tbText.slice(0, 120), progress, alerts });\n` +
        `})()`
    )
  } catch {
    // ignore
  }
  log(`PostButton: still disabled after ${timeoutMs}ms (diag=${diag || '(none)'})`)
  throw new Error(`X post button stayed disabled (url=${info.url} title=${info.title})`)
}

async function clickXPostButton(bridge: BrowserLike, log: (m: string) => void): Promise<void> {
  await waitForXPostButtonEnabled({ bridge, log, timeoutMs: 90_000 })
  await tryClick(bridge, [
    '[data-testid="tweetButtonInline"]',
    '[data-testid="tweetButton"]',
    'div[data-testid="tweetButtonInline"]',
    'button[data-testid="tweetButtonInline"]'
  ])
}

async function debugFileInputs(bridge: BrowserLike, log: (m: string) => void): Promise<void> {
  const script = `(() => {
    const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
    return inputs.map((i) => ({
      testid: i.getAttribute('data-testid') || '',
      accept: i.getAttribute('accept') || '',
      multiple: !!i.multiple,
      hidden: !!(i.hidden || (i.style && i.style.display === 'none')),
      aria: i.getAttribute('aria-label') || ''
    }));
  })()`
  try {
    const res = await bridge.evaluate(script)
    log(`File inputs: ${res}`)
  } catch {
    // ignore
  }
}

async function tryAttachGifFromX(opts: {
  bridge: BrowserLike
  log: (m: string) => void
  query: string
}): Promise<boolean> {
  const { bridge, log, query } = opts
  const budgetMs = 75_000
  const started = Date.now()
  const remaining = (): number => Math.max(0, budgetMs - (Date.now() - started))

  const waitForAnySelector = async (sels: string[], timeoutMs: number): Promise<string> => {
    const startedWait = Date.now()
    while (Date.now() - startedWait < timeoutMs) {
      try {
        const found = await bridge.evaluate(
          `(() => {\n` +
            `  const sels = ${JSON.stringify(sels)};\n` +
            `  for (const s of sels) {\n` +
            `    try { if (document.querySelector(s)) return s; } catch {}\n` +
            `  }\n` +
            `  return '';\n` +
            `})()`
        )
        if (typeof found === 'string' && found.trim()) return found.trim()
      } catch {
        // ignore
      }
      await sleep(400)
    }
    return ''
  }

  const tryDisableXPointerMasks = async (): Promise<boolean> => {
    try {
      const res = await bridge.evaluate(
        `(() => {\n` +
          `  const masks = Array.from(document.querySelectorAll('[data-testid="twc-cc-mask"]'));\n` +
          `  for (const m of masks) {\n` +
          `    try { m.style.pointerEvents = 'none'; m.style.display = 'none'; } catch {}\n` +
          `  }\n` +
          `  return JSON.stringify({ count: masks.length });\n` +
          `})()`
      )
      const o = JSON.parse(res || '{}') as any
      return (o.count ?? 0) > 0
    } catch {
      return false
    }
  }

  const domClickFirst = async (selectors: string[]): Promise<string> => {
    const res = await bridge.evaluate(
      `(() => {\n` +
        `  const sels = ${JSON.stringify(selectors)};\n` +
        `  for (const sel of sels) {\n` +
        `    let el = null;\n` +
        `    try { el = document.querySelector(sel); } catch { el = null; }\n` +
        `    if (!el) continue;\n` +
        `    try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch {}\n` +
        `    try { el.click(); return sel; } catch {}\n` +
        `  }\n` +
        `  return '';\n` +
        `})()`
    )
    return typeof res === 'string' ? res : ''
  }

  const tryCloseDialog = async (): Promise<void> => {
    try {
      if (bridge.pressKey) await bridge.pressKey('Escape')
    } catch {
      // ignore
    }
  }

  // If the picker is already open, don't click the button again.
  const existingDialog = await waitForAnySelector(['div[role="dialog"]', '[role="dialog"]'], 700)
  if (!existingDialog) {
    try {
      log('GIF: opening picker')
      // Use DOM click to bypass pointer-event masks.
      const clicked = await domClickFirst([
        'button[data-testid="gifSearchButton"]',
        'button[aria-label="GIF"]',
        'button[aria-label="Add a GIF"]',
        'div[aria-label="GIF"]'
      ])
      if (!clicked) throw new Error('gif button not found')
    } catch {
      return false
    }

    await sleep(900)
  }

  // Wait for the picker dialog / search input to appear. X can be slow here.
  const dialogSel = await waitForAnySelector(
    ['div[role="dialog"]', '[role="dialog"]'],
    Math.min(20_000, remaining())
  )
  if (!dialogSel) {
    log('GIF: picker dialog did not appear (timeout)')
    await tryCloseDialog()
    return false
  }

  // Search within the GIF picker using engine-native type (React-compatible).
  const searchCandidates = [
    'input[data-testid="gifSearchInput"]',
    'input[data-testid="SearchBox_Search_Input"]',
    'input[aria-label="Search query"]',
    'input[aria-label="Search GIFs"]',
    'input[placeholder*="Search"]'
  ]

  await tryDisableXPointerMasks()

  const searchSel = await waitForAnySelector(searchCandidates, Math.min(35_000, remaining()))
  if (searchSel) {
    try {
      log(`GIF: searching "${query}"`)
      await bridge.type(searchSel, query)
      if (bridge.pressKey) await bridge.pressKey('Enter')
      await sleep(1500)
    } catch (e) {
      log(`GIF: search failed (${e instanceof Error ? e.message : String(e)}); trying trending`)
    }
  } else {
    log('GIF: search input not found; trying trending results')
  }

  // Wait for GIF results to render.
  await sleep(600)
  const resultCandidates = [
    'div[data-testid="gifSearchResult"]',
    'div[role="dialog"] div[role="button"]'
  ]

  const resultSel = await waitForAnySelector(resultCandidates, Math.min(25_000, remaining()))
  if (!resultSel) {
    log('GIF: no results found/loaded (timeout)')
    await tryCloseDialog()
    return false
  }

  // Click the first GIF result using engine-native click.
  try {
    await bridge.click(resultSel)
    log(`GIF: clicked result via ${resultSel}`)
    await sleep(2000)

    // If X navigated to /i/foundmedia/ it's a consent/browse page — go back to composer.
    const info = await bridge.getPageInfo().catch(() => ({ url: '', title: '' }))
    if (/\/i\/foundmedia\//i.test(info.url || '')) {
      log('GIF: landed on foundmedia page; navigating back to composer')
      await bridge.navigate('https://x.com/compose/post')
      await sleep(2000)
    }

    // Verify dialog closed.
    const dialogStillOpen = await waitForAnySelector(['div[role="dialog"]'], 800)
    if (dialogStillOpen) {
      await tryCloseDialog()
      await sleep(500)
    }

    return true
  } catch (e) {
    log(`GIF: failed to click result (${e instanceof Error ? e.message : String(e)})`)
    await tryCloseDialog()
    return false
  }
}

async function getProfileUrl(bridge: BrowserLike): Promise<string> {
  const script = `(() => {
    const candidates = [
      'a[data-testid="AppTabBar_Profile_Link"]',
      'a[aria-label="Profile"]',
      'a[aria-label="Your profile"]'
    ];
    for (const sel of candidates) {
      const a = document.querySelector(sel);
      const href = a?.getAttribute('href') || '';
      if (!href) continue;
      return href.startsWith('http') ? href : ('https://x.com' + (href.startsWith('/') ? href : '/' + href));
    }
    const a = Array.from(document.querySelectorAll('a[href^="/"]')).find(x => {
      const lab = (x.getAttribute('aria-label') || '').toLowerCase();
      return lab.includes('profile');
    });
    const href = a?.getAttribute('href') || '';
    if (!href) return '';
    return 'https://x.com' + href;
  })()`
  const res = await bridge.evaluate(script)
  return typeof res === 'string' ? res : ''
}

async function findLatestStatusOnProfile(bridge: BrowserLike): Promise<string> {
  const script = `(() => {
    const a = document.querySelector('article a[href*="/status/"]');
    const u = a?.getAttribute('href') || '';
    if (!u) return '';
    return u.startsWith('http') ? u : ('https://x.com' + (u.startsWith('/') ? u : '/' + u));
  })()`
  const res = await bridge.evaluate(script)
  return typeof res === 'string' ? res : ''
}

async function findPostedUrl(bridge: BrowserLike): Promise<string> {
  const script = `(() => {
    const href = location.href || '';
    if (href.includes('/status/')) return { ok: true, url: href };
    const a = Array.from(document.querySelectorAll('a[href*="/status/"]')).find(x => {
      const t = (x.textContent || '').trim().toLowerCase();
      return t === 'view' || t === 'ver' || t === 'open' || t === 'abrir' || x.getAttribute('aria-label')?.toLowerCase() === 'view';
    }) || Array.from(document.querySelectorAll('a[href*="/status/"]'))[0];
    if (!a) return { ok: false };
    const u = a.getAttribute('href') || '';
    const abs = u.startsWith('http') ? u : ('https://x.com' + (u.startsWith('/') ? u : '/' + u));
    return { ok: true, url: abs };
  })()`
  const res = await bridge.evaluate(script)
  try {
    const obj = JSON.parse(res)
    return obj?.ok ? String(obj.url) : ''
  } catch {
    return ''
  }
}

function looksLikeXStatusUrl(url: string): boolean {
  return /^https?:\/\/(x\.com|twitter\.com)\/.+\/status\//i.test(url)
}

export async function runXPostWorkflow(opts: {
  task: Task
  taskManager: TaskManager
  browser: BrowserLike
  log: (msg: string) => void
  provider: ProviderId
  planned?: PlannedOut
}): Promise<{ post_url: string; tweet_text: string; image_file_path: string; alt_text: string }> {
  const { task, taskManager: tm, browser, log, provider } = opts

  const safeInfo = async (label: string): Promise<void> => {
    try {
      const info = await browser.getPageInfo()
      log(`${label}: url=${info.url || '(none)'} title=${info.title || '(none)'}`)
    } catch {
      // ignore
    }
  }

  try {
    const plan = opts.planned ?? (await planCopyAndDesign({ task, taskManager: tm, log }))
    const tweetText = plan.tweetText
    const altText = plan.altText
    const design = plan.design

    const attached = (task.attachments ?? []).filter((p) => typeof p === 'string')
    const explicitMedia = attached.find((p) => looksLikeImageOrVideoPath(p))
    if (explicitMedia) {
      log(`GenerateImageExternal: using user-provided attachment: ${explicitMedia}`)

      const imagePath = explicitMedia

      log('PostToX: opening composer, attaching image, posting')
      await browser.navigate('https://x.com/compose/post')
      await sleep(2500)
      await safeInfo('Compose')

      await waitForXComposerReady({ bridge: browser, log, timeoutMs: 180_000 })

      await setComposerText(browser, tweetText)
      await sleep(300)

      await debugFileInputs(browser, log)

      // In some X builds the file input is mounted lazily after interacting with the media button.
      try {
        await tryClick(browser, [
          'button[aria-label="Add photos or video"]',
          'div[aria-label="Add photos or video"]',
          'button[aria-label="Media"]',
          'button[data-testid="mediaButton"]'
        ])
        await sleep(600)
        await debugFileInputs(browser, log)
      } catch {
        // ok
      }

      // Upload media via file input.
      const fileSelCandidates = ['input[data-testid="fileInput"]', 'input[type="file"]']
      let uploaded = false
      let lastUpErr: unknown = null
      for (let attempt = 0; attempt < 5 && !uploaded; attempt++) {
        for (const sel of fileSelCandidates) {
          try {
            await browser.uploadFile(sel, [imagePath])
            uploaded = true
            break
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            if (/Unknown action:\s*uploadFile/i.test(msg)) {
              throw new Error(
                'Browser backend does not support file uploads. Ensure browser automation is enabled and retry.'
              )
            }
            lastUpErr = e
          }
        }
        if (!uploaded) await sleep(600)
      }
      if (!uploaded) {
        await safeInfo('Upload failed')
        throw new Error(
          `Could not upload image: ${lastUpErr instanceof Error ? lastUpErr.message : String(lastUpErr)}`
        )
      }

      await sleep(2200)

      await clickXPostButton(browser, log)

      // Wait and try to extract the new post URL.
      let postUrl = ''
      for (let i = 0; i < 10; i++) {
        await sleep(1200)
        postUrl = await findPostedUrl(browser)
        if (postUrl && looksLikeXStatusUrl(postUrl)) break
      }

      // Fallback: go to profile and take the latest status URL.
      if (!postUrl || !looksLikeXStatusUrl(postUrl)) {
        await safeInfo('Post URL not found; trying profile fallback')
        const profileUrl = await getProfileUrl(browser)
        if (profileUrl) {
          await browser.navigate(profileUrl)
          await sleep(2500)
          const latest = await findLatestStatusOnProfile(browser)
          if (latest && looksLikeXStatusUrl(latest)) postUrl = latest
        }
      }

      if (!postUrl || !looksLikeXStatusUrl(postUrl)) {
        await safeInfo('Post URL still not found')
        throw new Error('Posted, but could not reliably extract post URL')
      }

      return {
        post_url: postUrl,
        tweet_text: tweetText,
        image_file_path: imagePath,
        alt_text: altText
      }
    }

    const wantsGif = /\bgif\b|giphy/i.test(task.prompt)
    if (wantsGif) {
      log('PostToX: opening composer and attaching a GIF')
      await browser.navigate('https://x.com/compose/post')
      await sleep(2500)
      await safeInfo('Compose')

      await waitForXComposerReady({ bridge: browser, log, timeoutMs: 180_000 })

      await setComposerText(browser, tweetText)
      await sleep(500)

      const themeRaw = (design.theme ?? '').trim()
      const queries = Array.from(
        new Set(
          [
            themeRaw && !/^(bull|bullish)$/i.test(themeRaw) ? `${themeRaw} bitcoin meme` : '',
            'bitcoin to the moon',
            'btc pump',
            'bull market',
            'bitcoin bull',
            'rocket launch'
          ].filter(Boolean)
        )
      )

      let ok = false
      let forceImageFallback = false
      for (const q of queries) {
        try {
          ok = await tryAttachGifFromX({ bridge: browser, log, query: q })
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          if (msg.includes('SKYNUL_XPOST_FALLBACK_IMAGE')) {
            forceImageFallback = true
            ok = false
            break
          }
          throw e
        }
        if (ok) break
      }
      if (!ok) {
        if (forceImageFallback) {
          log('GIF: blocked by consent gate; falling back to generated image upload')
        } else {
          log('GIF: could not attach via UI; falling back to generated image upload')
        }
      } else {
        await sleep(1200)

        await clickXPostButton(browser, log)

        let postUrl = ''
        for (let i = 0; i < 10; i++) {
          await sleep(1200)
          postUrl = await findPostedUrl(browser)
          if (postUrl && looksLikeXStatusUrl(postUrl)) break
        }

        if (!postUrl || !looksLikeXStatusUrl(postUrl)) {
          await safeInfo('Post URL not found; trying profile fallback')
          const profileUrl = await getProfileUrl(browser)
          if (profileUrl) {
            await browser.navigate(profileUrl)
            await sleep(2500)
            const latest = await findLatestStatusOnProfile(browser)
            if (latest && looksLikeXStatusUrl(latest)) postUrl = latest
          }
        }

        if (!postUrl || !looksLikeXStatusUrl(postUrl)) {
          await safeInfo('Post URL still not found')
          throw new Error('Posted, but could not reliably extract post URL')
        }

        return {
          post_url: postUrl,
          tweet_text: tweetText,
          image_file_path: 'X GIF (inline)',
          alt_text: altText
        }
      }
    }

    let bgDataUrl: string | undefined = undefined
    if (provider !== 'chatgpt') {
      log(
        `GenerateImageExternal: Your model can't generate images (${provider}). Using template render.`
      )
    } else {
      try {
        const theme = (design.theme ?? '').trim()
        const imgPrompt =
          `Bullish Bitcoin meme-style background image, cinematic lighting, clean modern tech aesthetic. ` +
          `Elements: a confident bull charging upward, a rising green price chart, subtle Bitcoin/orange accents. ` +
          `No words, no logos, no watermarks. ${theme ? `Theme: ${theme}. ` : ''}` +
          `Wide 16:9.`

        log('GenerateImageExternal: generating background via OpenAI Images')
        const gen = await openaiGenerateImageBase64({ prompt: imgPrompt, size: '1536x1024' })
        bgDataUrl = `data:image/png;base64,${gen.b64}`
      } catch (e) {
        log(
          `GenerateImageExternal: OpenAI image gen failed; falling back to HTML render. ` +
            `${e instanceof Error ? e.message : String(e)}`
        )
      }
    }

    log('GenerateImageExternal: rendering meme via CDP screenshot')
    const html = buildMemeHtml(design, bgDataUrl)
    await browser.navigate(absDataUrl(html))
    await sleep(1200)
    const pngBase64 = await browser.screenshot()
    if (!pngBase64) throw new Error('Screenshot returned empty data')

    const outDir = join(app.getPath('userData'), 'artifacts', task.id)
    await mkdir(outDir, { recursive: true })
    const imagePath = join(outDir, 'x_post.png')
    await writeFile(imagePath, Buffer.from(pngBase64, 'base64'))

    log('PostToX: opening composer, attaching image, posting')
    await browser.navigate('https://x.com/compose/post')
    await sleep(2500)
    await safeInfo('Compose')

    await waitForXComposerReady({ bridge: browser, log, timeoutMs: 180_000 })

    await setComposerText(browser, tweetText)
    await sleep(300)

    await debugFileInputs(browser, log)

    // In some X builds the file input is mounted lazily after interacting with the media button.
    try {
      await tryClick(browser, [
        'button[aria-label="Add photos or video"]',
        'div[aria-label="Add photos or video"]',
        'button[aria-label="Media"]',
        'button[data-testid="mediaButton"]'
      ])
      await sleep(600)
      await debugFileInputs(browser, log)
    } catch {
      // ok
    }

    // Upload image via file input.
    const fileSelCandidates = ['input[data-testid="fileInput"]', 'input[type="file"]']
    let uploaded = false
    let lastUpErr: unknown = null
    for (let attempt = 0; attempt < 5 && !uploaded; attempt++) {
      for (const sel of fileSelCandidates) {
        try {
          await browser.uploadFile(sel, [imagePath])
          uploaded = true
          break
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          if (/Unknown action:\s*uploadFile/i.test(msg)) {
            throw new Error(
              'Browser backend does not support file uploads. Ensure browser automation is enabled and retry.'
            )
          }
          lastUpErr = e
        }
      }
      if (!uploaded) await sleep(600)
    }
    if (!uploaded) {
      await safeInfo('Upload failed')
      throw new Error(
        `Could not upload image: ${lastUpErr instanceof Error ? lastUpErr.message : String(lastUpErr)}`
      )
    }

    await sleep(2200)

    await clickXPostButton(browser, log)

    // Wait and try to extract the new post URL.
    let postUrl = ''
    for (let i = 0; i < 10; i++) {
      await sleep(1200)
      postUrl = await findPostedUrl(browser)
      if (postUrl && looksLikeXStatusUrl(postUrl)) break
    }

    // Fallback: go to profile and take the latest status URL.
    if (!postUrl || !looksLikeXStatusUrl(postUrl)) {
      await safeInfo('Post URL not found; trying profile fallback')
      const profileUrl = await getProfileUrl(browser)
      if (profileUrl) {
        await browser.navigate(profileUrl)
        await sleep(2500)
        const latest = await findLatestStatusOnProfile(browser)
        if (latest && looksLikeXStatusUrl(latest)) postUrl = latest
      }
    }

    if (!postUrl || !looksLikeXStatusUrl(postUrl)) {
      await safeInfo('Post URL still not found')
      throw new Error('Posted, but could not reliably extract post URL')
    }

    return {
      post_url: postUrl,
      tweet_text: tweetText,
      image_file_path: imagePath,
      alt_text: altText
    }
  } catch (e) {
    await safeInfo('Workflow error context')
    throw e
  }
}
