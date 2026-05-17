import type { ProviderId, Task, TaskAction, TaskStep } from '@skynul/shared'
import { writeFile } from 'fs/promises'
import os from 'os'
import type { BrowserEngine } from '../browser/engine/browser-engine'
import { acquireBrowserEngine } from '../browser/engine/factory'
import { codexVisionRespond, type VisionMessage } from '../transport/providers/codex-vision'
import { parseModelResponse } from './action-parser'
import { AppBridge } from './app-bridge'
import { buildBrowserSystemPrompt, buildCdpSystemPrompt, buildCodeSystemPrompt } from './system-prompt'
import { type InterTaskAPI } from './actions/inter-task'
import type { ActionRouterContext } from './actions/router'
import { routeAction } from './actions/router'
import type { ActionContext, BrowserContext, CodeContext } from './actions/types'
import { compressVisionHistory } from './utils/compress-history'
import { autoDelegateForSocialPost } from './delegates/social-post'

export type TaskRunnerCallbacks = {
  onStep: (taskId: string, step: TaskStep) => void
  onComplete: (task: Task) => void
}

export type TaskRunnerOpts = {
  provider: ProviderId
  openaiModel: string
  memoryContext?: string
  taskManager?: import('./task-manager').TaskManager | null
  taskId?: string
}

const PROVIDERS: Record<string, () => Promise<any>> = {
  kimi: () => import('../transport/providers/kimi-vision'),
  glm: () => import('../transport/providers/glm-vision'),
  minimax: () => import('../transport/providers/minimax-vision'),
  openrouter: () => import('../transport/providers/openrouter-vision'),
  gemini: () => import('../transport/providers/gemini-vision'),
  ollama: () => import('../transport/providers/ollama-vision'),
}

const PROVIDER_FNS: Record<string, string> = {
  kimi: 'kimiVisionRespond',
  glm: 'glmVisionRespond',
  minimax: 'minimaxVisionRespond',
  openrouter: 'openrouterVisionRespond',
  gemini: 'geminiVisionRespond',
  ollama: 'ollamaVisionRespond',
}

export class TaskRunner {
  private aborted = false
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null
  private task: Task
  private lastScrapeData = ''
  private usageTotals: { inputTokens: number; outputTokens: number } | null = null
  private appBridge = new AppBridge()
  private autoDelegated = false

  constructor(
    task: Task,
    private opts: TaskRunnerOpts,
    private callbacks: TaskRunnerCallbacks,
  ) {
    this.task = { ...task }
  }

  async run(): Promise<Task> {
    if (this.task.mode === 'code') return this.runCode()
    if (this.task.capabilities.includes('polymarket.trading')) return this.runCdp()
    return this.runBrowser()
  }

  abort(reason?: string): void {
    this.aborted = true
    if (reason) this.task.error = reason
    this.cleanup()
  }

  getTask(): Task { return { ...this.task } }

  // ── Browser loop ──────────────────────────────────────────────────────────

