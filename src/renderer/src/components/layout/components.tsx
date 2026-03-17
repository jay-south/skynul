/**
 * Layout Components
 *
 * Componentes de layout reutilizables basados en patrones existentes.
 * NO modifican estilos, solo encapsulan estructuras comunes.
 */

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

interface PageHeaderProps {
  title: string
  subtitle?: string
}

/**
 * Header de página con título y subtítulo opcional
 * Usado en: tasks index, dashboard
 */
export function PageHeader({ title, subtitle }: PageHeaderProps): React.JSX.Element {
  return (
    <div style={{ marginBottom: '32px', textAlign: 'center' }}>
      <div className="composerHeading">{title}</div>
      {subtitle && (
        <div
          style={{
            color: 'var(--nb-muted)',
            fontSize: '15px',
            marginTop: '12px',
            lineHeight: 1.5
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  )
}

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

interface CardGridProps {
  children: ReactNode
  columns?: 2 | 3 | 4
}

/**
 * Grid de tarjetas responsive
 * Usado en: templates, provider cards
 */
export function CardGrid({ children, columns = 3 }: CardGridProps): React.JSX.Element {
  const gridTemplate = {
    2: 'repeat(2, 1fr)',
    3: 'repeat(3, 1fr)',
    4: 'repeat(4, 1fr)'
  }

  return (
    <div
      className="providerGrid"
      style={{
        display: 'grid',
        gridTemplateColumns: gridTemplate[columns],
        gap: '12px',
        marginTop: '12px'
      }}
    >
      {children}
    </div>
  )
}

interface ActionButtonProps {
  children: ReactNode
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  icon?: ReactNode
  fullWidth?: boolean
}

/**
 * Botón de acción consistente
 * Usado en: CTAs, form buttons
 */
export function ActionButton({
  children,
  onClick,
  variant = 'primary',
  icon,
  fullWidth = false
}: ActionButtonProps): React.JSX.Element {
  const variantStyles = {
    primary: {
      background: 'var(--nb-accent)',
      color: 'white'
    },
    secondary: {
      background: 'var(--nb-panel)',
      color: 'var(--text-primary)',
      border: '1px solid var(--nb-border)'
    },
    danger: {
      background: 'var(--nb-danger)',
      color: 'white'
    }
  }

  return (
    <button
      type="button"
      className="btn"
      onClick={onClick}
      style={{
        padding: '10px 16px',
        borderRadius: '8px',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        width: fullWidth ? '100%' : 'auto',
        border: 'none',
        ...variantStyles[variant]
      }}
    >
      {icon && <span>{icon}</span>}
      {children}
    </button>
  )
}

interface StatusBadgeProps {
  status: string
}

/**
 * Badge de estado reutilizable
 * Usado en: task lists, schedules
 */
export function StatusBadge({ status }: StatusBadgeProps): React.JSX.Element {
  const statusConfig: Record<string, { bg: string; color: string; label: string }> = {
    pending_approval: { bg: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af', label: 'Pending' },
    approved: { bg: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af', label: 'Approved' },
    running: { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', label: 'Running' },
    completed: { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', label: 'Done' },
    failed: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: 'Failed' },
    cancelled: { bg: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af', label: 'Cancelled' }
  }

  const config = statusConfig[status] || {
    bg: 'rgba(156, 163, 175, 0.15)',
    color: '#9ca3af',
    label: status
  }

  return (
    <span
      className="taskStatusBadge"
      style={{
        fontSize: '11px',
        padding: '2px 6px',
        borderRadius: '4px',
        background: config.bg,
        color: config.color
      }}
    >
      {config.label}
    </span>
  )
}

interface ListItemProps {
  title: string
  meta?: ReactNode
  active?: boolean
  onClick?: () => void
  actions?: ReactNode
}

/**
 * Item de lista reutilizable
 * Usado en: task lists, schedule lists
 */
export function ListItem({
  title,
  meta,
  active = false,
  onClick,
  actions
}: ListItemProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={`rbItem ${active ? 'active' : ''}`}
      onClick={onClick}
      disabled={!onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '10px 12px',
        marginBottom: '4px',
        borderRadius: '8px',
        cursor: onClick ? 'pointer' : 'default',
        background: active ? 'var(--nb-accent-soft)' : 'transparent',
        border: active ? '1px solid var(--nb-accent)' : '1px solid transparent',
        transition: 'all 0.15s ease',
        opacity: onClick ? 1 : 0.7
      }}
    >
      <div className="rbItemContent">
        <div
          className="rbItemTitle"
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: meta ? '4px' : 0
          }}
        >
          {title}
        </div>
        {meta && (
          <div className="rbItemMeta" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {meta}
            {actions}
          </div>
        )}
      </div>
    </button>
  )
}
