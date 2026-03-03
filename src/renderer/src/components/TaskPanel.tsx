import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Task } from '../../../shared/task'

const STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Pending',
  approved: 'Approved',
  running: 'Running',
  completed: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled'
}

const STATUS_COLORS: Record<string, string> = {
  pending_approval: 'var(--nb-muted)',
  approved: 'var(--nb-accent-2)',
  running: 'var(--nb-accent-2)',
  completed: 'var(--nb-accent-2)',
  failed: 'var(--nb-danger)',
  cancelled: 'var(--nb-muted)'
}

function TaskDropdown(props: {
  anchorEl: HTMLElement
  isRunning: boolean
  onStop: () => void
  onDelete: () => void
  onClose: () => void
}): React.JSX.Element {
  const rect = props.anchorEl.getBoundingClientRect()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        !props.anchorEl.contains(e.target as Node)
      ) {
        props.onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [props])

  return createPortal(
    <div
      ref={ref}
      className="rbDropdown"
      style={{
        position: 'fixed',
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
        zIndex: 9999
      }}
    >
      {props.isRunning && (
        <button
          className="rbDropdownItem"
          onClick={() => {
            props.onStop()
            props.onClose()
          }}
        >
          Stop
        </button>
      )}
      <button
        className="rbDropdownItem danger"
        onClick={() => {
          props.onDelete()
          props.onClose()
        }}
      >
        Delete
      </button>
    </div>,
    document.body
  )
}

export function TaskPanel(props: {
  tasks: Task[]
  activeTaskId: string | null
  onSelectTask: (id: string) => void
  onNewTask: () => void
  onStopTask: (id: string) => void
  onDeleteTask: (id: string) => void
}): React.JSX.Element {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  const closeMenu = useCallback(() => {
    setMenuOpenId(null)
    setMenuAnchor(null)
  }, [])

  return (
    <div className="taskPanelWrap">
      <div className="rbTop">
        <div className="rbTitle">Tasks</div>
        <button className="rbNew" onClick={props.onNewTask}>
          New
        </button>
      </div>

      <div className="rbList" role="tablist" aria-label="Tasks">
        {props.tasks.length === 0 && (
          <div className="taskEmpty">No tasks yet. Click &quot;New&quot; to create one.</div>
        )}
        {props.tasks.map((t) => (
          <div
            key={t.id}
            className={`rbItem ${t.id === props.activeTaskId ? 'active' : ''}`}
            role="tab"
            aria-selected={t.id === props.activeTaskId}
          >
            <div className="rbItemContent" onClick={() => props.onSelectTask(t.id)}>
              <div className="rbItemTitle">{t.prompt.slice(0, 40)}</div>
              <div className="rbItemMeta">
                <span className="taskStatusBadge" style={{ color: STATUS_COLORS[t.status] }}>
                  {STATUS_LABELS[t.status] ?? t.status}
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
                if (menuOpenId === t.id) {
                  closeMenu()
                } else {
                  setMenuOpenId(t.id)
                  setMenuAnchor(e.currentTarget)
                }
              }}
            >
              ···
            </button>
          </div>
        ))}
      </div>

      {menuOpenId && menuAnchor && (
        <TaskDropdown
          anchorEl={menuAnchor}
          isRunning={props.tasks.find((t) => t.id === menuOpenId)?.status === 'running'}
          onStop={() => props.onStopTask(menuOpenId)}
          onDelete={() => props.onDeleteTask(menuOpenId)}
          onClose={closeMenu}
        />
      )}
    </div>
  )
}
