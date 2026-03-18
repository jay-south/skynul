import { useNavigate } from 'react-router-dom'
import { PageContent } from '../components/layout'
import { Button } from '../components/ui/button'
import { useDeleteSchedule, useSchedules, useToggleSchedule } from '../queries'
import { cn } from '../lib/utils'

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
        <Button type="button" variant="filled" onClick={() => navigate('/schedules/new')}>
          + New Schedule
        </Button>
      }
    >
      {schedules.length === 0 ? (
        <div style={{ color: 'var(--nb-muted)', padding: '20px 0' }}>No scheduled tasks yet.</div>
      ) : (
        <div className="flex flex-col gap-[10px]">
          {schedules.map((s) => (
            <form
              key={s.id}
              className={cn(
                'w-full flex items-center justify-between gap-[12px] p-[12px] rounded-[14px] border border-[var(--nb-border)] bg-[var(--nb-panel)] cursor-pointer text-left disabled:cursor-not-allowed disabled:opacity-[0.65]',
                s.enabled &&
                  'border-[color-mix(in_srgb,var(--nb-accent-2),transparent_60%)] bg-[color-mix(in_srgb,var(--nb-accent-2),transparent_92%)]'
              )}
              onSubmit={(e) => {
                e.preventDefault()
              }}
              onClick={() => navigate(`/schedules/${s.id}`)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return
                e.preventDefault()
                navigate(`/schedules/${s.id}`)
              }}
            >
              <div className="flex flex-col min-w-0">
                <div
                  className="text-[14px] font-semibold text-[color-mix(in_srgb,var(--nb-text),transparent_10%)]"
                >
                  {s.prompt.slice(0, 60)}
                </div>
                <div className="text-[12px] font-[520] text-[var(--nb-muted)]">
                  {s.frequency} · Next: {formatNext(s.nextRunAt)}
                </div>
              </div>
              <div className="flex items-center gap-[8px]">
                <button
                  type="button"
                  className={cn(
                    'w-[44px] h-[26px] rounded-full border border-[var(--nb-border)] bg-[color-mix(in_srgb,var(--nb-text),transparent_92%)] p-[3px] flex items-center justify-start',
                    s.enabled &&
                      'border-[color-mix(in_srgb,var(--nb-accent-2),transparent_60%)] bg-[color-mix(in_srgb,var(--nb-accent-2),transparent_78%)]'
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggle(s.id)
                  }}
                >
                  <div
                    className={cn(
                      'w-[18px] h-[18px] rounded-full bg-[var(--nb-panel-2)] border border-[var(--nb-border)] shadow-[0_10px_22px_rgba(0,0,0,0.08)] transition-transform duration-[140ms] ease-out',
                      s.enabled &&
                        'translate-x-[18px] border-[color-mix(in_srgb,var(--nb-accent-2),transparent_65%)]'
                    )}
                  />
                </button>
                <Button
                  type="button"
                  variant="default"
                  size="small"
                  className="!px-[8px] !py-[2px] !text-[11px] !leading-none"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(s.id)
                  }}
                >
                  ×
                </Button>
              </div>
            </form>
          ))}
        </div>
      )}
    </PageContent>
  )
}
