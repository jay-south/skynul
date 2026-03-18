import type { ReactNode } from 'react'

interface PageContainerProps {
  children: ReactNode
  className?: string
}

/**
 * Contenedor estándar para páginas fullscreen
 * Usado en: Projects, Dashboard, Schedules
 */
export function PageContainer({ children, className }: PageContainerProps): React.JSX.Element {
  return (
    <div
      className={`pageContainer ${className || ''}`}
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: '32px 24px'
      }}
    >
      <div
        className="pageContainerInner"
        style={{
          width: '100%',
          maxWidth: '1200px',
          margin: '0 auto',
          minHeight: '400px'
        }}
      >
        {children}
      </div>
    </div>
  )
}
