// ── Task Capability IDs ───────────────────────────────────────────────────────

export type TaskCapabilityId =
  | 'screen.read'
  | 'input.mouse'
  | 'input.keyboard'
  | 'app.launch'
  | 'browser.cdp'
  | 'polymarket.trading'
  | 'office.professional'

export const ALL_TASK_CAPABILITIES: Array<{
  id: TaskCapabilityId
  title: string
  desc: string
}> = [
  { id: 'screen.read', title: 'Screen Capture', desc: 'Take screenshots of your display.' },
  { id: 'input.mouse', title: 'Mouse Control', desc: 'Click, scroll, and move the cursor.' },
  { id: 'input.keyboard', title: 'Keyboard Input', desc: 'Type text and send key combos.' },
  { id: 'app.launch', title: 'Launch Apps', desc: 'Open applications on your computer.' },
  { id: 'browser.cdp', title: 'Browser (CDP)', desc: 'Control Chrome via extension relay (no screenshots).' },
  {
    id: 'polymarket.trading',
    title: 'Polymarket Trading',
    desc: 'Trade on Polymarket via a dedicated API client (no screen control).'
  },
  {
    id: 'office.professional',
    title: 'Office Pro',
    desc: 'Professional formatting expertise for Excel, Word, and PowerPoint.'
  }
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
  // Desktop / screen agent actions
  | { type: 'click'; x: number; y: number; button?: 'left' | 'right' | 'middle' }
  | { type: 'double_click'; x: number; y: number }
  | { type: 'type'; text: string }
  | { type: 'key'; combo: string }
  | { type: 'scroll'; x: number; y: number; direction: 'up' | 'down'; amount?: number }
  | { type: 'move'; x: number; y: number }
  | { type: 'launch'; app: string }
  | { type: 'wait'; ms: number }
  | { type: 'web_scrape'; url: string; instruction: string }
  | { type: 'save_to_excel'; filename: string; filter?: string }
  | { type: 'done'; summary: string }
  | { type: 'fail'; reason: string }
  // Polymarket trading actions (require polymarket.trading capability)
  | { type: 'polymarket_get_account_summary' }
  | { type: 'polymarket_get_trader_leaderboard' }
  | { type: 'polymarket_search_markets'; query: string; limit?: number }
  | {
      type: 'polymarket_place_order'
      tokenId: string
      side: 'buy' | 'sell'
      price: number
      size: number
      tickSize?: string
      negRisk?: boolean
    }
  | {
      type: 'polymarket_close_position'
      tokenId: string
      size?: number
    }

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
  /** Result text from API actions (polymarket, etc.). */
  result?: string
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
