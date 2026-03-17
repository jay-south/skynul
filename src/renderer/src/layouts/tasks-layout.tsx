import { useMemo, useState } from 'react'
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { useCancelTask, useDeleteTask, useTasks } from '../queries/tasks'

export function TasksLayout(): React.JSX.Element {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const { taskId } = useParams()

  // Queries
  const { data: tasksResponse } = useTasks()
  const tasks = tasksResponse?.tasks ?? []

  // Mutations
  const deleteTaskMutation = useDeleteTask()
  const cancelTaskMutation = useCancelTask()

  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks
    return tasks.filter(
      (t) =>
        t.prompt?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.id.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [tasks, searchQuery])

  // Get root tasks only (no parent)
  const rootTasks = useMemo(() => {
    return filteredTasks.filter((t) => !t.parentTaskId)
  }, [filteredTasks])

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

  return (
    <div className="tasksLayout">
      {/* Task sidebar */}
      <div className="tasksSidebar">
        <div className="sidebarToolbar">
          <NavLink to="/tasks" className="sidebarToolbarBtn" end>
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              <path d="M4 1l.5 1.5L6 3l-1.5.5L4 5l-.5-1.5L2 3l1.5-.5L4 1z" />
            </svg>
            New Task
          </NavLink>
        </div>

        <div className="sidebarSearch">
          <input
            className="sidebarSearchInput"
            type="text"
            placeholder="Search tasks…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Task List */}
        <div className="taskPanelWrap">
          <div className="rbTop">
            <div className="rbTitle">Tasks</div>
          </div>

          <div className="rbList" role="tablist" aria-label="Tasks">
            {rootTasks.length === 0 && (
              <div className="taskEmpty">No tasks yet. Click "New" to create one.</div>
            )}
            {rootTasks.map((t) => (
              <div
                key={t.id}
                className={`rbItem ${t.id === activeRootId ? 'active' : ''}`}
                role="tab"
                aria-selected={t.id === activeRootId}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/task-id', t.id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onClick={() => navigate(`/tasks/${t.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <div className="rbItemContent">
                  <div className="rbItemTitle">{t.prompt.slice(0, 40)}</div>
                  <div className="rbItemMeta">
                    <span
                      className="taskStatusBadge"
                      style={{
                        color:
                          t.status === 'failed'
                            ? 'var(--nb-danger)'
                            : t.status === 'running' || t.status === 'completed'
                              ? 'var(--nb-accent-2)'
                              : 'var(--nb-muted)'
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
                    {' · '}
                    {t.steps.length} steps
                  </div>
                </div>
                <button
                  className="rbMenuBtn"
                  aria-label="Task options"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (t.status === 'running') {
                      cancelTaskMutation.mutate(t.id)
                    } else {
                      deleteTaskMutation.mutate(t.id)
                    }
                  }}
                >
                  {t.status === 'running' ? '⏹' : '×'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="tasksMain">
        <Outlet />
      </div>
    </div>
  )
}
