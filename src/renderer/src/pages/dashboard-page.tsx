import { TaskDashboard } from '@/components/feature/dashboard'
import { PageHeader } from '@/components/page-header'

export function DashboardPage(): React.JSX.Element {
  return (
    <div className="h-full overflow-hidden">
      <div className="h-full overflow-y-auto px-6 py-6 mx-auto w-full max-w-6xl">
        <PageHeader
          title="Dashboard"
          description="Real-time overview of agents, tasks, and system stats."
          className="mb-6"
        />

        <TaskDashboard />
      </div>
    </div>
  )
}
