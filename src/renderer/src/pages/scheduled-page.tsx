import { useNavigate } from 'react-router-dom'
import { useSchedules, useToggleSchedule, useDeleteSchedule } from '../queries'

export function ScheduledPage(): React.JSX.Element {
  const navigate = useNavigate()

  // Queries
  const { data: schedules = [] } = useSchedules()

  // Mutations
  const toggleScheduleMutation = useToggleSchedule()
  const deleteScheduleMutation = useDeleteSchedule()

  const handleToggle = (id: string) => {
    toggleScheduleMutation.mutate(id)
  }

  const handleDelete = (id: string) => {
    deleteScheduleMutation.mutate(id)
  }

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

  return (
    <div className="settingsPanel">
      <div className="settingsPanelInner">
        <div className="settingsBackBar">
          <button
            className="backBtn"
            onClick={() => navigate('/tasks')}
            aria-label="Back to tasks"
            title="Back to tasks"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
            <span>Back</span>
          </button>
        </div>

        <h2 className="settingsPanelTitle">Scheduled Tasks</h2>

        <div style={{ marginBottom: 16 }}>
          <button className="btn btnFilled" onClick={() => navigate('/schedules/new')}>
            + New Schedule
          </button>
        </div>

        {schedules.length === 0 ? (
          <div style={{ color: 'var(--nb-muted)', padding: '20px 0' }}>No scheduled tasks yet.</div>
        ) : (
          <div className="capList">
            {schedules.map((s) => (
              <div
                key={s.id}
                className="cap"
                onClick={() => navigate(`/schedules/${s.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <div className="capLeft">
                  <div className="capTitle">{s.prompt.slice(0, 60)}</div>
                  <div className="capDesc">
                    {s.frequency} · Next: {formatNext(s.nextRunAt)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    className={`capToggle ${s.enabled ? '' : 'off'}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggle(s.id)
                    }}
                    aria-hidden="true"
                  >
                    <div className="capKnob" />
                  </button>
                  <button
                    className="btn"
                    style={{ fontSize: 11, padding: '2px 8px' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(s.id)
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
