import styles from './Button.module.css'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'filled'
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
  const classes = [
    styles.button,
    variant === 'filled' && styles.filled,
    size === 'small' && styles.small,
    className
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  )
}
