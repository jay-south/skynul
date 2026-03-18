import type { Schedule, Task } from '@skynul/shared'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageContent } from '../components/layout'
import { Button } from '../components/ui/button'
import { cn } from '../lib/utils'

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
    return (
      <PageContent title="Schedule Detail" showBack backTo="/schedules">
        <div className="settingsSection">
          <div className="settingsLabel">Status</div>
          <div className="pathBox">Schedule not found</div>
        </div>
      </PageContent>
    )
  }

  const completedRuns = scheduleHistory.filter((t) => t.status === 'completed').length
  const failedRuns = scheduleHistory.filter((t) => t.status === 'failed').length
  const totalTokens = scheduleHistory.reduce((sum, t) => {
    return sum + (t.usage ? t.usage.inputTokens + t.usage.outputTokens : 0)
  }, 0)

  return (
    <PageContent title="Schedule Detail" showBack backTo="/schedules">
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
          <Button type="button" variant="default" onClick={() => void handleToggle()}>
            {schedule.enabled ? 'Pause' : 'Resume'}
          </Button>
          <Button
            type="button"
            variant="default"
            className="!text-[var(--nb-danger)]"
            onClick={() => void handleDelete()}
          >
            Delete
          </Button>
        </div>

        {scheduleHistory.length > 0 && (
          <div className="settingsSection" style={{ marginTop: 32 }}>
            <div className="settingsLabel">Run History</div>
            <div className="flex flex-col gap-[10px]">
              {scheduleHistory.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className={cn(
                    'w-full flex items-center justify-between gap-[12px] p-[12px] rounded-[14px] border border-[var(--nb-border)] bg-[var(--nb-panel)] cursor-pointer text-left'
                  )}
                  onClick={() => navigate(`/tasks/${t.id}`)}
                  style={{ cursor: 'pointer', width: '100%', textAlign: 'left' }}
                >
                  <div className="flex flex-col min-w-0">
                    <div className="text-[14px] font-semibold text-[color-mix(in_srgb,var(--nb-text),transparent_10%)]">
                      {t.prompt.slice(0, 50)}...
                    </div>
                    <div className="text-[12px] font-[520] text-[var(--nb-muted)]">
                      {t.status} · {t.steps.length} steps · {formatAgo(t.updatedAt)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
    </PageContent>
  )
}
