import type { SVGProps } from 'react'

type IconArrowLeftProps = SVGProps<SVGSVGElement>

export function IconArrowLeft(props: IconArrowLeftProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
    </svg>
  )
}
