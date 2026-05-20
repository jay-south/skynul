import { DEFAULT_CAPABILITIES } from '@skynul/shared'
import { useParams } from 'react-router-dom'
import { ChatFeed, InputBar } from '@/components/feature/chat'
import { useApproveTask, useCancelTask, usePolicy, useSetAutoApprove, useTask } from '@/queries'

export function TaskChatPage(): React.JSX.Element {
  const { taskId } = useParams()

  const { data: task } = useTask(taskId)
  const { data: policy } = usePolicy()

  const approveMutation = useApproveTask()
  const cancelMutation = useCancelTask()
  const dontAskAgainMutation = useSetAutoApprove()

  const isRunning = task?.status === 'running'

  const handleInputSubmit = (_text: string, _attachments?: string[]) => {
    if (!task || !taskId) return

    if (task.status === 'running') {
      // send message to running task
    }
  }

  if (!task) {
    return <div>Task not found</div>
  }

  return (
    <div>
      <ChatFeed
        task={task}
        onApprove={() => taskId && approveMutation.mutate(taskId)}
        onCancel={() => taskId && cancelMutation.mutate(taskId)}
        onDontAskAgain={() => dontAskAgainMutation.mutate(true)}
      />

      <InputBar
        lang={policy?.language ?? 'en'}
        autoCaps={DEFAULT_CAPABILITIES[task.mode] ?? []}
        compact={true}
        onSubmit={handleInputSubmit}
        onStop={isRunning ? () => taskId && cancelMutation.mutate(taskId) : undefined}
      />
    </div>
  )
}
