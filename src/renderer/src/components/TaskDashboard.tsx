import { useEffect, useMemo, useState } from 'react'
import type { Task } from '@skynul/shared'
import type { Schedule } from '@skynul/shared'
import type { RuntimeStats } from '@skynul/shared'

// ── Helpers ──────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  running: 'var(--nb-accent-2)',
  completed: 'var(--nb-accent-2)',
  failed: 'var(--nb-danger)',
  pending_approval: 'var(--nb-warning, #f0a030)',
  cancelled: 'var(--nb-muted)',
  approved: 'var(--nb-accent-2)'
}

const STATUS_LABEL: Record<string, string> = {
  running: 'Running',
  completed: 'Done',
  failed: 'Failed',
  pending_approval: 'Pending',
  cancelled: 'Cancelled',
  approved: 'Starting'
}

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

function RecentTask(props: { task: Task; onClick: () => void }): React.JSX.Element {
  const { task } = props
  const ago = formatAgo(task.updatedAt)

  return (
    <button className="dashRecentItem" onClick={props.onClick}>
        <div
          className="dashRecentDot"
          style={{ background: STATUS_COLOR[task.status] ?? 'var(--nb-muted)' }}
        />
        <div className="dashRecentContent">
        <div className="dashRecentTitle">
          {task.prompt.slice(0, 50)}
          {task.prompt.length > 50 ? '…' : ''}
        </div>
        <div className="dashRecentMeta">
          <span style={{ color: STATUS_COLOR[task.status] }}>
            {STATUS_LABEL[task.status] ?? task.status}
          </span>
          {' · '}
          {task.steps.length} steps · {ago}
        </div>
      </div>
    </button>
  )
}

function AgentCard(props: {
  task: Task
  subAgentCount: number
  onOpen: () => void
  onDetails: () => void
}): React.JSX.Element {
  const { task } = props

  const tokens = task.usage ? task.usage.inputTokens + task.usage.outputTokens : null

  return (
    <div className="agentCard">
      <div className="agentCardTop">
        <div className="agentCardTitle">
          {task.prompt.slice(0, 72)}
          {task.prompt.length > 72 ? '…' : ''}
        </div>
        <div className="agentCardMeta">
          <span
            className="agentStatusDot"
            style={{ background: STATUS_COLOR[task.status] ?? 'var(--nb-muted)' }}
          />
          <span style={{ color: STATUS_COLOR[task.status] ?? 'var(--nb-muted)' }}>
            {STATUS_LABEL[task.status] ?? task.status}
          </span>
          {' · '}
          {task.mode}
          {' · '}
          {task.steps.length} steps
          {props.subAgentCount > 0 ? ` · ${props.subAgentCount} subagents` : ''}
        </div>
      </div>

      <div className="agentCardBottom">
        <div className="agentCardPills">
          <span className="agentPill">Tokens: {tokens ?? '—'}</span>
          <span className="agentPill">Updated: {formatAgo(task.updatedAt)}</span>
        </div>
        <div className="agentCardActions">
          <button className="btnSecondary" onClick={props.onDetails}>
            Details
          </button>
          <button className="btn" onClick={props.onOpen}>
            Open
          </button>
        </div>
      </div>
    </div>
  )
}

