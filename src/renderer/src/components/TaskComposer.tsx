import { useEffect, useMemo, useRef, useState } from 'react'
import type { LanguageCode } from '../../../shared/policy'
import type { TaskCapabilityId } from '../../../shared/task'
import { ALL_TASK_CAPABILITIES } from '../../../shared/task'
import { speechLocale, t } from '../i18n'
import {
  deleteSavedPrompt,
  loadSavedPrompts,
  persistSavedPrompts,
  savePromptText,
  type SavedPrompt
} from '../task-prompts'
import type { TaskTemplateId } from './TaskTemplates'
import type { ScheduleFrequency } from '../../../shared/schedule'

function templateTitleKey(template: TaskTemplateId): Parameters<typeof t>[1] {
  switch (template) {
    case 'daily':
      return 'task_composer_title_daily'
    case 'trading':
      return 'task_composer_title_trading'
    case 'chat':
      return 'task_composer_title_chat'
    case 'custom':
      return 'task_composer_title_custom'
  }
}

// ── Schedule presets ──────────────────────────────────────────────────

type SchedPreset = {
  id: string
  label: string
  desc: string
  frequency: ScheduleFrequency
  cronExpr: string
  needsTime: boolean
  needsDow: boolean
}

const SCHED_PRESETS: SchedPreset[] = [
  { id: 'hourly',    label: 'Every hour',      desc: 'Runs at :00 every hour',          frequency: 'custom', cronExpr: '0 * * * *',   needsTime: false, needsDow: false },
  { id: '4h',        label: 'Every 4 hours',   desc: 'Runs every 4 hours from midnight', frequency: 'custom', cronExpr: '0 */4 * * *', needsTime: false, needsDow: false },
  { id: '2x_day',    label: 'Twice a day',     desc: '9 AM and 3 PM',                   frequency: 'custom', cronExpr: '0 9,15 * * *', needsTime: false, needsDow: false },
  { id: 'daily',     label: 'Once a day',      desc: 'Pick a time below',               frequency: 'daily',  cronExpr: '',             needsTime: true,  needsDow: false },
  { id: 'weekdays',  label: 'Weekdays only',   desc: 'Mon–Fri at a chosen time',        frequency: 'custom', cronExpr: '',             needsTime: true,  needsDow: false },
  { id: 'weekly',    label: 'Once a week',     desc: 'Pick day + time',                 frequency: 'weekly', cronExpr: '',             needsTime: true,  needsDow: true  },
  { id: 'custom',    label: 'Custom (cron)',   desc: 'Advanced: write a cron expression', frequency: 'custom', cronExpr: '',           needsTime: false, needsDow: false }
]

function buildPresetCron(preset: SchedPreset, time: string, dow: number, customCron: string): string {
  if (preset.id === 'custom') return customCron.trim() || '0 9 * * *'
  if (!preset.needsTime) return preset.cronExpr

  const [h, m] = time.split(':').map(Number)
  const hour = isNaN(h) ? 9 : h
  const minute = isNaN(m) ? 0 : m

  if (preset.id === 'weekdays') return `${minute} ${hour} * * 1-5`
  if (preset.id === 'weekly') return `${minute} ${hour} * * ${dow}`
  return `${minute} ${hour} * * *` // daily
}

function nextCronTimeLocal(cronExpr: string): number {
  const parts = cronExpr.trim().split(/\s+/)
  if (parts.length !== 5) return Date.now() + 86_400_000
  const [minStr, hourStr, , , dowStr] = parts
  const minute = parseInt(minStr, 10)
  const hour = parseInt(hourStr, 10)
  if (isNaN(minute) || isNaN(hour)) return Date.now() + 86_400_000

  const now = new Date()

  if (dowStr !== '*') {
    const targetDow = parseInt(dowStr, 10)
    if (isNaN(targetDow)) return Date.now() + 86_400_000
    for (let off = 0; off <= 7; off++) {
      const c = new Date(now)
      c.setDate(c.getDate() + off)
      c.setHours(hour, minute, 0, 0)
      if (c.getDay() === targetDow && c.getTime() > Date.now()) return c.getTime()
    }
    return Date.now() + 7 * 86_400_000
  }

  const today = new Date(now)
  today.setHours(hour, minute, 0, 0)
  if (today.getTime() > Date.now()) return today.getTime()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(hour, minute, 0, 0)
  return tomorrow.getTime()
}

