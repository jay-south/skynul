import { useNavigate } from 'react-router-dom'
import { useTasks, useSchedules } from '../queries'
import { TaskDashboard } from '../components/TaskDashboard'

export function DashboardPage(): React.JSX.Element {
  const navigate = useNavigate()

  const { data: tasksResponse } = useTasks()
  const tasks = tasksResponse?.tasks ?? []

  const { data: schedules = [] } = useSchedules()

  const handleSelectTask = (id: string) => {
    navigate(`/tasks/${id}`)
  }

  const handleSelectSchedule = (id: string) => {
    navigate(`/schedules/${id}`)
  }

  return (
    <div className="settingsPanel">
      <div className="settingsPanelInner">
        <div className="settingsBackBar">
          <button
            className="backBtn"
            onClick={() => navigate('/tasks')}
            aria-label="Back to tasks"
            title="Back to tasks"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
            <span>Back</span>
          </button>
        </div>

        <h2 className="settingsPanelTitle">Dashboard</h2>

        <TaskDashboard
          tasks={tasks}
          schedules={schedules}
          onSelectTask={handleSelectTask}
          onSelectSchedule={handleSelectSchedule}
        />
      </div>
    </div>
  )
}
