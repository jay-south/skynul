import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { TaskDrawer } from '../../TaskDrawer'

interface TasksShellProps {
  children: ReactNode
}

export function TasksShell({ children }: TasksShellProps): React.JSX.Element {
  const { taskId } = useParams()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  useEffect(() => {
    if (taskId) {
      setIsDrawerOpen(true)
    } else {
      setIsDrawerOpen(false)
    }
  }, [taskId])

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        {!isDrawerOpen && (
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              zIndex: 50,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: 'var(--nb-panel)',
              border: '1px solid var(--nb-border)',
              borderRadius: '10px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--nb-hover)'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--nb-panel)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
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
        {children}
      </div>
      <TaskDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </div>
  )
}
