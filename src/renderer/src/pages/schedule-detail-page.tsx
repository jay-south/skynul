import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  BackBar,
  BackButton,
  PanelTitle,
  PathBox,
  Section,
  SectionLabel,
  SettingsPanel
} from '@/components/common'
import { CapabilityList, CapabilityToggle } from '@/components/feature/settings'
import { useDeleteSchedule, useSchedules, useToggleSchedule } from '@/queries/schedules/hooks'
import { useTasks } from '@/queries/tasks/hooks'
import { taskCreatedAtMs } from '@/queries/tasks/utils'

export function ScheduleDetailPage(): React.JSX.Element {
  const { scheduleId } = useParams()
  const navigate = useNavigate()
  const { data: schedules = [] } = useSchedules()
  const { data: tasks = [] } = useTasks()
  const toggleSchedule = useToggleSchedule()
  const deleteSchedule = useDeleteSchedule()

  const schedule = schedules.find((s) => s.id === scheduleId) ?? null

  const handleToggle = async () => {
    if (!schedule) return
    await toggleSchedule.mutateAsync(schedule.id)
  }

  const handleDelete = async () => {
    if (!schedule) return
    await deleteSchedule.mutateAsync(schedule.id)
    navigate('/schedules')
  }

  const scheduleHistory = useMemo(() => {
    if (!schedule) return []
    return tasks
      .filter((t) => t.prompt === schedule.prompt)
      .sort((a, b) => taskCreatedAtMs(b) - taskCreatedAtMs(a))
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
    return (
      <SettingsPanel>
        <PanelTitle>Schedule not found</PanelTitle>
      </SettingsPanel>
    )
  }

  const completedRuns = scheduleHistory.filter((t) => t.status === 'completed').length
  const failedRuns = scheduleHistory.filter((t) => t.status === 'failed').length
  const totalTokens = 0

  return (
    <SettingsPanel>
      <BackBar>
        <BackButton onClick={() => navigate('/schedules')}>Back</BackButton>
      </BackBar>

      <PanelTitle>Schedule Detail</PanelTitle>

      <Section>
        <SectionLabel>Prompt</SectionLabel>
        <PathBox>{schedule.prompt}</PathBox>
      </Section>

      <Section>
        <SectionLabel>Configuration</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div
            style={{
              padding: 12,
              background: 'var(--nb-panel)',
              borderRadius: 8,
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--nb-muted)', marginBottom: 4 }}>Frequency</div>
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
            <div style={{ fontSize: 11, color: 'var(--nb-muted)', marginBottom: 4 }}>Next Run</div>
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
      </Section>

      <Section>
        <SectionLabel>Stats</SectionLabel>
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
      </Section>

      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <button type="button" className="btn" onClick={() => void handleToggle()}>
          {schedule.enabled ? 'Pause' : 'Resume'}
        </button>
        <button
          type="button"
          className="btn"
          style={{ color: 'var(--nb-danger)' }}
          onClick={() => void handleDelete()}
        >
          Delete
        </button>
      </div>

      {scheduleHistory.length > 0 && (
        <Section>
          <SectionLabel>Run History</SectionLabel>
          <CapabilityList>
            {scheduleHistory.map((t) => (
              <CapabilityToggle
                key={t.id}
                title={`${t.prompt.slice(0, 50)}...`}
                description={`${t.status} · ${formatAgo(taskCreatedAtMs(t))}`}
                enabled={t.status === 'completed'}
                onToggle={() => navigate(`/tasks/${t.id}`)}
              />
            ))}
          </CapabilityList>
        </Section>
      )}
    </SettingsPanel>
  )
}
