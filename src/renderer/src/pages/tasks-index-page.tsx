import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { InputBar } from '../components/InputBar'
import { useCreateTask } from '../queries'
import type { TaskCapabilityId } from '../../../shared/task'

export function TasksIndexPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [, setComposerPrompt] = useState('')
  const createTaskMutation = useCreateTask()

  const detectAutoCaps = (prompt: string): TaskCapabilityId[] => {
    const lower = prompt.toLowerCase()
    const detected = new Set<TaskCapabilityId>()

    // Browser keywords
    const browserWords = [
      'browser',
      'webpage',
      'website',
      'scrape',
      'navigate',
      'url',
      'search',
      'google'
    ]
    if (browserWords.some((w) => lower.includes(w))) detected.add('browser.cdp')

    // App launch keywords
    const appWords = ['launch', 'whatsapp', 'telegram', 'discord', 'slack', 'spotify']
    if (appWords.some((w) => lower.includes(w))) detected.add('app.launch')

    // Default
    if (detected.size === 0) detected.add('browser.cdp')

    return [...detected]
  }

  const handleSubmit = (text: string, attachments?: string[]) => {
    const caps = detectAutoCaps(text)

    // Detect mode
    let mode: 'browser' | 'code' = 'browser'
    const codeWords = [
      'command',
      'script',
      'headless',
      'fetch',
      'curl',
      'code',
      'git',
      'build',
      'deploy'
    ]
    if (codeWords.some((w) => text.toLowerCase().includes(w))) mode = 'code'

    createTaskMutation.mutate(
      { prompt: text, capabilities: caps, mode, attachments },
      {
        onSuccess: (response) => {
          navigate(`/tasks/${response.task.id}`)
        },
        onError: (error) => {
          console.error('Failed to create task:', error)
        }
      }
    )
  }

  return (
    <div className="chatFeedCentered">
      <div className="composerHeading">Automate anything.</div>
      <InputBar
        lang="en"
        autoCaps={['browser.cdp']}
        compact={false}
        onSubmit={handleSubmit}
        onTextChange={setComposerPrompt}
      />
    </div>
  )
}
