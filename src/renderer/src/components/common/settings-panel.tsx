import type { ReactNode } from 'react'

interface SettingsPanelProps {
  children: ReactNode
}

export function SettingsPanel({ children }: SettingsPanelProps): React.JSX.Element {
  return (
    <div className="h-full overflow-y-auto px-6 py-8">
      <div className="w-full max-w-[640px] mx-auto flex flex-col gap-6 min-h-[400px]">
        {children}
      </div>
    </div>
  )
}

interface BackBarProps {
  children?: ReactNode
}

export function BackBar({ children }: BackBarProps): React.JSX.Element {
  return <div className="mb-3">{children}</div>
}

interface BackButtonProps {
  onClick: () => void
  children?: ReactNode
}

export function BackButton({ onClick, children }: BackButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 px-3.5 py-2 pr-2 rounded-xl border-none bg-nb-panel text-nb-muted cursor-pointer text-sm font-medium transition-all duration-100 hover:bg-nb-accent-2/15 hover:text-nb-text"
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <title>Back</title>
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      {children}
    </button>
  )
}

interface PanelTitleProps {
  children: ReactNode
}

export function PanelTitle({ children }: PanelTitleProps): React.JSX.Element {
  return <h2 className="text-xl font-bold text-nb-text m-0">{children}</h2>
}
