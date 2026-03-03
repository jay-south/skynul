import { useEffect, useMemo, useState } from 'react'
import type { Task } from '../../../shared/task'
import type { Schedule } from '../../../shared/schedule'
import type { RuntimeStats } from '../../../shared/runtime'

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

function RecentTask(props: { task: Task; onClick: () => void }): React.JSX.Element {
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
      <div
        className="dashRecentDot"
        style={{ background: statusColor[task.status] ?? 'var(--nb-muted)' }}
      />
      <div className="dashRecentContent">
        <div className="dashRecentTitle">
          {task.prompt.slice(0, 50)}
          {task.prompt.length > 50 ? '…' : ''}
        </div>
        <div className="dashRecentMeta">
          <span style={{ color: statusColor[task.status] }}>
            {statusLabel[task.status] ?? task.status}
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
            style={{ background: statusColor[task.status] ?? 'var(--nb-muted)' }}
          />
          <span style={{ color: statusColor[task.status] ?? 'var(--nb-muted)' }}>
            {statusLabel[task.status] ?? task.status}
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

  const [agentDetailsId, setAgentDetailsId] = useState<string | null>(null)
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
    if (!agentDetailsId && activeTasks.length === 0) return
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
            {activeRoots.length === 0 ? (
              <div className="dashEmpty">No active agents right now.</div>
            ) : (
              <div className="agentGrid">
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

          {selectedAgent && (
            <div className="modalBackdrop" onMouseDown={() => setAgentDetailsId(null)}>
              <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
                <div className="modalHeader">
                  <div className="modalTitle">Agent details</div>
                  <button
                    className="modalClose"
                    onClick={() => setAgentDetailsId(null)}
                    aria-label="Close"
                  >
                    &times;
                  </button>
                </div>

                <div
                  className="modalBody"
                  style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                  <div className="agentDetailsBlock">
                    <div className="agentDetailsPrompt">{selectedAgent.prompt}</div>
                    <div className="agentDetailsMeta">
                      <span className="agentPill">Status: {selectedAgent.status}</span>
                      <span className="agentPill">Mode: {selectedAgent.mode}</span>
                      <span className="agentPill">Steps: {selectedAgent.steps.length}</span>
                      <span className="agentPill">
                        Tokens:{' '}
                        {selectedAgent.usage
                          ? selectedAgent.usage.inputTokens + selectedAgent.usage.outputTokens
                          : '—'}
                      </span>
                      <span className="agentPill">
                        Updated: {formatAgo(selectedAgent.updatedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="agentDetailsBlock">
                    <div className="dashSectionTitle" style={{ marginBottom: 6 }}>
                      Subagents
                    </div>
                    {selectedSubAgents.length === 0 ? (
                      <div className="dashEmpty">No subagents currently running.</div>
                    ) : (
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
                                {t.status} · {t.mode} · {t.steps.length} steps ·{' '}
                                {formatAgo(t.updatedAt)}
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className="agentDetailsBlock">
                    <div className="dashSectionTitle" style={{ marginBottom: 6 }}>
                      Computer (app)
                    </div>
                    <div className="agentDetailsMeta">
                      <span className="agentPill">
                        CPU: {runtime ? `${runtime.app.cpuPercent.toFixed(1)}%` : '—'}
                      </span>
                      <span className="agentPill">
                        RAM: {runtime ? `${runtime.app.memoryMB.toFixed(0)} MB` : '—'}
                      </span>
                      <span className="agentPill">
                        Processes: {runtime ? runtime.app.processCount : '—'}
                      </span>
                      <span className="agentPill">
                        System free: {runtime ? `${runtime.system.freeMemMB.toFixed(0)} MB` : '—'}
                      </span>
                    </div>
                    <div className="settingsFieldHint">
                      Per-agent CPU/RAM is not available yet (all tasks run inside the same Electron
                      processes).
                    </div>
                  </div>
                </div>

                <div
                  className="modalActions"
                  style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}
                >
                  <button className="btnSecondary" onClick={() => setAgentDetailsId(null)}>
                    Close
                  </button>
                  <button className="btn" onClick={() => props.onSelectTask(selectedAgent.id)}>
                    Open agent
                  </button>
                </div>
              </div>
            </div>
          )}
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
