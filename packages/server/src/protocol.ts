import type {
  ProviderId,
  Task,
  TaskCapabilityId,
  TaskMode,
  TaskSource,
  TaskStep
} from '@skynul/shared'

// ── Sidecar → Rust (stdout) ──────────────────────────────────────────────────

export type SidecarOutput =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | {
      type: 'task_update'
      task_id: string
      status: Task['status']
      message?: string
      step?: TaskStep
      summary?: string
    }
  | { type: 'channel_incoming'; source: TaskSource; chat_id: string; text: string }

// ── Rust → Sidecar (stdin) ───────────────────────────────────────────────────

export type SidecarInput =
  | { type: 'init'; config: InitConfig }
  | { type: 'execute'; task: TaskInput; provider: ProviderConfig }
  | { type: 'message'; task_id: string; message: string }
  | { type: 'cancel'; task_id: string }

export type InitConfig = {
  channels?: Record<string, ChannelInit>
}

export type ChannelInit = {
  enabled: boolean
  credentials: Record<string, string>
}

export type TaskInput = {
  id: string
  prompt: string
  attachments?: string[]
  mode: TaskMode
  capabilities: TaskCapabilityId[]
  maxSteps: number
  timeoutMs: number
  source?: TaskSource
}

export type ProviderConfig = {
  id: ProviderId
  model: string
  apiKey?: string
}

// ── I/O helpers ──────────────────────────────────────────────────────────────

export function writeOutput(output: SidecarOutput): void {
  process.stdout.write(`${JSON.stringify(output)}\n`)
}

export function readInput(): Promise<SidecarInput> {
  return new Promise((resolve, reject) => {
    const handler = (data: Buffer) => {
      process.stdin.removeListener('data', handler)
      try {
        resolve(JSON.parse(data.toString()))
      } catch (e) {
        reject(e)
      }
    }
    process.stdin.once('data', handler)
  })
}

export function startInputLoop(onInput: (input: SidecarInput) => void): void {
  let buffer = ''
  process.stdin.on('data', (chunk: Buffer) => {
    buffer += chunk.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.trim()) {
        try {
          onInput(JSON.parse(line))
        } catch {
          writeOutput({ type: 'error', message: `parse error: ${line.slice(0, 200)}` })
        }
      }
    }
  })
}
