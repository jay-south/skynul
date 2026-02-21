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

import type { Task, TaskAction, TaskStep } from '../../shared/task'
import type { ProviderId } from '../../shared/policy'
import { WindowsBridge } from './windows-bridge'
import { buildSystemPrompt } from './system-prompt'
import { parseModelResponse } from './action-parser'
import { openaiVisionRespond } from '../providers/openai-vision'
import { codexVisionRespond, type VisionMessage } from '../providers/codex-vision'
import { getSecret } from '../secret-store'

export type TaskRunnerCallbacks = {
  onUpdate: (task: Task) => void
}

export type TaskRunnerOpts = {
  provider: ProviderId
  openaiModel: string
}

export class TaskRunner {
  private bridge: WindowsBridge | null = null
  private aborted = false
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null
  private task: Task

  constructor(
    task: Task,
    private opts: TaskRunnerOpts,
    private callbacks: TaskRunnerCallbacks
  ) {
    this.task = { ...task }
  }

  /**
   * Run the agent loop. Resolves when the task is done, failed, or cancelled.
   */
  async run(): Promise<Task> {
    // Validate provider auth before starting
    if (this.opts.provider === 'openai') {
      const apiKey = await getSecret('openai.apiKey')
      if (!apiKey) {
        return this.finish('failed', 'OpenAI API key is not set')
      }
    }
    // For chatgpt provider, codexVisionRespond checks tokens internally

    // Setup timeout
    this.timeoutHandle = setTimeout(() => {
      this.abort('Task timed out')
    }, this.task.timeoutMs)

    // Create bridge — push status so UI knows what's happening
    this.pushStatus('Initializing Windows bridge...')
    this.bridge = new WindowsBridge()
    try {
      await this.bridge.init()
    } catch (e) {
      this.cleanup()
      return this.finish('failed', `Failed to start Windows bridge: ${e instanceof Error ? e.message : String(e)}`)
    }
    this.pushStatus('Bridge ready. Starting agent loop...')

    const systemPrompt = buildSystemPrompt(this.task.capabilities)
    const history: VisionMessage[] = []

    // Initial user message with the task prompt
    history.push({
      role: 'user',
      content: [{ type: 'input_text', text: `Task: ${this.task.prompt}` }]
    })

    // Agent loop
    while (!this.aborted && this.task.steps.length < this.task.maxSteps) {
      try {
        // 1. Capture screenshot
        // Recovery: if bridge died, try to restart once
        if (!this.bridge?.isAlive) {
          try {
            this.bridge = new WindowsBridge()
            await this.bridge.init()
          } catch (e) {
            return this.finish('failed', `Bridge recovery failed: ${e instanceof Error ? e.message : String(e)}`)
          }
        }

        let screenshotBuf: Buffer
        let scaleX = 1
        let scaleY = 1
        try {
          const shot = await this.bridge.captureScreen({ maxWidth: 900, maxHeight: 506 })
          screenshotBuf = shot.buffer
          scaleX = shot.scaleX
          scaleY = shot.scaleY
        } catch (e) {
          return this.finish('failed', `Screenshot failed: ${e instanceof Error ? e.message : String(e)}`)
        }

        const screenshotBase64 = screenshotBuf.toString('base64')
        const dataUrl = `data:image/png;base64,${screenshotBase64}`

        // 2. Build message with screenshot
        const stepIndex = this.task.steps.length
        let turnText: string
        if (stepIndex === 0) {
          turnText = `Task: ${this.task.prompt}\n\nHere is the current screenshot:`
        } else {
          // Include a compact log of the last 8 actions so the model remembers what it already did
          const recentSteps = this.task.steps.slice(-8)
          const actionLog = recentSteps.map((s) => {
            const a = s.action
            let desc: string = a.type
            if (a.type === 'click' || a.type === 'double_click') desc = `${a.type}(${a.x},${a.y})`
            else if (a.type === 'type') desc = `type "${a.text.slice(0, 60)}${a.text.length > 60 ? '…' : ''}"`
            else if (a.type === 'key') desc = `key ${a.combo}`
            else if (a.type === 'scroll') desc = `scroll ${a.direction}`
            else if (a.type === 'wait') desc = `wait ${a.ms}ms`
            else if (a.type === 'launch') desc = `launch ${a.app}`
            return `Step ${s.index + 1}: ${desc}${s.thought ? ` — ${s.thought.slice(0, 80)}` : ''}`
          }).join('\n')
          turnText = `Step ${stepIndex + 1}. Here is the current screenshot.\n\nRecent actions taken:\n${actionLog}\n\nDo NOT repeat actions that already succeeded. Continue with the next logical step.`
        }

        const turnMessage: VisionMessage = {
          role: 'user',
          content: [
            { type: 'input_text', text: turnText },
            { type: 'input_image', image_url: dataUrl }
          ]
        }

        // Keep history manageable — last 10 turns
        if (history.length > 20) {
          history.splice(1, history.length - 19)
        }

        history.push(turnMessage)

        // 3. Send to model — route by active provider
        const rawResponse = await this.callVisionModel(systemPrompt, history)

        // 4. Parse action
        const { thought, action } = parseModelResponse(rawResponse)

        // Record assistant response in history (Responses API requires output_text for assistant)
        history.push({
          role: 'assistant',
          content: [{ type: 'output_text', text: rawResponse }]
        })

        // 5. Create step
        const step: TaskStep = {
          index: this.task.steps.length,
          timestamp: Date.now(),
          screenshotBase64,
          action,
          thought
        }

        // 6. Check capability before executing
        const capError = this.checkCapability(action)
        if (capError) {
          step.error = capError
          this.task.steps.push(step)
          this.pushUpdate()
          return this.finish('failed', capError)
        }

        // 7. Execute action
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

        try {
          await this.executeAction(action, scaleX, scaleY)
        } catch (e) {
          step.error = e instanceof Error ? e.message : String(e)
        }

        this.task.steps.push(step)
        this.pushUpdate()

        // Small delay between actions to let the UI update
        await this.sleep(200)
      } catch (e) {
        if (this.aborted) break
        return this.finish('failed', `Agent loop error: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    if (this.aborted) {
      return this.finish('cancelled')
    }

    return this.finish('failed', `Reached max steps (${this.task.maxSteps})`)
  }

  /**
   * Route vision call to the correct provider.
   */
  private async callVisionModel(
    systemPrompt: string,
    messages: VisionMessage[]
  ): Promise<string> {
    if (this.opts.provider === 'chatgpt') {
      return codexVisionRespond({ systemPrompt, messages, sessionId: this.task.id })
    }

    // OpenAI direct API
    const apiKey = await getSecret('openai.apiKey')
    if (!apiKey) throw new Error('OpenAI API key is not set')

    return openaiVisionRespond({
      apiKey,
      model: this.opts.openaiModel,
      systemPrompt,
      messages
    })
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

  private checkCapability(action: TaskAction): string | null {
    const caps = new Set(this.task.capabilities)

    switch (action.type) {
      case 'click':
      case 'double_click':
      case 'scroll':
      case 'move':
        if (!caps.has('input.mouse')) return `Action "${action.type}" requires input.mouse capability`
        break
      case 'type':
      case 'key':
        if (!caps.has('input.keyboard')) return `Action "${action.type}" requires input.keyboard capability`
        break
      case 'launch':
        if (!caps.has('app.launch')) return `Action "${action.type}" requires app.launch capability`
        break
      case 'wait':
      case 'done':
      case 'fail':
        break // always allowed
    }

    return null
  }

  private async executeAction(action: TaskAction, scaleX: number, scaleY: number): Promise<void> {
    if (!this.bridge) throw new Error('Bridge not available')

    // Helper: map model coords (screenshot space) → native screen coords
    const sx = (x: number) => Math.round(x * scaleX)
    const sy = (y: number) => Math.round(y * scaleY)

    switch (action.type) {
      case 'click':
        await this.bridge.click(sx(action.x), sy(action.y), action.button ?? 'left')
        break
      case 'double_click':
        await this.bridge.doubleClick(sx(action.x), sy(action.y))
        break
      case 'type':
        await this.bridge.type(action.text)
        break
      case 'key':
        await this.bridge.keyCombo(action.combo)
        break
      case 'scroll': {
        const clicks = action.direction === 'up' ? (action.amount ?? 3) : -(action.amount ?? 3)
        await this.bridge.scroll(sx(action.x), sy(action.y), clicks)
        break
      }
      case 'move':
        await this.bridge.moveMouse(sx(action.x), sy(action.y))
        break
      case 'launch':
        await this.bridge.launchApp(action.app)
        break
      case 'wait':
        await this.sleep(action.ms)
        break
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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  getTask(): Task {
    return { ...this.task }
  }
}
