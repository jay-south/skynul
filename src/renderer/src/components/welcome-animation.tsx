import type React from 'react'
import timoSrc from '@/assets/timo.jpeg'
import { cn } from '@/lib/utils'

const BG_KEY = 'skynul-bg'

function getCustomBg(): string | null {
  try {
    return localStorage.getItem(BG_KEY)
  } catch {
    return null
  }
}

interface WelcomeAnimationProps {
  className?: string
}

export function WelcomeAnimation({ className }: WelcomeAnimationProps): React.JSX.Element {
  const customBg = getCustomBg()
  const src = customBg || timoSrc

  return <img src={src} alt="" className={cn('size-full object-cover object-bottom', className)} />
}
