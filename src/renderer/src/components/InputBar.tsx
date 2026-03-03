import { useRef, useState } from 'react'
import type { LanguageCode } from '../../../shared/policy'
import type { TaskCapabilityId } from '../../../shared/task'
import { ALL_TASK_CAPABILITIES } from '../../../shared/task'
import { speechLocale } from '../i18n'

export function InputBar(props: {
  lang: LanguageCode
  autoCaps: TaskCapabilityId[]
  /** true = compact mode (inside feed, full-width border) */
  compact: boolean
  onSubmit: (text: string) => void
  onTextChange?: (text: string) => void
  onStop?: () => void
}): React.JSX.Element {
  const [text, setText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const submit = (): void => {
    const trimmed = text.trim()
    if (!trimmed) return
    props.onSubmit(trimmed)
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const toggleMic = (): void => {
    if (isRecording) {
      recognitionRef.current?.stop()
      return
    }
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) return

    const rec = new SR()
    rec.lang = speechLocale(props.lang)
    rec.interimResults = true
    rec.continuous = true
    const base = text.trim()
    rec.onstart = (): void => setIsRecording(true)
    rec.onend = (): void => setIsRecording(false)
    rec.onerror = (): void => setIsRecording(false)
    rec.onresult = (e: SpeechRecognitionEvent): void => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(' ')
        .trim()
      setText(base ? `${base} ${transcript}` : transcript)
    }
    recognitionRef.current = rec
    rec.start()
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setText(e.target.value)
    props.onTextChange?.(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  const capsHint =
    !props.compact && text.trim() && props.autoCaps.length > 0
      ? props.autoCaps
          .map((c) => ALL_TASK_CAPABILITIES.find((a) => a.id === c)?.title)
          .filter(Boolean)
          .join(', ')
      : null

  const micButton = (
    <button
      className={`inputBarMicBtn ${isRecording ? 'recording' : ''}`}
      onClick={toggleMic}
      title={isRecording ? 'Stop recording' : 'Voice input'}
    >
      {isRecording ? (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4Zm6.5 9a.5.5 0 0 1 .5.5 7 7 0 0 1-6.5 6.97V19h2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1h2v-1.53A7 7 0 0 1 5 10.5a.5.5 0 0 1 1 0 6 6 0 0 0 12 0 .5.5 0 0 1 .5-.5Z" />
        </svg>
      )}
    </button>
  )

  const sendButton = (
    <button
      className="inputBarSendBtn"
      onClick={submit}
      disabled={!text.trim()}
      title={props.compact ? 'Send message' : 'Create task'}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
      </svg>
    </button>
  )

  // ── Compact: inside feed, full-width border ────
  if (props.compact) {
    return (
      <div className="inputBarWrap">
        <div className="inputBar">
          <div className="inputBarInner">
            <textarea
              ref={textareaRef}
              className="inputBarTextarea"
              placeholder="Send a message to the agent..."
              value={text}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <div className="inputBarActions">
              {props.onStop && (
                <button className="inputBarStopBtn" onClick={props.onStop} title="Stop task">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              )}
              {micButton}
              {sendButton}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Full: centered ─────────────
  return (
    <div className="inputBar">
      {capsHint && <div className="inputBarCapsHint">{capsHint}</div>}
      <div className="inputBarInner">
        <textarea
          ref={textareaRef}
          className="inputBarTextarea"
          placeholder="What should the agent do?"
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <div className="inputBarActions">
          {micButton}
          {sendButton}
        </div>
      </div>
    </div>
  )
}
