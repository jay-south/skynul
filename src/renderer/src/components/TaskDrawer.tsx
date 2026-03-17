import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCancelTask, useDeleteTask, useTasks } from '../queries/tasks'
import { Drawer, DrawerContent, DrawerHeader, DrawerStyles, DrawerTitle } from './ui/drawer'

interface TaskDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export function TaskDrawer({ isOpen, onClose }: TaskDrawerProps): React.JSX.Element {
  const navigate = useNavigate()
  const { taskId } = useParams()

  // Queries
  const { data: tasksResponse } = useTasks()
  const tasks = tasksResponse?.tasks ?? []

  // Mutations
  const deleteTaskMutation = useDeleteTask()
  const cancelTaskMutation = useCancelTask()

  // Get root tasks only (no parent) - limit to last 15 for performance
  const rootTasks = useMemo(() => {
    return tasks
      .filter((t) => !t.parentTaskId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 15)
  }, [tasks])

  // Get active root task ID
  const activeRootId = useMemo(() => {
    if (!taskId) return null
    const byId = new Map(tasks.map((t) => [t.id, t] as const))
    let cur = byId.get(taskId)
    let hops = 0
    while (cur?.parentTaskId && hops < 50) {
      const next = byId.get(cur.parentTaskId)
      if (!next) break
      cur = next
      hops++
    }
    return cur?.id ?? taskId
  }, [tasks, taskId])

  const handleTaskClick = (id: string) => {
    navigate(`/tasks/${id}`)
    onClose()
  }

  const handleNewTask = () => {
    navigate('/tasks')
    onClose()
  }

  return (
    <>
      <DrawerStyles />
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent>
          <DrawerHeader>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <DrawerTitle>Recent Tasks</DrawerTitle>
              <button
                type="button"
                onClick={onClose}
                onKeyDown={(e) => e.key === 'Enter' && onClose()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--nb-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </DrawerHeader>

          {/* New Task Button */}
          <div style={{ padding: '12px 16px' }}>
            <button
              type="button"
              onClick={handleNewTask}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'var(--nb-accent)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Task
            </button>
          </div>

          {/* Task List */}
          <div style={{ flex: 1, overflow: 'auto', padding: '0 8px 8px' }}>
            {rootTasks.length === 0 ? (
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  color: 'var(--nb-muted)',
                  fontSize: '13px'
                }}
              >
                No tasks yet
              </div>
            ) : (
              rootTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => handleTaskClick(t.id)}
                  style={{
                    padding: '10px 12px',
                    marginBottom: '4px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: t.id === activeRootId ? 'var(--nb-accent-soft)' : 'transparent',
                    border:
                      t.id === activeRootId
                        ? '1px solid var(--nb-accent)'
                        : '1px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginBottom: '4px'
                    }}
                  >
                    {t.prompt?.slice(0, 40) || 'Untitled task'}
                    {t.prompt && t.prompt.length > 40 ? '...' : ''}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background:
                          t.status === 'failed'
                            ? 'rgba(239, 68, 68, 0.15)'
                            : t.status === 'running'
                              ? 'rgba(34, 197, 94, 0.15)'
                              : t.status === 'completed'
                                ? 'rgba(34, 197, 94, 0.15)'
                                : 'rgba(156, 163, 175, 0.15)',
                        color:
                          t.status === 'failed'
                            ? '#ef4444'
                            : t.status === 'running'
                              ? '#22c55e'
                              : t.status === 'completed'
                                ? '#22c55e'
                                : '#9ca3af'
                      }}
                    >
                      {t.status === 'pending_approval'
                        ? 'Pending'
                        : t.status === 'approved'
                          ? 'Approved'
                          : t.status === 'running'
                            ? 'Running'
                            : t.status === 'completed'
                              ? 'Done'
                              : t.status === 'failed'
                                ? 'Failed'
                                : t.status === 'cancelled'
                                  ? 'Cancelled'
                                  : t.status}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (t.status === 'running') {
                          cancelTaskMutation.mutate(t.id)
                        } else {
                          deleteTaskMutation.mutate(t.id)
                        }
                      }}
                      style={{
                        marginLeft: 'auto',
                        background: 'none',
                        border: 'none',
                        color: 'var(--nb-muted)',
                        cursor: 'pointer',
                        padding: '2px 4px',
                        fontSize: '12px',
                        opacity: 0.6,
                        transition: 'opacity 0.15s'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                    >
                      {t.status === 'running' ? '⏹' : '×'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
