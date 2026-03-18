import { cn } from '../../lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'filled' | 'secondary' | 'ghost'
  size?: 'default' | 'small'
  children: React.ReactNode
}

export function Button({
  variant = 'default',
  size = 'default',
  className,
  children,
  ...props
}: ButtonProps): React.JSX.Element {
  return (
    <button
      className={cn(
        // Base styles
        'inline-flex items-center justify-center',
        'font-semibold text-[13px]',
        'rounded-full',
        'transition-all duration-120 ease-out',
        'cursor-pointer',
        'disabled:opacity-50 disabled:cursor-not-allowed',

        // Variants
        variant === 'default' && [
          'px-3.5 py-2.5',
          'border border-[var(--nb-accent-2)]/30',
          'bg-[var(--nb-accent-2)]/10',
          'text-[var(--nb-text)]',
          'hover:bg-[var(--nb-accent-2)]/15 hover:border-[var(--nb-accent-2)]/50',
          'hover:-translate-y-px',
          'active:translate-y-0'
        ],

        variant === 'filled' && [
          'px-5 py-2.5',
          'border border-[var(--nb-accent-2)]/50',
          'bg-[var(--nb-accent-2)]/25',
          'text-[var(--nb-text)]',
          'hover:bg-[var(--nb-accent-2)]/35 hover:border-[var(--nb-accent-2)]/65',
          'hover:-translate-y-px',
          'active:translate-y-0'
        ],

        variant === 'secondary' && [
          'px-3.5 py-2.5',
          'border border-[var(--nb-border)]',
          'bg-transparent',
          'text-[var(--nb-muted)]',
          'hover:text-[var(--nb-text)] hover:border-[var(--nb-border)]/80'
        ],

        variant === 'ghost' && [
          'px-3 py-2',
          'border-0',
          'bg-transparent',
          'text-[var(--nb-muted)]',
          'hover:text-[var(--nb-text)] hover:bg-[var(--nb-surface-2)]'
        ],

        // Sizes
        size === 'small' && ['text-xs px-2.5 py-1.5'],

        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
