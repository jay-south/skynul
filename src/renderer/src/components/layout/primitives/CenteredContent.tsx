import type { ReactNode } from 'react'

interface CenteredContentProps {
  children: ReactNode
}

/**
 * Contenido centrado vertical y horizontalmente
 * Usado en: tasks index (chat centered)
 */
export function CenteredContent({ children }: CenteredContentProps): React.JSX.Element {
  return <div className="chatFeedCentered">{children}</div>
}
