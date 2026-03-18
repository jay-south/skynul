import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { useCreateSchedule } from '../queries'

export function NewSchedulePage(): React.JSX.Element {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')
  const [frequency, setFrequency] = useState('daily')
  const [time, setTime] = useState('09:00')

  const createScheduleMutation = useCreateSchedule()

  const handleSave = () => {
    if (!prompt.trim()) return

    // Build cron expression based on frequency
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
    <div className="settingsPanel">
      <div className="settingsPanelInner">
        <div className="settingsBackBar">
          <Button
            className="backBtn"
            onClick={() => navigate('/schedules')}
            aria-label="Back"
            title="Back"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
              <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
            <span>Back</span>
          </Button>
        </div>

        <h2 className="settingsPanelTitle">New Schedule</h2>

        <div className="settingsSection">
          <div className="settingsLabel">Prompt</div>
          <textarea
            className="settingsInput"
            style={{ minHeight: 80, resize: 'vertical' }}
            placeholder="What should the agent do?"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <div className="settingsSection">
          <div className="settingsLabel">Frequency</div>
          <select
            className="settingsInput"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
          >
            <option value="hourly">Every hour</option>
            <option value="daily">Once a day</option>
            <option value="weekly">Once a week</option>
          </select>
        </div>

        {(frequency === 'daily' || frequency === 'weekly') && (
          <div className="settingsSection">
            <div className="settingsLabel">Time</div>
            <input
              type="time"
              className="settingsInput"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <Button variant="filled" onClick={() => navigate('/schedules')}>
            Cancel
          </Button>
          <Button
            className="btn btnFilled"
            disabled={!prompt.trim() || createScheduleMutation.isPending}
            onClick={() => void handleSave()}
          >
            {createScheduleMutation.isPending ? 'Saving...' : 'Create Schedule'}
          </Button>
        </div>
      </div>
    </div>
  )
}
