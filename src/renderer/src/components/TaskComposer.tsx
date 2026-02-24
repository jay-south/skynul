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

export function TaskComposer(props: {
  lang: LanguageCode
  template: TaskTemplateId
  onCancel: () => void
  onSubmit: (prompt: string, caps: TaskCapabilityId[]) => void
}): React.JSX.Element {
  const { lang } = props
  const title = useMemo(() => t(lang, templateTitleKey(props.template)), [lang, props.template])

  const [prompt, setPrompt] = useState('')
  const [selectedCaps, setSelectedCaps] = useState<Set<TaskCapabilityId>>(
    new Set(['screen.read', 'input.mouse', 'input.keyboard'])
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
    rec.onerror = (): void => setIsRecording(false)
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
              rows={4}
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
      </div>
    </div>
  )
}
