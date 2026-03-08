import { useMemo } from 'react'
import type { Task } from '../../../shared/task'

type AgentLabel = { name?: string; role?: string; strippedPrompt: string }

function parseAgentLabel(prompt: string): AgentLabel {
  // Optional prefix convention:
  //   [Name|Role] rest...
  //   [Name] rest...
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

function fmtAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 10) return 'now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

const STATUS_LABEL: Record<string, string> = {
  pending_approval: 'Pending',
  approved: 'Approved',
  running: 'Running',
  completed: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled'
}

export function MultiAgentControlRoom(props: {
  rootTask: Task
  tasks: Task[]
  activeTaskId: string
  onSelectTask: (id: string) => void
}): React.JSX.Element {
  const { rootTask } = props

  const rootPrompt = useMemo(() => {
    const parsed = parseAgentLabel(rootTask.prompt)
    const text = parsed.strippedPrompt.trim()
    return text.length > 60 ? text.slice(0, 57) + '…' : text
  }, [rootTask.prompt])

  const grouped = useMemo(() => {
    const byId = new Map(props.tasks.map((t) => [t.id, t] as const))

    const isDescendantOfRoot = (t: Task): boolean => {
      if (t.id === rootTask.id) return true
      let cur: Task | undefined = t
      let hops = 0
      while (cur?.parentTaskId && hops < 50) {
        if (cur.parentTaskId === rootTask.id) return true
        cur = byId.get(cur.parentTaskId)
        hops++
      }
      return false
    }

    const all = props.tasks.filter(isDescendantOfRoot)
    const root = all.find((t) => t.id === rootTask.id) ?? rootTask
    const subs = all.filter((t) => t.id !== root.id).sort((a, b) => b.updatedAt - a.updatedAt)
    return [root, ...subs]
  }, [props.tasks, rootTask.id])

  return (
    <div className="maPanel" role="region" aria-label="Multi-agent control room">
      <div className="maTop">
        <div className="maTitle">Multi-Agent Control Room</div>
        <div className="maMeta">
          <span className="maMetaPill" title={rootTask.id}>
            Root: {rootPrompt || rootTask.id}
          </span>
          <span className="maMetaPill">Agents: {Math.max(1, grouped.length)}</span>
        </div>
      </div>

      <div className="maRow" role="list">
        {grouped.map((t, idx) => {
          const parsed = parseAgentLabel(t.prompt)
          const role = inferRole(t, parsed)
          const fallbackName = defaultAgentName(t.id === rootTask.id ? 'Manager' : role, t.id)
          const name = inferName(t, parsed, fallbackName)
          const isActive = t.id === props.activeTaskId
          const status = STATUS_LABEL[t.status] ?? t.status
          const isTransmitting = t.status === 'running' && t.steps.length > 0
          return (
            <div key={t.id} className="maCardWrapper" style={{ animationDelay: `${idx * 120}ms` }}>
              {/* Cable connector between cards */}
              {idx > 0 && (
                <div className={`maCable ${isTransmitting ? 'transmitting' : ''}`}>
                  <div className="maCableLine" />
                  {isTransmitting && <div className="maCablePulse" />}
                </div>
              )}
              <button
                className={`maCard ${isActive ? 'active' : ''}`}
                onClick={() => props.onSelectTask(t.id)}
                role="listitem"
                title={parsed.strippedPrompt}
              >
                <div className="maCardTop">
                  <div className="maName">@{name}</div>
                  <div className="maRole">{role}</div>
                </div>
                <div className="maCardBottom">
                  <span className={`maStatus ${t.status}`}>{status}</span>
                  <span className="maTiny">{t.steps.length} steps</span>
                  <span className="maTiny">{fmtAgo(t.updatedAt)}</span>
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
