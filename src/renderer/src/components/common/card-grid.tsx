import type { ReactNode } from 'react'

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
