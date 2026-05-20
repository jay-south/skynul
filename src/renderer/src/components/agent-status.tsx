import type React from 'react'
import { cn } from '@/lib/utils'

interface AgentStatusProps {
  status: 'idle' | 'active'
  className?: string
}

export function AgentStatus({ status, className }: AgentStatusProps): React.JSX.Element {
  return (
    <span className={cn('relative flex items-center justify-center', className)}>
      <svg viewBox="0 0 24 24" fill="none" className="size-6 shrink-0" aria-hidden="true">
        {status === 'active' ? (
          <>
            <rect
              x="2"
              y="7"
              width="20"
              height="12"
              rx="6"
              fill="currentColor"
              className="opacity-15"
            />
            <rect
              x="2"
              y="7"
              width="20"
              height="12"
              rx="6"
              stroke="currentColor"
              strokeWidth="1.5"
              className="opacity-50 animate-pulse"
            />
            <circle cx="9" cy="12" r="1.5" fill="currentColor" className="opacity-80" />
            <circle cx="15" cy="12" r="1.5" fill="currentColor" className="opacity-80" />
            <circle cx="4" cy="5" r="0.8" fill="currentColor" className="opacity-30" />
            <circle cx="7.5" cy="4" r="0.6" fill="currentColor" className="opacity-20" />
            <circle cx="11" cy="3.5" r="0.5" fill="currentColor" className="opacity-15" />
          </>
        ) : (
          <>
            <rect
              x="2"
              y="7"
              width="20"
              height="12"
              rx="6"
              fill="currentColor"
              className="opacity-10"
            />
            <path
              d="M7 12.5l3-1.5M14 11l3 1.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="opacity-40"
            />
            <path
              d="M18 5l-2.5 2.5h2.5L15.5 10"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-30"
            />
          </>
        )}
      </svg>
    </span>
  )
}
