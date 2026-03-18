import { useNavigate } from 'react-router-dom'
import { BackBar, BackButton, PanelTitle, SettingsPanel } from '@/components/common'
import { TaskDashboard } from '@/components/feature/dashboard'
import { useSchedules, useTasks } from '@/queries'

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
    <SettingsPanel>
      <BackBar>
        <BackButton onClick={() => navigate('/tasks')}>Back</BackButton>
      </BackBar>

      <PanelTitle>Dashboard</PanelTitle>

      <TaskDashboard
        tasks={tasks}
        schedules={schedules}
        onSelectTask={handleSelectTask}
        onSelectSchedule={handleSelectSchedule}
      />
    </SettingsPanel>
  )
}
