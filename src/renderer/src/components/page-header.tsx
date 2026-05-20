import type React from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  className?: string
}

export function PageHeader({ title, description, className }: PageHeaderProps): React.JSX.Element {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <h1 className="text-2xl font-semibold text-nb-text tracking-tight m-0">{title}</h1>
      {description && <p className="text-sm text-nb-muted m-0 leading-relaxed">{description}</p>}
    </div>
  )
}
