import type { Task } from '@skynul/shared'

// ── Cross-cutting context (available in all modes) ──────────────────────────

export type ActionContext = {
  task: Task
  taskId: string
  pushUpdate: () => void
}

// ── Browser-mode context ────────────────────────────────────────────────────

export type BrowserEngineHandle = {
  navigate: (url: string) => Promise<void>
  click: (selector: string, frameId?: string) => Promise<void>
  type: (selector: string, text: string, frameId?: string) => Promise<void>
  pressKey: (key: string) => Promise<void>
  evaluate: (script: string, frameId?: string) => Promise<string | undefined>
  uploadFile: (selector: string, filePaths: string[], frameId?: string) => Promise<void>
  snapshot: () => Promise<{ url: string; title: string; snapshot: string }>
}

export type BrowserContext = ActionContext & { engine: BrowserEngineHandle }

// ── Code-mode context ───────────────────────────────────────────────────────

export type CodeContext = ActionContext & {
  appBridge: {
    run: (app: string, script: string) => Promise<{ ok: boolean; output?: string; error?: string }>
  }
  shell: (command: string, cwd?: string, timeoutMs?: number) => Promise<string>
  scrapeUrl: (url: string, instruction?: string) => Promise<string>
  getLastScrapeData: () => string
  setLastScrapeData: (data: string) => void
}
