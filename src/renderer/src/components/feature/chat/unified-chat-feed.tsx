import type { TaskMessageResponse, TaskResponse, TaskStreamPendingApproval, TaskStreamStep } from '@shared'
import { ChevronDown, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { stepsFromMessage } from '@/components/feature/chat/conversation'
import { approveToolCall } from '@/queries/tasks/service'

function needsProviderSetup(error?: string): boolean {
  if (!error) return false
  return /api key|OPENAI_API_KEY|nvapi-|provider/i.test(error)
}

function needsPermissionsSetup(error?: string): boolean {
  if (!error) return false
  return /Settings → Permissions|cmd\.run|fs\.read|fs\.write|net\.http|Policy blocked|Necesitás habilitar/i.test(
    error
  )
}

type LivePhase = 'thinking' | 'working' | 'composing' | 'streaming'

function livePhase(draft: string, steps: TaskStreamStep[]): LivePhase {
  if (draft) return 'streaming'
  if (steps.length > 0) return 'composing'
  return 'thinking'
}

function PhaseLabel({ phase }: { phase: LivePhase }): React.JSX.Element {
  const labels: Record<LivePhase, string> = {
    thinking: 'Pensando…',
    working: 'Ejecutando…',
    composing: 'Generando respuesta…',
    streaming: 'Escribiendo…'
  }
  return <span className="text-[13px] font-medium text-nb-muted">{labels[phase]}</span>
}

function ThinkingDots(): React.JSX.Element {
  return (
    <div className="inline-flex items-center gap-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-nb-muted/70 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

function UserBubble({ content }: { content: string }): React.JSX.Element {
  return (
    <div className="flex justify-end">
      <div className="max-w-[min(85%,640px)] rounded-[20px] rounded-br-md bg-[hsl(var(--nb-accent-2)/0.92)] px-4 py-3 text-[14px] leading-[1.55] text-white shadow-[0_1px_2px_hsl(var(--nb-shadow)/0.14)]">
        <p className="whitespace-pre-wrap break-words">{content}</p>
      </div>
    </div>
  )
}

function ActivitySteps({ steps }: { steps: TaskStreamStep[] }): React.JSX.Element | null {
  if (steps.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      {steps.map((step) => (
        <div
          key={`${step.tool}\0${step.label}\0${step.ok}`}
          className="flex items-start gap-2.5 rounded-lg bg-nb-panel-2/60 px-3 py-2 font-mono text-[12px] leading-snug"
        >
          <span
            className={`mt-0.5 shrink-0 ${step.ok ? 'text-emerald-500' : 'text-nb-danger'}`}
            aria-hidden="true"
          >
            {step.ok ? '✓' : '✗'}
          </span>
          <span className="min-w-0 break-words text-nb-muted">
            <span className="font-semibold text-nb-text">{step.tool}</span>
            {step.label ? ` · ${step.label}` : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

function ToolActivityBlock({
  steps,
  defaultOpen = false,
  live = false
}: {
  steps: TaskStreamStep[]
  defaultOpen?: boolean
  live?: boolean
}): React.JSX.Element | null {
  const [open, setOpen] = useState(defaultOpen || live)
  if (steps.length === 0) return null

  const label =
    steps.length === 1 ? `1 acción · ${steps[0].tool}` : `${steps.length} acciones`

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center gap-2 rounded-lg border border-nb-border/50 bg-nb-panel-2/40 px-3 py-2 text-left transition-colors hover:bg-nb-panel-2/70"
      >
        {live ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-nb-accent-2" strokeWidth={2} />
        ) : (
          <span className="size-3.5 shrink-0 rounded-full bg-emerald-500/15 text-center text-[10px] leading-[14px] text-emerald-600">
            ✓
          </span>
        )}
        <span className="flex-1 text-[13px] font-medium text-nb-text">{label}</span>
        <ChevronDown
          className={`size-4 shrink-0 text-nb-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          strokeWidth={2}
        />
      </button>
      {open ? (
        <div className="mt-2 pl-1">
          <ActivitySteps steps={steps} />
        </div>
      ) : null}
    </div>
  )
}

function AssistantMessage({
  message,
  task
}: {
  message: TaskMessageResponse
  task: TaskResponse
}): React.JSX.Element {
  const steps = stepsFromMessage(message)
  const isError = message.error || (message.role === 'assistant' && task.status === 'failed')

  if (isError) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[min(85%,640px)] rounded-[20px] rounded-bl-md border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-[14px] leading-[1.55] text-nb-text">
          <p className="whitespace-pre-wrap break-words text-nb-danger">{message.content}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {needsPermissionsSetup(message.content) && (
              <Link
                to="/settings/permissions"
                className="text-[13px] font-medium text-nb-accent-2 underline underline-offset-2 hover:opacity-90"
              >
                Ir a Permissions
              </Link>
            )}
            {needsProviderSetup(message.content) && (
              <Link
                to="/settings/model"
                className="text-[13px] font-medium text-nb-accent-2 underline underline-offset-2 hover:opacity-90"
              >
                Configurar modelo
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[min(85%,640px)] text-[14px] leading-[1.65] text-nb-text">
        {steps.length > 0 ? <ToolActivityBlock steps={steps} defaultOpen={false} /> : null}
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </div>
  )
}

function PermissionApprovalBlock({
  taskId,
  approval
}: {
  taskId: string
  approval: TaskStreamPendingApproval
}): React.JSX.Element {
  const [busy, setBusy] = useState(false)

  const respond = async (approved: boolean) => {
    if (busy) return
    setBusy(true)
    try {
      await approveToolCall(taskId, approval.requestId, approved)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[min(85%,640px)] rounded-[20px] rounded-bl-md border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-[14px] leading-[1.55] text-nb-text">
        <p className="font-medium text-nb-text">El agente quiere ejecutar una acción</p>
        <p className="mt-1 font-mono text-[13px] text-nb-muted">
          {approval.tool}
          {approval.label ? ` · ${approval.label}` : ''}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void respond(true)}
            className="rounded-md bg-nb-accent-2 px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
          >
            Aprobar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void respond(false)}
            className="rounded-md border border-nb-border px-3 py-1.5 text-[13px] font-medium text-nb-muted disabled:opacity-50"
          >
            Rechazar
          </button>
        </div>
      </div>
    </div>
  )
}

function LiveAssistant({
  task,
  streamDraft,
  streamSteps,
  pendingApproval
}: {
  task: TaskResponse
  streamDraft?: string
  streamSteps?: TaskStreamStep[]
  pendingApproval?: TaskStreamPendingApproval
}): React.JSX.Element {
  const steps = streamSteps ?? []
  const phase = livePhase(streamDraft ?? '', steps)
  const displayPhase = phase === 'thinking' && steps.length > 0 ? 'working' : phase

  if (pendingApproval) {
    return <PermissionApprovalBlock taskId={task.id} approval={pendingApproval} />
  }

  if (streamDraft) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[min(85%,640px)] text-[14px] leading-[1.65] text-nb-text">
          {steps.length > 0 ? (
            <ToolActivityBlock steps={steps} defaultOpen live={displayPhase === 'working'} />
          ) : null}
          <p className="whitespace-pre-wrap break-words">{streamDraft}</p>
          <span className="ml-0.5 inline-block h-[1.1em] w-[2px] animate-pulse bg-nb-accent-2 align-text-bottom" />
        </div>
      </div>
    )
  }

  if (task.status === 'cancelled') {
    return (
      <div className="flex justify-start">
        <div className="rounded-[20px] rounded-bl-md border border-nb-border/50 bg-nb-panel-2/80 px-4 py-3 text-[13px] text-nb-muted">
          Cancelada
        </div>
      </div>
    )
  }

  if (task.status === 'failed' && task.error) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[min(85%,640px)] rounded-[20px] rounded-bl-md border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-[14px] leading-[1.55] text-nb-text">
          <p className="whitespace-pre-wrap break-words text-nb-danger">{task.error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[min(85%,640px)]">
        {steps.length > 0 ? (
          <ToolActivityBlock steps={steps} defaultOpen live={displayPhase !== 'composing'} />
        ) : null}
        <div className="flex items-center gap-2 py-1">
          {displayPhase === 'composing' ? (
            <PhaseLabel phase="composing" />
          ) : displayPhase === 'working' ? (
            <PhaseLabel phase="working" />
          ) : (
            <>
              <ThinkingDots />
              <PhaseLabel phase="thinking" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

interface UnifiedChatFeedProps {
  thread: TaskMessageResponse[]
  task?: TaskResponse
  bottomRef?: React.RefObject<HTMLDivElement | null>
  awaitingReply?: boolean
  streamDraft?: string
  streamSteps?: TaskStreamStep[]
  pendingApproval?: TaskStreamPendingApproval
}

export function UnifiedChatFeed({
  thread,
  task,
  bottomRef,
  awaitingReply = false,
  streamDraft,
  streamSteps,
  pendingApproval
}: UnifiedChatFeedProps): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 py-6 md:px-8">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8">
        {!task ? (
          <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
            <p className="text-[15px] font-medium text-nb-text">¿Qué querés automatizar?</p>
            <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-nb-muted">
              Escribí abajo para empezar una conversación nueva.
            </p>
          </div>
        ) : thread.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
            <p className="text-[13px] text-nb-muted">Sin mensajes todavía.</p>
          </div>
        ) : (
          <>
            {thread.map((message) => {
              const key = `${message.role}:${message.createdAt}:${message.content.slice(0, 48)}`
              return message.role === 'user' ? (
                <UserBubble key={key} content={message.content} />
              ) : (
                <AssistantMessage key={key} message={message} task={task} />
              )
            })}
            {awaitingReply ? (
              <LiveAssistant
                task={task}
                streamDraft={streamDraft}
                streamSteps={streamSteps}
                pendingApproval={pendingApproval}
              />
            ) : null}
          </>
        )}
        <div ref={bottomRef} className="h-px shrink-0" />
      </div>
    </div>
  )
}
