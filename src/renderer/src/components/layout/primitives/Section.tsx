import type { ReactNode } from 'react'

interface SectionProps {
  children: ReactNode
  className?: string
}

/**
 * Sección con estilo settingsSection
 * Usado en: settings pages, forms
 */
export function Section({ children, className }: SectionProps): React.JSX.Element {
  return <div className={`settingsSection ${className || ''}`}>{children}</div>
}

interface SectionLabelProps {
  children: ReactNode
}

/**
 * Label de sección (settingsLabel)
 */
export function SectionLabel({ children }: SectionLabelProps): React.JSX.Element {
  return <div className="settingsLabel">{children}</div>
}

interface SectionFieldProps {
  children: ReactNode
  hint?: string
}

/**
 * Campo de sección con hint opcional
 */
export function SectionField({ children, hint }: SectionFieldProps): React.JSX.Element {
  return (
    <div className="settingsField">
      {hint && <div className="settingsFieldHint">{hint}</div>}
      {children}
    </div>
  )
}