function fmtNext(ts: number): string {
  const diffMs = ts - Date.now()
  if (diffMs < 60_000) return 'now'
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 60) return `in ${diffMin}m`
  const diffH = Math.round(diffMs / 3_600_000)
  if (diffH < 24) return `in ${diffH}h`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function ScheduleCard(props: { schedule: Schedule; onClick: () => void }): React.JSX.Element {
  const s = props.schedule
  return (
    <div className="agentCard" style={{ cursor: 'pointer' }} onClick={props.onClick}>
      <div className="agentCardTop">
        <div className="agentCardPrompt">{s.prompt.slice(0, 80)}</div>
        <div className="agentCardMeta">
          <span className="agentStatusDot" style={{ background: 'var(--nb-accent-2)' }} />
          <span style={{ color: 'var(--nb-accent-2)' }}>Scheduled</span>
          {' · '}
          {s.frequency}
        </div>
      </div>
      <div className="agentCardBottom">
        <div className="agentCardPills">
          <span className="agentPill">
            Next: {fmtNext(s.nextRunAt)}{' '}
            {new Date(s.nextRunAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </span>
          {s.lastRunAt && (
            <span className="agentPill">Last: {formatAgo(s.lastRunAt)}</span>
          )}
        </div>
      </div>
    </div>
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
  onSelectSchedule?: (id: string) => void
}): React.JSX.Element {
  const { tasks, schedules } = props

  const [agentDetailsId, setAgentDetailsId] = useState<string | null>(null)
  const [scheduleDetailsId, setScheduleDetailsId] = useState<string | null>(null)
  const [runtime, setRuntime] = useState<RuntimeStats | null>(null)

  const stats = useMemo(() => {
    const now = Date.now()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayMs = todayStart.getTime()

    const running = tasks.filter((t) => t.status === 'running').length
    const pending = tasks.filter((t) => t.status === 'pending_approval').length
    const completedToday = tasks.filter(
      (t) => t.status === 'completed' && t.updatedAt >= todayMs
    ).length
    const failedToday = tasks.filter((t) => t.status === 'failed' && t.updatedAt >= todayMs).length
    const totalStepsToday = tasks
      .filter((t) => t.updatedAt >= todayMs)
      .reduce((sum, t) => sum + t.steps.length, 0)
    const activeSchedules = schedules.filter((s) => s.enabled).length

    const completedTodayTasks = tasks.filter(
      (t) => t.status === 'completed' && t.updatedAt >= todayMs
    )
    const avgDuration =
      completedTodayTasks.length > 0
        ? completedTodayTasks.reduce((sum, t) => sum + (t.updatedAt - t.createdAt), 0) /
          completedTodayTasks.length
        : 0

    return {
      running,
      pending,
      completedToday,
      failedToday,
      totalStepsToday,
      activeSchedules,
      avgDuration
    }
  }, [tasks, schedules])

  const recentTasks = useMemo(() => {
    return [...tasks].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6)
  }, [tasks])

  const activeTasks = useMemo(() => {
    return tasks.filter(
      (t) => t.status === 'running' || t.status === 'approved' || t.status === 'pending_approval'
    )
  }, [tasks])

  const activeRoots = useMemo(() => {
    return activeTasks.filter((t) => !t.parentTaskId)
  }, [activeTasks])

  const activeByParent = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of activeTasks) {
      if (!t.parentTaskId) continue
      const list = map.get(t.parentTaskId) ?? []
      list.push(t)
      map.set(t.parentTaskId, list)
    }
    return map
  }, [activeTasks])

  const selectedAgent = agentDetailsId ? (tasks.find((t) => t.id === agentDetailsId) ?? null) : null
  const selectedSubAgents = selectedAgent ? (activeByParent.get(selectedAgent.id) ?? []) : []

  useEffect(() => {
    if (!agentDetailsId && !scheduleDetailsId && activeTasks.length === 0) return
    let alive = true
    const tick = (): void => {
      void window.skynul
        .runtimeGetStats()
        .then((s) => {
          if (alive) setRuntime(s)
        })
        .catch(() => {})
    }
    tick()
    const t = setInterval(tick, 2000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [agentDetailsId, activeTasks.length])

  const selectedSchedule = scheduleDetailsId
    ? (schedules.find((s) => s.id === scheduleDetailsId) ?? null)
    : null

  // Tasks spawned by the selected schedule (match by prompt)
  const scheduleHistory = useMemo(() => {
    if (!selectedSchedule) return []
    return tasks
      .filter((t) => t.prompt === selectedSchedule.prompt)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 20)
  }, [selectedSchedule, tasks])

  const hasTasks = tasks.length > 0

  // ── Schedule detail screen ──────────────────────────────────────
  if (selectedSchedule) {
    const totalTokens = scheduleHistory.reduce((sum, t) => {
      return sum + (t.usage ? t.usage.inputTokens + t.usage.outputTokens : 0)
    }, 0)
    const completedRuns = scheduleHistory.filter((t) => t.status === 'completed').length
    const failedRuns = scheduleHistory.filter((t) => t.status === 'failed').length

    // Find currently running task from this schedule (if any)
    const schedRunning = scheduleHistory.find(
      (t) => t.status === 'running' || t.status === 'approved'
    )
    const schedSubAgents = schedRunning
      ? tasks.filter((t) => t.parentTaskId === schedRunning.id)
      : []

    return (
      <div className="dashWrap">
        <button
          className="schedDetailBack"
          onClick={() => setScheduleDetailsId(null)}
          style={{ marginBottom: 16 }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z" />
          </svg>
          Back
        </button>

        <div className="agentDetailsPrompt" style={{ fontSize: 15, marginBottom: 16 }}>
          {selectedSchedule.prompt}
        </div>

        <div className="dashStats" style={{ marginBottom: 20 }}>
          <StatCard label="Frequency" value={selectedSchedule.frequency} />
          <StatCard
            label="Next run"
            value={fmtNext(selectedSchedule.nextRunAt)}
            sub={new Date(selectedSchedule.nextRunAt).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit'
            })}
          />
          <StatCard label="Total runs" value={completedRuns + failedRuns} />
          <StatCard
            label="Success rate"
            value={
              completedRuns + failedRuns > 0
                ? `${Math.round((completedRuns / (completedRuns + failedRuns)) * 100)}%`
                : '—'
            }
            color={failedRuns > 0 ? 'var(--nb-danger)' : 'var(--nb-accent-2)'}
          />
          <StatCard label="Total tokens" value={totalTokens > 0 ? totalTokens.toLocaleString() : '—'} />
          <StatCard
            label="Status"
            value={selectedSchedule.enabled ? 'Active' : 'Paused'}
            color={selectedSchedule.enabled ? 'var(--nb-accent-2)' : 'var(--nb-muted)'}
          />
        </div>

        {schedRunning && schedSubAgents.length > 0 && (
          <div className="dashSection">
            <div className="dashSectionTitle">Subagents</div>
            <div className="agentSubList">
              {schedSubAgents
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((t) => (
                  <button
                    key={t.id}
                    className="agentSubItem"
                    onClick={() => props.onSelectTask(t.id)}
                  >
                    <div className="agentSubTitle">
                      {t.prompt.slice(0, 80)}
                      {t.prompt.length > 80 ? '…' : ''}
                    </div>
                    <div className="agentSubMeta">
                      {t.status} · {t.mode} · {t.steps.length} steps · {formatAgo(t.updatedAt)}
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}

        <div className="dashSection">
          <div className="dashSectionTitle">System</div>
          <div className="agentDetailsMeta">
            <span className="agentPill">
              CPU: {runtime ? `${runtime.app.cpuPercent.toFixed(1)}%` : '—'}
            </span>
            <span className="agentPill">
              RAM: {runtime ? `${runtime.app.memoryMB.toFixed(0)} MB` : '—'}
            </span>
            <span className="agentPill">
              System free: {runtime ? `${runtime.system.freeMemMB.toFixed(0)} MB` : '—'}
            </span>
          </div>
        </div>

        <div className="dashSection">
          <div className="dashSectionTitle">Run history</div>
          {scheduleHistory.length === 0 ? (
            <div className="dashEmpty">No runs yet.</div>
          ) : (
            <div className="dashRecentList">
              {scheduleHistory.map((t) => (
                <RecentTask key={t.id} task={t} onClick={() => props.onSelectTask(t.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Agent detail screen ─────────────────────────────────────────
  if (selectedAgent) {
    return (
      <div className="dashWrap">
        <button
          className="schedDetailBack"
          onClick={() => setAgentDetailsId(null)}
          style={{ marginBottom: 16 }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z" />
          </svg>
          Back
        </button>

        <div className="agentDetailsPrompt" style={{ fontSize: 15, marginBottom: 16 }}>
          {selectedAgent.prompt}
        </div>

        <div className="dashStats" style={{ marginBottom: 20 }}>
          <StatCard
            label="Status"
            value={STATUS_LABEL[selectedAgent.status] ?? selectedAgent.status}
            color={STATUS_COLOR[selectedAgent.status] ?? 'var(--nb-muted)'}
          />
          <StatCard label="Mode" value={selectedAgent.mode} />
          <StatCard label="Steps" value={selectedAgent.steps.length} />
          <StatCard
            label="Tokens"
            value={
              selectedAgent.usage
                ? (selectedAgent.usage.inputTokens + selectedAgent.usage.outputTokens).toLocaleString()
                : '—'
            }
          />
          <StatCard label="Updated" value={formatAgo(selectedAgent.updatedAt)} />
          <StatCard label="Subagents" value={selectedSubAgents.length} />
        </div>

        {selectedSubAgents.length > 0 && (
          <div className="dashSection">
            <div className="dashSectionTitle">Subagents</div>
            <div className="agentSubList">
              {selectedSubAgents
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((t) => (
                  <button
                    key={t.id}
                    className="agentSubItem"
                    onClick={() => props.onSelectTask(t.id)}
                  >
                    <div className="agentSubTitle">
                      {t.prompt.slice(0, 80)}
                      {t.prompt.length > 80 ? '…' : ''}
                    </div>
                    <div className="agentSubMeta">
                      {t.status} · {t.mode} · {t.steps.length} steps · {formatAgo(t.updatedAt)}
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}

        <div className="dashSection">
          <div className="dashSectionTitle">System</div>
          <div className="agentDetailsMeta">
            <span className="agentPill">
              CPU: {runtime ? `${runtime.app.cpuPercent.toFixed(1)}%` : '—'}
            </span>
            <span className="agentPill">
              RAM: {runtime ? `${runtime.app.memoryMB.toFixed(0)} MB` : '—'}
            </span>
            <span className="agentPill">
              System free: {runtime ? `${runtime.system.freeMemMB.toFixed(0)} MB` : '—'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn" onClick={() => props.onSelectTask(selectedAgent.id)}>
            Open agent
          </button>
        </div>
      </div>
    )
  }

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
            <StatCard label="Steps today" value={stats.totalStepsToday} />
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
            <div className="dashSectionTitle">Agents</div>
            {activeRoots.length === 0 && schedules.filter((s) => s.enabled).length === 0 ? (
              <div className="dashEmpty">No active agents right now.</div>
            ) : (
              <div className="agentGrid">
                {schedules
                  .filter((s) => s.enabled)
                  .map((s) => (
                    <ScheduleCard
                      key={`sched-${s.id}`}
                      schedule={s}
                      onClick={() => setScheduleDetailsId(s.id)}
                    />
                  ))}
                {activeRoots
                  .sort((a, b) => b.updatedAt - a.updatedAt)
                  .map((t) => (
                    <AgentCard
                      key={t.id}
                      task={t}
                      subAgentCount={(activeByParent.get(t.id) ?? []).length}
                      onOpen={() => props.onSelectTask(t.id)}
                      onDetails={() => setAgentDetailsId(t.id)}
                    />
                  ))}
              </div>
            )}
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
