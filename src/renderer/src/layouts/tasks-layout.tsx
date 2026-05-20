import { useEffect, useState } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import { TaskDrawer } from '@/components/feature/task'

export function TasksLayout(): React.JSX.Element {
  const { taskId } = useParams()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  useEffect(() => {
    setIsDrawerOpen(!!taskId)
  }, [taskId])

  return (
    <div className="flex h-full">
      <div className="flex-1 relative">
        {!isDrawerOpen && (
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="absolute top-4 left-4 z-50 flex items-center gap-2 px-4 py-2.5 bg-nb-panel border border-nb-border rounded-xl text-nb-text text-sm font-medium cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.1)] transition-all duration-200 hover:bg-nb-panel-2 hover:-translate-y-0.5"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Tasks
          </button>
        )}
        <Outlet />
      </div>
      <TaskDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </div>
  )
}
