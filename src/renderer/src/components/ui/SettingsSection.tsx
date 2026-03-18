import type { ReactNode } from 'react'
import styles from './settings-section.module.css'

interface SettingsSectionProps {
  children: ReactNode
  className?: string
}

export function SettingsSection({ children, className }: SettingsSectionProps): React.JSX.Element {
  return <div className={`${styles.section} ${className || ''}`}>{children}</div>
}

interface SettingsLabelProps {
  children: ReactNode
}

export function SettingsLabel({ children }: SettingsLabelProps): React.JSX.Element {
  return <div className={styles.label}>{children}</div>
}

interface SettingsFieldProps {
  children: ReactNode
  hint?: string
}

export function SettingsField({ children, hint }: SettingsFieldProps): React.JSX.Element {
  return (
    <div className={styles.field}>
      {hint && <div className={styles.hint}>{hint}</div>}
      {children}
    </div>
  )
}
