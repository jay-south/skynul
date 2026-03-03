import { useMemo } from 'react'
import type { Task } from '../../../shared/task'
import type { Schedule } from '../../../shared/schedule'

// ── Helpers ──────────────────────────────────────────────────────────

function StatCard(props: {
  label: string
  value: string | number
  color?: string
  sub?: string
}): React.JSX.Element {
  return (
    <div className="dashStatCard">
      <div className="dashStatValue" style={props.color ? { color: props.color } : undefined}>
        {props.value}
      </div>
      <div className="dashStatLabel">{props.label}</div>
      {props.sub && <div className="dashStatSub">{props.sub}</div>}
    </div>
  )
}

function RecentTask(props: {
  task: Task
  onClick: () => void
}): React.JSX.Element {
  const { task } = props
  const statusColor: Record<string, string> = {
    running: 'var(--nb-accent-2)',
    completed: 'var(--nb-accent-2)',
    failed: 'var(--nb-danger)',
    pending_approval: 'var(--nb-warning, #f0a030)',
    cancelled: 'var(--nb-muted)',
    approved: 'var(--nb-accent-2)'
  }
  const statusLabel: Record<string, string> = {
    running: 'Running',
    completed: 'Done',
    failed: 'Failed',
    pending_approval: 'Pending',
    cancelled: 'Cancelled',
    approved: 'Starting'
  }
  const ago = formatAgo(task.updatedAt)

  return (
    <button className="dashRecentItem" onClick={props.onClick}>
      <div className="dashRecentDot" style={{ background: statusColor[task.status] ?? 'var(--nb-muted)' }} />
      <div className="dashRecentContent">
        <div className="dashRecentTitle">{task.prompt.slice(0, 50)}{task.prompt.length > 50 ? '…' : ''}</div>
        <div className="dashRecentMeta">
          <span style={{ color: statusColor[task.status] }}>{statusLabel[task.status] ?? task.status}</span>
          {' · '}{task.steps.length} steps · {ago}
        </div>
      </div>
    </button>
  )
}

function formatAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const remSecs = secs % 60
  return `${mins}m ${remSecs}s`
}

// ── Dashboard (stats + recent tasks only) ────────────────────────────

export function TaskDashboard(props: {
  tasks: Task[]
  schedules: Schedule[]
  onSelectTask: (id: string) => void
}): React.JSX.Element {
  const { tasks, schedules } = props

  const stats = useMemo(() => {
    const now = Date.now()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayMs = todayStart.getTime()

    const running = tasks.filter((t) => t.status === 'running').length
    const pending = tasks.filter((t) => t.status === 'pending_approval').length
    const completedToday = tasks.filter((t) => t.status === 'completed' && t.updatedAt >= todayMs).length
    const failedToday = tasks.filter((t) => t.status === 'failed' && t.updatedAt >= todayMs).length
    const totalStepsToday = tasks
      .filter((t) => t.updatedAt >= todayMs)
      .reduce((sum, t) => sum + t.steps.length, 0)
    const activeSchedules = schedules.filter((s) => s.enabled).length

    const completedTodayTasks = tasks.filter((t) => t.status === 'completed' && t.updatedAt >= todayMs)
    const avgDuration = completedTodayTasks.length > 0
      ? completedTodayTasks.reduce((sum, t) => sum + (t.updatedAt - t.createdAt), 0) / completedTodayTasks.length
      : 0

    return { running, pending, completedToday, failedToday, totalStepsToday, activeSchedules, avgDuration }
  }, [tasks, schedules])

  const recentTasks = useMemo(() => {
    return [...tasks]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 6)
  }, [tasks])

  const hasTasks = tasks.length > 0

  return (
    <div className="dashWrap">
      {hasTasks && (
        <>
          <div className="dashStats">
            <StatCard
              label="Running"
              value={stats.running}
              color="var(--nb-accent-2)"
              sub={stats.pending > 0 ? `${stats.pending} pending` : undefined}
            />
            <StatCard
              label="Completed today"
              value={stats.completedToday}
              color="var(--nb-accent-2)"
            />
            <StatCard
              label="Failed today"
              value={stats.failedToday}
              color={stats.failedToday > 0 ? 'var(--nb-danger)' : 'var(--nb-muted)'}
            />
            <StatCard
              label="Steps today"
              value={stats.totalStepsToday}
            />
            <StatCard
              label="Avg duration"
              value={stats.avgDuration > 0 ? formatDuration(stats.avgDuration) : '—'}
            />
            <StatCard
              label="Schedules"
              value={stats.activeSchedules}
              sub={`of ${schedules.length} total`}
            />
          </div>

          <div className="dashSection">
            <div className="dashSectionTitle">Recent tasks</div>
            <div className="dashRecentList">
              {recentTasks.map((t) => (
                <RecentTask key={t.id} task={t} onClick={() => props.onSelectTask(t.id)} />
              ))}
            </div>
          </div>
        </>
      )}

      {!hasTasks && (
        <div className="dashEmpty" style={{ textAlign: 'center', padding: '40px 0' }}>
          No tasks yet. Create one from the main view.
        </div>
      )}
    </div>
  )
}
