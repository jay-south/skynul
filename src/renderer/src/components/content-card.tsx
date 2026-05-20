import type React from 'react'
import { cn } from '@/lib/utils'

interface ContentCardProps {
  title: string
  description?: string
  className?: string
  children?: React.ReactNode
}

export function ContentCard({
  title,
  description,
  className,
  children
}: ContentCardProps): React.JSX.Element {
  return (
    <div className={cn('rounded-xl bg-nb-panel border border-nb-border p-5', className)}>
      <div className="flex flex-col gap-0.5 mb-4">
        <h3 className="text-sm font-semibold text-nb-text m-0">{title}</h3>
        {description && <p className="text-xs text-nb-muted m-0">{description}</p>}
      </div>
      {children}
    </div>
  )
}
