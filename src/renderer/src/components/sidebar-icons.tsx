import type React from 'react'
import { cn } from '@/lib/utils'

const iconBase = 'size-6 shrink-0 transition-colors duration-200'

export function LogoSkynulMark({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 488 466" fill="none" className={cn('shrink-0', className)} aria-hidden="true">
      <path
        d="M465.3 240.6c-66.7 31.6-146.3 11.5-216.8 4-5.5 4 10.3 13.3 13.1 16.2 18.5 19.4-26.1 54.2-29 110.1-.5 9.7-1.4 47.6 6.4 27.8.1-.3.3-.6.4-.9 45.3-73.7 172.4-61.5 227.7-155.2 2.8-2.9 1.5-4.3.2-4z"
        fill="currentColor"
      />
      <path
        d="M254 11c29.6 67.6 7.2 146.5-2.4 216.8 3.8 5.6 13.6-9.9 16.6-12.6 19.9-17.9 53.4 27.7 109.2 32.3 9.7.8 47.5 2.8 27.9-5.6-.3-.1-.6-.3-.9-.5C332.1 193.9 348.1 67.2 256.1 9.2 254.9 8.4 253.5 9.7 254 11z"
        fill="currentColor"
      />
      <path
        d="M21.8 226.9c67.6-29.6 146.5-7.2 216.8 2.4 5.6-3.8-9.9-13.6-12.6-16.6-17.9-19.9 27.7-53.4 32.3-109.2.8-9.7 2.8-47.5-5.6-27.9-.1.3-.3.6-.5.9C204.7 148.8 78 132.8 20 224.8 19.3 226 20.5 227.4 21.8 226.9z"
        fill="currentColor"
      />
      <path
        d="M233.6 455.2c-30.5-67.2-9.1-146.4-.4-216.8-3.9-5.5-13.5 10.1-16.4 12.8-19.7 18.2-53.8-27-109.6-30.8-9.7-.7-47.5-2.2-27.9 5.9.3.1.6.3.9.5 72.9 46.5 58.6 173.4 151.3 230.2 1.8 1.4 3.3.2 2.7-1.1z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconTasks({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn(iconBase, className)} aria-hidden="true">
      <path d="M9 6h10M9 12h7M9 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M5 7l1.5 1.5L5 10M5 13l1.5 1.5L5 16M5 19l1.5 1.5L5 22"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-60"
      />
    </svg>
  )
}

export function IconDashboard({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn(iconBase, className)} aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect
        x="13"
        y="3"
        width="8"
        height="5"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        className="opacity-70"
      />
      <rect x="13" y="11" width="8" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect
        x="3"
        y="13"
        width="8"
        height="8"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        className="opacity-80"
      />
    </svg>
  )
}

export function IconProjects({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn(iconBase, className)} aria-hidden="true">
      <path
        d="M4 7a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M4 7l8 5 8-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 12v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="opacity-50"
      />
    </svg>
  )
}

export function IconScheduled({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn(iconBase, className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 7v5l3 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconUser({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn(iconBase, className)} aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconSettings({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn(iconBase, className)} aria-hidden="true">
      <path
        d="M12 2l9 5.5v9L12 22l-9-5.5v-9L12 2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}
