import type { ReactNode } from 'react'

interface CenteredContentProps {
  children: ReactNode
}

export function CenteredContent({ children }: CenteredContentProps): React.JSX.Element {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 max-w-[780px] mx-auto w-full">
      {children}
    </div>
  )
}
