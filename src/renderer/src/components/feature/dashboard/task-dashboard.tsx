import type { Task } from '@skynul/shared'
import { useEffect, useMemo, useState } from 'react'
import { ContentCard } from '@/components/content-card'
import { useRuntimeStats } from '@/queries/runtime/hooks'
import { useSchedules } from '@/queries/schedules/hooks'
import { useTasks } from '@/queries/tasks/hooks'

const STATUS_COLOR: Record<string, string> = {
  running: 'var(--nb-accent-2)',
  completed: 'var(--nb-accent-2)',
  failed: 'var(--nb-danger)',
  pending: 'var(--nb-warning, #f0a030)',
  cancelled: 'var(--nb-muted)'
}

const STATUS_LABEL: Record<string, string> = {
  running: 'Running',
  completed: 'Done',
  failed: 'Failed',
  pending: 'Pending',
  cancelled: 'Cancelled',
  approved: 'Starting'
}

function StatCard(props: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl bg-nb-panel border border-nb-border px-4 py-3.5 text-center">
      <div className="text-2xl font-semibold text-nb-text leading-none">{props.value}</div>
      <div className="text-[11px] text-nb-muted mt-1.5 uppercase tracking-[0.04em] font-medium">
        {props.label}
      </div>
      {props.sub && <div className="text-[10px] text-nb-muted/60 mt-0.5">{props.sub}</div>}
    </div>
  )
}

export function TaskDashboard(): React.JSX.Element {
  const { data: runtime } = useRuntimeStats()

  const runtimeCards = useMemo(() => {
    if (!runtime) return null
    const cards: React.JSX.Element[] = []
    if (runtime.app) {
      cards.push(
        <StatCard
          key="cpu"
          label="CPU"
          value={`${runtime.app.cpuPercent.toFixed(1)}%`}
          sub="agent"
        />
      )
      cards.push(
        <StatCard key="ram" label="RAM" value={`${runtime.app.memoryMB} MB`} sub="heap used" />
      )
    }
    if (runtime.system) {
      cards.push(
        <StatCard
          key="free"
          label="Free RAM"
          value={`${runtime.system.freeMemMB} MB`}
          sub="system"
        />
      )
    }
    return cards
  }, [runtime])

  return (
    <div className="flex flex-col gap-5">
      {runtimeCards && <div className="grid grid-cols-3 gap-3">{runtimeCards}</div>}

      <ActiveAgentsSection />
      <RecentTasksSection />
      <SchedulesSection />
    </div>
  )
}

function ActiveAgentsSection(): React.JSX.Element {
  const [tasks, setTasks] = useState<Task[]>([])
  const [agentDetailsId, setAgentDetailsId] = useState<string | null>(null)
  const [scheduleDetailsId, setScheduleDetailsId] = useState<string | null>(null)

  useEffect(() => {
    const wsUrl = `ws://localhost:${import.meta.env.VITE_SKYNUL_PORT ?? '3141'}/ws`
    let ws: WebSocket | null = new WebSocket(wsUrl)
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as { type: string; payload: { task: Task } }
        if (msg.type === 'task:update' && msg.payload?.task) {
          setTasks((prev) => {
            const idx = prev.findIndex((t) => t.id === msg.payload.task.id)
            if (idx >= 0) {
              const next = [...prev]
              next[idx] = msg.payload.task
              return next
            }
            return [...prev, msg.payload.task]
          })
        }
      } catch {
        /* ignore */
      }
    }
    ws.onclose = () => {
      ws = null
    }
    return () => {
      ws?.close()
    }
  }, [])

  const activeTasks = tasks.filter((t) => t.status === 'running' || t.status === 'pending')
  const selectedAgent = agentDetailsId ? (tasks.find((t) => t.id === agentDetailsId) ?? null) : null
  const selectedSubAgents: Task[] = []

  return (
    <ContentCard title="Active Agents">
      {activeTasks.length === 0 ? (
        <div className="flex items-center gap-2 py-1">
          <span className="size-1.5 rounded-full bg-nb-muted/40" />
          <span className="text-xs text-nb-muted">No active agents · All quiet</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {activeTasks.slice(0, 3).map((task) => (
            <AgentCard
              key={task.id}
              task={task}
              tasks={tasks}
              onSelect={(id) => setAgentDetailsId(id)}
              onScheduleSelect={(id) => setScheduleDetailsId(id)}
              isActive={agentDetailsId === task.id}
            />
          ))}
        </div>
      )}

      {selectedAgent && (
        <AgentDetailPanel
          task={selectedAgent}
          subAgents={selectedSubAgents}
          tasks={tasks}
          onClose={() => setAgentDetailsId(null)}
          onScheduleSelect={(id) => setScheduleDetailsId(id)}
        />
      )}
      {scheduleDetailsId && (
        <ScheduleDetailPanel
          scheduleId={scheduleDetailsId}
          onClose={() => setScheduleDetailsId(null)}
        />
      )}
    </ContentCard>
  )
}

