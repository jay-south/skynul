import { ArrowLeft, CheckCircle2, CircleX, Loader2, Plus, Square, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar'
import { t } from '@/i18n'
import { useCancelTask, useDeleteTask, useGeneralSettings, useTasks } from '@/queries'
import { taskUpdatedAtMs } from '@/queries/tasks/utils'

const ACTIVE_BAR =
  'absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-[hsl(var(--nb-accent-2))] opacity-0 transition-all duration-300 group-data-[active=true]/menu-button:opacity-100'

const MENU_BUTTON_CLASS =
  'relative transition-all duration-200 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:h-12!'

function taskTitle(prompt: string | undefined): string {
  if (!prompt?.trim()) return 'Untitled task'
  const trimmed = prompt.trim()
  return trimmed.length > 36 ? `${trimmed.slice(0, 36)}…` : trimmed
}

type TaskStatusKind = 'progress' | 'success' | 'failed'

function taskStatusKind(status: string): TaskStatusKind {
  if (status === 'completed') return 'success'
  if (status === 'failed' || status === 'cancelled') return 'failed'
  return 'progress'
}

function taskStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'running':
      return 'Running'
    case 'completed':
      return 'Completed'
    case 'failed':
      return 'Failed'
    case 'cancelled':
      return 'Cancelled'
    case 'planning':
      return 'Planning'
    default:
      return status
  }
}

function TaskStatusIcon({ status }: { status: string }): React.JSX.Element {
  const kind = taskStatusKind(status)
  const label = taskStatusLabel(status)

  if (kind === 'success') {
    return (
      <CheckCircle2
        className="relative z-10 size-4 shrink-0 text-emerald-500 transition-transform duration-200 group-hover/menu-button:scale-110"
        strokeWidth={1.75}
        aria-label={label}
      />
    )
  }

  if (kind === 'failed') {
    return (
      <CircleX
        className="relative z-10 size-4 shrink-0 text-red-500 transition-transform duration-200 group-hover/menu-button:scale-110"
        strokeWidth={1.75}
        aria-label={label}
      />
    )
  }

  return (
    <Loader2
      className={`relative z-10 size-4 shrink-0 text-[hsl(var(--nb-accent-2))] transition-transform duration-200 group-hover/menu-button:scale-110 ${status === 'running' || status === 'planning' ? 'animate-spin' : ''}`}
      strokeWidth={1.75}
      aria-label={label}
    />
  )
}

export function TaskSidebarNav(): React.JSX.Element {
  const navigate = useNavigate()
  const { taskId } = useParams()
  const { data: tasksData } = useTasks()
  const tasks = Array.isArray(tasksData) ? tasksData : []
  const { data: general } = useGeneralSettings()
  const lang = general?.language ?? 'en'

  const deleteTaskMutation = useDeleteTask()
  const cancelTaskMutation = useCancelTask()

  const recentTasks = useMemo(
    () => [...tasks].sort((a, b) => taskUpdatedAtMs(b) - taskUpdatedAtMs(a)).slice(0, 40),
    [tasks]
  )

  return (
    <SidebarGroup className="flex min-h-0 flex-1 flex-col">
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Back to app"
              size="lg"
              className={`${MENU_BUTTON_CLASS} mb-1`}
            >
              <NavLink
                to="/dashboard"
                className="relative no-underline hover:no-underline text-sidebar-foreground/70 hover:text-sidebar-foreground"
              >
                <ArrowLeft className="size-4 shrink-0" strokeWidth={1.75} />
                <span className="relative z-10 text-[15px] font-medium tracking-tight group-data-[collapsible=icon]:hidden">
                  Back to app
                </span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>

      <SidebarGroupLabel className="px-3 text-[10px] uppercase tracking-wider text-sidebar-foreground/40 group-data-[collapsible=icon]:hidden">
        {t(lang, 'tasks_title')}
      </SidebarGroupLabel>

      <SidebarGroupContent className="px-1">
        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={!taskId}
              tooltip={t(lang, 'tasks_new')}
              size="lg"
              className={MENU_BUTTON_CLASS}
            >
              <NavLink to="/tasks" end className="relative no-underline hover:no-underline">
                <span className={ACTIVE_BAR} style={{ boxShadow: '0 0 10px hsl(var(--nb-accent-2) / 0.6)' }} />
                <Plus
                  className="relative z-10 size-4 shrink-0 transition-transform duration-200 group-hover/menu-button:scale-110"
                  strokeWidth={2}
                />
                <span className="relative z-10 text-[15px] font-medium tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:hidden">
                  {t(lang, 'tasks_new')}
                </span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>

      <SidebarGroupContent className="min-h-0 flex-1 overflow-y-auto px-1 pb-2 group-data-[collapsible=icon]:hidden">
        {recentTasks.length === 0 ? (
          <p className="px-3 py-4 text-center text-[12px] text-sidebar-foreground/45">No tasks yet</p>
        ) : (
          <SidebarMenu className="gap-0.5">
            {recentTasks.map((task) => (
              <SidebarMenuItem key={task.id} className="group/item relative">
                <SidebarMenuButton
                  asChild
                  isActive={task.id === taskId}
                  tooltip={`${taskTitle(task.prompt)} · ${taskStatusLabel(task.status)}`}
                  size="lg"
                  className={`${MENU_BUTTON_CLASS} pr-8`}
                >
                  <NavLink to={`/tasks/${task.id}`} className="relative no-underline hover:no-underline">
                    <span className={ACTIVE_BAR} style={{ boxShadow: '0 0 10px hsl(var(--nb-accent-2) / 0.6)' }} />
                    <TaskStatusIcon status={task.status} />
                    <span className="relative z-10 min-w-0 flex-1 truncate text-[15px] font-medium tracking-tight text-sidebar-foreground">
                      {taskTitle(task.prompt)}
                    </span>
                  </NavLink>
                </SidebarMenuButton>

                <button
                  type="button"
                  aria-label={
                    task.status === 'running' ? t(lang, 'tasks_cancel') : t(lang, 'common_delete')
                  }
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (task.status === 'running') {
                      cancelTaskMutation.mutate(task.id)
                      return
                    }
                    deleteTaskMutation.mutate(task.id, {
                      onSuccess: () => {
                        if (taskId === task.id) navigate('/tasks')
                      }
                    })
                  }}
                  className="absolute right-1 top-1/2 z-20 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-sidebar-foreground/45 opacity-0 transition-opacity hover:bg-sidebar-accent hover:text-sidebar-foreground group-hover/item:opacity-100"
                >
                  {task.status === 'running' ? (
                    <Square className="size-3.5" strokeWidth={2} />
                  ) : (
                    <Trash2 className="size-3.5" strokeWidth={2} />
                  )}
                </button>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
