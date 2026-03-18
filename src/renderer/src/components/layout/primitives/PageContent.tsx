import type { ReactNode } from 'react'
import { PageContainer } from './PageContainer'
import { PageHeader } from './PageHeader'

interface PageContentProps {
  title: string
  subtitle?: string
  showBack?: boolean
  backTo?: string
  actions?: ReactNode
  className?: string
  children: ReactNode
}

export function PageContent({
  title,
  subtitle,
  showBack,
  backTo,
  actions,
  className,
  children
}: PageContentProps): React.JSX.Element {
  return (
    <PageContainer className={className}>
      <PageHeader title={title} subtitle={subtitle} showBack={showBack} backTo={backTo} actions={actions} />
      {children}
    </PageContainer>
  )
}
