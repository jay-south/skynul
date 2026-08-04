import type { TaskResponse } from '@shared'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ContentCard } from '@/components/content-card'
import { useRuntimeStats } from '@/queries/runtime/hooks'
import { useSchedules } from '@/queries/schedules/hooks'
import { useTasks } from '@/queries/tasks/hooks'
import { isTaskLive, taskCreatedAtMs } from '@/queries/tasks/utils'

const STATUS_COLOR: Record<string, string> = {
  running: 'var(--nb-accent-2)',
  completed: 'var(--nb-accent-2)',
  failed: 'var(--nb-danger)',
  pending: 'var(--nb-warning, #f0a030)',
  planning: 'var(--nb-accent-2)',
  cancelled: 'var(--nb-muted)'
}

const STATUS_LABEL: Record<string, string> = {
  running: 'Running',
  completed: 'Done',
  failed: 'Failed',
  pending: 'Pending',
  planning: 'Planning',
  cancelled: 'Cancelled'
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
        <StatCard key="ram" label="RAM" value={`${runtime.app.memoryMb} MB`} sub="heap used" />
      )
    }
    if (runtime.system) {
      cards.push(
        <StatCard
          key="free"
          label="Free RAM"
          value={`${runtime.system.freeMemMb} MB`}
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
  const { data: tasks = [] } = useTasks()
  const activeTasks = tasks.filter((t) => isTaskLive(t.status))

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
            <AgentCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </ContentCard>
  )
}

function AgentCard(props: { task: TaskResponse }): React.JSX.Element {
  return (
    <Link
      to={`/tasks/${props.task.id}`}
      className="border border-nb-border rounded-xl bg-nb-panel-2 p-3 flex flex-col gap-2 no-underline hover:no-underline hover:border-nb-accent-2/30 transition-colors"
    >
      <div className="text-xs font-medium text-nb-text leading-relaxed line-clamp-2">
        {props.task.prompt}
      </div>
      <div className="flex items-center gap-1 text-[11px] text-nb-muted">
        <span
          className="size-1.5 rounded-full shrink-0"
          style={{ backgroundColor: STATUS_COLOR[props.task.status] ?? 'var(--nb-muted)' }}
        />
        {STATUS_LABEL[props.task.status] ?? props.task.status}
      </div>
    </Link>
  )
}

function RecentTasksSection(): React.JSX.Element {
  const { data: tasks = [] } = useTasks()
  const recent = [...tasks].sort((a, b) => taskCreatedAtMs(b) - taskCreatedAtMs(a)).slice(0, 5)

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
            <Link
              key={t.id}
              to={`/tasks/${t.id}`}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-nb-text no-underline hover:no-underline transition-colors duration-100 hover:bg-nb-panel"
            >
              <span
                className="size-1.5 rounded-full shrink-0"
                style={{ backgroundColor: STATUS_COLOR[t.status] ?? 'var(--nb-muted)' }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs truncate">{t.prompt}</div>
                <div className="text-[11px] text-nb-muted mt-px">
                  {STATUS_LABEL[t.status] ?? t.status}
                </div>
              </div>
            </Link>
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
