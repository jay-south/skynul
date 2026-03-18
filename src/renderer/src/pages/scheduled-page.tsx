import { useNavigate } from 'react-router-dom'
import { CapabilityList, CapabilityToggle } from '../components/CapabilityToggle'
import { BackBar, BackButton, PanelTitle, SettingsPanel } from '../components/layout'
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
    <SettingsPanel>
      <BackBar>
        <BackButton onClick={() => navigate('/tasks')}>Back</BackButton>
      </BackBar>

      <PanelTitle>Scheduled Tasks</PanelTitle>

      <div style={{ marginBottom: 16 }}>
        <button type="button" className="btn" onClick={() => navigate('/schedules/new')}>
          + New Schedule
        </button>
      </div>

      {schedules.length === 0 ? (
        <div style={{ color: 'var(--nb-muted)', padding: '20px 0' }}>No scheduled tasks yet.</div>
      ) : (
        <CapabilityList>
          {schedules.map((s) => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer'
              }}
              onClick={() => navigate(`/schedules/${s.id}`)}
            >
              <div style={{ flex: 1 }}>
                <CapabilityToggle
                  title={s.prompt.slice(0, 60)}
                  description={`${s.frequency} · Next: ${formatNext(s.nextRunAt)}`}
                  enabled={s.enabled}
                  onToggle={() => handleToggle(s.id)}
                />
              </div>
              <button
                type="button"
                className="btnSecondary"
                style={{ fontSize: 11, padding: '2px 8px' }}
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(s.id)
                }}
              >
                ×
              </button>
            </div>
          ))}
        </CapabilityList>
      )}
    </SettingsPanel>
  )
}
