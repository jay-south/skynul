import type { TaskCreateRequest } from '@shared'
import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { InputBar, UnifiedChatFeed } from '@/components/feature/chat'
import {
  useCancelTask,
  useContinueTask,
  useCreateTask,
  useConversation,
  useGeneralSettings
} from '@/queries'
import { canContinueTask } from '@/queries/tasks/utils'

export function TasksChatView(): React.JSX.Element {
  const navigate = useNavigate()
  const { taskId } = useParams()
  const bottomRef = useRef<HTMLDivElement>(null)

  const { task, thread, stream, awaitingReply, isRunning, isLoading } = useConversation(taskId)
  const { data: general } = useGeneralSettings()
  const createTaskMutation = useCreateTask()
  const continueTaskMutation = useContinueTask()
  const cancelMutation = useCancelTask()

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when thread grows or stream updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread.length, stream?.draft, stream?.steps.length, stream?.pendingApproval, awaitingReply])

  const handleSubmit = (text: string, attachments?: string[]) => {
    if (task && isRunning) return

    if (taskId && task && canContinueTask(task.status)) {
      continueTaskMutation.mutate({ id: taskId, prompt: text, attachments })
      return
    }

    const payload: TaskCreateRequest = { prompt: text, attachments }
    createTaskMutation.mutate(payload, {
      onSuccess: (created) => navigate(`/tasks/${created.id}`)
    })
  }

  if (taskId && isLoading) {
    return <div className="flex flex-1 items-center justify-center p-6 text-sm text-nb-muted">Cargando…</div>
  }

  if (taskId && !task) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-nb-muted">
        Conversación no encontrada
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <UnifiedChatFeed
        thread={thread}
        task={task}
        bottomRef={bottomRef}
        awaitingReply={awaitingReply}
        streamDraft={stream?.draft}
        streamSteps={stream?.steps}
        pendingApproval={stream?.pendingApproval}
      />

      <InputBar
        lang={general?.language ?? 'en'}
        compact={!!taskId}
        disabled={isRunning}
        onSubmit={handleSubmit}
        onStop={isRunning && taskId ? () => cancelMutation.mutate(taskId) : undefined}
      />
    </div>
  )
}
