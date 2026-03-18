import type { Task, TaskCapabilityId } from '@skynul/shared'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  ChatFeed,
  CollectiveChatFeed,
  InputBar,
  MultiAgentControlRoom
} from '@/components/feature/chat'
import {
  useApproveTask,
  useCancelTask,
  usePolicy,
  useSendTaskMessage,
  useSetAutoApprove,
  useTask,
  useTasks
} from '@/queries'

export function TaskChatPage(): React.JSX.Element {
  const { taskId } = useParams()
  const [composerPrompt, setComposerPrompt] = useState('')

  const multiAgentPanelEnabled =
    (import.meta.env.VITE_MULTI_AGENT_PANEL as string | undefined) !== '0'

  const { data: task } = useTask(taskId)
  const { data: tasksResponse } = useTasks()
  const tasks = tasksResponse?.tasks ?? []
  const { data: policy } = usePolicy()

  const approveMutation = useApproveTask()
  const cancelMutation = useCancelTask()
  const dontAskAgainMutation = useSetAutoApprove()
  const sendMessageMutation = useSendTaskMessage()

  const rootTask = useMemo(() => {
    if (!task) return null
    const byId = new Map(tasks.map((t) => [t.id, t] as const))
    let cur: Task | undefined = task
    let hops = 0
    while (cur?.parentTaskId && hops < 50) {
      const next = byId.get(cur.parentTaskId)
      if (!next) break
      cur = next
      hops++
    }
    return cur ?? task
  }, [task, tasks])

  const hasMultiAgents = useMemo(() => {
    if (!rootTask) return false
    return tasks.some((t) => {
      if (t.id === rootTask.id) return false
      let cur: Task | undefined = t
      let hops = 0
      while (cur?.parentTaskId && hops < 50) {
        if (cur.parentTaskId === rootTask.id) return true
        cur = tasks.find((x) => x.id === cur?.parentTaskId)
        hops++
      }
      return false
    })
  }, [rootTask, tasks])

  const isCollectiveMode = Boolean(multiAgentPanelEnabled && rootTask && hasMultiAgents)
  const controlTask = isCollectiveMode ? rootTask : task
  const isRunning = controlTask?.status === 'running'

  const handleInputSubmit = (text: string, _attachments?: string[]) => {
    if (!controlTask || !taskId) return

    if (controlTask.status === 'running') {
      sendMessageMutation.mutate(
        { id: taskId, message: text },
        {
          onSuccess: () => setComposerPrompt('')
        }
      )
    }
  }

  const detectAutoCaps = (prompt: string): TaskCapabilityId[] => {
    const lower = prompt.toLowerCase()
    const detected = new Set<TaskCapabilityId>()

    const browserWords = ['browser', 'webpage', 'website', 'scrape', 'navigate', 'url', 'search']
    if (browserWords.some((w) => lower.includes(w))) detected.add('browser.cdp')

    if (detected.size === 0) detected.add('browser.cdp')

    return [...detected]
  }

  if (!task) {
    return <div>Task not found</div>
  }

  return (
    <div>
      {multiAgentPanelEnabled && rootTask && hasMultiAgents && (
        <MultiAgentControlRoom
          rootTask={rootTask}
          tasks={tasks}
          activeTaskId={task.id}
          onSelectTask={(id) => {
            window.location.hash = `#/tasks/${id}`
          }}
        />
      )}

      {isCollectiveMode && controlTask ? (
        <CollectiveChatFeed rootTask={controlTask} tasks={tasks} />
      ) : (
        <ChatFeed
          task={task}
          onApprove={() => taskId && approveMutation.mutate(taskId)}
          onCancel={() => taskId && cancelMutation.mutate(taskId)}
          onDontAskAgain={() => dontAskAgainMutation.mutate(true)}
        />
      )}

      <InputBar
        lang={policy?.language ?? 'en'}
        autoCaps={detectAutoCaps(composerPrompt)}
        compact={true}
        onSubmit={handleInputSubmit}
        onStop={isRunning ? () => taskId && cancelMutation.mutate(taskId) : undefined}
        onTextChange={setComposerPrompt}
      />
    </div>
  )
}
