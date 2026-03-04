import { useEffect, useRef, useState } from 'react'
import type { Task, TaskStep, TaskCapabilityId } from '../../../shared/task'
import { ALL_TASK_CAPABILITIES } from '../../../shared/task'

/** Convert URLs in text to clickable <a> tags, preserving the rest as text */
function renderLinked(text: string): (string | React.ReactElement)[] {
  const parts: (string | React.ReactElement)[] = []
  const re = /(https?:\/\/[^\s<]+)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const url = m[1]
    parts.push(
      <a key={m.index} href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#58a6ff', wordBreak: 'break-all' }}>
        {url.length > 60 ? url.slice(0, 57) + '…' : url}
      </a>
    )
    last = re.lastIndex
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

/** User-friendly label for the action. Returns null for technical actions that should be hidden. */
function formatAction(step: TaskStep): string | null {
  const a = step.action as Record<string, unknown>
  const type = a.type as string
  switch (type) {
    case 'navigate': {
      const url = (a.url as string) ?? ''
      try { return `Opening ${new URL(url).hostname}` } catch { return `Opening page…` }
    }
    case 'launch': return `Opening ${a.app}`
    case 'done': return String(a.summary)
    case 'fail': return String(a.reason)
    // Technical actions — hide, the thought already explains what's happening
    case 'evaluate':
    case 'click':
    case 'double_click':
    case 'type':
    case 'key':
    case 'pressKey':
    case 'scroll':
    case 'wait':
    case 'web_scrape':
    case 'shell':
    case 'user_message':
      return null
    default: return null
  }
}


function CapsApproval(props: {
  caps: TaskCapabilityId[]
  status: string
  onApprove: () => void
  onCancel: () => void
  onDontAskAgain: () => void
}): React.JSX.Element {
  const isPending = props.status === 'pending_approval'
  return (
    <div className="feedBubble feedBubbleBot">
      <div className="feedBubbleContent">
        <span className="feedCapsLabel">
          {isPending ? 'Capabilities:' : 'Approved:'}
        </span>
        {props.caps.map((capId) => {
          const cap = ALL_TASK_CAPABILITIES.find((c) => c.id === capId)
          return (
            <span key={capId} className={`feedCapChip ${isPending ? '' : 'confirmed'}`}>
              {cap?.title ?? capId}
            </span>
          )
        })}
        {isPending && (
          <div className="feedCapsActions">
            <button className="btn feedBtnAllow" onClick={props.onApprove}>Allow & Run</button>
            <button className="btn feedBtnCancel" onClick={props.onCancel}>Cancel</button>
            <button className="feedDontAsk" onClick={() => { props.onDontAskAgain(); props.onApprove() }}>
              Don't ask again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const RESULT_TRUNCATE = 120

function ResultBlock(props: { text: string }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const isLong = props.text.length > RESULT_TRUNCATE
  const display = !isLong || expanded ? props.text : props.text.slice(0, RESULT_TRUNCATE) + '…'

  return (
    <div
      className={`feedStepResult ${isLong ? 'clickable' : ''}`}
      onClick={isLong ? () => setExpanded(!expanded) : undefined}
    >
      {display}
      {isLong && <span className="feedResultToggle">{expanded ? ' ▲' : ' ▼'}</span>}
    </div>
  )
}

function StepLine(props: { step: TaskStep }): React.JSX.Element {
  const { step } = props
  const hasError = !!step.error
  const time = new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`feedStep ${hasError ? 'feedStepError' : ''}`}>
      <span className="feedStepTime">{time}</span>
      {step.thought && <div className="feedStepThought">{step.thought}</div>}
      {formatAction(step) && <div className="feedStepAction">{formatAction(step)}</div>}
      {step.result && <ResultBlock text={step.result} />}
      {step.error && <div className="feedStepErr">{step.error}</div>}
    </div>
  )
}

export function ChatFeed(props: {
  task: Task
  onApprove: () => void
  onCancel: () => void
  onDontAskAgain: () => void
}): React.JSX.Element {
  const { task } = props
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [task.steps.length, task.status])

  const isTerminal = task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled'

  return (
    <div className="chatFeed" ref={scrollRef}>
      {/* User prompt */}
      <div className="feedBubble feedBubbleUser">
        {task.prompt}
      </div>

      {/* Caps */}
      <CapsApproval
        caps={task.capabilities}
        status={task.status}
        onApprove={props.onApprove}
        onCancel={props.onCancel}
        onDontAskAgain={props.onDontAskAgain}
      />

      {/* Thinking */}
      {task.status === 'running' && task.steps.length === 0 && (
        <div className="feedBubble feedBubbleBot feedThinking">
          {task.summary || 'Thinking...'}
        </div>
      )}

      {/* Steps — user messages as user bubbles, agent steps grouped in bot blocks */}
      {task.steps.length > 0 && (() => {
        const elements: React.JSX.Element[] = []
        let agentBatch: TaskStep[] = []
        let lastDateStr = ''

        const flushBatch = (key: string): void => {
          if (agentBatch.length > 0) {
            elements.push(
              <div key={key} className="feedBubble feedBubbleBot feedStepsBlock">
                {agentBatch.map((s) => <StepLine key={s.index} step={s} />)}
              </div>
            )
            agentBatch = []
          }
        }

        const maybeAddDateSep = (ts: number | undefined, key: string): void => {
          if (!ts) return
          const dateStr = new Date(ts).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric'
          })
          if (dateStr !== lastDateStr) {
            flushBatch(`bot-before-date-${key}`)
            elements.push(
              <div key={`date-sep-${key}`} className="feedDateSep">
                <span>{dateStr}</span>
              </div>
            )
            lastDateStr = dateStr
          }
        }

        for (const step of task.steps) {
          const a = step.action as Record<string, unknown>
          maybeAddDateSep(step.timestamp, String(step.index))
          if (a.type === 'user_message') {
            flushBatch(`bot-before-${step.index}`)
            elements.push(
              <div key={`user-${step.index}`} className="feedBubble feedBubbleUser">
                {String(a.text)}
              </div>
            )
          } else {
            agentBatch.push(step)
          }
        }
        flushBatch('bot-final')
        return elements
      })()}

      {/* Terminal */}
      {isTerminal && (
        <div className={`feedStatus ${task.status}`} style={{ whiteSpace: 'pre-wrap' }}>
          {task.status === 'completed' && renderLinked(task.summary || 'Tarea completada')}
          {task.status === 'failed' && renderLinked(task.error || 'Tarea fallida')}
          {task.status === 'cancelled' && 'Tarea cancelada'}
        </div>
      )}
    </div>
  )
}
