import type { Task, TaskStep } from '@skynul/shared'
import { useEffect, useMemo, useRef, useState } from 'react'

type AgentLabel = { name?: string; role?: string; strippedPrompt: string }

function parseAgentLabel(prompt: string): AgentLabel {
  const m = prompt.match(
    /^\s*\[(?<name>[^\]|]{1,32})(?:\|(?<role>[^\]]{1,32}))?\]\s*(?<rest>[\s\S]*)$/
  )
  if (!m || !m.groups) return { strippedPrompt: prompt }
  const name = m.groups.name?.trim()
  const role = m.groups.role?.trim()
  const strippedPrompt = (m.groups.rest ?? '').trim() || prompt
  return { name, role, strippedPrompt }
}

function inferRole(task: Task, parsed: AgentLabel | null): string {
  const fromTask = (task.agentRole ?? '').trim()
  if (fromTask) return fromTask
  const fromPrompt = (parsed?.role ?? '').trim()
  if (fromPrompt) return fromPrompt
  if (task.capabilities.includes('office.professional')) return 'Office'
  if (task.capabilities.includes('polymarket.trading')) return 'Trading'
  if (task.capabilities.includes('browser.cdp')) return 'Browser'
  if (task.capabilities.includes('app.launch')) return 'Apps'
  return task.mode === 'code' ? 'Code' : 'Agent'
}

function inferName(task: Task, parsed: AgentLabel | null, fallback: string): string {
  const fromTask = (task.agentName ?? '').trim()
  if (fromTask) return fromTask
  const fromPrompt = (parsed?.name ?? '').trim()
  if (fromPrompt) return fromPrompt
  return fallback
}

function defaultAgentName(role: string, seed: string): string {
  const pools: Record<string, string[]> = {
    Manager: ['Atlas', 'Kernel', 'Director', 'Control'],
    Browser: ['Orbit', 'Navigator', 'Relay', 'Pilot'],
    Copy: ['Quill', 'Copydesk', 'Scribe', 'Draft'],
    Design: ['Prism', 'Vector', 'Canvas', 'Studio'],
    Research: ['Glyph', 'Index', 'Scout', 'Signal'],
    QA: ['Aegis', 'Verifier', 'Audit', 'Gate'],
    Code: ['Forge', 'Compiler', 'Builder', 'Refactor'],
    Agent: ['Node', 'Module', 'Echo', 'Nova']
  }
  const pool = pools[role] ?? pools.Agent
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const idx = (h >>> 0) % pool.length
  return pool[idx]!
}

/** User-friendly label for the action. Returns null for technical actions that should be hidden. */
function formatAction(step: TaskStep): string | null {
  const a = step.action as Record<string, unknown>
  const type = a.type as string
  switch (type) {
    case 'navigate': {
      const url = (a.url as string) ?? ''
      try {
        return `Opening ${new URL(url).hostname}`
      } catch {
        return 'Opening page…'
      }
    }
    case 'launch':
      return `Opening ${a.app}`
    case 'done':
      return String(a.summary)
    case 'fail':
      return String(a.reason)
    // Technical actions — hide
    case 'evaluate':
    case 'click':
    case 'double_click':
    case 'type':
    case 'key':
    case 'pressKey':
    case 'scroll':
    case 'wait':
    case 'web_scrape':
    case 'shell':
    case 'user_message':
      return null
    default:
      return null
  }
}

function StepLine(props: { step: TaskStep }): React.JSX.Element {
  const { step } = props
  const hasError = !!step.error
  const time = new Date(step.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })
  const actionLabel = formatAction(step)

  const RESULT_TRUNCATE = 160
  const [expanded, setExpanded] = useState(false)
  const resultText = step.result ?? ''
  const isLong = resultText.length > RESULT_TRUNCATE
  const resultDisplay =
    !isLong || expanded ? resultText : resultText.slice(0, RESULT_TRUNCATE) + '…'

  return (
    <div className={`feedStep ${hasError ? 'feedStepError' : ''}`}>
      <span className="feedStepTime">{time}</span>
      {step.thought && <div className="feedStepThought">{step.thought}</div>}
      {actionLabel && <div className="feedStepAction">{actionLabel}</div>}
      {step.result && (
        <div
          className={`feedStepResult${isLong ? ' clickable' : ''}`}
          onClick={isLong ? () => setExpanded(!expanded) : undefined}
        >
          {resultDisplay}
          {isLong && <span className="feedResultToggle">{expanded ? ' ▲' : ' ▼'}</span>}
        </div>
      )}
      {step.error && <div className="feedStepErr">{step.error}</div>}
    </div>
  )
}

type Event =
  | { kind: 'user_prompt'; text: string }
  | { kind: 'spawn'; ts: number; taskId: string; text: string }
  | { kind: 'user_message'; ts: number; taskId: string; text: string }
  | { kind: 'step'; ts: number; taskId: string; step: TaskStep }

function buildDescendants(rootTaskId: string, tasks: Task[]): Task[] {
  const byId = new Map(tasks.map((t) => [t.id, t] as const))
  const isDesc = (t: Task): boolean => {
    if (t.id === rootTaskId) return true
    let cur: Task | undefined = t
    let hops = 0
    while (cur?.parentTaskId && hops < 50) {
      if (cur.parentTaskId === rootTaskId) return true
      cur = byId.get(cur.parentTaskId)
      hops++
    }
    return false
  }
  return tasks.filter(isDesc)
}

