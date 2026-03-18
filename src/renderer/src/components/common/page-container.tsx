import type { ReactNode } from 'react'

interface PageContainerProps {
  children: ReactNode
  className?: string
}

/**
 * Contenedor principal de página con padding estándar
 * Usado en: settings pages, dashboard, etc.
 */
export function PageContainer({ children, className }: PageContainerProps): React.JSX.Element {
  return (
    <div className={className} style={{ padding: '24px' }}>
      {children}
    </div>
  )
}
