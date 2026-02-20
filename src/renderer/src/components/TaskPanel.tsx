import { useState } from 'react'
import type { Task, TaskCapabilityId } from '../../../shared/task'
import { ALL_TASK_CAPABILITIES } from '../../../shared/task'

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
  approved: 'var(--nb-accent)',
  running: 'var(--nb-accent-2)',
  completed: 'var(--nb-accent)',
  failed: 'var(--nb-danger)',
  cancelled: 'var(--nb-muted)'
}

export function TaskPanel(props: {
  tasks: Task[]
  activeTaskId: string | null
  onSelectTask: (id: string) => void
  onNewTask: (prompt: string, caps: TaskCapabilityId[]) => void
}): React.JSX.Element {
  const [showNew, setShowNew] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [selectedCaps, setSelectedCaps] = useState<Set<TaskCapabilityId>>(
    new Set(['screen.read', 'input.mouse', 'input.keyboard'])
  )

  const toggleCap = (id: TaskCapabilityId): void => {
    setSelectedCaps((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const submit = (): void => {
    const text = prompt.trim()
    if (!text) return
    props.onNewTask(text, [...selectedCaps])
    setPrompt('')
    setShowNew(false)
  }

  return (
    <>
      <div className="rbTop">
        <div className="rbTitle">Tasks</div>
        <button className="rbNew" onClick={() => setShowNew(!showNew)}>
          {showNew ? 'Cancel' : 'New'}
        </button>
      </div>

      {showNew && (
        <div className="taskNewForm">
          <textarea
            className="taskNewPrompt"
            placeholder="Describe what you want the agent to do..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
          />
          <div className="taskCapList">
            {ALL_TASK_CAPABILITIES.map((c) => (
              <button
                key={c.id}
                className={`taskCapChip ${selectedCaps.has(c.id) ? 'on' : ''}`}
                onClick={() => toggleCap(c.id)}
                title={c.desc}
              >
                {c.title}
              </button>
            ))}
          </div>
          <button className="btn" onClick={submit} disabled={!prompt.trim()}>
            Create Task
          </button>
        </div>
      )}

      <div className="rbList" role="tablist" aria-label="Tasks">
        {props.tasks.length === 0 && !showNew && (
          <div className="taskEmpty">No tasks yet. Click "New" to create one.</div>
        )}
        {props.tasks.map((t) => (
          <div
            key={t.id}
            className={`rbItem ${t.id === props.activeTaskId ? 'active' : ''}`}
            role="tab"
            aria-selected={t.id === props.activeTaskId}
            onClick={() => props.onSelectTask(t.id)}
          >
            <div className="rbItemContent">
              <div className="rbItemTitle">{t.prompt.slice(0, 40)}</div>
              <div className="rbItemMeta">
                <span
                  className="taskStatusBadge"
                  style={{ color: STATUS_COLORS[t.status] }}
                >
                  {STATUS_LABELS[t.status] ?? t.status}
                </span>
                {' · '}
                {t.steps.length} steps
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