export function CollectiveChatFeed(props: { rootTask: Task; tasks: Task[] }): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scope = useMemo(() => {
    const all = buildDescendants(props.rootTask.id, props.tasks)
    const byId = new Map(all.map((t) => [t.id, t] as const))
    const root = byId.get(props.rootTask.id) ?? props.rootTask
    const subs = all.filter((t) => t.id !== root.id).sort((a, b) => a.createdAt - b.createdAt)
    return { root, subs, byId }
  }, [props.rootTask.id, props.tasks])

  const agents = useMemo(() => {
    const list = [scope.root, ...scope.subs]
    const map = new Map<string, { name: string; role: string; prompt: string }>()
    list.forEach((t) => {
      const parsed = parseAgentLabel(t.prompt)
      const role = inferRole(t, parsed)
      const fallbackName = defaultAgentName(t.id === scope.root.id ? 'Manager' : role, t.id)
      const name = inferName(t, parsed, fallbackName)
      map.set(t.id, { name, role, prompt: parsed.strippedPrompt })
    })
    return map
  }, [scope.root, scope.subs])

  const events = useMemo(() => {
    const ev: Event[] = []
    const rootParsed = parseAgentLabel(scope.root.prompt)
    ev.push({ kind: 'user_prompt', text: rootParsed.strippedPrompt })

    // Synthetic spawn events for subagents so you can see coordination kickoff.
    for (const t of scope.subs) {
      const info = agents.get(t.id)
      const label = info ? `@${info.name} (${info.role})` : t.id
      const parsed = parseAgentLabel(t.prompt)
      const brief =
        parsed.strippedPrompt.length > 140
          ? parsed.strippedPrompt.slice(0, 137) + '…'
          : parsed.strippedPrompt
      ev.push({ kind: 'spawn', ts: t.createdAt, taskId: t.id, text: `${label} spawned: ${brief}` })
    }

    const all = [scope.root, ...scope.subs]
    for (const t of all) {
      for (const s of t.steps) {
        const a = s.action as Record<string, unknown>
        if (a.type === 'user_message') {
          ev.push({
            kind: 'user_message',
            ts: s.timestamp,
            taskId: t.id,
            text: String(a.text ?? '')
          })
        } else {
          ev.push({ kind: 'step', ts: s.timestamp, taskId: t.id, step: s })
        }
      }
    }

    ev.sort((a, b) => {
      const ta = a.kind === 'user_prompt' ? scope.root.createdAt : a.ts
      const tb = b.kind === 'user_prompt' ? scope.root.createdAt : b.ts
      if (ta !== tb) return ta - tb
      const ida = a.kind === 'user_prompt' ? scope.root.id : a.taskId
      const idb = b.kind === 'user_prompt' ? scope.root.id : b.taskId
      if (ida !== idb) return ida.localeCompare(idb)
      if (a.kind === 'step' && b.kind === 'step') return a.step.index - b.step.index
      return a.kind.localeCompare(b.kind)
    })

    return ev
  }, [agents, scope.root, scope.subs])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [events.length])

  return (
    <div className="chatFeed" ref={scrollRef}>
      {(() => {
        const out: React.JSX.Element[] = []
        let batch: TaskStep[] = []
        let batchTaskId: string | null = null

        const flush = (key: string): void => {
          if (!batchTaskId || batch.length === 0) return
          const info = agents.get(batchTaskId)
          const label = info ? `@${info.name} (${info.role})` : batchTaskId
          out.push(
            <div key={key} className="feedBubble feedBubbleBot feedStepsBlock">
              <div className="cAgentHeader">{label}</div>
              {batch.map((s) => (
                <StepLine key={`${batchTaskId}-${s.index}`} step={s} />
              ))}
            </div>
          )
          batch = []
          batchTaskId = null
        }

        for (let i = 0; i < events.length; i++) {
          const e = events[i]

          if (e.kind === 'step') {
            if (!batchTaskId) batchTaskId = e.taskId
            if (batchTaskId !== e.taskId) {
              flush(`bot-flush-before-${e.taskId}-${e.step.index}`)
              batchTaskId = e.taskId
            }
            batch.push(e.step)
            continue
          }

          flush(`bot-flush-before-event-${i}`)

          if (e.kind === 'user_prompt') {
            out.push(
              <div key={`user-prompt-${i}`} className="feedBubble feedBubbleUser">
                {e.text}
              </div>
            )
            continue
          }

          if (e.kind === 'user_message') {
            out.push(
              <div key={`user-msg-${e.taskId}-${e.ts}-${i}`} className="feedBubble feedBubbleUser">
                {e.text}
              </div>
            )
            continue
          }

          if (e.kind === 'spawn') {
            out.push(
              <div key={`spawn-${e.taskId}-${e.ts}-${i}`} className="feedBubble feedBubbleBot">
                <div className="cFeedMeta">{e.text}</div>
              </div>
            )
          }
        }

        flush('bot-final')
        return out
      })()}
    </div>
  )
}
