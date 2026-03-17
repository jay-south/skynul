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
