import type { LanguageCode } from '@shared'
import { useRef, useState } from 'react'
import { speechLocale } from '@/i18n'

export function InputBar(props: {
  lang: LanguageCode
  compact: boolean
  disabled?: boolean
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
    if (props.disabled) return
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
      /* ignore */
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
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      e.preventDefault()
      void (async () => {
        const clipText = await window.skynul.clipboardReadText()
        if (clipText) {
          const el = textareaRef.current
          if (!el) {
            setText((prev) => prev + clipText)
            return
          }
          const start = el.selectionStart ?? el.value.length
          const end = el.selectionEnd ?? el.value.length
          const next = el.value.slice(0, start) + clipText + el.value.slice(end)
          setText(next)
          requestAnimationFrame(() => {
            el.selectionStart = start + clipText.length
            el.selectionEnd = start + clipText.length
            el.style.height = 'auto'
            el.style.height = `${Math.min(el.scrollHeight, 220)}px`
          })
          return
        }
        const filePath = await window.skynul.fsSaveTempFile()
        if (filePath)
          setAttachments((prev) => (prev.includes(filePath) ? prev : [...prev, filePath]))
      })()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setText(e.target.value)
    props.onTextChange?.(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`
  }

  const btn =
    'w-7 h-7 rounded-full border-none flex items-center justify-center shrink-0 transition-colors duration-100'
  const micButton = (
    <button
      type="button"
      onClick={toggleMic}
      title={isRecording ? 'Stop recording' : 'Voice input'}
      className={`${btn} ${isRecording ? 'text-nb-danger animate-pulse' : 'bg-transparent text-nb-muted hover:text-nb-text'}`}
    >
      {isRecording ? (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <title>Stop recording</title>
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <title>Microphone</title>
          <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4Zm6.5 9a.5.5 0 0 1 .5.5 7 7 0 0 1-6.5 6.97V19h2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1h2v-1.53A7 7 0 0 1 5 10.5a.5.5 0 0 1 1 0 6 6 0 0 0 12 0 .5.5 0 0 1 .5-.5Z" />
        </svg>
      )}
    </button>
  )

  const attachButton = (
    <button
      type="button"
      onClick={() => void pickFiles()}
      title="Attach files"
      className={`${btn} bg-white/4 text-nb-muted hover:text-nb-text hover:bg-white/7`}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
        <title>Add attachment</title>
        <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z" />
      </svg>
    </button>
  )

  const attachmentsRow =
    attachments.length > 0 ? (
      <section className="flex flex-wrap gap-1.5 mt-2 pl-[2px]" aria-label="Attachments">
        {attachments.slice(0, 8).map((p) => {
          const isDataUrl = p.startsWith('data:image/')
          const name = isDataUrl ? 'imagen' : p.split(/[\\/]/).pop() || p
          const isImage = isDataUrl || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(p)
          return (
            <div
              key={p}
              className={`inline-flex items-center gap-1.5 max-w-full px-2.5 py-1.5 rounded-full border border-nb-border bg-nb-panel text-nb-text text-xs ${isImage ? 'p-1 rounded-xl overflow-hidden' : ''}`}
              title={p}
            >
              {isImage ? (
                <img src={p} className="w-14 h-14 object-cover rounded-md block" alt={name} />
              ) : (
                <span className="max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap">
                  {name}
                </span>
              )}
              <button
                type="button"
                onClick={() => setAttachments((prev) => prev.filter((x) => x !== p))}
                title="Remove"
                className="border-none bg-none text-nb-muted cursor-pointer flex items-center justify-center hover:text-nb-text"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <title>Remove attachment</title>
                  <path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.7 2.88 18.29 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.29-6.3z" />
                </svg>
              </button>
            </div>
          )
        })}
        {attachments.length > 8 ? (
          <div className="inline-flex items-center px-2.5 py-1.5 rounded-full border border-dashed border-nb-border text-nb-muted text-xs">
            +{attachments.length - 8}
          </div>
        ) : null}
      </section>
    ) : null

  const sendButton = (
    <button
      type="button"
      onClick={submit}
      disabled={!text.trim() || props.disabled}
      title={props.compact ? 'Send message' : 'Create task'}
      className="w-8 h-8 rounded-full border-none bg-nb-accent-2 text-white cursor-pointer flex items-center justify-center transition-opacity duration-100 disabled:opacity-30 disabled:cursor-default hover:enabled:opacity-85"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
        <title>Send</title>
        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
      </svg>
    </button>
  )

  const inner = (showStop: boolean) => (
    <>
      {attachButton}
      <textarea
        ref={textareaRef}
        className="flex-1 bg-none border-none text-nb-text text-sm font-inherit resize-none outline-none leading-[1.5] min-h-[21px] max-h-[220px] overflow-y-auto placeholder:text-nb-muted"
        placeholder={props.compact ? 'Send a message to the agent...' : 'What should the agent do?'}
        value={text}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        rows={1}
      />
      <div className="flex items-center gap-1 shrink-0">
        {showStop && (
          <button
            type="button"
            onClick={props.onStop}
            title="Stop task"
            className="w-7 h-7 rounded-full border-none bg-none text-nb-danger cursor-pointer flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <title>Stop</title>
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        )}
        {micButton}
        {sendButton}
      </div>
    </>
  )

  if (props.compact) {
    return (
      <div className="shrink-0 border-t border-nb-border">
        <div className="px-6 py-3 pb-4 max-w-[720px] w-full mx-auto">
          <div className="flex items-end gap-2 bg-nb-panel border border-nb-border rounded-[14px] p-2 px-3">
            {inner(!!props.onStop)}
          </div>
          {attachmentsRow}
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 pb-4 max-w-[720px] w-full mx-auto">
      <div className="flex items-end gap-2 bg-nb-panel border border-nb-border rounded-[14px] p-2 px-3">
        {inner(false)}
      </div>
      {attachmentsRow}
    </div>
  )
}
