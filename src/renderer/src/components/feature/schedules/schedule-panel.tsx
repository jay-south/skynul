import type { Schedule, ScheduleFrequency } from '@skynul/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './schedule-panel.module.css'

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
    label: 'Custom',
    desc: 'Pick specific days and time',
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
  const [customDays, setCustomDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [customTime, setCustomTime] = useState('09:00')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[3]

  const buildCustomCron = (): string => {
    const [h, m] = customTime.split(':').map(Number)
    const days =
      customDays.length === 7 || customDays.length === 0 ? '*' : customDays.sort().join(',')
    return `${m} ${h} * * ${days}`
  }

  const cronExpr = preset.needsCustomCron ? buildCustomCron() : buildCron(preset, time, dow)

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
      <div className={styles.schedCard}>
        <div className={styles.schedCardRow}>
          <div className={styles.schedCardLabel}>Frequency</div>
          <div className={styles.schedRowBody}>
            <div className={styles.schedPresets} role="list" aria-label="Frequency presets">
              {PRESETS.filter((p) => p.id !== 'custom').map((p) => (
                <button
                  key={p.id}
                  className={`${styles.schedPresetChip} ${presetId === p.id ? styles.schedPresetChipOn : ''}`}
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
          <div className={styles.schedCardRow}>
            <div className={styles.schedCardLabel}>Time</div>
            <div className={styles.schedTimeRow}>
              <input
                type="time"
                className={styles.schedTimeInput}
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
              {preset.needsDow && (
                <select
                  className={styles.schedDowSelect}
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
          <>
            <div className={styles.schedCardRow}>
              <div className={styles.schedCardLabel}>Days</div>
              <div className={styles.schedDayPicker}>
                {DAYS.map((d, i) => (
                  <button
                    key={i}
                    className={`${styles.schedDayBtn} ${customDays.includes(i) ? styles.schedDayBtnOn : ''}`}
                    onClick={() =>
                      setCustomDays((prev) =>
                        prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
                      )
                    }
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.schedCardRow}>
              <div className={styles.schedCardLabel}>Time</div>
              <div className={styles.schedTimeRow}>
                <input
                  type="time"
                  className={styles.schedTimeInput}
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        <div className={styles.schedCardFooter}>
          <div className={styles.schedPreview}>
            <span className={styles.schedPreviewDesc}>{preset.desc}</span>
            {nextRunAtPreview > 0 && (
              <span className={styles.schedPreviewNext}>Next run {fmtNext(nextRunAtPreview)}</span>
            )}
          </div>
          <button className={styles.schedCancelLink} onClick={props.onCancel}>
            Cancel
          </button>
        </div>
      </div>

      {presetId !== 'custom' && (
        <button className={styles.schedCustomToggle} onClick={() => setPresetId('custom')}>
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Custom schedule
        </button>
      )}
    </>
  )
}

/* ── Schedule Detail (center panel) ────────────────────────────────── */

import type { Task } from '@skynul/shared'

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
    <div className={styles.schedDetail}>
      <div className={styles.schedDetailHeader}>
        <button className={styles.schedDetailBack} onClick={props.onBack}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z" />
          </svg>
          Back
        </button>

        <span
          className={`${styles.schedDetailStatus} ${s.enabled ? styles.schedDetailStatusOn : ''}`}
        >
          {s.enabled ? 'Active' : 'Paused'}
        </span>
      </div>

      <div className={styles.schedDetailPrompt}>{s.prompt}</div>

      <div className={styles.schedDetailCard}>
        <div className={styles.schedDetailGrid}>
          <div className={styles.schedDetailLabel}>Frequency</div>
          <div className={styles.schedDetailValue}>{s.frequency}</div>

          <div className={styles.schedDetailLabel}>Cron</div>
          <div className={styles.schedDetailCronRow}>
            <code className={styles.schedDetailCode}>{s.cronExpr}</code>
            <button
              className={styles.schedDetailCopy}
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

          <div className={styles.schedDetailLabel}>Next run</div>
          <div className={styles.schedDetailValue} title={new Date(s.nextRunAt).toLocaleString()}>
            {fmtNext(s.nextRunAt)}
          </div>

          {s.lastRunAt && (
            <>
              <div className={styles.schedDetailLabel}>Last run</div>
              <div
                className={styles.schedDetailValue}
                title={new Date(s.lastRunAt).toLocaleString()}
              >
                {new Date(s.lastRunAt).toLocaleString()}
              </div>
            </>
          )}
        </div>
      </div>

      <div className={styles.schedDetailActions}>
        <button className={`btn ${styles.schedDetailBtn}`} onClick={props.onToggle}>
          {s.enabled ? 'Pause' : 'Enable'}
        </button>
        <button
          className={`btn ${styles.schedDetailBtn} ${styles.schedDetailBtnDanger}`}
          onClick={props.onDelete}
        >
          Delete
        </button>
      </div>

      {/* ── Run history ─────────────────────────────────────────── */}
      <div className={styles.schedRunHistory}>
        <div className={styles.schedRunHistoryTitle}>Run history</div>
        {runs.length === 0 && <div className={styles.schedRunEmpty}>No runs yet.</div>}
        {runs.map((t) => (
          <button
            key={t.id}
            className={styles.schedRunItem}
            onClick={() => props.onViewProcess(t.id)}
          >
            <span className={styles.schedRunDot}>{statusDot(t.status)}</span>
            <span className={styles.schedRunDate}>
              {new Date(t.createdAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
            <span className={styles.schedRunDuration}>
              {t.updatedAt > t.createdAt ? fmtDuration(t.createdAt, t.updatedAt) : '—'}
            </span>
            {t.usage && (
              <span className={styles.schedRunTokens}>
                {((t.usage.inputTokens + t.usage.outputTokens) / 1000).toFixed(1)}k tok
              </span>
            )}
            <svg
              className={styles.schedRunArrow}
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="currentColor"
            >
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
      <button className={styles.schedNewBtn} onClick={props.onNewSchedule}>
        + New Schedule
      </button>

      <div className={styles.rbList} role="list" aria-label="Schedules">
        {props.schedules.length === 0 && <div className="taskEmpty">No scheduled tasks yet.</div>}
        {props.schedules.map((s) => (
          <div
            key={s.id}
            className={`rbItem schedItem ${props.activeScheduleId === s.id ? 'active' : ''}`}
            role="tab"
            aria-selected={props.activeScheduleId === s.id}
          >
            <div
              className={styles.rbItemContent}
              style={{ opacity: s.enabled ? 1 : 0.5 }}
              onClick={() => props.onSelect(s.id)}
            >
              <div className={styles.rbItemTitle} title={s.prompt}>
                {s.prompt.slice(0, 40)}
              </div>
              <div className={styles.schedItemMeta}>
                <span
                  className={`${styles.schedPill} ${s.enabled ? styles.schedPillOn : styles.schedPillOff}`}
                >
                  {s.enabled ? 'Active' : 'Paused'}
                </span>
                <span className={styles.schedPill}>{s.frequency}</span>
                <span
                  className={`${styles.schedPill} ${styles.schedPillNext}`}
                  title={new Date(s.nextRunAt).toLocaleString()}
                >
                  Next {fmtNext(s.nextRunAt)}
                  <span className={styles.schedPillTime}>
                    {new Date(s.nextRunAt).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </span>
              </div>
            </div>
            <div className={styles.rbItemActions}>
              <button
                className={`${styles.scheduleToggleBtn} ${s.enabled ? styles.scheduleToggleBtnOn : styles.scheduleToggleBtnOff}`}
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
                className={styles.rbMenuBtn}
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
