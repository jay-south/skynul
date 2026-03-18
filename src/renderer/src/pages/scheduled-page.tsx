import { useNavigate } from 'react-router-dom'
import { PageContent } from '../components/layout'
import { useDeleteSchedule, useSchedules, useToggleSchedule } from '../queries'

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
    <PageContent
      title="Scheduled Tasks"
      showBack
      backTo="/tasks"
      actions={
        <button type="button" className="btn btnFilled" onClick={() => navigate('/schedules/new')}>
          + New Schedule
        </button>
      }
    >
      {schedules.length === 0 ? (
        <div style={{ color: 'var(--nb-muted)', padding: '20px 0' }}>No scheduled tasks yet.</div>
      ) : (
        <div className="capList">
          {schedules.map((s) => (
            <form
              key={s.id}
              className="cap"
              onSubmit={(e) => {
                e.preventDefault()
              }}
              onClick={() => navigate(`/schedules/${s.id}`)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return
                e.preventDefault()
                navigate(`/schedules/${s.id}`)
              }}
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
                  type="button"
                  className={`capToggle ${s.enabled ? '' : 'off'}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggle(s.id)
                  }}
                >
                  <div className="capKnob" />
                </button>
                <button
                  type="button"
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
            </form>
          ))}
        </div>
      )}
    </PageContent>
  )
}
