import { writeFile } from 'node:fs/promises'
import os from 'node:os'
import type { ProviderId, Task, TaskAction, TaskStep } from '@skynul/shared'
import type { BrowserEngine } from '../browser/browser-engine'
import { acquireBrowserEngine } from '../browser/factory'
import { codexVisionRespond, type VisionMessage } from '../providers/codex-vision'
import { parseModelResponse } from './action-parser'
import type { ActionRouterContext } from './actions/router'
import { routeAction } from './actions/router'
import type { ActionContext, BrowserContext, CodeContext } from './actions/types'
import { AppBridge } from './app-bridge'
import {
  buildBrowserSystemPrompt,
  buildCdpSystemPrompt,
  buildSandboxSystemPrompt
} from './system-prompt'
import { compressVisionHistory } from './utils/compress-history'

export type TaskRunnerCallbacks = {
  onStep: (taskId: string, step: TaskStep) => void
  onComplete: (task: Task) => void
}

export type TaskRunnerOpts = {
  provider: ProviderId
  model: string
  apiKey?: string
}

type VisionRespondOpts = { apiKey?: string; systemPrompt: string; messages: VisionMessage[] }
type VisionRespondResult = Promise<{
  text: string
  usage?: { inputTokens: number; outputTokens: number }
}>
type VisionMod = Record<string, (opts: VisionRespondOpts) => VisionRespondResult>

const PROVIDERS: Record<string, () => Promise<unknown>> = {
  kimi: () => import('../providers/kimi-vision'),
  glm: () => import('../providers/glm-vision'),
  minimax: () => import('../providers/minimax-vision'),
  openrouter: () => import('../providers/openrouter-vision'),
  gemini: () => import('../providers/gemini-vision'),
  ollama: () => import('../providers/ollama-vision')
}

const PROVIDER_FNS: Record<string, string> = {
  kimi: 'kimiVisionRespond',
  glm: 'glmVisionRespond',
  minimax: 'minimaxVisionRespond',
  openrouter: 'openrouterVisionRespond',
  gemini: 'geminiVisionRespond',
  ollama: 'ollamaVisionRespond'
}

export class TaskRunner {
  private aborted = false
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null
  private task: Task
  private lastScrapeData = ''
  private usageTotals: { inputTokens: number; outputTokens: number } | null = null
  private appBridge = new AppBridge()

  constructor(
    task: Task,
    private opts: TaskRunnerOpts,
    private callbacks: TaskRunnerCallbacks
  ) {
    this.task = { ...task }
  }

  async run(): Promise<Task> {
    if ((this.task.mode as string) === 'sandbox') return this.runSandbox()
    if (this.task.capabilities.includes('polymarket.trading')) return this.runCdp()
    return this.runBrowser()
  }

  abort(reason?: string): void {
    this.aborted = true
    if (reason) this.task.error = reason
    this.cleanup()
  }

  getTask(): Task {
    return { ...this.task }
  }

  // ── Browser loop ──────────────────────────────────────────────────────────

