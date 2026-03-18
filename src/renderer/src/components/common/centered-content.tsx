import type { ReactNode } from 'react'
import styles from '@/components/feature/chat/chat.module.css'

interface CenteredContentProps {
  children: ReactNode
}

/**
 * Contenido centrado vertical y horizontalmente
 * Usado en: tasks index (chat centered)
 */
export function CenteredContent({ children }: CenteredContentProps): React.JSX.Element {
  return <div className={styles.chatFeedCentered}>{children}</div>
}
