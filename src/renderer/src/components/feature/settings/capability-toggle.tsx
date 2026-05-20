import type { ReactNode } from 'react'

interface CapabilityToggleProps {
  title: string
  description?: string
  enabled: boolean
  onToggle: () => void
  disabled?: boolean
  children?: ReactNode
}

export function CapabilityToggle({
  title,
  description,
  enabled,
  onToggle,
  disabled = false,
  children
}: CapabilityToggleProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={enabled}
      className={`w-full flex items-center justify-between gap-3 p-3 rounded-[14px] border text-left cursor-pointer disabled:cursor-not-allowed disabled:opacity-65
        ${enabled ? 'border-nb-accent-2/40 bg-nb-accent-2/8' : 'border-nb-border bg-nb-panel'}`}
    >
      <div>
        <div className="text-sm font-semibold text-nb-text/90">{title}</div>
        {description && <div className="text-xs font-medium text-nb-muted">{description}</div>}
        {children}
      </div>
      <div
        aria-hidden="true"
        className={`w-11 h-[26px] rounded-full border flex items-center p-[3px] shrink-0
          ${enabled ? 'bg-nb-accent-2/22 border-nb-accent-2/40' : 'bg-nb-text/8 border-nb-border'}`}
      >
        <div
          className={`w-[18px] h-[18px] rounded-full bg-nb-panel-2 border transition-transform duration-140
            ${
              enabled
                ? 'translate-x-[18px] border-nb-accent-2/35 shadow-[0_10px_22px_rgba(0,0,0,0.08)]'
                : 'translate-x-0 border-nb-border shadow-[0_10px_22px_rgba(0,0,0,0.08)]'
            }`}
        />
      </div>
    </button>
  )
}

interface CapabilityListProps {
  children: ReactNode
}

export function CapabilityList({ children }: CapabilityListProps): React.JSX.Element {
  return <div className="flex flex-col gap-2.5">{children}</div>
}
