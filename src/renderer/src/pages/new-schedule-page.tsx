import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackBar, BackButton, PanelTitle, Section, SettingsPanel } from '@/components/common'
import { Button } from '@/components/ui/Button'
import { useCreateSchedule } from '@/queries'

export function NewSchedulePage(): React.JSX.Element {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')
  const [frequency, setFrequency] = useState('daily')
  const [time, setTime] = useState('09:00')

  const createScheduleMutation = useCreateSchedule()

  const handleSave = () => {
    if (!prompt.trim()) return

    let cronExpr = ''
    switch (frequency) {
      case 'hourly':
        cronExpr = '0 * * * *'
        break
      case 'daily':
        {
          const [hour, min] = time.split(':')
          cronExpr = `${min} ${hour} * * *`
        }
        break
      case 'weekly':
        {
          const [hour, min] = time.split(':')
          cronExpr = `${min} ${hour} * * 1`
        }
        break
      default:
        cronExpr = '0 9 * * *'
    }

    createScheduleMutation.mutate(
      {
        prompt: prompt.trim(),
        frequency,
        cronExpr,
        enabled: true
      },
      {
        onSuccess: () => navigate('/schedules'),
        onError: (e) => console.error(e)
      }
    )
  }

  return (
    <SettingsPanel>
      <BackBar>
        <BackButton onClick={() => navigate('/schedules')}>Back</BackButton>
      </BackBar>

      <PanelTitle>New Schedule</PanelTitle>

      <Section>
        <label htmlFor="schedule-prompt">Prompt</label>
        <textarea
          id="schedule-prompt"
          style={{ minHeight: 80 }}
          placeholder="What should the agent do?"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </Section>

      <Section>
        <label htmlFor="schedule-frequency">Frequency</label>
        <select
          id="schedule-frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
        >
          <option value="hourly">Every hour</option>
          <option value="daily">Once a day</option>
          <option value="weekly">Once a week</option>
        </select>
      </Section>

      {(frequency === 'daily' || frequency === 'weekly') && (
        <Section>
          <label htmlFor="schedule-time">Time</label>
          <input
            id="schedule-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </Section>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <Button onClick={() => navigate('/schedules')}>Cancel</Button>
        <Button
          variant="filled"
          disabled={!prompt.trim() || createScheduleMutation.isPending}
          onClick={() => void handleSave()}
        >
          {createScheduleMutation.isPending ? 'Saving...' : 'Create Schedule'}
        </Button>
      </div>
    </SettingsPanel>
  )
}