export function TaskComposer(props: {
  lang: LanguageCode
  template: TaskTemplateId
  onCancel: () => void
  onSubmit: (prompt: string, caps: TaskCapabilityId[]) => void
  onSchedule?: (sched: Record<string, unknown>) => void
}): React.JSX.Element {
  const { lang } = props
  const title = useMemo(() => t(lang, templateTitleKey(props.template)), [lang, props.template])

  const [prompt, setPrompt] = useState('')
  const [runMode, setRunMode] = useState<'once' | 'schedule'>('once')
  const [schedPresetId, setSchedPresetId] = useState('daily')
  const [schedTime, setSchedTime] = useState('09:00')
  const [schedDow, setSchedDow] = useState(1) // Monday
  const [customCron, setCustomCron] = useState('0 9 * * *')
  const [selectedCaps, setSelectedCaps] = useState<Set<TaskCapabilityId>>(
    new Set<TaskCapabilityId>(['browser.cdp'])
  )
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>(loadSavedPrompts)
  const [savedFeedback, setSavedFeedback] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null)

  useEffect(() => {
    setPrompt('')
  }, [props.template])

  const toggleCap = (id: TaskCapabilityId): void => {
    setSelectedCaps((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const saveCurrentPrompt = (): void => {
    const next = savePromptText(savedPrompts, prompt)
    setSavedPrompts(next)
    persistSavedPrompts(next)
    setSavedFeedback(true)
    setTimeout(() => setSavedFeedback(false), 1500)
  }

  const removeSaved = (id: string): void => {
    const next = deleteSavedPrompt(savedPrompts, id)
    setSavedPrompts(next)
    persistSavedPrompts(next)
  }

  const submit = (): void => {
    const text = prompt.trim()
    if (!text) return

    if (runMode === 'schedule' && props.onSchedule) {
      const preset = SCHED_PRESETS.find((p) => p.id === schedPresetId) ?? SCHED_PRESETS[3]
      const cronExpr = buildPresetCron(preset, schedTime, schedDow, customCron)
      props.onSchedule({
        prompt: text,
        capabilities: [...selectedCaps],
        mode: 'screen',
        frequency: preset.frequency,
        cronExpr,
        enabled: true,
        lastRunAt: null,
        nextRunAt: nextCronTimeLocal(cronExpr)
      })
      return
    }

    props.onSubmit(text, [...selectedCaps])
  }

  const toggleMic = (): void => {
    if (isRecording) {
      recognitionRef.current?.stop()
      return
    }
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) return

    const rec = new SR()
    rec.lang = speechLocale(lang)
    rec.interimResults = true
    rec.continuous = true

    const base = prompt.trim()

    rec.onstart = (): void => setIsRecording(true)
    rec.onend = (): void => setIsRecording(false)
    rec.onerror = (e: Event & { error?: string }): void => {
      console.warn('[SpeechRecognition] error:', e.error ?? e)
      setIsRecording(false)
    }
    rec.onresult = (e: SpeechRecognitionEvent): void => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(' ')
        .trim()
      setPrompt(base ? `${base} ${transcript}` : transcript)
    }

    recognitionRef.current = rec
    rec.start()
  }

  return (
    <div className="taskComposerWrap">
      <div className="taskComposerHeader">
        <div className="taskComposerTitle">{title}</div>
        <div className="taskComposerActions">
          <button className="btnSecondary" onClick={props.onCancel}>
            {t(lang, 'common_cancel')}
          </button>
          <button className="btn" onClick={submit} disabled={!prompt.trim()}>
            {t(lang, 'tasks_new_from_template')}
          </button>
        </div>
      </div>

      <div className="taskComposerBody">
        {savedPrompts.length > 0 && (
          <div className="taskComposerSection">
            <div className="taskComposerLabel">{t(lang, 'task_composer_saved_label')}</div>
            <div className="savedPromptsList">
              {savedPrompts.map((sp) => (
                <div key={sp.id} className="savedPromptItem">
                  <button
                    className="savedPromptText"
                    title={sp.text}
                    onClick={() => setPrompt(sp.text)}
                  >
                    {sp.text.slice(0, 72)}
                    {sp.text.length > 72 ? '...' : ''}
                  </button>
                  <button
                    className="savedPromptDel"
                    aria-label={t(lang, 'tasks_remove_saved_prompt_aria')}
                    onClick={() => removeSaved(sp.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="taskComposerSection">
          <div className="taskComposerLabel">{t(lang, 'task_composer_prompt_label')}</div>
          <div className="taskComposerPromptWrap">
            <textarea
              className="taskNewPrompt taskComposerPrompt"
              placeholder={t(lang, 'tasks_prompt_placeholder')}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={7}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
            />
            <div className="taskComposerPromptActionsInner">
              <button
                className={`micBtn${isRecording ? ' recording' : ''}`}
                onClick={toggleMic}
                aria-label={isRecording ? 'Stop recording' : 'Voice input'}
                title={isRecording ? 'Stop recording' : 'Voice input'}
              >
                {isRecording ? (
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                    <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4Zm6.5 9a.5.5 0 0 1 .5.5 7 7 0 0 1-6.5 6.97V19h2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1h2v-1.53A7 7 0 0 1 5 10.5a.5.5 0 0 1 1 0 6 6 0 0 0 12 0 .5.5 0 0 1 .5-.5Z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="taskComposerPromptActions">
            <button
              className="btnSecondary"
              onClick={saveCurrentPrompt}
              disabled={!prompt.trim()}
              title={t(lang, 'tasks_save_prompt')}
            >
              {savedFeedback ? t(lang, 'tasks_saved') : t(lang, 'tasks_save_prompt')}
            </button>
          </div>
        </div>

        <div className="taskComposerSection">
          <div className="taskComposerLabel">{t(lang, 'task_composer_caps_label')}</div>
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
        </div>

        {/* ── Run mode: once vs schedule ──────────────────────────── */}
        {props.onSchedule && (
          <div className="taskComposerSection">
            <div className="taskComposerLabel">Run mode</div>
            <div className="seg seg--2col" style={{ marginBottom: 8 }}>
              <button
                className={`segBtn ${runMode === 'once' ? 'active' : ''}`}
                onClick={() => setRunMode('once')}
              >
                Run once
              </button>
              <button
                className={`segBtn ${runMode === 'schedule' ? 'active' : ''}`}
                onClick={() => setRunMode('schedule')}
              >
                Schedule
              </button>
            </div>

            {runMode === 'schedule' && (
              <>
                <div className="taskCapList" style={{ marginBottom: 8 }}>
                  {SCHED_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      className={`taskCapChip ${schedPresetId === p.id ? 'on' : ''}`}
                      onClick={() => setSchedPresetId(p.id)}
                      title={p.desc}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="settingsFieldHint" style={{ marginBottom: 8, fontSize: 12 }}>
                  {SCHED_PRESETS.find((p) => p.id === schedPresetId)?.desc}
                </div>

                {/* Time picker — shown for presets that need it */}
                {SCHED_PRESETS.find((p) => p.id === schedPresetId)?.needsTime && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                    <input
                      type="time"
                      value={schedTime}
                      onChange={(e) => setSchedTime(e.target.value)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: '1px solid var(--nb-border)',
                        background: 'var(--nb-surface-2)',
                        color: 'var(--nb-text)',
                        fontSize: 13
                      }}
                    />

                    {SCHED_PRESETS.find((p) => p.id === schedPresetId)?.needsDow && (
                      <select
                        value={schedDow}
                        onChange={(e) => setSchedDow(Number(e.target.value))}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid var(--nb-border)',
                          background: 'var(--nb-surface-2)',
                          color: 'var(--nb-text)',
                          fontSize: 13
                        }}
                      >
                        <option value={0}>Sunday</option>
                        <option value={1}>Monday</option>
                        <option value={2}>Tuesday</option>
                        <option value={3}>Wednesday</option>
                        <option value={4}>Thursday</option>
                        <option value={5}>Friday</option>
                        <option value={6}>Saturday</option>
                      </select>
                    )}
                  </div>
                )}

                {/* Custom cron input */}
                {schedPresetId === 'custom' && (
                  <input
                    type="text"
                    value={customCron}
                    onChange={(e) => setCustomCron(e.target.value)}
                    placeholder="0 9 * * *"
                    spellCheck={false}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid var(--nb-border)',
                      background: 'var(--nb-surface-2)',
                      color: 'var(--nb-text)',
                      fontSize: 13,
                      fontFamily: 'monospace',
                      width: '100%'
                    }}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