  private async runBrowser(): Promise<Task> {
    this.pushStatus('Launching browser...')
    let engine: BrowserEngine
    let release: (() => Promise<void>) | null = null
    try {
      const acquired = await acquireBrowserEngine()
      engine = acquired.engine
      release = acquired.release
      this.pushStatus('Browser ready')
    } catch (e) {
      return this.finish(
        'failed',
        `Browser launch failed: ${e instanceof Error ? e.message : String(e)}`
      )
    }
    if (this.aborted) {
      if (release) await release().catch(() => {})
      return this.finish('cancelled')
    }

    this.timeoutHandle = setTimeout(() => this.abort('Task timed out'), this.task.timeoutMs)
    const systemPrompt = buildBrowserSystemPrompt()
    const history: VisionMessage[] = []
    const { filePaths: attachPaths, dataUrls: attachDataUrls } = await this.resolveAttachments()
    const attachBlock =
      attachPaths.length > 0
        ? `\n\nReference files (use upload_file with these paths to upload them to any site):\n${attachPaths.map((p) => `- ${p}`).join('\n')}`
        : ''

    const ctx = this.buildRouterContext('browser', { engine })

    try {
      for (let step = 0; step < this.task.maxSteps && !this.aborted; step++) {
        const snap = await engine
          .snapshot()
          .catch(() => ({ url: '', title: '', snapshot: '(page not available)' }))
        const actionLog = this.buildActionLog()

        const turnText =
          step === 0
            ? `Task: ${this.task.prompt}${attachBlock}\n\nCurrent page:\nURL: ${snap.url}\nTitle: ${snap.title}\n\nPage snapshot:\n${snap.snapshot}`
            : `Step ${step + 1}.\nURL: ${snap.url}\nTitle: ${snap.title}\n\nPage snapshot:\n${snap.snapshot}${actionLog}`

        const turnMessage: VisionMessage = {
          role: 'user',
          content: [
            { type: 'input_text', text: turnText },
            ...(step === 0
              ? attachDataUrls.slice(0, 4).map((url) => ({
                  type: 'input_image' as const,
                  detail: 'auto' as const,
                  image_url: url
                }))
              : [])
          ]
        }

        history.push(turnMessage)
        compressVisionHistory(history, 8)

        const { text: rawResponse, usage } = await this.callVisionModel(systemPrompt, history)
        if (usage) this.addUsage(usage)
        const { thought, action } = parseModelResponse(rawResponse)

        history.push({ role: 'assistant', content: [{ type: 'output_text', text: rawResponse }] })

        const done = this.handleEndAction(action, thought)
        if (done) {
          if (release) await release().catch(() => {})
          return done
        }

        const stepResult = await this.executeWithError(action, ctx)
        const taskStep: TaskStep = {
          index: this.task.steps.length,
          timestamp: Date.now(),
          screenshotBase64: '',
          action,
          thought,
          ...(stepResult.result ? { result: stepResult.result } : {}),
          ...(stepResult.error ? { error: stepResult.error } : {})
        }
        this.task.steps.push(taskStep)
        this.pushStep(taskStep)
        await this.sleep(500)
      }
    } catch (e) {
      if (release) await release().catch(() => {})
      if (this.aborted) return this.finish('cancelled')
      return this.finish(
        'failed',
        `Browser loop error: ${e instanceof Error ? e.message : String(e)}`
      )
    }
    if (release) await release().catch(() => {})
    if (this.aborted) return this.finish('cancelled')
    return this.finish('failed', `Reached max steps (${this.task.maxSteps})`)
  }

  // ── CDP / API-only loop ───────────────────────────────────────────────────

