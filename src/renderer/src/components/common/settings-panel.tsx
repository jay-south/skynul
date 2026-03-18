import type { ReactNode } from 'react'
import styles from './settings.module.css'

interface SettingsPanelProps {
  children: ReactNode
}

/**
 * Panel de settings con scroll y layout estándar
 * Usado en: settings pages, dashboard, projects, schedules
 */
export function SettingsPanel({ children }: SettingsPanelProps): React.JSX.Element {
  return (
    <div className={styles.settingsPanel}>
      <div className={styles.settingsPanelInner}>{children}</div>
    </div>
  )
}

interface BackBarProps {
  children?: ReactNode
}

/**
 * Barra superior con botón de back opcional
 */
export function BackBar({ children }: BackBarProps): React.JSX.Element {
  return <div className={styles.settingsBackBar}>{children}</div>
}

interface BackButtonProps {
  onClick: () => void
  children?: ReactNode
}

/**
 * Botón de navegación hacia atrás
 */
export function BackButton({ onClick, children }: BackButtonProps): React.JSX.Element {
  return (
    <button type="button" className={styles.backBtn} onClick={onClick}>
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      {children}
    </button>
  )
}

interface PanelTitleProps {
  children: ReactNode
}

/**
 * Título del panel de settings
 */
export function PanelTitle({ children }: PanelTitleProps): React.JSX.Element {
  return <h2 className={styles.settingsPanelTitle}>{children}</h2>
}
