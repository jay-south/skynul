import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Task, TaskCapabilityId } from '../../../shared/task'
import { ALL_TASK_CAPABILITIES } from '../../../shared/task'

type SavedPrompt = { id: string; text: string }

const SAVED_PROMPTS_KEY = 'netbot.savedTaskPrompts.v1'

function loadSavedPrompts(): SavedPrompt[] {
  try {
    const raw = localStorage.getItem(SAVED_PROMPTS_KEY)
    return raw ? (JSON.parse(raw) as SavedPrompt[]) : []
  } catch {
    return []
  }
}

function persistSavedPrompts(prompts: SavedPrompt[]): void {
  localStorage.setItem(SAVED_PROMPTS_KEY, JSON.stringify(prompts))
}

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

// Dropdown rendered via portal so it escapes rbList overflow:auto
function TaskDropdown(props: {
  anchorEl: HTMLElement
  onDelete: () => void
  onSavePrompt: () => void
  onClose: () => void
}): React.JSX.Element {
  const rect = props.anchorEl.getBoundingClientRect()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          !props.anchorEl.contains(e.target as Node)) {
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
      <button
        className="rbDropdownItem"
        onClick={() => {
          props.onSavePrompt()
          props.onClose()
        }}
      >
        Save prompt
      </button>
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
  onNewTask: (prompt: string, caps: TaskCapabilityId[]) => void
  onDeleteTask: (id: string) => void
}): React.JSX.Element {
  const [showNew, setShowNew] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [selectedCaps, setSelectedCaps] = useState<Set<TaskCapabilityId>>(
    new Set(['screen.read', 'input.mouse', 'input.keyboard'])
  )
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>(loadSavedPrompts)
  const [savedFeedback, setSavedFeedback] = useState(false)

  const closeMenu = useCallback(() => {
    setMenuOpenId(null)
    setMenuAnchor(null)
  }, [])

  const toggleCap = (id: TaskCapabilityId): void => {
    setSelectedCaps((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const savePromptText = (text: string): void => {
    const trimmed = text.trim()
    if (!trimmed) return
    const id = `sp_${Date.now().toString(36)}`
    const next = [{ id, text: trimmed }, ...savedPrompts.filter((p) => p.text !== trimmed)]
    setSavedPrompts(next)
    persistSavedPrompts(next)
    setSavedFeedback(true)
    setTimeout(() => setSavedFeedback(false), 1500)
  }

  const deleteSavedPrompt = (id: string): void => {
    const next = savedPrompts.filter((p) => p.id !== id)
    setSavedPrompts(next)
    persistSavedPrompts(next)
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
          {savedPrompts.length > 0 && (
            <div className="savedPromptsList">
              {savedPrompts.map((sp) => (
                <div key={sp.id} className="savedPromptItem">
                  <button
                    className="savedPromptText"
                    title={sp.text}
                    onClick={() => setPrompt(sp.text)}
                  >
                    {sp.text.slice(0, 48)}{sp.text.length > 48 ? '…' : ''}
                  </button>
                  <button
                    className="savedPromptDel"
                    aria-label="Remove saved prompt"
                    onClick={() => deleteSavedPrompt(sp.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
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
          <div className="taskNewFormActions">
            <button
              className="btnSecondary"
              onClick={() => savePromptText(prompt)}
              disabled={!prompt.trim()}
              title="Save this prompt for later"
            >
              {savedFeedback ? 'Saved!' : 'Save prompt'}
            </button>
            <button className="btn" onClick={submit} disabled={!prompt.trim()}>
              Create Task
            </button>
          </div>
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
          onSavePrompt={() => {
            const task = props.tasks.find((t) => t.id === menuOpenId)
            if (task) savePromptText(task.prompt)
          }}
          onDelete={() => props.onDeleteTask(menuOpenId)}
          onClose={closeMenu}
        />
      )}
    </>
  )
}
