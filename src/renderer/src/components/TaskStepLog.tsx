import { useEffect, useRef } from 'react'
import type { TaskStep } from '../../../shared/task'

const ACTION_LABELS: Record<string, string> = {
  click: 'Click',
  double_click: 'Double Click',
  type: 'Type',
  key: 'Key',
  scroll: 'Scroll',
  move: 'Move',
  launch: 'Launch',
  wait: 'Wait',
  done: 'Done',
  fail: 'Failed'
}

function formatAction(step: TaskStep): string {
  const a = step.action
  switch (a.type) {
    case 'click':
      return `Click (${a.x}, ${a.y}) ${a.button ?? 'left'}`
    case 'double_click':
      return `Double click (${a.x}, ${a.y})`
    case 'type':
      return `Type "${a.text.length > 30 ? a.text.slice(0, 30) + '...' : a.text}"`
    case 'key':
      return `Key: ${a.combo}`
    case 'scroll':
      return `Scroll ${a.direction} at (${a.x}, ${a.y})`
    case 'move':
      return `Move to (${a.x}, ${a.y})`
    case 'launch':
      return `Launch: ${a.app}`
    case 'wait':
      return `Wait ${a.ms}ms`
    case 'done':
      return `Done: ${a.summary}`
    case 'fail':
      return `Failed: ${a.reason}`
    default:
      return JSON.stringify(a)
  }
}

export function TaskStepLog(props: { steps: TaskStep[] }): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [props.steps.length])

  return (
    <div className="stepLog" ref={scrollRef}>
      {props.steps.length === 0 && (
        <div className="stepLogEmpty">Waiting for first step...</div>
      )}
      {props.steps.map((step) => (
        <div key={step.index} className={`stepItem ${step.error ? 'error' : ''}`}>
          <div className="stepHeader">
            <span className="stepIndex">#{step.index + 1}</span>
            <span className="stepAction">
              {ACTION_LABELS[step.action.type] ?? step.action.type}
            </span>
            <span className="stepTime">
              {new Date(step.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className="stepDetail">{formatAction(step)}</div>
          {step.thought && <div className="stepThought">{step.thought}</div>}
          {step.error && <div className="stepError">{step.error}</div>}
        </div>
      ))}
    </div>
  )
}
