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
  onSubmit: (text: string, attachments?: string[]) => void
  onTextChange?: (text: string) => void
  onStop?: () => void
}): React.JSX.Element {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<string[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const submit = (): void => {
    const trimmed = text.trim()
    if (!trimmed) return
    props.onSubmit(trimmed, attachments.length ? attachments : undefined)
    setText('')
    setAttachments([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const pickFiles = async (): Promise<void> => {
    try {
      const res = await window.skynul.showOpenFilesDialog()
      if (res.canceled) return
      const next = [...attachments]
      for (const p of res.filePaths) {
        if (!next.includes(p)) next.push(p)
      }
      setAttachments(next)
    } catch {
      // ignore
    }
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
    rec.onerror = (e: Event & { error?: string }): void => {
      console.warn('[SpeechRecognition] error:', e.error ?? e)
      setIsRecording(false)
    }
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
      return
    }
    // Ctrl+V / Cmd+V — check for image in clipboard
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      console.log('[paste] ctrl+v detected, key:', e.key, 'ctrl:', e.ctrlKey)
      e.preventDefault()
      void (async () => {
        const filePath = await window.skynul.fsSaveTempFile()
        console.log('[paste] raw result:', filePath)
        if (filePath) {
          setAttachments((prev) => (prev.includes(filePath) ? prev : [...prev, filePath]))
          return
        }
        // No image — paste text manually
        const clipText = await window.skynul.clipboardReadText()
        if (!clipText) return
        const el = textareaRef.current
        if (!el) { setText((prev) => prev + clipText); return }
        const start = el.selectionStart ?? el.value.length
        const end = el.selectionEnd ?? el.value.length
        const next = el.value.slice(0, start) + clipText + el.value.slice(end)
        setText(next)
        requestAnimationFrame(() => {
          el.selectionStart = start + clipText.length
          el.selectionEnd = start + clipText.length
        })
      })()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setText(e.target.value)
    props.onTextChange?.(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 220) + 'px'
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

  const attachButton = (
    <button className="inputBarAttachBtn" onClick={() => void pickFiles()} title="Attach files">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
        <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z" />
      </svg>
    </button>
  )

  const attachmentsRow =
    attachments.length > 0 ? (
      <div className="inputBarAttachments" aria-label="Attachments">
        {attachments.slice(0, 8).map((p) => {
          const isDataUrl = p.startsWith('data:image/')
          const name = isDataUrl ? 'imagen' : (p.split(/[\\/]/).pop() || p)
          const isImage = isDataUrl || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(p)
          return (
            <div key={p} className={`inputBarAttachment${isImage ? ' inputBarAttachmentImg' : ''}`} title={p}>
              {isImage ? (
                <img src={p} className="inputBarAttachmentThumb" alt={name} />
              ) : (
                <span className="inputBarAttachmentName">{name}</span>
              )}
              <button
                className="inputBarAttachmentRemove"
                onClick={() => setAttachments((prev) => prev.filter((x) => x !== p))}
                title="Remove"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.7 2.88 18.29 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.29-6.3z" />
                </svg>
              </button>
            </div>
          )
        })}
        {attachments.length > 8 ? (
          <div className="inputBarAttachmentMore">+{attachments.length - 8}</div>
        ) : null}
      </div>
    ) : null

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
            {attachButton}
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
          {attachmentsRow}
        </div>
      </div>
    )
  }

  // ── Full: centered ─────────────
  return (
    <div className="inputBar">
      {capsHint && <div className="inputBarCapsHint">{capsHint}</div>}
      <div className="inputBarInner">
        {attachButton}
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
      {attachmentsRow}
    </div>
  )
}
