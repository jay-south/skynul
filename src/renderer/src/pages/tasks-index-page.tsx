import { useNavigate } from 'react-router-dom'
import { CenteredContent, PageHeader } from '@/components/common'
import { InputBar } from '@/components/feature/chat'
import { useCreateTask } from '@/queries'
import { detectCapabilities, detectMode } from '@/lib/capabilities'

export function TasksIndexPage(): React.JSX.Element {
  const navigate = useNavigate()
  const createTaskMutation = useCreateTask()

  const handleSubmit = (text: string, attachments?: string[]) => {
    const caps = detectCapabilities(text)
    const mode = detectMode(text)

    createTaskMutation.mutate(
      { prompt: text, capabilities: caps, mode, attachments },
      {
        onSuccess: (task) => {
          navigate(`/tasks/${task.id}`)
        },
        onError: (error) => {
          console.error('Failed to create task:', error)
        }
      }
    )
  }

  return (
    <CenteredContent>
      <PageHeader
        title="What do you want to automate?"
        subtitle="Describe what you need and I'll handle it for you."
      />
      <InputBar
        lang="en"
        autoCaps={[]}
        compact={false}
        onSubmit={handleSubmit}
      />
    </CenteredContent>
  )
}
