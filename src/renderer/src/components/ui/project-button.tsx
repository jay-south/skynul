import { cn } from '../../lib/utils'

interface ProjectButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'default' | 'small'
  variant?: 'default' | 'filled'
  children: React.ReactNode
}

/**
 * Botón específico para crear proyectos
 * Migrado desde main.css .projectsCreateBtn
 */
export function ProjectButton({
  variant = 'filled',
  size = 'default',
  className,
  children,
  ...props
}: ProjectButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={cn(
        // Base styles de .projectsCreateBtn
        'inline-flex items-center gap-1.5',
        'appearance-none',
        'border border-white/15',
        'rounded-[10px]',
        variant === 'filled' ? 'bg-white/[0.08]' : 'bg-transparent',
        'text-white',
        'cursor-pointer',
        'font-inherit',
        'font-medium',
        'transition-all duration-150',

        // Hover states
        'hover:bg-white/[0.12] hover:border-white/25',

        // Size variants
        size === 'default' && ['px-5 py-2.5', 'text-[13px]', 'mt-1.5'],

        size === 'small' && ['px-3.5 py-1.5', 'text-xs', 'mt-0'],

        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
