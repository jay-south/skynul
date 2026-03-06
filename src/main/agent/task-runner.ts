/**
 * TaskRunner — the agent loop for a single task.
 *
 * 1. Create WindowsBridge
 * 2. Screenshot → send to model with history
 * 3. Model responds with JSON action
 * 4. Execute action via bridge
 * 5. Record step (screenshot + action + result)
 * 6. Push update to renderer
 * 7. Repeat until done, fail, timeout, or max steps
 */

import type { Task, TaskAction, TaskCapabilityId, TaskStep } from '../../shared/task'
import type { ProviderId } from '../../shared/policy'
import type { PolicyState } from '../../shared/policy'
import { WindowsBridge } from './windows-bridge'
import { BrowserBridge } from './browser-bridge'
import type { CdpRelay } from './cdp-relay'
import { buildCdpSystemPrompt, buildCodeSystemPrompt } from './system-prompt'
import { parseModelResponse } from './action-parser'
import { codexVisionRespond, type VisionMessage } from '../providers/codex-vision'
import { PolymarketClient } from '../polymarket-client'
import { scrapeUrl } from './web-scraper'
import { createExcelFromTsv } from './excel-writer'
import { resolveWithinWorkspace } from './workspace-path'

export type TaskRunnerCallbacks = {
  onUpdate: (task: Task) => void
}

export type TaskRunnerOpts = {
  provider: ProviderId
  openaiModel: string
  cdpRelay?: CdpRelay | null
  memoryContext?: string
  taskManager?: import('./task-manager').TaskManager | null
  taskId?: string
  /** Policy state snapshot used for enforcement (not UI). */
  policy?: Pick<PolicyState, 'workspaceRoot' | 'capabilities'>
  /** Effective task capabilities (intersection) enforced by the runner. */
  effectiveTaskCapabilities?: TaskCapabilityId[]
  /** Internal execution prompt (may differ from task.prompt shown in UI). */
  executionPrompt?: string
}

export class TaskRunner {
  private bridge: WindowsBridge | null = null
  private aborted = false
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null
  private task: Task
  private lastScrapeData = ''
  /** When true, next CDP turn includes a screenshot (for after launch/native app interaction). */
  private cdpNeedsScreenshot = false
  private activeFrameId: string | undefined = undefined
  /** Scale factors from last CDP screenshot — needed to convert screenshot coords to native coords. */
  private cdpScaleX = 1
  private cdpScaleY = 1
  /** Best-effort accumulated token usage (when provider returns usage). */
  private usageTotals: { inputTokens: number; outputTokens: number } | null = null
  private readonly effectiveCaps: Set<TaskCapabilityId>
  private readonly policyCaps: PolicyState['capabilities']
  private readonly workspaceRoot: string | null
  private readonly executionPrompt: string

  constructor(
    task: Task,
    private opts: TaskRunnerOpts,
    private callbacks: TaskRunnerCallbacks
  ) {
    this.task = { ...task }

    this.effectiveCaps = new Set(opts.effectiveTaskCapabilities ?? task.capabilities)
    this.policyCaps = opts.policy?.capabilities ?? {
      'fs.read': false,
      'fs.write': false,
      'cmd.run': false,
      'net.http': false
    }
    this.workspaceRoot = opts.policy?.workspaceRoot ?? null
    this.executionPrompt = opts.executionPrompt?.trim() ? opts.executionPrompt : task.prompt
  }

  /**
   * Run the agent loop. Resolves when the task is done, failed, or cancelled.
   */
  async run(): Promise<Task> {
    // Code mode — text-only loop, no bridge/screenshots
    if (this.task.mode === 'code') {
      return this.runCode()
    }

    // Default: CDP text-based loop via Chrome extension
    return this.runCdp()
  }

