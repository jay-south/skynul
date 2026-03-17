import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import type { Schedule } from '../../../shared/schedule'
import type { Task } from '../../../shared/task'

export function ScheduleDetailPage(): React.JSX.Element {
  const { scheduleId } = useParams()
  const navigate = useNavigate()
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])

  // Load schedule and tasks
  useEffect(() => {
    if (!scheduleId) return

    void window.skynul.scheduleList().then((schedules) => {
      const s = schedules.find((x) => x.id === scheduleId)
      if (s) setSchedule(s)
    })

    void window.skynul.taskList().then(({ tasks: list }) => {
      setTasks(list)
    })
  }, [scheduleId])

  const handleToggle = async () => {
    if (!schedule) return
    const updated = await window.skynul.scheduleToggle(schedule.id)
    setSchedule(updated.find((s) => s.id === scheduleId) ?? null)
  }

  const handleDelete = async () => {
    if (!schedule) return
    await window.skynul.scheduleDelete(schedule.id)
    navigate('/schedules')
  }

  // Tasks spawned by this schedule (match by prompt)
  const scheduleHistory = useMemo(() => {
    if (!schedule) return []
    return tasks
      .filter((t) => t.prompt === schedule.prompt)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 20)
  }, [schedule, tasks])

  const formatNext = (ts: number): string => {
    const now = Date.now()
    const diffMs = ts - now
    if (diffMs < 60_000) return 'now'
    const diffMin = Math.round(diffMs / 60_000)
    if (diffMin < 60) return `in ${diffMin}m`
    const diffH = Math.round(diffMs / 3_600_000)
    if (diffH < 24) return `in ${diffH}h`
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  const formatAgo = (ts: number): string => {
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  if (!schedule) {
    return <div className="settingsPanel">Schedule not found</div>
  }

  const completedRuns = scheduleHistory.filter((t) => t.status === 'completed').length
  const failedRuns = scheduleHistory.filter((t) => t.status === 'failed').length
  const totalTokens = scheduleHistory.reduce((sum, t) => {
    return sum + (t.usage ? t.usage.inputTokens + t.usage.outputTokens : 0)
  }, 0)

  return (
    <div className="settingsPanel">
      <div className="settingsPanelInner">
        <div className="settingsBackBar">
          <button
            className="backBtn"
            onClick={() => navigate('/schedules')}
            aria-label="Back"
            title="Back"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
            <span>Back</span>
          </button>
        </div>

        <h2 className="settingsPanelTitle">Schedule Detail</h2>

        <div className="settingsSection">
          <div className="settingsLabel">Prompt</div>
          <div className="pathBox">{schedule.prompt}</div>
        </div>

        <div className="settingsSection">
          <div className="settingsLabel">Configuration</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div
              style={{
                padding: 12,
                background: 'var(--nb-panel)',
                borderRadius: 8,
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--nb-muted)', marginBottom: 4 }}>
                Frequency
              </div>
              <div style={{ fontWeight: 600 }}>{schedule.frequency}</div>
            </div>
            <div
              style={{
                padding: 12,
                background: 'var(--nb-panel)',
                borderRadius: 8,
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--nb-muted)', marginBottom: 4 }}>
                Next Run
              </div>
              <div style={{ fontWeight: 600 }}>{formatNext(schedule.nextRunAt)}</div>
            </div>
            <div
              style={{
                padding: 12,
                background: 'var(--nb-panel)',
                borderRadius: 8,
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--nb-muted)', marginBottom: 4 }}>Status</div>
              <div style={{ fontWeight: 600 }}>
                {schedule.enabled ? (
                  <span style={{ color: 'var(--green, #4ade80)' }}>Active</span>
                ) : (
                  <span style={{ color: 'var(--nb-muted)' }}>Paused</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="settingsSection">
          <div className="settingsLabel">Stats</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div
              style={{
                padding: 12,
                background: 'var(--nb-panel)',
                borderRadius: 8,
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--nb-muted)', marginBottom: 4 }}>
                Total Runs
              </div>
              <div style={{ fontWeight: 600 }}>{completedRuns + failedRuns}</div>
            </div>
            <div
              style={{
                padding: 12,
                background: 'var(--nb-panel)',
                borderRadius: 8,
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--nb-muted)', marginBottom: 4 }}>
                Success Rate
              </div>
              <div style={{ fontWeight: 600 }}>
                {completedRuns + failedRuns > 0
                  ? `${Math.round((completedRuns / (completedRuns + failedRuns)) * 100)}%`
                  : '—'}
              </div>
            </div>
            <div
              style={{
                padding: 12,
                background: 'var(--nb-panel)',
                borderRadius: 8,
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--nb-muted)', marginBottom: 4 }}>
                Total Tokens
              </div>
              <div style={{ fontWeight: 600 }}>
                {totalTokens > 0 ? totalTokens.toLocaleString() : '—'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <button className="btn" onClick={() => void handleToggle()}>
            {schedule.enabled ? 'Pause' : 'Resume'}
          </button>
          <button
            className="btn"
            style={{ color: 'var(--nb-danger)' }}
            onClick={() => void handleDelete()}
          >
            Delete
          </button>
        </div>

        {scheduleHistory.length > 0 && (
          <div className="settingsSection" style={{ marginTop: 32 }}>
            <div className="settingsLabel">Run History</div>
            <div className="capList">
              {scheduleHistory.map((t) => (
                <div
                  key={t.id}
                  className="cap"
                  onClick={() => navigate(`/tasks/${t.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="capLeft">
                    <div className="capTitle">{t.prompt.slice(0, 50)}...</div>
                    <div className="capDesc">
                      {t.status} · {t.steps.length} steps · {formatAgo(t.updatedAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
