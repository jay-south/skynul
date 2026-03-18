import type { Task } from '@skynul/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './TaskPanel.module.css'

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
      className={styles.rbDropdown}
      style={{
        position: 'fixed',
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
        zIndex: 9999
      }}
    >
      {props.isRunning && (
        <button
          className={styles.rbDropdownItem}
          onClick={() => {
            props.onStop()
            props.onClose()
          }}
        >
          Stop
        </button>
      )}
      <button
        className={`${styles.rbDropdownItem} ${styles.rbDropdownItemDanger}`}
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

  const byId = useMemo(() => new Map(props.tasks.map((t) => [t.id, t] as const)), [props.tasks])

  const activeRootId = useMemo(() => {
    if (!props.activeTaskId) return null
    let cur = byId.get(props.activeTaskId)
    let hops = 0
    while (cur?.parentTaskId && hops < 50) {
      const next = byId.get(cur.parentTaskId)
      if (!next) break
      cur = next
      hops++
    }
    return cur?.id ?? props.activeTaskId
  }, [byId, props.activeTaskId])

  // Sub-agent tasks are shown in the Multi-Agent Control Room, not as separate items.
  const rootTasks = useMemo(() => props.tasks.filter((t) => !t.parentTaskId), [props.tasks])

  const closeMenu = useCallback(() => {
    setMenuOpenId(null)
    setMenuAnchor(null)
  }, [])

  return (
    <div className={styles.taskPanelWrap}>
      <div className={styles.rbTop}>
        <div className={styles.rbTitle}>Tasks</div>
        <button className={styles.rbNew} onClick={props.onNewTask}>
          New
        </button>
      </div>

      <div className={styles.rbList} role="tablist" aria-label="Tasks">
        {rootTasks.length === 0 && (
          <div className={styles.taskEmpty}>No tasks yet. Click "New" to create one.</div>
        )}
        {rootTasks.map((t) => (
          <div
            key={t.id}
            className={`${styles.rbItem} ${t.id === activeRootId ? styles.rbItemActive : ''}`}
            role="tab"
            aria-selected={t.id === activeRootId}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/task-id', t.id)
              e.dataTransfer.effectAllowed = 'move'
            }}
          >
            <div className={styles.rbItemContent} onClick={() => props.onSelectTask(t.id)}>
              <div className={styles.rbItemTitle}>{t.prompt.slice(0, 40)}</div>
              <div className={styles.rbItemMeta}>
                <span className={styles.taskStatusBadge} style={{ color: STATUS_COLORS[t.status] }}>
                  {STATUS_LABELS[t.status] ?? t.status}
                </span>
                {' · '}
                {t.steps.length} steps
              </div>
            </div>
            <button
              className={styles.rbMenuBtn}
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