  private async runCdp(): Promise<Task> {
    this.pushStatus(`Connecting to ${this.getProviderDisplayName()}...`)
    this.timeoutHandle = setTimeout(() => this.abort('Task timed out'), this.task.timeoutMs)
    this.pushStatus('Starting agent loop...')

    const systemPrompt = buildCdpSystemPrompt(this.task.capabilities)
    const history: VisionMessage[] = []
    const allAttachments = (this.task.attachments ?? []).filter((x) => typeof x === 'string')
    const imageDataUrls = allAttachments.filter((a) => a.startsWith('data:image/'))
    const filePaths = allAttachments.filter((a) => !a.startsWith('data:image/'))
    const attachmentsBlock =
      filePaths.length > 0
        ? `\n\nAttached local files (absolute paths):\n${filePaths
            .slice(0, 12)
            .map((p) => `- ${p}`)
            .join('\n')}`
        : ''

    history.push({
      role: 'user',
      content: [
        { type: 'input_text', text: `Task: ${this.task.prompt}${attachmentsBlock}` },
        ...imageDataUrls
          .slice(0, 4)
          .map((url) => ({ type: 'input_image' as const, detail: 'auto' as const, image_url: url }))
      ]
    })

    const ctx = this.buildRouterContext('cdp')

    while (!this.aborted && this.task.steps.length < this.task.maxSteps) {
      try {
        const stepIndex = this.task.steps.length
        let actionLog = ''
        if (stepIndex > 0) {
          actionLog = `\n\nRecent actions:\n${this.task.steps
            .slice(-8)
            .map(
              (s) =>
                `Step ${s.index + 1}: ${s.action.type}${s.result ? ` → ${s.result.slice(0, 200)}` : ''}${s.error ? ` [ERROR: ${s.error.slice(0, 100)}]` : ''}`
            )
            .join('\n')}\n\nDo NOT repeat actions that already succeeded.`
        }

        const turnText =
          stepIndex === 0
            ? `Task: ${this.task.prompt}\n\nYou are in API-only mode. Use the polymarket_* actions directly. Do NOT use shell, navigate, or evaluate.`
            : `Step ${stepIndex + 1}.${actionLog}`
        history.push({ role: 'user', content: [{ type: 'input_text', text: turnText }] })
        compressVisionHistory(history, 8)

        const { text: rawResponse, usage } = await this.callVisionModel(systemPrompt, history)
        if (usage) this.addUsage(usage)
        const { thought, action } = parseModelResponse(rawResponse)

        history.push({ role: 'assistant', content: [{ type: 'output_text', text: rawResponse }] })

        const done = this.handleEndAction(action, thought)
        if (done) return done

        const stepResult = await this.executeWithError(action, ctx)
        const taskStep: TaskStep = {
          index: this.task.steps.length,
          timestamp: Date.now(),
          screenshotBase64: '',
          action,
          thought,
          ...(stepResult.result ? { result: stepResult.result } : {}),
          ...(stepResult.error ? { error: stepResult.error } : {})
        }
        this.task.steps.push(taskStep)
        this.pushStep(taskStep)
        await this.sleep(500)
      } catch (e) {
        if (this.aborted) break
        return this.finish(
          'failed',
          `API loop error: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }
    if (this.aborted) return this.finish('cancelled')
    return this.finish('failed', `Reached max steps (${this.task.maxSteps})`)
  }

  // ── Sandbox loop ──────────────────────────────────────────────────────────

  private async runSandbox(): Promise<Task> {
    this.pushStatus(`Connecting to ${this.getProviderDisplayName()}...`)
    if (this.aborted) return this.finish('cancelled')

    this.timeoutHandle = setTimeout(() => this.abort('Task timed out'), this.task.timeoutMs)
    this.pushStatus('Preparing sandbox...')

    const systemPrompt = buildSandboxSystemPrompt(this.task.capabilities)
    const history: VisionMessage[] = []

    history.push({
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: `Task: ${this.task.prompt}\n\n[SANDBOX MODE] You have NO screen access. Use shell, file operations, and app_script actions.`
        }
      ]
    })

    const ctx = this.buildRouterContext('sandbox')

    while (!this.aborted && this.task.steps.length < this.task.maxSteps) {
      try {
        const stepIndex = this.task.steps.length
        let turnText: string
        if (stepIndex === 0) {
          turnText = this.task.capabilities.includes('app.scripting')
            ? `Task: ${this.task.prompt}\n\n[APP SCRIPTING ACTIVE] Use app_script for design tasks. Keep scripts under 6 lines. Build designs in many small steps (10-20+).`
            : `Task: ${this.task.prompt}\n\n[SANDBOX] Use shell, file_read/file_write/file_edit, app_script actions.`
        } else {
          turnText = `Step ${stepIndex + 1}.\n\nRecent actions:\n${this.task.steps
            .slice(-8)
            .map((s) => {
              const a = s.action
              const rec = a as unknown as Record<string, unknown>
              let desc: string = a.type
              if (a.type === 'shell') desc = `shell "${String(rec.command ?? '').slice(0, 80)}"`
              else if (a.type === 'file_read') desc = `file_read ${String(rec.path ?? '')}`
              else if (a.type === 'file_write') desc = `file_write ${String(rec.path ?? '')}`
              else if (a.type === 'file_edit') desc = `file_edit ${String(rec.path ?? '')}`
              else if (a.type === 'app_script') desc = `app_script ${String(rec.app ?? '')}`
              return `Step ${s.index + 1}: ${desc}${s.result ? ` → ${s.result.slice(0, 300)}` : ''}${s.error ? ` [ERROR: ${s.error.slice(0, 100)}]` : ''}`
            })
            .join('\n')}\n\nContinue with the next step.`
        }

        history.push({ role: 'user', content: [{ type: 'input_text', text: turnText }] })
        if (history.length > 20) history.splice(1, history.length - 19)

        this.pushStatus('Thinking...')
        const { text: rawResponse, usage } = await this.callVisionModel(systemPrompt, history)
        if (usage) this.addUsage(usage)
        const { thought, action } = parseModelResponse(rawResponse)

        history.push({ role: 'assistant', content: [{ type: 'output_text', text: rawResponse }] })

        const done = this.handleEndAction(action, thought)
        if (done) return done

        const stepResult = await this.executeWithError(action, ctx)
        const taskStep: TaskStep = {
          index: this.task.steps.length,
          timestamp: Date.now(),
          screenshotBase64: '',
          action,
          thought,
          ...(stepResult.result ? { result: stepResult.result } : {}),
          ...(stepResult.error ? { error: stepResult.error } : {})
        }
        this.task.steps.push(taskStep)
        this.pushStep(taskStep)

        await this.sleep(200)
      } catch (e) {
        if (this.aborted) break
        return this.finish(
          'failed',
          `Sandbox loop error: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }
    if (this.aborted) return this.finish('cancelled')
    return this.finish('failed', `Reached max steps (${this.task.maxSteps})`)
  }

  // ── Action execution ──────────────────────────────────────────────────────

  private buildRouterContext(
    mode: 'browser' | 'cdp' | 'sandbox',
    browserEngine?: { engine: BrowserEngine }
  ): ActionRouterContext {
    const base: ActionContext = {
      task: this.task,
      taskId: this.task.id,
      pushUpdate: () => this.pushUpdate()
    }

    let browser: BrowserContext | undefined
    if (browserEngine) {
      const engine = browserEngine.engine
      browser = {
        ...base,
        engine: {
          navigate: (url) => engine.navigate(url),
          click: (sel, fid) => engine.click(sel, fid),
          type: (sel, txt, fid) => engine.type(sel, txt, fid),
          pressKey: (key) => engine.pressKey(key),
          evaluate: (script, fid) => engine.evaluate(script, fid),
          uploadFile: (sel, paths, fid) => engine.uploadFile(sel, paths, fid),
          snapshot: () => engine.snapshot()
        }
      }
    }

    const code: CodeContext = {
      ...base,
      appBridge: this.appBridge,
      shell: (cmd, cwd, timeout) => this.executeShell(cmd, cwd, timeout),
      scrapeUrl: (url, instruction) =>
        import('./web-scraper').then((m) => m.scrapeUrl(url, instruction ?? '')),
      getLastScrapeData: () => this.lastScrapeData,
      setLastScrapeData: (data) => {
        this.lastScrapeData = data
      }
    }

    return {
      mode,
      base,
      browser,
      code,
      taskId: this.task.id,
      appBridge: this.appBridge,
      lastScrapeData: this.lastScrapeData,
      setLastScrapeData: (data) => {
        this.lastScrapeData = data
      }
    }
  }

  private async executeWithError(
    action: TaskAction,
    ctx: ActionRouterContext
  ): Promise<{ result?: string; error?: string }> {
    try {
      const result = await routeAction(action, ctx)
      return result ? { result } : {}
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }

  private handleEndAction(action: TaskAction, thought?: string): Task | undefined {
    if (action.type === 'done') {
      this.task.summary = action.summary
      this.task.steps.push({
        index: this.task.steps.length,
        timestamp: Date.now(),
        screenshotBase64: '',
        action,
        thought
      })
      this.pushUpdate()
      return this.finish('completed')
    }
    if (action.type === 'fail') {
      this.task.steps.push({
        index: this.task.steps.length,
        timestamp: Date.now(),
        screenshotBase64: '',
        action,
        thought
      })
      this.pushUpdate()
      return this.finish('failed', action.reason)
    }
    return undefined
  }

  private buildActionLog(): string {
    if (this.task.steps.length === 0) return ''
    const recent = this.task.steps.slice(-8)
    let log = `\n\nRecent actions:\n${recent
      .map((s) => {
        const res = s.result ? ` → ${s.result.slice(0, 200)}` : ''
        const err = s.error ? ` [ERROR: ${s.error.slice(0, 100)}]` : ''
        const trunc = s.thought?.includes('truncated')
          ? ' [YOUR RESPONSE WAS TRUNCATED — keep thought under 30 words]'
          : ''
        return `Step ${s.index + 1}: ${s.action.type}${res}${err}${trunc}`
      })
      .join('\n')}\n\nDo NOT repeat actions that already succeeded.`

    const failedSelectors = new Set<string>()
    for (const s of this.task.steps) {
      if (s.error) {
        const raw = s.action as Record<string, unknown>
        if (raw.selector) failedSelectors.add(String(raw.selector))
      }
    }
    if (failedSelectors.size > 0) {
      log += `\n\n⚠ FAILED SELECTORS (do NOT use these again, try a completely different approach):\n${[...failedSelectors].map((s) => `- ${s}`).join('\n')}`
    }
    return log
  }

  // ── Vision model ──────────────────────────────────────────────────────────

  private async callVisionModel(
    systemPrompt: string,
    messages: VisionMessage[]
  ): Promise<{ text: string; usage?: { inputTokens: number; outputTokens: number } }> {
    const provider = this.opts.provider
    const apiKey = this.opts.apiKey
    if (provider === 'chatgpt')
      return {
        text: await codexVisionRespond({
          systemPrompt,
          messages,
          sessionId: this.task.id,
          model: this.opts.model
        })
      }
    const mod = (await PROVIDERS[provider]?.()) as VisionMod
    const fnName = PROVIDER_FNS[provider]
    if (fnName === undefined) throw new Error(`Vision provider not implemented: ${provider}`)
    const fn = mod[fnName]
    if (typeof fn !== 'function')
      throw new Error(`Vision provider export missing: ${provider}.${fnName}`)
    return fn({ apiKey, systemPrompt, messages })
  }

  private addUsage(usage: { inputTokens: number; outputTokens: number }): void {
    if (!this.usageTotals) this.usageTotals = { inputTokens: 0, outputTokens: 0 }
    this.usageTotals.inputTokens += usage.inputTokens
    this.usageTotals.outputTokens += usage.outputTokens
    this.task.usage = { ...this.usageTotals }
  }

  // ── Attachments ───────────────────────────────────────────────────────────

  private async resolveAttachments(): Promise<{ filePaths: string[]; dataUrls: string[] }> {
    const all = (this.task.attachments ?? []).filter((x) => typeof x === 'string')
    const filePaths: string[] = []
    const dataUrls: string[] = []
    for (const a of all) {
      if (a.startsWith('data:image/')) {
        dataUrls.push(a)
        const ext = a.startsWith('data:image/png') ? 'png' : 'jpg'
        const p = `${os.tmpdir()}/skynul-ref-${Date.now()}-${dataUrls.length}.${ext}`
        const base64 = a.split(',')[1]
        await writeFile(p, Buffer.from(base64, 'base64'))
        filePaths.push(p)
      } else {
        filePaths.push(a)
      }
    }
    return { filePaths, dataUrls }
  }

  // ── Shell ─────────────────────────────────────────────────────────────────

  private executeShell(command: string, cwd?: string, timeoutMs?: number): Promise<string> {
    return new Promise((resolve) => {
      const { exec } = require('node:child_process') as typeof import('child_process')
      const timeout = Math.min(timeoutMs ?? 120_000, 300_000)
      const child = exec(
        command,
        { timeout, maxBuffer: 1024 * 1024, cwd: cwd || undefined },
        (err, stdout, stderr) => {
          const out = this.headTail((stdout ?? '').toString(), 4000)
          const errOut = (stderr ?? '').toString().slice(0, 1000)
          resolve(
            err
              ? `[Exit ${err.code ?? 1}] ${errOut || err.message}\n${out}`.trim()
              : errOut
                ? `${out}\n[stderr] ${errOut}`
                : out || '(no output)'
          )
        }
      )
      child.stdin?.end()
    })
  }

  private headTail(text: string, limit: number): string {
    if (text.length <= limit) return text
    const head = Math.floor(limit * 0.6)
    const tail = limit - head
    return `${text.slice(0, head)}\n\n[... ${text.length - head - tail} chars omitted ...]\n\n${text.slice(text.length - tail)}`
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  private finish(status: 'completed' | 'failed' | 'cancelled', error?: string): Task {
    this.cleanup()
    this.task.status = status
    if (error) this.task.error = error
    this.task.updatedAt = Date.now()
    this.pushUpdate()
    return this.task
  }

  private cleanup(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle)
      this.timeoutHandle = null
    }
  }

  private pushStep(step: TaskStep): void {
    this.task.updatedAt = Date.now()
    this.callbacks.onStep(this.task.id, step)
  }

  private pushUpdate(): void {
    this.task.updatedAt = Date.now()
    this.callbacks.onComplete({ ...this.task })
  }

  private pushStatus(msg: string): void {
    this.task.summary = msg
    this.pushUpdate()
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private getProviderDisplayName(): string {
    const p = this.opts.provider
    return p.charAt(0).toUpperCase() + p.slice(1)
  }
}
