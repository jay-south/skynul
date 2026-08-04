import { cn } from '@/lib/utils'

export function ThemeIcon(props: {
  src: string
  alt?: string
  className?: string
}): React.JSX.Element {
  return (
    <img
      src={props.src}
      alt={props.alt ?? ''}
      draggable={false}
      className={cn('themed-icon object-contain', props.className)}
    />
  )
}
