// ── Task Capability IDs ───────────────────────────────────────────────────────

export type TaskCapabilityId =
  | 'screen.read'
  | 'input.mouse'
  | 'input.keyboard'
  | 'app.launch'
  | 'browser.cdp'

export const ALL_TASK_CAPABILITIES: Array<{
  id: TaskCapabilityId
  title: string
  desc: string
}> = [
  { id: 'screen.read', title: 'Screen Capture', desc: 'Take screenshots of your display.' },
  { id: 'input.mouse', title: 'Mouse Control', desc: 'Click, scroll, and move the cursor.' },
  { id: 'input.keyboard', title: 'Keyboard Input', desc: 'Type text and send key combos.' },
  { id: 'app.launch', title: 'Launch Apps', desc: 'Open applications on your computer.' },
  { id: 'browser.cdp', title: 'Browser (CDP)', desc: 'Control Chrome via extension relay (no screenshots).' }
]

// ── Task Status Flow ──────────────────────────────────────────────────────────
// pending_approval → approved → running → completed | failed | cancelled

export type TaskStatus =
  | 'pending_approval'
  | 'approved'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

// ── Task Actions (model output) ───────────────────────────────────────────────

export type TaskAction =
  | { type: 'click'; x: number; y: number; button?: 'left' | 'right' | 'middle' }
  | { type: 'double_click'; x: number; y: number }
  | { type: 'type'; text: string }
  | { type: 'key'; combo: string }
  | { type: 'scroll'; x: number; y: number; direction: 'up' | 'down'; amount?: number }
  | { type: 'move'; x: number; y: number }
  | { type: 'launch'; app: string }
  | { type: 'wait'; ms: number }
  | { type: 'done'; summary: string }
  | { type: 'fail'; reason: string }

// ── Task Step (one turn of the agent loop) ────────────────────────────────────

export type TaskStep = {
  index: number
  timestamp: number
  /** Base64 PNG screenshot taken before this action. */
  screenshotBase64: string
  /** Action the model decided on. */
  action: TaskAction
  /** Model reasoning / thought (optional). */
  thought?: string
  /** Error if action execution failed. */
  error?: string
}

// ── Task (the top-level entity) ───────────────────────────────────────────────

export type Task = {
  id: string
  prompt: string
  status: TaskStatus
  capabilities: TaskCapabilityId[]
  steps: TaskStep[]
  createdAt: number
  updatedAt: number
  /** Max steps before auto-stopping. */
  maxSteps: number
  /** Hard timeout in ms. */
  timeoutMs: number
  /** Error message if failed. */
  error?: string
  /** Summary from the model when done. */
  summary?: string
}

// ── IPC payloads ──────────────────────────────────────────────────────────────

export type TaskCreateRequest = {
  prompt: string
  capabilities: TaskCapabilityId[]
  maxSteps?: number
  timeoutMs?: number
}

export type TaskCreateResponse = {
  task: Task
}

export type TaskApproveRequest = {
  taskId: string
}

export type TaskCancelRequest = {
  taskId: string
}

export type TaskGetRequest = {
  taskId: string
}

export type TaskListResponse = {
  tasks: Task[]
}

/** Push event payload sent from main → renderer. */
export type TaskUpdateEvent = {
  task: Task
}
