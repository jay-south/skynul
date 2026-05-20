import type { TaskCapabilityId, TaskMode } from '@skynul/shared'
import { DEFAULT_CAPABILITIES } from '@skynul/shared'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { InputBar } from '@/components/feature/chat'
import { PageHeader } from '@/components/page-header'
import { detectMode } from '@/lib/capabilities'
import { useCreateTask } from '@/queries'

const MODE_LABELS: Record<TaskMode, string> = {
  browser: 'Browser',
  sandbox: 'Sandbox'
}

export function TasksIndexPage(): React.JSX.Element {
  const navigate = useNavigate()
  const createTaskMutation = useCreateTask()
  const [selectedMode, setSelectedMode] = useState<TaskMode | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [selectedCapabilities, setSelectedCapabilities] = useState<TaskCapabilityId[] | null>(null)
  const [inputText, setInputText] = useState('')

  const handleSubmit = (text: string, attachments?: string[]) => {
    const mode = selectedMode ?? detectMode(text)
    const caps = selectedCapabilities ?? DEFAULT_CAPABILITIES[mode]

    createTaskMutation.mutate(
      { prompt: text, capabilities: caps, mode, attachments },
      {
        onSuccess: (task) => navigate(`/tasks/${task.id}`),
        onError: (error) => console.error('Failed to create task:', error)
      }
    )
  }

  const modes: TaskMode[] = ['browser', 'sandbox']
  const effectiveMode = selectedMode ?? detectMode(inputText)
  const currentCapabilities = selectedCapabilities ?? DEFAULT_CAPABILITIES[effectiveMode]

  const allCapabilities: Array<{ id: TaskCapabilityId; label: string; desc: string }> = [
    { id: 'browser.cdp', label: 'Browser CDP', desc: 'Control Chrome via Playwright' },
    { id: 'app.launch', label: 'Launch Apps', desc: 'Open applications' },
    { id: 'app.scripting', label: 'App Scripting', desc: 'Run scripts in design apps' },
    { id: 'polymarket.trading', label: 'Polymarket', desc: 'Trade on Polymarket' },
    { id: 'office.professional', label: 'Office Pro', desc: 'Excel, Word, PowerPoint formatting' }
  ]

  const toggleCapability = (id: TaskCapabilityId) => {
    setSelectedCapabilities((prev) => {
      const caps = prev ?? DEFAULT_CAPABILITIES[effectiveMode]
      return caps.includes(id) ? caps.filter((c) => c !== id) : [...caps, id]
    })
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 max-w-[640px] mx-auto w-full gap-4">
      <PageHeader
        title="What do you want to automate?"
        description="Describe what you need and I'll handle it for you."
      />

      <div className="flex items-center gap-1.5">
        {modes.map((m) => {
          const autoMode = detectMode(inputText)
          const active = effectiveMode === m
          const isAuto = selectedMode === null && autoMode === m
          return (
            <button
              key={m}
              type="button"
              onClick={() => setSelectedMode(selectedMode === m ? null : m)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                active
                  ? 'bg-nb-accent-2/10 border-nb-accent-2/30 text-nb-accent-2'
                  : 'border-nb-border/30 text-nb-muted hover:text-nb-text hover:border-nb-border/60 bg-transparent'
              } ${isAuto ? 'ring-1 ring-nb-accent-2/20' : ''}`}
            >
              {MODE_LABELS[m]}
              {isAuto && <span className="ml-1 text-[10px] opacity-60">●</span>}
            </button>
          )
        })}
      </div>

      <InputBar
        lang="en"
        autoCaps={[]}
        compact={false}
        onSubmit={handleSubmit}
        onTextChange={setInputText}
      />

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-xs text-nb-muted hover:text-nb-text transition-colors flex items-center gap-1"
      >
        <span className="text-sm">⚙</span> Advanced
      </button>

      {showAdvanced && (
        <div className="w-full max-w-[480px] p-3 rounded-lg border border-nb-border/30 bg-nb-panel-2/50">
          <p className="text-xs text-nb-muted mb-2">
            Capabilities for {MODE_LABELS[effectiveMode]}
          </p>
          <div className="space-y-1.5">
            {allCapabilities.map((cap) => {
              const active = currentCapabilities.includes(cap.id)
              return (
                <button
                  key={cap.id}
                  type="button"
                  onClick={() => toggleCapability(cap.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                    active
                      ? 'bg-nb-accent-2/10 text-nb-accent-2'
                      : 'text-nb-muted hover:text-nb-text hover:bg-nb-panel-1'
                  }`}
                >
                  <span className="font-medium">{cap.label}</span>
                  <span className="ml-2 opacity-60">{cap.desc}</span>
                </button>
              )
            })}
          </div>
          {selectedCapabilities && (
            <button
              type="button"
              onClick={() => setSelectedCapabilities(null)}
              className="mt-2 text-xs text-nb-accent-2 hover:underline"
            >
              Reset to defaults
            </button>
          )}
        </div>
      )}
    </div>
  )
}