  /**
   * CDP text-based agent loop (no screenshots).
   */
  private async runCdp(): Promise<Task> {
    // Set initial status immediately, before any validation
    this.pushStatus(`Connecting to ${this.getProviderDisplayName()}...`)

    // Check if this task actually needs the browser (CDP)
    const needsBrowser =
      this.effectiveCaps.has('browser.cdp') || this.effectiveCaps.has('app.launch')
    let browserBridge: BrowserBridge | null = null

    if (needsBrowser) {
      // Check if aborted before validating CDP relay
      if (this.aborted) {
        return this.finish('cancelled')
      }

      const relay = this.opts.cdpRelay
      if (!relay) {
        return this.finish('failed', 'CDP relay not available')
      }
      browserBridge = new BrowserBridge(relay)

      // Check if aborted before checking connection
      if (this.aborted) {
        return this.finish('cancelled')
      }

      if (!browserBridge.isConnected) {
        return this.finish('failed', 'Chrome extension not connected to CDP relay')
      }
      // Check if aborted before creating task tab
      if (this.aborted) {
        return this.finish('cancelled')
      }

      // Always create a new tab for the task; never close or reuse the user's current tab
      try {
        await browserBridge.ensureTaskTab()
      } catch (e) {
        return this.finish(
          'failed',
          `Could not create task tab: ${e instanceof Error ? e.message : String(e)}`
        )
      }

      // Browser bridge is ready
      this.pushStatus('Setting up browser bridge...')
    }

    this.timeoutHandle = setTimeout(() => {
      this.abort('Task timed out')
    }, this.task.timeoutMs)

    this.pushStatus(needsBrowser ? 'Preparing agent loop...' : 'Starting agent loop...')

    const systemPrompt = buildCdpSystemPrompt([...this.effectiveCaps])
    const history: VisionMessage[] = []

    const memCtxCdp = this.opts.memoryContext ?? ''
    history.push({
      role: 'user',
      content: [{ type: 'input_text', text: `Task: ${this.executionPrompt}${memCtxCdp}` }]
    })

    while (!this.aborted && this.task.steps.length < this.task.maxSteps) {
      try {
        // Get page info if browser is available
        let pageUrl = ''
        let pageTitle = ''
        let pageText = ''
        let elementsBlock = ''

        if (browserBridge) {
          try {
            let pageInfo = await browserBridge.getPageInfo()

            // If main frame has no interactive elements, check iframes
            this.activeFrameId = undefined
            const tryIframes = async (): Promise<boolean> => {
              try {
                const frames = await browserBridge.getFrames()
                const childFrames = frames.filter(
                  (f) => f.parentId !== null && f.url.startsWith('http')
                )
                for (const frame of childFrames.slice(0, 3)) {
                  const frameInfo = await browserBridge.getPageInfo(frame.id)
                  if (frameInfo.elements.length > 0) {
                    pageInfo = frameInfo
                    this.activeFrameId = frame.id
                    return true
                  }
                }
              } catch {
                /* ignore */
              }
              return false
            }

            if (pageInfo.elements.length === 0) {
              if (!(await tryIframes())) {
                // SPA may still be mounting — wait once and retry
                await this.sleep(2500)
                pageInfo = await browserBridge.getPageInfo()
                if (pageInfo.elements.length === 0) await tryIframes()
              }
            }

            pageUrl = pageInfo.url
            pageTitle = pageInfo.title
            pageText = pageInfo.text.slice(0, 2800)
            elementsBlock =
              pageInfo.elements.length > 0
                ? `\n\nInteractive elements (use these exact selectors for click/type):\n${pageInfo.elements
                    .map(
                      (el) =>
                        `  ${el.selector}  ${el.text ? `| "${el.text.slice(0, 40)}${el.text.length > 40 ? '…' : ''}"` : ''}`
                    )
                    .join('\n')}`
                : ''
          } catch (e) {
            return this.finish(
              'failed',
              `getPageInfo failed: ${e instanceof Error ? e.message : String(e)}`
            )
          }
        }

        const stepIndex = this.task.steps.length
        let actionLog = ''
        if (stepIndex > 0) {
          const recentSteps = this.task.steps.slice(-8)
          actionLog =
            '\n\nRecent actions:\n' +
            recentSteps
              .map((s) => {
                let desc = s.action.type
                const resultSuffix = s.result ? ` → ${s.result.slice(0, 200)}` : ''
                const errorSuffix = s.error ? ` [ERROR: ${s.error.slice(0, 100)}]` : ''
                return `Step ${s.index + 1}: ${desc}${resultSuffix}${errorSuffix}`
              })
              .join('\n') +
            '\n\nDo NOT repeat actions that already succeeded.'
        }

        let turnText: string
        if (!browserBridge) {
          // No browser — API-only mode (e.g. Polymarket trading)
          turnText =
            stepIndex === 0
              ? `Task: ${this.executionPrompt}\n\nYou are in API-only mode. Use the polymarket_* actions directly. Do NOT use shell, navigate, or evaluate.`
              : `Step ${stepIndex + 1}.${actionLog}`
        } else {
          turnText =
            stepIndex === 0
              ? `Task: ${this.executionPrompt}\n\nCurrent page:\nURL: ${pageUrl}\nTitle: ${pageTitle}\nText: ${pageText}${elementsBlock}`
              : `Step ${stepIndex + 1}.\nURL: ${pageUrl}\nTitle: ${pageTitle}\nText: ${pageText}${elementsBlock}${actionLog}`
        }

        // Inject incoming messages from other tasks
        const inboxBlock = this.drainInbox()

        const turnContent: VisionMessage['content'] = [
          { type: 'input_text', text: turnText + inboxBlock }
        ]

        // After launch/native actions, include a screenshot so the model can see the app
        if (this.cdpNeedsScreenshot) {
          this.cdpNeedsScreenshot = false
          try {
            const wb = await this.getScreenBridge()
            const shot = await wb.captureScreen({ maxWidth: 1280, maxHeight: 720 })
            this.cdpScaleX = shot.scaleX
            this.cdpScaleY = shot.scaleY
            turnContent.push({
              type: 'input_image',
              image_url: `data:image/png;base64,${shot.buffer.toString('base64')}`
            })
          } catch {
            // non-critical — model continues without screenshot
          }
        }

        const turnMessage: VisionMessage = {
          role: 'user',
          content: turnContent
        }

        if (history.length > 20) {
          history.splice(1, history.length - 19)
        }
        history.push(turnMessage)

        const { text: rawResponse, usage } = await this.callVisionModel(systemPrompt, history)
        if (usage) this.addUsage(usage)
        const { thought, action } = parseModelResponse(rawResponse)

        history.push({
          role: 'assistant',
          content: [{ type: 'output_text', text: rawResponse }]
        })

        const step: TaskStep = {
          index: this.task.steps.length,
          timestamp: Date.now(),
          screenshotBase64: '',
          action,
          thought
        }

        if (action.type === 'done') {
          this.task.summary = action.summary
          this.task.steps.push(step)
          this.pushUpdate()
          browserBridge?.destroy()
          return this.finish('completed')
        }

        if (action.type === 'fail') {
          this.task.steps.push(step)
          this.pushUpdate()
          browserBridge?.destroy()
          return this.finish('failed', action.reason)
        }

        // Execute action
        try {
          const result = browserBridge
            ? await this.executeCdpAction(browserBridge, action)
            : await this.executeApiOnlyAction(action)
          if (result) step.result = result
        } catch (e) {
          step.error = e instanceof Error ? e.message : String(e)
        }

        this.task.steps.push(step)
        this.pushUpdate()
        await this.sleep(500)
      } catch (e) {
        if (this.aborted) break
        browserBridge?.destroy()
        return this.finish(
          'failed',
          `CDP loop error: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }

    browserBridge?.destroy()
    if (this.aborted) return this.finish('cancelled')
    return this.finish('failed', `Reached max steps (${this.task.maxSteps})`)
  }

  /**
   * Code mode — text-only agent loop. No bridge, no screenshots.
   * Uses shell commands and API actions only.
   */
  private async runCode(): Promise<Task> {
    // Set initial status immediately
    this.pushStatus(`Connecting to ${this.getProviderDisplayName()}...`)

    // Check if aborted before setting up timeout
    if (this.aborted) {
      return this.finish('cancelled')
    }

    this.timeoutHandle = setTimeout(() => {
      this.abort('Task timed out')
    }, this.task.timeoutMs)

    this.pushStatus('Preparing agent loop...')

    const systemPrompt = buildCodeSystemPrompt()
    const history: VisionMessage[] = []

    const memCtx = this.opts.memoryContext ?? ''
    history.push({
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: `Task: ${this.executionPrompt}${memCtx}\n\n[CODE MODE] You have NO screen access. Use file_read, file_write, file_edit, file_list, file_search, and shell to accomplish the task. Do NOT use click, scroll, move, or other screen actions.`
        }
      ]
    })

    while (!this.aborted && this.task.steps.length < this.task.maxSteps) {
      try {
        const stepIndex = this.task.steps.length
        let turnText: string
        if (stepIndex === 0) {
          turnText = `Task: ${this.executionPrompt}\n\n[CODE MODE] No screen. Use file_read/file_write/file_edit/file_list/file_search/shell/done/fail actions.`
        } else {
          const recentSteps = this.task.steps.slice(-8)
          const actionLog = recentSteps
            .map((s) => {
              const a = s.action
              let desc: string = a.type
              if (a.type === 'shell') desc = `shell "${(a as any).command?.slice(0, 80)}"`
              else if (a.type === 'file_read') desc = `file_read ${(a as any).path}`
              else if (a.type === 'file_write') desc = `file_write ${(a as any).path}`
              else if (a.type === 'file_edit') desc = `file_edit ${(a as any).path}`
              else if (a.type === 'file_list') desc = `file_list "${(a as any).pattern}"`
              else if (a.type === 'file_search') desc = `file_search "${(a as any).pattern}"`
              const resultSuffix = s.result ? ` → ${s.result.slice(0, 300)}` : ''
              const errorSuffix = s.error ? ` [ERROR: ${s.error.slice(0, 100)}]` : ''
              return `Step ${s.index + 1}: ${desc}${resultSuffix}${errorSuffix}`
            })
            .join('\n')
          turnText = `Step ${stepIndex + 1}.\n\nRecent actions:\n${actionLog}\n\nContinue with the next step.`
        }

        // Inject incoming messages from other tasks
        turnText += this.drainInbox()

        const turnMessage: VisionMessage = {
          role: 'user',
          content: [{ type: 'input_text', text: turnText }]
        }

        if (history.length > 20) {
          history.splice(1, history.length - 19)
        }
        history.push(turnMessage)

        const { text: rawResponse, usage } = await this.callVisionModel(systemPrompt, history)
        if (usage) this.addUsage(usage)
        const { thought, action } = parseModelResponse(rawResponse)

        history.push({
          role: 'assistant',
          content: [{ type: 'output_text', text: rawResponse }]
        })

        const step: TaskStep = {
          index: this.task.steps.length,
          timestamp: Date.now(),
          screenshotBase64: '',
          action,
          thought
        }

        if (action.type === 'done') {
          this.task.summary = action.summary
          this.task.steps.push(step)
          this.pushUpdate()
          return this.finish('completed')
        }

        if (action.type === 'fail') {
          this.task.steps.push(step)
          this.pushUpdate()
          return this.finish('failed', action.reason)
        }

        // In code mode, only allow non-visual actions
        if (['click', 'double_click', 'scroll', 'move'].includes(action.type)) {
          step.error = `Action "${action.type}" not available in code mode. Use shell commands instead.`
          this.task.steps.push(step)
          this.pushUpdate()
          await this.sleep(200)
          continue
        }

        // Execute action (shell, polymarket, web_scrape, etc.)
        try {
          const result = await this.executeCodeAction(action)
          if (result) step.result = result
        } catch (e) {
          step.error = e instanceof Error ? e.message : String(e)
        }

        this.task.steps.push(step)
        this.pushUpdate()
        await this.sleep(200)
      } catch (e) {
        if (this.aborted) break
        return this.finish(
          'failed',
          `Code loop error: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }

    if (this.aborted) return this.finish('cancelled')
    return this.finish('failed', `Reached max steps (${this.task.maxSteps})`)
  }

  /** Execute an action in code mode (no bridge needed). */
  private async executeCodeAction(action: TaskAction): Promise<string | undefined> {
    switch (action.type) {
      case 'shell':
        this.assertPolicy('cmd.run', 'shell')
        return this.executeShell(action.command, action.cwd, action.timeout)
      case 'wait':
        await this.sleep(action.ms)
        return undefined
      case 'web_scrape': {
        this.assertPolicy('net.http', 'web_scrape')
        const data = await scrapeUrl(action.url, action.instruction)
        if (data.includes('\t')) this.lastScrapeData += (this.lastScrapeData ? '\n' : '') + data
        return data
      }
      case 'save_to_excel': {
        if (!this.lastScrapeData) return '[Error: no data available. Use web_scrape first.]'
        try {
          const filePath = await createExcelFromTsv(
            this.lastScrapeData,
            action.filename,
            action.filter
          )
          return `Excel saved: ${filePath}`
        } catch (e) {
          return `[Error creating Excel: ${e instanceof Error ? e.message : String(e)}]`
        }
      }
      case 'launch':
        this.assertTaskCap('app.launch', 'launch')
        this.assertPolicy('cmd.run', 'launch')
        return this.executeShell(
          `powershell.exe -NoProfile -Command "Start-Process '${action.app}'"`
        )
      case 'polymarket_get_account_summary':
      case 'polymarket_get_trader_leaderboard':
      case 'polymarket_search_markets':
      case 'polymarket_place_order':
      case 'polymarket_close_position':
        this.assertTaskCap('polymarket.trading', action.type)
        this.assertPolicy('net.http', action.type)
        return this.executePolymarketAction(action)
      case 'file_read':
        this.assertPolicy('fs.read', 'file_read')
        return this.executeFileRead(action.path, action.offset, action.limit, action.cwd)
      case 'file_write':
        this.assertPolicy('fs.write', 'file_write')
        return this.executeFileWrite(action.path, action.content, action.cwd)
      case 'file_edit':
        this.assertPolicy('fs.read', 'file_edit')
        this.assertPolicy('fs.write', 'file_edit')
        return this.executeFileEdit(action.path, action.old_string, action.new_string, action.cwd)
      case 'file_list':
        this.assertPolicy('fs.read', 'file_list')
        return this.executeFileList(action.pattern, action.cwd)
      case 'file_search':
        this.assertPolicy('fs.read', 'file_search')
        return this.executeFileSearch(action.pattern, action.path, action.glob, action.cwd)
      case 'task_list_peers':
      case 'task_send':
      case 'task_read':
      case 'task_message':
        return this.executeInterTaskAction(action)
      default:
        return `[Action "${action.type}" not supported in code mode]`
    }
  }

  /** Read a file with line numbers (cat -n style). */
  private async executeFileRead(
    filePath: string,
    offset?: number,
    limit?: number,
    cwd?: string
  ): Promise<string> {
    const fs = await import('fs/promises')
    const resolved = this.resolveWorkspacePath(filePath, cwd)
    try {
      const content = await fs.readFile(resolved, 'utf-8')
      let lines = content.split('\n')
      const startLine = offset && offset > 0 ? offset - 1 : 0
      if (limit && limit > 0) {
        lines = lines.slice(startLine, startLine + limit)
      } else if (startLine > 0) {
        lines = lines.slice(startLine)
      }
      const numbered = lines.map((line, i) => `${String(startLine + i + 1).padStart(6)}\t${line}`)
      const result = numbered.join('\n')
      return result.length > 8000 ? result.slice(0, 8000) + '\n[... truncated]' : result
    } catch (e) {
      return `[Error reading ${resolved}: ${e instanceof Error ? e.message : String(e)}]`
    }
  }

  /** Write a file, creating intermediate dirs. */
  private async executeFileWrite(filePath: string, content: string, cwd?: string): Promise<string> {
    const fs = await import('fs/promises')
    const path = await import('path')
    const resolved = this.resolveWorkspacePath(filePath, cwd)
    try {
      await fs.mkdir(path.dirname(resolved), { recursive: true })
      await fs.writeFile(resolved, content, 'utf-8')
      return `File written: ${resolved} (${content.length} bytes)`
    } catch (e) {
      return `[Error writing ${resolved}: ${e instanceof Error ? e.message : String(e)}]`
    }
  }

  /** Search-and-replace in a file. Fails if old_string not found or not unique. */
  private async executeFileEdit(
    filePath: string,
    oldStr: string,
    newStr: string,
    cwd?: string
  ): Promise<string> {
    const fs = await import('fs/promises')
    const resolved = this.resolveWorkspacePath(filePath, cwd)
    try {
      const content = await fs.readFile(resolved, 'utf-8')
      const count = content.split(oldStr).length - 1
      if (count === 0) return `[Error: old_string not found in ${resolved}]`
      if (count > 1)
        return `[Error: old_string found ${count} times in ${resolved} — must be unique. Add more context.]`
      const updated = content.replace(oldStr, newStr)
      await fs.writeFile(resolved, updated, 'utf-8')
      return `File edited: ${resolved} (replaced 1 occurrence)`
    } catch (e) {
      return `[Error editing ${resolved}: ${e instanceof Error ? e.message : String(e)}]`
    }
  }

  /** List files matching a glob pattern using fd (fallback to find). */
  private async executeFileList(pattern: string, cwd?: string): Promise<string> {
    const { exec } = require('child_process') as typeof import('child_process')
    const execOpts = {
      timeout: 10_000,
      maxBuffer: 512 * 1024,
      cwd: this.resolveWorkspaceDir(cwd)
    }
    return new Promise((resolve) => {
      // Try fd first, fallback to find
      const fdCmd = `fd --type f --glob '${pattern.replace(/'/g, "'\\''")}'`
      exec(fdCmd, execOpts, (err, stdout) => {
        if (!err && stdout.trim()) {
          const result = stdout.trim()
          resolve(result.length > 6000 ? result.slice(0, 6000) + '\n[... truncated]' : result)
          return
        }
        // Fallback to find
        const findCmd = `find . -type f -name '${pattern.replace(/'/g, "'\\''")}'`
        exec(findCmd, execOpts, (err2, stdout2) => {
          if (err2) {
            resolve(`[Error listing files: ${err2.message}]`)
            return
          }
          const result = stdout2.trim() || '(no files found)'
          resolve(result.length > 6000 ? result.slice(0, 6000) + '\n[... truncated]' : result)
        })
      })
    })
  }

  /** Search file contents using rg (fallback to grep -rn). */
  private async executeFileSearch(
    pattern: string,
    searchPath?: string,
    glob?: string,
    cwd?: string
  ): Promise<string> {
    const { exec } = require('child_process') as typeof import('child_process')
    const execOpts = {
      timeout: 10_000,
      maxBuffer: 512 * 1024,
      cwd: this.resolveWorkspaceDir(cwd)
    }
    return new Promise((resolve) => {
      const escapedPattern = pattern.replace(/'/g, "'\\''")
      const dir = searchPath ? this.resolveWorkspaceDir(searchPath) : '.'
      const globFlag = glob ? ` --glob '${glob.replace(/'/g, "'\\''")}'` : ''
      const rgCmd = `rg -n --max-count 50 '${escapedPattern}' ${dir}${globFlag}`
      exec(rgCmd, execOpts, (err, stdout) => {
        if (!err || (err as any)?.code === 1) {
          const result = (stdout || '').trim() || '(no matches found)'
          resolve(result.length > 6000 ? result.slice(0, 6000) + '\n[... truncated]' : result)
          return
        }
        // Fallback to grep
        const grepGlob = glob ? ` --include='${glob.replace(/'/g, "'\\''")}'` : ''
        const grepCmd = `grep -rn '${escapedPattern}' ${dir}${grepGlob} | head -50`
        exec(grepCmd, execOpts, (err2, stdout2) => {
          if (err2 && !(err2 as any)?.code) {
            resolve(`[Error searching: ${err2.message}]`)
            return
          }
          const result = (stdout2 || '').trim() || '(no matches found)'
          resolve(result.length > 6000 ? result.slice(0, 6000) + '\n[... truncated]' : result)
        })
      })
    })
  }

  /** Lazy-init a WindowsBridge for hybrid CDP+screen actions (launch, file uploads). */
  private async getScreenBridge(): Promise<WindowsBridge> {
    if (!this.bridge || !this.bridge.isAlive) {
      this.bridge = new WindowsBridge()
      await this.bridge.init()
    }
    return this.bridge
  }

  /** Execute actions in API-only mode (no browser). Only polymarket + inter-task + wait/done/fail. */
  private async executeApiOnlyAction(action: TaskAction): Promise<string | undefined> {
    const type = action.type
    switch (type) {
      case 'polymarket_get_account_summary':
      case 'polymarket_get_trader_leaderboard':
      case 'polymarket_search_markets':
      case 'polymarket_place_order':
      case 'polymarket_close_position':
        this.assertTaskCap('polymarket.trading', action.type)
        this.assertPolicy('net.http', action.type)
        return this.executePolymarketAction(action)
      case 'task_list_peers':
      case 'task_send':
      case 'task_read':
      case 'task_message':
        return this.executeInterTaskAction(action)
      case 'wait':
        await this.sleep((action as any).ms ?? 1000)
        return undefined
      default:
        return `[Error: "${type}" is not available in API-only mode. Use polymarket_* actions.]`
    }
  }

  private async executeCdpAction(
    bridge: BrowserBridge,
    action: TaskAction
  ): Promise<string | undefined> {
    const raw = action as Record<string, unknown>
    const type = raw.type as string

    switch (type) {
      case 'navigate':
        this.assertTaskCap('browser.cdp', 'navigate')
        await bridge.navigate(raw.url as string)
        this.activeFrameId = undefined
        break
      case 'click':
        this.assertTaskCap('browser.cdp', 'click')
        if (raw.x != null && raw.y != null) {
          // Coordinate click → use screen bridge (after launch), scale to native resolution
          const wb = await this.getScreenBridge()
          const nx = Math.round((raw.x as number) * this.cdpScaleX)
          const ny = Math.round((raw.y as number) * this.cdpScaleY)
          await wb.click(nx, ny, (raw.button as 'left' | 'right') ?? 'left')
          this.cdpNeedsScreenshot = true
        } else {
          await bridge.click(raw.selector as string, this.activeFrameId)
        }
        break
      case 'type':
        this.assertTaskCap('browser.cdp', 'type')
        if (raw.selector) {
          await bridge.type(raw.selector as string, raw.text as string, this.activeFrameId)
        } else {
          // No selector → type via screen bridge (after launch)
          const wb = await this.getScreenBridge()
          await wb.type(raw.text as string)
          this.cdpNeedsScreenshot = true
        }
        break
      case 'key': {
        this.assertTaskCap('browser.cdp', 'key')
        if (this.cdpNeedsScreenshot || this.bridge?.isAlive) {
          // In screen mode after launch → use bridge for key combos
          const wb = await this.getScreenBridge()
          await wb.keyCombo((raw.combo as string) || (raw.key as string))
          this.cdpNeedsScreenshot = true
        } else {
          await bridge.pressKey((raw.key as string) || (raw.combo as string))
        }
        break
      }
      case 'pressKey':
        this.assertTaskCap('browser.cdp', 'pressKey')
        if (this.bridge?.isAlive) {
          const wb = await this.getScreenBridge()
          await wb.keyCombo(raw.key as string)
          this.cdpNeedsScreenshot = true
        } else {
          await bridge.pressKey(raw.key as string)
        }
        break
      case 'evaluate': {
        this.assertTaskCap('browser.cdp', 'evaluate')
        const evalResult = await bridge.evaluate(raw.script as string, this.activeFrameId)
        // If evaluate returns TSV data, accumulate into lastScrapeData so save_to_excel can use it
        if (evalResult && evalResult.includes('\t')) {
          if (this.lastScrapeData) {
            // Append rows only (skip header of subsequent evaluates)
            const newLines = evalResult.split('\n').filter((l) => l.includes('\t'))
            const existingHeader = this.lastScrapeData.split('\n')[0]
            const newRows = newLines.filter((l) => l !== existingHeader)
            if (newRows.length > 0) this.lastScrapeData += '\n' + newRows.join('\n')
          } else {
            this.lastScrapeData = evalResult
          }
        }
        return evalResult || undefined
      }
      case 'wait':
        await this.sleep((raw.ms as number) ?? 1000)
        break
      case 'launch': {
        this.assertTaskCap('app.launch', 'launch')
        // Hybrid: use WindowsBridge to launch native apps from CDP mode
        const wb = await this.getScreenBridge()
        await wb.launchApp(raw.app as string)
        this.cdpNeedsScreenshot = true
        return `Launched ${raw.app}. Next turn will include a screenshot of the screen.`
      }
      case 'web_scrape': {
        this.assertPolicy('net.http', 'web_scrape')
        const data = await scrapeUrl(raw.url as string, raw.instruction as string)
        if (data.includes('\t')) this.lastScrapeData += (this.lastScrapeData ? '\n' : '') + data
        return data
      }
      case 'save_to_excel': {
        if (!this.lastScrapeData)
          return '[Error: no data available. Use web_scrape or evaluate (returning TSV) first.]'
        try {
          const filePath = await createExcelFromTsv(
            this.lastScrapeData,
            raw.filename as string,
            raw.filter as string | undefined
          )
          return `Excel saved and opened: ${filePath}`
        } catch (e) {
          return `[Error creating Excel: ${e instanceof Error ? e.message : String(e)}. Data had ${this.lastScrapeData.split('\\n').length} lines.]`
        }
      }
      case 'polymarket_get_account_summary':
      case 'polymarket_get_trader_leaderboard':
      case 'polymarket_search_markets':
      case 'polymarket_place_order':
      case 'polymarket_close_position':
        this.assertTaskCap('polymarket.trading', action.type)
        this.assertPolicy('net.http', action.type)
        return this.executePolymarketAction(action)
      case 'task_list_peers':
      case 'task_send':
      case 'task_read':
      case 'task_message':
        return this.executeInterTaskAction(action)
      case 'shell':
      case 'file_read':
      case 'file_write':
      case 'file_edit':
        return `[Error: "${type}" is not available in browser mode. Use the built-in actions like polymarket_*, navigate, evaluate, etc.]`
    }
    return undefined
  }

  /**
   * Route vision call to the correct provider.
   */
  private async callVisionModel(
    systemPrompt: string,
    messages: VisionMessage[]
  ): Promise<{ text: string; usage?: { inputTokens: number; outputTokens: number } }> {
    this.assertPolicy('net.http', 'provider')
    switch (this.opts.provider) {
      case 'chatgpt':
        return {
          text: await codexVisionRespond({ systemPrompt, messages, sessionId: this.task.id })
        }
      case 'claude': {
        const { claudeVisionRespond } = await import('../providers/claude-vision')
        return { text: await claudeVisionRespond({ systemPrompt, messages }) }
      }
      case 'deepseek': {
        const { deepseekVisionRespond } = await import('../providers/deepseek-vision')
        return { text: await deepseekVisionRespond({ systemPrompt, messages }) }
      }
      case 'kimi': {
        const { kimiVisionRespond } = await import('../providers/kimi-vision')
        return kimiVisionRespond({ systemPrompt, messages })
      }
      case 'glm': {
        const { glmVisionRespond } = await import('../providers/glm-vision')
        return glmVisionRespond({ systemPrompt, messages })
      }
      case 'minimax': {
        const { minimaxVisionRespond } = await import('../providers/minimax-vision')
        return minimaxVisionRespond({ systemPrompt, messages })
      }
      case 'openrouter': {
        const { openrouterVisionRespond } = await import('../providers/openrouter-vision')
        return openrouterVisionRespond({ systemPrompt, messages })
      }
      case 'gemini': {
        const { geminiVisionRespond } = await import('../providers/gemini-vision')
        return geminiVisionRespond({ systemPrompt, messages })
      }
      default:
        throw new Error(`Unsupported provider: ${this.opts.provider}`)
    }
  }

  private addUsage(usage: { inputTokens: number; outputTokens: number }): void {
    if (!this.usageTotals) this.usageTotals = { inputTokens: 0, outputTokens: 0 }
    this.usageTotals.inputTokens += usage.inputTokens
    this.usageTotals.outputTokens += usage.outputTokens
    this.task.usage = { ...this.usageTotals }
  }

  /**
   * Cancel the task immediately.
   */
  abort(reason?: string): void {
    this.aborted = true
    if (reason) {
      this.task.error = reason
    }
    this.cleanup()
  }

  /** Handle inter-task communication actions. */
  private async executeInterTaskAction(action: TaskAction): Promise<string> {
    const tm = this.opts.taskManager
    if (!tm) return '[Error: task manager not available for inter-task communication]'

    switch (action.type) {
      case 'task_list_peers': {
        const all = tm.list()
        const peers = all
          .filter((t) => t.id !== this.opts.taskId)
          .map((t) => ({ id: t.id, prompt: t.prompt.slice(0, 120), status: t.status }))
        return JSON.stringify(peers)
      }
      case 'task_send': {
        const result = await tm.spawnAndWait(action.prompt, [...this.effectiveCaps], this.task.id)
        return `Sub-task ${result.taskId} finished: ${result.summary}`
      }
      case 'task_read': {
        const target = tm.get(action.taskId)
        if (!target) return `[Error: task ${action.taskId} not found]`
        return JSON.stringify({
          id: target.id,
          status: target.status,
          summary: target.summary ?? null
        })
      }
      case 'task_message': {
        try {
          tm.sendMessage(action.taskId, this.opts.taskId ?? this.task.id, action.message)
          return `Message sent to ${action.taskId}`
        } catch (e) {
          return `[Error: ${e instanceof Error ? e.message : String(e)}]`
        }
      }
      default:
        return '[Error: unknown inter-task action]'
    }
  }

  private executeShell(command: string, cwd?: string, timeoutMs?: number): Promise<string> {
    return new Promise((resolve) => {
      const { exec } = require('child_process') as typeof import('child_process')
      const timeout = Math.min(timeoutMs ?? 120_000, 300_000) // default 120s, max 5min
      const child = exec(
        command,
        { timeout, maxBuffer: 1024 * 1024, cwd: cwd || undefined },
        (err, stdout, stderr) => {
          const out = (stdout ?? '').toString().slice(0, 4000)
          const errOut = (stderr ?? '').toString().slice(0, 1000)
          if (err) {
            resolve(`[Exit ${err.code ?? 1}] ${errOut || err.message}\n${out}`.trim())
          } else {
            resolve(errOut ? `${out}\n[stderr] ${errOut}` : out || '(no output)')
          }
        }
      )
      child.stdin?.end()
    })
  }

  private async executePolymarketAction(action: TaskAction): Promise<string> {
    this.assertTaskCap('polymarket.trading', action.type)
    this.assertPolicy('net.http', action.type)
    const client = new PolymarketClient({ mode: 'live' })

    switch (action.type) {
      case 'polymarket_get_account_summary': {
        const summary = await client.getAccountSummary()
        const result =
          `Balance: $${summary.balanceUsd.toFixed(2)}, ${summary.positions.length} positions.` +
          (summary.positions.length > 0
            ? '\n' +
              summary.positions
                .map(
                  (p) =>
                    `  ${p.marketTitle} [${p.outcome}] ${p.sizeShares} shares @ $${p.avgPriceUsd.toFixed(2)}, PnL $${p.pnlUsd.toFixed(2)}`
                )
                .join('\n')
            : '')
        this.task.summary = `Polymarket: ${result}`
        return result
      }
      case 'polymarket_get_trader_leaderboard': {
        const traders = await client.getTopTraders({
          limit: 10,
          timePeriod: 'MONTH',
          category: 'OVERALL'
        })
        const top = traders
          .slice(0, 5)
          .map(
            (t) => `#${t.rank} ${t.userName || t.wallet.slice(0, 8)} PnL $${t.pnlUsd.toFixed(2)}`
          )
          .join('; ')
        const result = `Leaderboard (MONTH): ${top || 'no traders found'}.`
        this.task.summary = `Polymarket ${result}`
        return result
      }
      case 'polymarket_search_markets': {
        const raw = action as any
        const markets = await client.searchMarkets(raw.query, raw.limit ?? 5)
        if (markets.length === 0) return 'No markets found.'
        const result = markets
          .map((m) => {
            const tokens = m.tokens
              .map((t) => `${t.outcome}: ${t.tokenId} @ $${t.price.toFixed(3)}`)
              .join(', ')
            return `${m.title} | vol: $${m.volume.toFixed(0)} | tokens: [${tokens}]`
          })
          .join('\n')
        return result
      }
      case 'polymarket_place_order': {
        await client.placeOrder({
          tokenId: action.tokenId,
          side: action.side,
          price: action.price,
          size: action.size,
          tickSize: action.tickSize,
          negRisk: action.negRisk
        })
        return `Order placed (GTC): ${action.side} ${action.size} @ $${action.price} on ${action.tokenId.slice(0, 10)}... — order stays in book until filled.`
      }
      case 'polymarket_close_position': {
        if (!action.tokenId)
          return '[Error: tokenId is required. Use polymarket_get_account_summary to find your position tokenId first.]'
        await client.closePosition({
          tokenId: action.tokenId,
          size: action.size
        })
        return `Position closed: ${action.tokenId.slice(0, 10)}... size=${action.size ?? 'full'}`
      }
      default:
        return ''
    }
  }

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
    if (this.bridge) {
      this.bridge.destroy()
      this.bridge = null
    }
  }

  private pushUpdate(): void {
    this.task.updatedAt = Date.now()
    this.callbacks.onUpdate({ ...this.task })
  }

  /** Push a status message visible in the UI (stored in task.error temporarily while running). */
  private pushStatus(msg: string): void {
    this.task.summary = msg
    this.pushUpdate()
  }

  /** Drain inbox and return a text block to prepend to turnText, or empty string if no messages. */
  private drainInbox(): string {
    const tm = this.opts.taskManager
    if (!tm) return ''
    const msgs = tm.drainMessages(this.opts.taskId ?? this.task.id)
    if (msgs.length === 0) return ''
    const lines = msgs.map((m) => `  From ${m.from}: ${m.message}`).join('\n')
    return `\n\n[INCOMING MESSAGES]\n${lines}\n[/INCOMING MESSAGES]`
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private assertPolicy(id: keyof PolicyState['capabilities'], action: string): void {
    if (!this.policyCaps[id]) {
      throw new Error(`Policy denied: ${action} requires ${id}`)
    }
  }

  private assertTaskCap(id: TaskCapabilityId, action: string): void {
    if (!this.effectiveCaps.has(id)) {
      throw new Error(`Capability denied: ${action} requires ${id}`)
    }
  }

  private resolveWorkspacePath(userPath: string, cwd?: string): string {
    if (!this.workspaceRoot) {
      throw new Error('Policy denied: workspaceRoot is not set')
    }
    return resolveWithinWorkspace(this.workspaceRoot, userPath, cwd)
  }

  private resolveWorkspaceDir(userDir?: string): string {
    if (!this.workspaceRoot) {
      throw new Error('Policy denied: workspaceRoot is not set')
    }
    if (!userDir) return this.workspaceRoot
    // Reuse the same resolver but treat the input as a directory segment.
    return resolveWithinWorkspace(this.workspaceRoot, userDir)
  }

  getTask(): Task {
    return { ...this.task }
  }

  /**
   * Get a user-friendly display name for the provider.
   * Capitalizes the provider ID (e.g., 'kimi' -> 'Kimi', 'claude' -> 'Claude')
   */
  private getProviderDisplayName(): string {
    const provider = this.opts.provider
    return provider.charAt(0).toUpperCase() + provider.slice(1)
  }
}
