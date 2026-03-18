import { useEffect, useState } from 'react'
import { Outlet, useLocation, useParams } from 'react-router-dom'
import { TaskDrawer } from '@/components/feature/task'
import styles from './tasks-layout.module.css'

export function TasksLayout(): React.JSX.Element {
  const location = useLocation()
  const { taskId } = useParams()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  useEffect(() => {
    if (taskId) {
      setIsDrawerOpen(true)
    } else {
      setIsDrawerOpen(false)
    }
  }, [taskId, location.pathname])

  return (
    <div className={styles.tasksLayout}>
      <div className={styles.tasksMainContent}>
        {!isDrawerOpen && (
          <button
            type="button"
            className={styles.tasksDrawerButton}
            onClick={() => setIsDrawerOpen(true)}
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
