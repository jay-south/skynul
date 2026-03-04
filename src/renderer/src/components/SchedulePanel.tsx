import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Schedule, ScheduleFrequency } from '../../../shared/schedule'

/* ── Helpers ───────────────────────────────────────────────────────── */

function fmtNext(ts: number): string {
  const now = Date.now()
  const diffMs = ts - now
  if (diffMs < 60_000) return 'now'
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 60) return `in ${diffMin}m`
  const diffH = Math.round(diffMs / 3_600_000)
  if (diffH < 24) return `in ${diffH}h`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

type SchedPreset = {
  id: string
  label: string
  desc: string
  frequency: ScheduleFrequency
  cronExpr: string
  needsTime: boolean
  needsDow: boolean
  needsCustomCron?: boolean
}

const PRESETS: SchedPreset[] = [
  {
    id: 'hourly',
    label: 'Every hour',
    desc: 'Runs at :00 every hour',
    frequency: 'custom',
    cronExpr: '0 * * * *',
    needsTime: false,
    needsDow: false
  },
  {
    id: '4h',
    label: 'Every 4 hours',
    desc: 'Runs every 4 hours from midnight',
    frequency: 'custom',
    cronExpr: '0 */4 * * *',
    needsTime: false,
    needsDow: false
  },
  {
    id: '2x_day',
    label: 'Twice a day',
    desc: '9 AM and 3 PM',
    frequency: 'custom',
    cronExpr: '0 9,15 * * *',
    needsTime: false,
    needsDow: false
  },
  {
    id: 'daily',
    label: 'Once a day',
    desc: 'Runs daily at the selected time',
    frequency: 'daily',
    cronExpr: '',
    needsTime: true,
    needsDow: false
  },
  {
    id: 'weekdays',
    label: 'Weekdays only',
    desc: 'Mon–Fri at a chosen time',
    frequency: 'custom',
    cronExpr: '',
    needsTime: true,
    needsDow: false
  },
  {
    id: 'weekly',
    label: 'Once a week',
    desc: 'Runs weekly on the selected day and time',
    frequency: 'weekly',
    cronExpr: '',
    needsTime: true,
    needsDow: true
  },
  {
    id: 'custom',
    label: 'Custom (cron)',
    desc: 'Advanced: write a cron expression',
    frequency: 'custom',
    cronExpr: '',
    needsTime: false,
    needsDow: false,
    needsCustomCron: true
  }
]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function buildCron(preset: SchedPreset, time: string, dow: number): string {
  if (preset.needsCustomCron) return ''
  if (!preset.needsTime) return preset.cronExpr
  const [h, m] = time.split(':').map(Number)
  if (preset.id === 'weekdays') return `${m} ${h} * * 1-5`
  if (preset.id === 'weekly') return `${m} ${h} * * ${dow}`
  return `${m} ${h} * * *`
}

function parseCronField(field: string, min: number, max: number): Set<number> {
  const out = new Set<number>()
  const f = field.trim()
  if (!f || f === '*') {
    for (let i = min; i <= max; i++) out.add(i)
    return out
  }

  // Step: */n
  const stepMatch = f.match(/^\*\/(\d+)$/)
  if (stepMatch) {
    const step = parseInt(stepMatch[1], 10)
    if (!isNaN(step) && step > 0) {
      for (let i = min; i <= max; i += step) out.add(i)
      return out
    }
  }

  for (const part of f.split(',')) {
    const p = part.trim()
    if (!p) continue
    const range = p.match(/^(\d+)-(\d+)$/)
    if (range) {
      const a = parseInt(range[1], 10)
      const b = parseInt(range[2], 10)
      if (isNaN(a) || isNaN(b)) continue
      const start = Math.max(min, Math.min(a, b))
      const end = Math.min(max, Math.max(a, b))
      for (let i = start; i <= end; i++) out.add(i)
      continue
    }

    const n = parseInt(p, 10)
    if (!isNaN(n) && n >= min && n <= max) out.add(n)
  }
  return out
}