function AgentCard(props: {
  task: Task
  tasks: Task[]
  onSelect: (id: string) => void
  onScheduleSelect: (id: string) => void
  isActive: boolean
}): React.JSX.Element {
  return (
    <div
      className={`border border-nb-border rounded-xl bg-nb-panel-2 p-3 flex flex-col gap-2.5 ${props.isActive ? 'ring-2 ring-nb-accent-2/20' : ''}`}
    >
      <div className="flex-1">
        <div className="text-xs font-medium text-nb-text leading-relaxed line-clamp-2">
          {props.task.prompt}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-nb-muted items-center">
          <span className="flex items-center gap-1">
            <span
              className="size-1.5 rounded-full shrink-0"
              style={{ backgroundColor: STATUS_COLOR[props.task.status] ?? 'var(--nb-muted)' }}
            />
            {STATUS_LABEL[props.task.status] ?? props.task.status}
          </span>
          <span>
            {props.task.steps.length} {props.task.steps.length === 1 ? 'step' : 'steps'}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {props.task.capabilities.slice(0, 2).map((c) => (
            <span
              key={c}
              className="text-[10px] px-2 py-0.5 rounded-full border border-nb-border bg-nb-panel text-nb-muted"
            >
              {c}
            </span>
          ))}
          {props.task.capabilities.length > 2 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-nb-border bg-nb-panel text-nb-muted">
              +{props.task.capabilities.length - 2}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => props.onSelect(props.task.id)}
          className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-nb-panel border border-nb-border cursor-pointer text-nb-text hover:bg-nb-accent-2/10 transition-colors shrink-0"
        >
          Details
        </button>
      </div>
    </div>
  )
}

function AgentDetailPanel(props: {
  task: Task
  subAgents: Task[]
  tasks: Task[]
  onClose: () => void
  onScheduleSelect: (id: string) => void
}): React.JSX.Element {
  return (
    <div className="mt-3 border border-nb-border rounded-xl bg-nb-panel-2 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-nb-text m-0">Agent Details</h3>
        <button
          type="button"
          onClick={props.onClose}
          className="text-[11px] text-nb-muted px-2 py-1 rounded-md bg-nb-panel border border-nb-border cursor-pointer hover:text-nb-text transition-colors"
        >
          Close
        </button>
      </div>
      <div className="text-xs text-nb-muted leading-relaxed">Prompt: {props.task.prompt}</div>
      <div className="text-[11px] text-nb-muted">
        Status:{' '}
        <span className="font-medium text-nb-text">
          {STATUS_LABEL[props.task.status] ?? props.task.status}
        </span>
      </div>
      {props.task.error && (
        <div className="text-[11px] text-nb-danger bg-nb-danger/10 border border-nb-danger/20 rounded-lg px-3 py-2">
          Error: {props.task.error}
        </div>
      )}
    </div>
  )
}

function ScheduleDetailPanel(props: {
  scheduleId: string
  onClose: () => void
}): React.JSX.Element {
  return (
    <div className="mt-3 border border-nb-border rounded-xl bg-nb-panel-2 p-4 flex items-center justify-between">
      <span className="text-xs text-nb-muted">Schedule: {props.scheduleId}</span>
      <button
        type="button"
        onClick={props.onClose}
        className="text-[11px] text-nb-muted px-2 py-1 rounded-md bg-nb-panel border border-nb-border cursor-pointer hover:text-nb-text transition-colors"
      >
        Close
      </button>
    </div>
  )
}

function RecentTasksSection(): React.JSX.Element {
  const { data: tasks = [] } = useTasks()
  const recent = tasks.slice(0, 5)
  return (
    <ContentCard title="Recent Tasks">
      {recent.length === 0 ? (
        <div className="flex items-center gap-2 py-1">
          <span className="size-1.5 rounded-full bg-nb-muted/40" />
          <span className="text-xs text-nb-muted">No tasks yet</span>
        </div>
      ) : (
        <div className="flex flex-col gap-px">
          {recent.map((t) => (
            <button
              key={t.id}
              type="button"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-none border-none text-nb-text cursor-pointer text-left w-full font-inherit transition-colors duration-100 hover:bg-nb-panel"
            >
              <span
                className="size-1.5 rounded-full shrink-0"
                style={{ backgroundColor: STATUS_COLOR[t.status] ?? 'var(--nb-muted)' }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs truncate">{t.prompt}</div>
                <div className="text-[11px] text-nb-muted mt-px">
                  {STATUS_LABEL[t.status] ?? t.status} · {t.steps.length} steps
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </ContentCard>
  )
}

function SchedulesSection(): React.JSX.Element {
  const { data: schedules = [] } = useSchedules()
  const upcoming = schedules.filter((s) => s.enabled).slice(0, 3)
  return (
    <ContentCard title="Upcoming">
      {upcoming.length === 0 ? (
        <div className="flex items-center gap-2 py-1">
          <span className="size-1.5 rounded-full bg-nb-muted/40" />
          <span className="text-xs text-nb-muted">No active schedules</span>
        </div>
      ) : (
        <div className="flex flex-col gap-px">
          {upcoming.map((s) => (
            <div key={s.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg">
              <span className="size-1.5 rounded-full bg-nb-accent-2/60 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-nb-text truncate">{s.prompt}</div>
                <div className="text-[11px] text-nb-muted mt-px">
                  {s.frequency} · {s.cronExpr}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ContentCard>
  )
}
