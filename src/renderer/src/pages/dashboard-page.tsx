import { useNavigate } from 'react-router-dom'
import { TaskDashboard } from '../components/TaskDashboard'
import { PageContent } from '../components/layout'
import { useSchedules, useTasks } from '../queries'

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
    <PageContent title="Dashboard" showBack backTo="/tasks">
      <TaskDashboard
        tasks={tasks}
        schedules={schedules}
        onSelectTask={handleSelectTask}
        onSelectSchedule={handleSelectSchedule}
      />
    </PageContent>
  )
}