  private async runBrowser(): Promise<Task> {
    this.pushStatus('Launching browser...')
    let engine: BrowserEngine
    let release: (() => Promise<void>) | null = null
    try {
      const acquired = await acquireBrowserEngine()
      engine = acquired.engine; release = acquired.release
      this.pushStatus('Browser ready')
    } catch (e) {
      return this.finish('failed', `Browser launch failed: ${e instanceof Error ? e.message : String(e)}`)
    }
    if (this.aborted) { if (release) await release().catch(() => {}); return this.finish('cancelled') }

    this.timeoutHandle = setTimeout(() => this.abort('Task timed out'), this.task.timeoutMs)
    const systemPrompt = buildBrowserSystemPrompt(!!this.task.parentTaskId)
    const history: VisionMessage[] = []
    const memCtx = this.opts.memoryContext ? `\n\nContext from memory:\n${this.opts.memoryContext}` : ''
    const { filePaths: attachPaths, dataUrls: attachDataUrls } = await this.resolveAttachments()
    const attachBlock = attachPaths.length > 0 ? `\n\nReference files (use upload_file with these paths to upload them to any site):\n${attachPaths.map((p) => `- ${p}`).join('\n')}` : ''

    const ctx = this.buildRouterContext('browser', { engine })
    if (!this.autoDelegated && this.opts.taskManager) {
      await autoDelegateForSocialPost(this.task, this.opts.taskManager, history)
      this.autoDelegated = true
    }

    try {
      for (let step = 0; step < this.task.maxSteps && !this.aborted; step++) {
        const snap = await engine.snapshot().catch(() => ({ url: '', title: '', snapshot: '(page not available)' }))
        const actionLog = this.buildActionLog()

        const turnText = step === 0
          ? `Task: ${this.task.prompt}${attachBlock}${memCtx}\n\nCurrent page:\nURL: ${snap.url}\nTitle: ${snap.title}\n\nPage snapshot:\n${snap.snapshot}`
          : `Step ${step + 1}.\nURL: ${snap.url}\nTitle: ${snap.title}\n\nPage snapshot:\n${snap.snapshot}${actionLog}`

        const inboxBlock = this.drainInbox()
        const turnMessage: VisionMessage = {
          role: 'user',
          content: [
            { type: 'input_text', text: turnText + inboxBlock },
            ...(step === 0 ? attachDataUrls.slice(0, 4).map((url) => ({ type: 'input_image' as const, detail: 'auto' as const, image_url: url })) : []),
          ],
        }

        history.push(turnMessage)
        compressVisionHistory(history, 8)

        const { text: rawResponse, usage } = await this.callVisionModel(systemPrompt, history)
        if (usage) this.addUsage(usage)
        const { thought, action } = parseModelResponse(rawResponse)

        history.push({ role: 'assistant', content: [{ type: 'output_text', text: rawResponse }] })

        const done = this.handleEndAction(action, thought)
        if (done) { if (release) await release().catch(() => {}); return done }

        const stepResult = await this.executeWithError(action, ctx)
        const taskStep: TaskStep = { index: this.task.steps.length, timestamp: Date.now(), screenshotBase64: '', action, thought, ...(stepResult.result ? { result: stepResult.result } : {}), ...(stepResult.error ? { error: stepResult.error } : {}) }
        this.task.steps.push(taskStep)
        this.pushStep(taskStep)
        await this.sleep(500)
      }
    } catch (e) {
      if (release) await release().catch(() => {})
      if (this.aborted) return this.finish('cancelled')
      return this.finish('failed', `Browser loop error: ${e instanceof Error ? e.message : String(e)}`)
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

    const systemPrompt = buildCdpSystemPrompt(this.task.capabilities, !!this.task.parentTaskId)
    const history: VisionMessage[] = []
    const memCtx = this.opts.memoryContext ?? ''
    const allAttachments = (this.task.attachments ?? []).filter((x) => typeof x === 'string')
    const imageDataUrls = allAttachments.filter((a) => a.startsWith('data:image/'))
    const filePaths = allAttachments.filter((a) => !a.startsWith('data:image/'))
    const attachmentsBlock = filePaths.length > 0 ? `\n\nAttached local files (absolute paths):\n${filePaths.slice(0, 12).map((p) => `- ${p}`).join('\n')}` : ''

    history.push({
      role: 'user',
      content: [{ type: 'input_text', text: `Task: ${this.task.prompt}${attachmentsBlock}${memCtx}` },
        ...imageDataUrls.slice(0, 4).map((url) => ({ type: 'input_image' as const, detail: 'auto' as const, image_url: url })),
      ],
    })

    const ctx = this.buildRouterContext('cdp')

    while (!this.aborted && this.task.steps.length < this.task.maxSteps) {
      try {
        const stepIndex = this.task.steps.length
        let actionLog = ''
        if (stepIndex > 0) {
          actionLog = '\n\nRecent actions:\n' + this.task.steps.slice(-8).map((s) => `Step ${s.index + 1}: ${s.action.type}${s.result ? ` → ${s.result.slice(0, 200)}` : ''}${s.error ? ` [ERROR: ${s.error.slice(0, 100)}]` : ''}`).join('\n') + '\n\nDo NOT repeat actions that already succeeded.'
        }

        const turnText = stepIndex === 0 ? `Task: ${this.task.prompt}\n\nYou are in API-only mode. Use the polymarket_* actions directly. Do NOT use shell, navigate, or evaluate.` : `Step ${stepIndex + 1}.${actionLog}`
        history.push({ role: 'user', content: [{ type: 'input_text', text: turnText + this.drainInbox() }] })
        compressVisionHistory(history, 8)

        const { text: rawResponse, usage } = await this.callVisionModel(systemPrompt, history)
        if (usage) this.addUsage(usage)
        const { thought, action } = parseModelResponse(rawResponse)

        history.push({ role: 'assistant', content: [{ type: 'output_text', text: rawResponse }] })

        const done = this.handleEndAction(action, thought)
        if (done) return done

        const stepResult = await this.executeWithError(action, ctx)
        const taskStep: TaskStep = { index: this.task.steps.length, timestamp: Date.now(), screenshotBase64: '', action, thought, ...(stepResult.result ? { result: stepResult.result } : {}), ...(stepResult.error ? { error: stepResult.error } : {}) }
        this.task.steps.push(taskStep)
        this.pushStep(taskStep)
        await this.sleep(500)
      } catch (e) {
        if (this.aborted) break
        return this.finish('failed', `API loop error: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    if (this.aborted) return this.finish('cancelled')
    return this.finish('failed', `Reached max steps (${this.task.maxSteps})`)
  }

  // ── Code loop ─────────────────────────────────────────────────────────────

  private async runCode(): Promise<Task> {
    this.pushStatus(`Connecting to ${this.getProviderDisplayName()}...`)
    if (this.aborted) return this.finish('cancelled')

    this.timeoutHandle = setTimeout(() => this.abort('Task timed out'), this.task.timeoutMs)
    this.pushStatus('Preparing agent loop...')

    const systemPrompt = buildCodeSystemPrompt(this.task.capabilities, !!this.task.parentTaskId)
    const history: VisionMessage[] = []
    const memCtx = this.opts.memoryContext ?? ''

    history.push({
      role: 'user',
      content: [{ type: 'input_text', text: `Task: ${this.task.prompt}${memCtx}\n\n[CODE MODE] You have NO screen access. Do NOT use click, scroll, move, or other screen actions.${this.task.capabilities.includes('app.scripting') ? ' [APP SCRIPTING ACTIVE] You MUST use app_script for design tasks. Do NOT use file_write for design files. Keep scripts under 6 lines.' : ' Use file_read, file_write, file_edit, file_list, file_search, and shell.'}` }],
    })

    const ctx = this.buildRouterContext('code')

    while (!this.aborted && this.task.steps.length < this.task.maxSteps) {
      try {
        const stepIndex = this.task.steps.length
        let turnText: string
        if (stepIndex === 0) {
          turnText = this.task.capabilities.includes('app.scripting')
            ? `Task: ${this.task.prompt}\n\n[APP SCRIPTING MODE] Use ONLY app_script actions. Keep scripts under 6 lines. Do NOT use file_write for design files.\n\nIMPORTANT: Take your time. Build the design in MANY small steps (10-20+ steps). Do NOT rush to save/done after 2-3 shapes. Each step should add ONE element: a shape, a color, a text, an alignment. Build up complexity gradually like a real designer would. Do NOT use "done" until the design is truly complete and polished.`
            : `Task: ${this.task.prompt}\n\n[CODE MODE] No screen. Use file_read/file_write/file_edit/file_list/file_search/shell/done/fail actions.`
        } else {
          turnText = `Step ${stepIndex + 1}.\n\nRecent actions:\n${this.task.steps.slice(-8).map((s) => {
            const a = s.action; let desc: string = a.type
            if (a.type === 'shell') desc = `shell "${(a as any).command?.slice(0, 80)}"`
            else if (a.type === 'file_read') desc = `file_read ${(a as any).path}`
            else if (a.type === 'file_write') desc = `file_write ${(a as any).path}`
            else if (a.type === 'file_edit') desc = `file_edit ${(a as any).path}`
            else if (a.type === 'file_list') desc = `file_list "${(a as any).pattern}"`
            else if (a.type === 'file_search') desc = `file_search "${(a as any).pattern}"`
            return `Step ${s.index + 1}: ${desc}${s.result ? ` → ${s.result.slice(0, 300)}` : ''}${s.error ? ` [ERROR: ${s.error.slice(0, 100)}]` : ''}`
          }).join('\n')}\n\nContinue with the next step.`
        }
        turnText += this.drainInbox()

        history.push({ role: 'user', content: [{ type: 'input_text', text: turnText }] })
        if (history.length > 20) history.splice(1, history.length - 19)

        this.pushStatus('Thinking...')
        const { text: rawResponse, usage } = await this.callVisionModel(systemPrompt, history)
        if (usage) this.addUsage(usage)
        const { thought, action } = parseModelResponse(rawResponse)

        history.push({ role: 'assistant', content: [{ type: 'output_text', text: rawResponse }] })

        const done = this.handleEndAction(action, thought)
        if (done) return done

        // Block screen actions in code mode
        if (['click', 'double_click', 'scroll', 'move'].includes(action.type)) {
          const errStep: TaskStep = { index: this.task.steps.length, timestamp: Date.now(), screenshotBase64: '', action, thought, error: `Action "${action.type}" not available in code mode. Use shell commands instead.` }
          this.task.steps.push(errStep)
          this.pushStep(errStep)
          await this.sleep(200); continue
        }

        const stepResult = await this.executeWithError(action, ctx)
        const taskStep: TaskStep = { index: this.task.steps.length, timestamp: Date.now(), screenshotBase64: '', action, thought, ...(stepResult.result ? { result: stepResult.result } : {}), ...(stepResult.error ? { error: stepResult.error } : {}) }
        this.task.steps.push(taskStep)
        this.pushStep(taskStep)

        // Canvas preview every 3 app_script steps
        if (action.type === 'app_script' && this.task.capabilities.includes('app.scripting') && this.task.steps.filter((s) => s.action.type === 'app_script').length % 3 === 0) {
          try {
            const appName = (action as any).app as string
            const previewB64 = await this.appBridge.getPreview(appName as any)
            if (previewB64) history.push({ role: 'user', content: [{ type: 'input_text', text: '[CANVAS PREVIEW] Look at the current state of your design. Check composition, alignment, spacing, and visual balance before continuing.' }, { type: 'input_image', image_url: `data:image/png;base64,${previewB64}` }] })
          } catch { /* preview failed */ }
        }

        await this.sleep(200)
      } catch (e) {
        if (this.aborted) break
        return this.finish('failed', `Code loop error: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    if (this.aborted) return this.finish('cancelled')
    return this.finish('failed', `Reached max steps (${this.task.maxSteps})`)
  }

  // ── Action execution ──────────────────────────────────────────────────────

  private buildRouterContext(mode: 'browser' | 'cdp' | 'code', browserEngine?: { engine: BrowserEngine }): ActionRouterContext {
    const base: ActionContext = { task: this.task, taskId: this.opts.taskId ?? this.task.id, pushUpdate: () => this.pushUpdate() }

    const interTask: InterTaskAPI = {
      list: () => this.opts.taskManager?.list() ?? [],
      get: (id) => this.opts.taskManager?.get(id),
      spawnAndWait: (prompt, parentTaskId, identity) => {
        return this.opts.taskManager!.spawnAndWait(prompt, this.task.capabilities, parentTaskId, identity)
      },
      sendMessage: (targetId, fromId, message) => this.opts.taskManager?.sendMessage(targetId, fromId, message),
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
          snapshot: () => engine.snapshot(),
        },
      }
    }

    const code: CodeContext = {
      ...base,
      appBridge: this.appBridge,
      shell: (cmd, cwd, timeout) => this.executeShell(cmd, cwd, timeout),
      scrapeUrl: (url, instruction) => import('./web-scraper').then((m) => m.scrapeUrl(url, instruction ?? '')),
      getLastScrapeData: () => this.lastScrapeData,
      setLastScrapeData: (data) => { this.lastScrapeData = data },
    }

    return {
      mode,
      base,
      browser,
      code,
      interTask,
      taskId: this.opts.taskId ?? this.task.id,
      appBridge: this.appBridge,
      lastScrapeData: this.lastScrapeData,
      setLastScrapeData: (data) => { this.lastScrapeData = data },
    }
  }

  private async executeWithError(action: TaskAction, ctx: ActionRouterContext): Promise<{ result?: string; error?: string }> {
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
      this.task.steps.push({ index: this.task.steps.length, timestamp: Date.now(), screenshotBase64: '', action, thought })
      this.pushUpdate()
      return this.finish('completed')
    }
    if (action.type === 'fail') {
      this.task.steps.push({ index: this.task.steps.length, timestamp: Date.now(), screenshotBase64: '', action, thought })
      this.pushUpdate()
      return this.finish('failed', action.reason)
    }
    return undefined
  }

  private buildActionLog(): string {
    if (this.task.steps.length === 0) return ''
    const recent = this.task.steps.slice(-8)
    let log = '\n\nRecent actions:\n' + recent.map((s) => {
      const res = s.result ? ` → ${s.result.slice(0, 200)}` : ''
      const err = s.error ? ` [ERROR: ${s.error.slice(0, 100)}]` : ''
      const trunc = s.thought?.includes('truncated') ? ' [YOUR RESPONSE WAS TRUNCATED — keep thought under 30 words]' : ''
      return `Step ${s.index + 1}: ${s.action.type}${res}${err}${trunc}`
    }).join('\n') + '\n\nDo NOT repeat actions that already succeeded.'

    const failedSelectors = new Set<string>()
    for (const s of this.task.steps) {
      if (s.error) {
        const raw = s.action as Record<string, unknown>
        if (raw.selector) failedSelectors.add(String(raw.selector))
      }
    }
    if (failedSelectors.size > 0) {
      log += '\n\n⚠ FAILED SELECTORS (do NOT use these again, try a completely different approach):\n' + [...failedSelectors].map((s) => `- ${s}`).join('\n')
    }
    return log
  }

  // ── Vision model ──────────────────────────────────────────────────────────

  private async callVisionModel(systemPrompt: string, messages: VisionMessage[]): Promise<{ text: string; usage?: { inputTokens: number; outputTokens: number } }> {
    const provider = this.opts.provider
    if (provider === 'chatgpt') return { text: await codexVisionRespond({ systemPrompt, messages, sessionId: this.task.id, model: this.opts.openaiModel }) }
    const mod = await PROVIDERS[provider]!()
    const fnName = PROVIDER_FNS[provider]!
    return mod[fnName]({ systemPrompt, messages })
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
      const { exec } = require('child_process') as typeof import('child_process')
      const timeout = Math.min(timeoutMs ?? 120_000, 300_000)
      const child = exec(command, { timeout, maxBuffer: 1024 * 1024, cwd: cwd || undefined }, (err, stdout, stderr) => {
        const out = this.headTail((stdout ?? '').toString(), 4000)
        const errOut = (stderr ?? '').toString().slice(0, 1000)
        resolve(err ? `[Exit ${err.code ?? 1}] ${errOut || err.message}\n${out}`.trim() : errOut ? `${out}\n[stderr] ${errOut}` : out || '(no output)')
      })
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
    if (this.timeoutHandle) { clearTimeout(this.timeoutHandle); this.timeoutHandle = null }
  }

  private pushStep(step: TaskStep): void {
    this.task.updatedAt = Date.now()
    this.callbacks.onStep(this.opts.taskId ?? this.task.id, step)
  }

  private pushUpdate(): void {
    this.task.updatedAt = Date.now()
    this.callbacks.onComplete({ ...this.task })
  }

  private pushStatus(msg: string): void {
    this.task.summary = msg
    this.pushUpdate()
  }

  private drainInbox(): string {
    const tm = this.opts.taskManager
    if (!tm) return ''
    const msgs = tm.drainMessages(this.opts.taskId ?? this.task.id)
    if (msgs.length === 0) return ''
    return `\n\n[INCOMING MESSAGES]\n${msgs.map((m) => `  From ${m.from}: ${m.message}`).join('\n')}\n[/INCOMING MESSAGES]`
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private getProviderDisplayName(): string {
    const p = this.opts.provider
    return p.charAt(0).toUpperCase() + p.slice(1)
  }
}
