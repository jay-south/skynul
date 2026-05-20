import type { ReactNode } from 'react'

interface SectionProps {
  children: ReactNode
  className?: string
}

export function Section({ children, className }: SectionProps): React.JSX.Element {
  return (
    <div className={`flex flex-col gap-2.5 w-full min-h-[60px] ${className || ''}`}>{children}</div>
  )
}

interface SectionLabelProps {
  children: ReactNode
}

export function SectionLabel({ children }: SectionLabelProps): React.JSX.Element {
  return (
    <div className="text-xs font-bold text-nb-text uppercase tracking-[0.04em]">{children}</div>
  )
}

interface SectionFieldProps {
  children: ReactNode
  hint?: string
}

export function SectionField({ children, hint }: SectionFieldProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      {hint && <div className="text-xs text-nb-muted">{hint}</div>}
      {children}
    </div>
  )
}
