import { Link, useNavigate } from 'react-router-dom'
import { ContentCard } from '@/components/content-card'
import { PageHeader } from '@/components/page-header'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb'
import { useDeleteSchedule, useSchedules, useToggleSchedule } from '@/queries'

function formatNext(ts: number): string {
  const now = Date.now()
  const diffMs = ts - now
  if (diffMs < 60_000) return 'now'
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 60) return `in ${diffMin}m`
  const diffH = Math.round(diffMs / 3_600_000)
  if (diffH < 24) return `in ${diffH}h`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function ScheduledPage(): React.JSX.Element {
  const navigate = useNavigate()

  const { data: schedules = [] } = useSchedules()
  const toggleScheduleMutation = useToggleSchedule()
  const deleteScheduleMutation = useDeleteSchedule()

  const handleToggle = (id: string) => toggleScheduleMutation.mutate(id)
  const handleDelete = (id: string) => deleteScheduleMutation.mutate(id)

  return (
    <div className="h-full overflow-hidden">
      <div className="h-full overflow-y-auto px-6 py-6 mx-auto w-full max-w-6xl">
        <Breadcrumb className="mb-4">
          <BreadcrumbList className="text-base text-nb-muted">
            <BreadcrumbItem>
              <BreadcrumbLink asChild className="text-nb-muted hover:text-nb-text">
                <Link to="/dashboard">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-nb-text">Scheduled</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageHeader
          title="Scheduled"
          description="View and manage your scheduled tasks."
          className="mb-6"
        />

        {schedules.length === 0 ? (
          <div className="flex justify-center pt-12">
            <div className="flex flex-col items-center gap-3">
              <div className="size-[72px] rounded-xl bg-nb-panel flex items-center justify-center text-nb-muted">
                <svg
                  viewBox="0 0 24 24"
                  width="40"
                  height="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <title>Schedule icon</title>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" />
                </svg>
              </div>
              <span className="text-lg font-semibold text-nb-text">No scheduled tasks yet</span>
              <span className="text-sm text-nb-muted max-w-[240px] text-center leading-relaxed">
                Create a schedule to run tasks automatically on a recurring basis.
              </span>
              <button
                type="button"
                onClick={() => navigate('/schedules/new')}
                className="flex items-center gap-1.5 rounded-xl bg-nb-accent-2 text-white px-5 py-2.5 mt-1 cursor-pointer text-xs font-medium transition-all duration-150 hover:opacity-90 border-none"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New Schedule
              </button>
            </div>
          </div>
        ) : (
          <ContentCard title="Schedules">
            <div className="flex items-center justify-end mb-3">
              <button
                type="button"
                onClick={() => navigate('/schedules/new')}
                className="flex items-center gap-1.5 rounded-lg bg-nb-accent-2 text-white px-3 py-1.5 cursor-pointer text-xs font-medium transition-all duration-150 hover:opacity-90 border-none"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {schedules.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-lg bg-nb-panel-2 border border-nb-border px-3.5 py-3 transition-all duration-150 hover:border-nb-border hover:bg-nb-panel"
                >
                  <div
                    className="flex items-center justify-center size-8 rounded-lg bg-nb-accent-2/10 text-nb-accent-2 shrink-0"
                    aria-hidden="true"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <title>Schedule</title>
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 3" />
                    </svg>
                  </div>

                  <button
                    type="button"
                    className="flex-1 min-w-0 text-left border-none bg-transparent cursor-pointer p-0 font-inherit"
                    onClick={() => navigate(`/schedules/${s.id}`)}
                  >
                    <div className="text-sm font-medium text-nb-text truncate">
                      {s.prompt.slice(0, 60)}
                    </div>
                    <div className="text-xs text-nb-muted">
                      {s.frequency} · Next: {formatNext(s.nextRunAt)}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggle(s.id)
                    }}
                    aria-pressed={s.enabled}
                    className={`shrink-0 w-11 h-[26px] rounded-full border flex items-center p-[3px] transition-colors cursor-pointer
                      ${
                        s.enabled
                          ? 'bg-nb-accent-2/22 border-nb-accent-2/40'
                          : 'bg-nb-text/8 border-nb-border'
                      }`}
                  >
                    <div
                      className={`w-[18px] h-[18px] rounded-full bg-nb-panel-2 border transition-transform duration-140
                        ${
                          s.enabled
                            ? 'translate-x-[18px] border-nb-accent-2/35'
                            : 'translate-x-0 border-nb-border'
                        }`}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(s.id)
                    }}
                    className="appearance-none bg-transparent border-none text-nb-muted text-lg cursor-pointer px-1.5 py-0.5 leading-none hover:text-nb-danger transition-colors shrink-0"
                    aria-label="Delete schedule"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </ContentCard>
        )}
      </div>
    </div>
  )
}
