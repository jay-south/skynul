import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Schedule, ScheduleFrequency } from '../../../shared/schedule'
import type { TaskCapabilityId } from '../../../shared/task'

/* ── Helpers ───────────────────────────────────────────────────────── */

function fmtNext(ts: number): string {
  const d = new Date(ts)
  const now = Date.now()
  const diffH = Math.round((ts - now) / 3_600_000)
  if (diffH < 1) return 'soon'
  if (diffH < 24) return `in ${diffH}h`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type SchedPreset = {
  id: string; label: string; desc: string
  frequency: ScheduleFrequency; cronExpr: string
  needsTime: boolean; needsDow: boolean
}

const PRESETS: SchedPreset[] = [
  { id: 'hourly',   label: 'Every hour',    desc: 'Runs at :00 every hour',           frequency: 'custom', cronExpr: '0 * * * *',   needsTime: false, needsDow: false },
  { id: '4h',       label: 'Every 4h',      desc: 'Every 4 hours from midnight',      frequency: 'custom', cronExpr: '0 */4 * * *', needsTime: false, needsDow: false },
  { id: 'daily',    label: 'Daily',         desc: 'Once a day at chosen time',        frequency: 'daily',  cronExpr: '',             needsTime: true,  needsDow: false },
  { id: 'weekdays', label: 'Weekdays',      desc: 'Mon–Fri at chosen time',           frequency: 'custom', cronExpr: '',             needsTime: true,  needsDow: false },
  { id: 'weekly',   label: 'Weekly',        desc: 'Once a week at chosen day + time', frequency: 'weekly', cronExpr: '',             needsTime: true,  needsDow: true  },
]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function buildCron(preset: SchedPreset, time: string, dow: number): string {
  if (!preset.needsTime) return preset.cronExpr
  const [h, m] = time.split(':').map(Number)
  if (preset.id === 'weekdays') return `${m} ${h} * * 1-5`
  if (preset.id === 'weekly') return `${m} ${h} * * ${dow}`
  return `${m} ${h} * * *`
}

function nextCronLocal(cronExpr: string): number {
  const parts = cronExpr.trim().split(/\s+/)
  if (parts.length < 5) return Date.now() + 3_600_000
  const [minP, hourP] = parts
  const now = new Date()
  const target = new Date(now)
  const mins = minP === '*' ? now.getMinutes() : parseInt(minP, 10)
  const hours = hourP === '*' ? now.getHours() : parseInt(hourP, 10)
  target.setHours(hours, mins, 0, 0)
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1)
  return target.getTime()
}

/* ── Dropdown ──────────────────────────────────────────────────────── */

function ScheduleDropdown(props: {
  anchorEl: HTMLElement
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

/* ── New Schedule Form ─────────────────────────────────────────────── */

function NewScheduleForm(props: {
  onSave: (data: Record<string, unknown>) => void
  onCancel: () => void
}): React.JSX.Element {
  const [prompt, setPrompt] = useState('')
  const [presetId, setPresetId] = useState('daily')
  const [time, setTime] = useState('09:00')
  const [dow, setDow] = useState(1)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[2]

  const handleSave = (): void => {
    if (!prompt.trim()) return
    const cronExpr = buildCron(preset, time, dow)
    const caps: TaskCapabilityId[] = ['browser.cdp']
    props.onSave({
      prompt: prompt.trim(),
      capabilities: caps,
      mode: 'browser',
      frequency: preset.frequency,
      cronExpr,
      enabled: true,
      nextRunAt: nextCronLocal(cronExpr)
    })
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setPrompt(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 80) + 'px'
  }

  return (
    <div className="schedNewForm">
      <textarea
        ref={textareaRef}
        className="schedNewPrompt"
        placeholder="What should the agent do?"
        value={prompt}
        onChange={handleInput}
        rows={2}
      />

      <div className="schedPresets">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            className={`schedPresetChip ${presetId === p.id ? 'active' : ''}`}
            onClick={() => setPresetId(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset.needsTime && (
        <div className="schedTimeRow">
          <input
            type="time"
            className="schedTimeInput"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
          {preset.needsDow && (
            <select
              className="schedDowSelect"
              value={dow}
              onChange={(e) => setDow(Number(e.target.value))}
            >
              {DAYS.map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="schedFormActions">
        <button className="btn schedSaveBtn" onClick={handleSave} disabled={!prompt.trim()}>Save</button>
        <button className="btn schedCancelBtn" onClick={props.onCancel}>Cancel</button>
      </div>
    </div>
  )
}

/* ── Main Panel ────────────────────────────────────────────────────── */

export function SchedulePanel(props: {
  schedules: Schedule[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onSave: (data: Record<string, unknown>) => void
}): React.JSX.Element {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [showNew, setShowNew] = useState(false)

  const closeMenu = useCallback(() => {
    setMenuOpenId(null)
    setMenuAnchor(null)
  }, [])

  return (
    <div className="taskPanelWrap">
      {showNew ? (
        <NewScheduleForm
          onSave={(data) => {
            props.onSave(data)
            setShowNew(false)
          }}
          onCancel={() => setShowNew(false)}
        />
      ) : (
        <button className="schedNewBtn" onClick={() => setShowNew(true)}>
          + New Schedule
        </button>
      )}

      <div className="rbList" role="list" aria-label="Schedules">
        {props.schedules.length === 0 && !showNew && (
          <div className="taskEmpty">No scheduled tasks yet.</div>
        )}
        {props.schedules.map((s) => (
          <div key={s.id} className="rbItem">
            <div className="rbItemContent" style={{ opacity: s.enabled ? 1 : 0.5 }}>
              <div className="rbItemTitle">{s.prompt.slice(0, 40)}</div>
              <div className="rbItemMeta">
                <span style={{ color: s.enabled ? 'var(--nb-accent-2)' : 'var(--nb-muted)' }}>
                  {s.enabled ? 'Active' : 'Paused'}
                </span>
                {' · '}
                {s.frequency}
                {' · next: '}
                {fmtNext(s.nextRunAt)}
              </div>
            </div>
            <button
              className="scheduleToggleBtn"
              onClick={() => props.onToggle(s.id)}
              aria-label={s.enabled ? 'Pause schedule' : 'Enable schedule'}
              title={s.enabled ? 'Pause' : 'Enable'}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: 'none',
                background: s.enabled ? 'var(--nb-accent-2)' : 'var(--nb-surface-2)',
                color: s.enabled ? '#fff' : 'var(--nb-muted)',
                cursor: 'pointer',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {s.enabled ? '||' : '>'}
            </button>
            <button
              className="rbMenuBtn"
              aria-label="Schedule options"
              onClick={(e) => {
                e.stopPropagation()
                if (menuOpenId === s.id) {
                  closeMenu()
                } else {
                  setMenuOpenId(s.id)
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
        <ScheduleDropdown
          anchorEl={menuAnchor}
          onDelete={() => {
            props.onDelete(menuOpenId)
            closeMenu()
          }}
          onClose={closeMenu}
        />
      )}
    </div>
  )
}
