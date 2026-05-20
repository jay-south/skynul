import type { Task, TaskStep } from '@skynul/shared'
import { useState } from 'react'

interface ChatFeedProps {
  task: Task
  onApprove?: () => void
  onCancel?: () => void
  onDontAskAgain?: () => void
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function ChatFeed({
  task,
  onApprove,
  onCancel,
  onDontAskAgain
}: ChatFeedProps): React.JSX.Element {
  const [expandedResult, setExpandedResult] = useState<number | null>(null)
  const steps = task.steps ?? []

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 pb-4 max-w-[720px] w-full mx-auto flex flex-col gap-3">
        {task.prompt && (
          <div className="self-end max-w-[90%] rounded-xl px-3 py-2 text-sm leading-[1.5] break-words bg-nb-accent-2/70 text-white">
            {task.prompt}
          </div>
        )}

        {steps.length === 0 && task.status === 'pending' && (
          <div className="self-center my-8 flex flex-col items-center gap-2">
            <div className="flex gap-2 mt-2">
              {onApprove && (
                <button
                  type="button"
                  onClick={onApprove}
                  className="bg-nb-accent-2 text-white font-semibold px-5 py-2 rounded-lg border-none cursor-pointer text-sm hover:opacity-90"
                >
                  Allow
                </button>
              )}
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="bg-transparent border border-nb-border text-nb-muted px-5 py-2 rounded-lg cursor-pointer text-sm hover:text-nb-text"
                >
                  Cancel
                </button>
              )}
            </div>
            {onDontAskAgain && (
              <button
                type="button"
                onClick={onDontAskAgain}
                className="bg-none border-none text-nb-muted text-[11px] cursor-pointer p-0 hover:text-nb-text hover:underline"
              >
                Don't ask again
              </button>
            )}
          </div>
        )}

        {steps.map((step) => (
          <StepBubble
            key={step.index}
            step={step}
            expandedResult={expandedResult}
            onToggleResult={() =>
              setExpandedResult(expandedResult === step.index ? null : step.index)
            }
          />
        ))}

        {task.status === 'running' && (
          <div className="px-4 py-3 min-h-0 self-start">
            <div className="inline-flex gap-1 items-center">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-nb-muted animate-bounce"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {task.status && !['pending', 'running'].includes(task.status) && (
          <div
            className={`text-xs py-1.5 self-start ${task.status === 'completed' ? 'text-nb-accent-2' : task.status === 'failed' ? 'text-nb-danger' : 'text-nb-muted'}`}
          >
            {task.status === 'completed'
              ? (task.summary ?? 'Task completed')
              : task.status === 'failed'
                ? (task.error ?? 'Task failed')
                : (task.error ?? `Task ${task.status}`)}
          </div>
        )}
      </div>
    </div>
  )
}

function StepBubble({
  step,
  expandedResult,
  onToggleResult
}: {
  step: TaskStep
  expandedResult: number | null
  onToggleResult: () => void
}): React.JSX.Element {
  const isError = !!step.error
  const raw = step.action as Record<string, unknown>
  const type = raw.type as string

  return (
    <div
      className={`flex flex-col ${type === 'user_message' ? 'self-end' : 'self-start'} ${isError ? 'text-nb-danger' : ''}`}
    >
      <div
        className={`rounded-2xl px-3.5 py-2.5 max-w-[720px] ${type === 'user_message' ? 'bg-nb-accent-2/8 border-nb-accent-2/22 self-end' : 'border border-nb-border bg-nb-panel-2 self-start'}`}
      >
        {step.thought && (
          <div className="text-xs text-nb-muted italic mb-1">
            {step.thought.length > 300 ? `${step.thought.slice(0, 300)}...` : step.thought}
          </div>
        )}
        <div className="text-xs font-mono text-nb-muted leading-[1.4] break-words">
          {JSON.stringify(step.action)}
        </div>
        {step.result && (
          <div className="mt-1 text-[11px] text-nb-muted leading-[1.4] whitespace-pre-wrap break-words">
            <span>
              {step.result.length > 200 && expandedResult !== step.index
                ? `${step.result.slice(0, 200)}...`
                : step.result}
            </span>
            {step.result.length > 200 && (
              <button
                type="button"
                onClick={onToggleResult}
                className="text-[9px] opacity-50 bg-none border-none cursor-pointer text-nb-muted ml-1"
              >
                {expandedResult === step.index ? 'less' : 'more'}
              </button>
            )}
          </div>
        )}
        {step.error && <div className="text-xs text-nb-danger mt-0.5">{step.error}</div>}
      </div>
      <div className="text-[11px] text-nb-muted mt-0.5 mx-1">{formatTime(step.timestamp)}</div>
    </div>
  )
}
