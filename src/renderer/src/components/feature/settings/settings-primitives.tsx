import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'

export function SettingsPageHeader(props: {
  title: string
  description?: string
}): React.JSX.Element {
  return (
    <header className="mb-8">
      <h1 className="text-lg font-semibold tracking-tight text-nb-text">{props.title}</h1>
      {props.description && (
        <p className="mt-1 text-sm text-nb-muted leading-relaxed max-w-lg">{props.description}</p>
      )}
    </header>
  )
}

export function SettingsSection(props: {
  title?: string
  description?: string
  className?: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <section className={cn('flex flex-col gap-3', props.className)}>
      {(props.title || props.description) && (
        <div className="px-1">
          {props.title && (
            <h2 className="text-xs font-medium uppercase tracking-wider text-nb-muted">
              {props.title}
            </h2>
          )}
          {props.description && (
            <p className="mt-0.5 text-xs text-nb-muted/80">{props.description}</p>
          )}
        </div>
      )}
      <div className="rounded-xl border border-nb-border bg-nb-panel overflow-hidden divide-y divide-nb-border">
        {props.children}
      </div>
    </section>
  )
}

export function SettingsRow(props: {
  title: ReactNode
  description?: ReactNode
  mono?: boolean
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 px-4 py-3.5 min-h-[56px]',
        props.className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-nb-text">{props.title}</div>
        {props.description && (
          <div
            className={cn(
              'text-xs text-nb-muted mt-0.5 leading-relaxed',
              props.mono && typeof props.description === 'string' && 'font-mono text-[11px]'
            )}
          >
            {props.description}
          </div>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-2">{props.children}</div>
    </div>
  )
}

export function SettingsStack(props: { children: ReactNode; className?: string }): React.JSX.Element {
  return (
    <div className={cn('flex flex-col gap-6', props.className)}>
      {props.children}
    </div>
  )
}

export function SegmentedControl<T extends string>(props: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  disabled?: boolean
}): React.JSX.Element {
  return (
    <div
      className="inline-flex max-w-full flex-wrap rounded-lg border border-nb-border bg-nb-panel-2 p-0.5"
      role="group"
    >
      {props.options.map((opt) => {
        const active = props.value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            disabled={props.disabled}
            aria-pressed={active}
            onClick={() => props.onChange(opt.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-all border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
              active
                ? 'bg-nb-panel text-nb-text shadow-sm'
                : 'bg-transparent text-nb-muted hover:text-nb-text'
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function SettingsInset(props: { children: ReactNode }): React.JSX.Element {
  return <div className="px-4 py-3 bg-nb-panel-2/40">{props.children}</div>
}

export function SettingsDivider(): React.JSX.Element {
  return <Separator className="bg-nb-border" />
}
