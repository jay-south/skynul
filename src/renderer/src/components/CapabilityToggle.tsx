import type { ReactNode } from 'react'
import styles from './CapabilityToggle.module.css'

interface CapabilityToggleProps {
  title: string
  description?: string
  enabled: boolean
  onToggle: () => void
  disabled?: boolean
  children?: ReactNode
}

/**
 * Toggle de capability con estilo switch
 * Usado en: settings pages, channel settings
 */
export function CapabilityToggle({
  title,
  description,
  enabled,
  onToggle,
  disabled = false,
  children
}: CapabilityToggleProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={`${styles.cap} ${enabled ? styles.capOn : ''}`}
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={enabled}
    >
      <div className={styles.capLeft}>
        <div className={styles.capTitle}>{title}</div>
        {description && <div className={styles.capDesc}>{description}</div>}
        {children}
      </div>
      <div className={styles.capToggle} aria-hidden="true">
        <div className={styles.capKnob} />
      </div>
    </button>
  )
}

interface CapabilityListProps {
  children: ReactNode
}

/**
 * Lista de capability toggles
 */
export function CapabilityList({ children }: CapabilityListProps): React.JSX.Element {
  return <div className={styles.capList}>{children}</div>
}