function nextCronLocal(cronExpr: string): number {
  const parts = cronExpr.trim().split(/\s+/)
  if (parts.length !== 5) return Date.now() + 86_400_000
  const [minStr, hourStr, , , dowStr] = parts

  const minutes = parseCronField(minStr, 0, 59)
  const hours = parseCronField(hourStr, 0, 23)
  const dows = dowStr === '*' ? null : parseCronField(dowStr, 0, 6)

  const after = Date.now()
  const start = new Date(after)
  start.setSeconds(0, 0)
  start.setMinutes(start.getMinutes() + 1)

  const maxMinutes = 14 * 24 * 60 // 14 days
  for (let i = 0; i < maxMinutes; i++) {
    const c = new Date(start.getTime() + i * 60_000)
    if (!minutes.has(c.getMinutes())) continue
    if (!hours.has(c.getHours())) continue
    if (dows && !dows.has(c.getDay())) continue
    return c.getTime()
  }
  return after + 86_400_000
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

export function NewScheduleForm(props: {
  onSave: (data: Record<string, unknown>) => void
  onCancel: () => void
}): React.JSX.Element {
  const [prompt, setPrompt] = useState('')
  const [presetId, setPresetId] = useState('daily')
  const [time, setTime] = useState('09:00')
  const [dow, setDow] = useState(1)
  const [customCron, setCustomCron] = useState('0 9 * * *')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[3]

  const cronExpr = preset.needsCustomCron
    ? customCron.trim() || '0 9 * * *'
    : buildCron(preset, time, dow)

  const nextRunAtPreview = prompt.trim() ? nextCronLocal(cronExpr) : 0

  const handleSave = (): void => {
    if (!prompt.trim()) return
    props.onSave({
      prompt: prompt.trim(),
      capabilities: ['browser.cdp'],
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
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }

  return (
    <>
      {/* ── heading + input (same width as normal composer) ──────── */}
      <div className="composerHeading">Schedule a task</div>

      <div className="inputBar">
        <div className="inputBarInner">
          <textarea
            ref={textareaRef}
            className="inputBarTextarea"
            placeholder="What should the agent do?"
            value={prompt}
            onChange={handleInput}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSave()
              }
            }}
          />
          <div className="inputBarActions">
            <button
              className="inputBarSendBtn"
              onClick={handleSave}
              disabled={!prompt.trim()}
              title="Save schedule"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── schedule options card ────────────────────────────────── */}
      <div className="schedCard">
        <div className="schedCardRow">
          <div className="schedCardLabel">Frequency</div>
          <div className="schedRowBody">
            <div className="schedPresets" role="list" aria-label="Frequency presets">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  className={`schedPresetChip ${presetId === p.id ? 'active' : ''}`}
                  onClick={() => setPresetId(p.id)}
                  title={p.desc}
                  aria-pressed={presetId === p.id}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {preset.needsTime && (
          <div className="schedCardRow">
            <div className="schedCardLabel">Time</div>
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
                    <option key={i} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}

        {preset.needsCustomCron && (
          <div className="schedCardRow">
            <div className="schedCardLabel">Cron</div>
            <input
              type="text"
              className="schedCronInput"
              value={customCron}
              onChange={(e) => setCustomCron(e.target.value)}
              placeholder="0 9 * * *"
              spellCheck={false}
            />
          </div>
        )}

        <div className="schedCardFooter">
          <div className="schedPreview">
            <span className="schedPreviewDesc">{preset.desc}</span>
            {preset.needsCustomCron && <code>{cronExpr}</code>}
            {nextRunAtPreview > 0 && (
              <span className="schedPreviewNext">Next run {fmtNext(nextRunAtPreview)}</span>
            )}
          </div>
          <button className="schedCancelLink" onClick={props.onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}

/* ── Schedule Detail (center panel) ────────────────────────────────── */

import type { Task } from '../../../shared/task'

function fmtDuration(startMs: number, endMs: number): string {
  const s = Math.round((endMs - startMs) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${s % 60}s`
}

function statusDot(status: string): string {
  if (status === 'completed') return '🟢'
  if (status === 'failed') return '🔴'
  if (status === 'running') return '🟡'
  return '⚪'
}

export function ScheduleDetail(props: {
  schedule: Schedule
  tasks: Task[]
  onToggle: () => void
  onDelete: () => void
  onBack: () => void
  onViewProcess: (taskId: string) => void
}): React.JSX.Element {
  const s = props.schedule

  const runs = props.tasks
    .filter((t) => t.prompt === s.prompt)
    .sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div className="schedDetail">
      <div className="schedDetailHeader">
        <button className="schedDetailBack" onClick={props.onBack}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z" />
          </svg>
          Back
        </button>

        <span className={`schedDetailStatus ${s.enabled ? 'on' : 'off'}`}>
          {s.enabled ? 'Active' : 'Paused'}
        </span>
      </div>

      <div className="schedDetailPrompt">{s.prompt}</div>

      <div className="schedDetailCard">
        <div className="schedDetailGrid">
          <div className="schedDetailLabel">Frequency</div>
          <div className="schedDetailValue">{s.frequency}</div>

          <div className="schedDetailLabel">Cron</div>
          <div className="schedDetailCronRow">
            <code className="schedDetailCode">{s.cronExpr}</code>
            <button
              className="schedDetailCopy"
              type="button"
              title="Copy cron"
              onClick={() => {
                try {
                  void navigator.clipboard?.writeText(s.cronExpr)
                } catch {
                  // noop
                }
              }}
            >
              Copy
            </button>
          </div>

          <div className="schedDetailLabel">Next run</div>
          <div className="schedDetailValue" title={new Date(s.nextRunAt).toLocaleString()}>
            {fmtNext(s.nextRunAt)}
          </div>

          {s.lastRunAt && (
            <>
              <div className="schedDetailLabel">Last run</div>
              <div className="schedDetailValue" title={new Date(s.lastRunAt).toLocaleString()}>
                {new Date(s.lastRunAt).toLocaleString()}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="schedDetailActions">
        <button className="btn schedDetailBtn" onClick={props.onToggle}>
          {s.enabled ? 'Pause' : 'Enable'}
        </button>
        <button className="btn schedDetailBtn danger" onClick={props.onDelete}>
          Delete
        </button>
      </div>

      {/* ── Run history ─────────────────────────────────────────── */}
      <div className="schedRunHistory">
        <div className="schedRunHistoryTitle">Run history</div>
        {runs.length === 0 && <div className="schedRunEmpty">No runs yet.</div>}
        {runs.map((t) => (
          <button
            key={t.id}
            className="schedRunItem"
            onClick={() => props.onViewProcess(t.id)}
          >
            <span className="schedRunDot">{statusDot(t.status)}</span>
            <span className="schedRunDate">
              {new Date(t.createdAt).toLocaleString(undefined, {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </span>
            <span className="schedRunDuration">
              {t.updatedAt > t.createdAt ? fmtDuration(t.createdAt, t.updatedAt) : '—'}
            </span>
            {t.usage && (
              <span className="schedRunTokens">
                {((t.usage.inputTokens + t.usage.outputTokens) / 1000).toFixed(1)}k tok
              </span>
            )}
            <svg className="schedRunArrow" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Main Panel ────────────────────────────────────────────────────── */

export function SchedulePanel(props: {
  schedules: Schedule[]
  activeScheduleId: string | null
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onSelect: (id: string | null) => void
  onNewSchedule: () => void
}): React.JSX.Element {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  const closeMenu = useCallback(() => {
    setMenuOpenId(null)
    setMenuAnchor(null)
  }, [])

  return (
    <div className="taskPanelWrap">
      <button className="schedNewBtn" onClick={props.onNewSchedule}>
        + New Schedule
      </button>

      <div className="rbList" role="list" aria-label="Schedules">
        {props.schedules.length === 0 && <div className="taskEmpty">No scheduled tasks yet.</div>}
        {props.schedules.map((s) => (
          <div
            key={s.id}
            className={`rbItem schedItem ${props.activeScheduleId === s.id ? 'active' : ''}`}
            role="tab"
            aria-selected={props.activeScheduleId === s.id}
          >
            <div
              className="rbItemContent"
              style={{ opacity: s.enabled ? 1 : 0.5 }}
              onClick={() => props.onSelect(s.id)}
            >
              <div className="rbItemTitle" title={s.prompt}>
                {s.prompt.slice(0, 40)}
              </div>
              <div className="schedItemMeta">
                <span className={`schedPill ${s.enabled ? 'on' : 'off'}`}>
                  {s.enabled ? 'Active' : 'Paused'}
                </span>
                <span className="schedPill">{s.frequency}</span>
                <span
                  className="schedPill schedPillNext"
                  title={new Date(s.nextRunAt).toLocaleString()}
                >
                  Next {fmtNext(s.nextRunAt)}
                  <span className="schedPillTime">
                    {new Date(s.nextRunAt).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </span>
              </div>
            </div>
            <div className="rbItemActions">
              <button
                className={`scheduleToggleBtn ${s.enabled ? 'on' : 'off'}`}
                onClick={(e) => {
                  e.stopPropagation()
                  props.onToggle(s.id)
                }}
                aria-label={s.enabled ? 'Pause schedule' : 'Enable schedule'}
                title={s.enabled ? 'Pause' : 'Enable'}
              >
                {s.enabled ? (
                  <svg
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M8 5v14l11-7L8 5z" />
                  </svg>
                )}
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
