import { useEffect } from 'react'
import { usePolicy } from '@/queries'

const THEME_KEY = 'skynul-theme'

function applyTheme(resolved: string): void {
  document.documentElement.setAttribute('data-theme', resolved)
}

function loadSaved(): string | null {
  try {
    return localStorage.getItem(THEME_KEY)
  } catch {
    return null
  }
}

// Apply immediately on module load to prevent flash
const saved = loadSaved()
if (saved) applyTheme(saved)
else applyTheme('dark')

export function useTheme(): void {
  const { data: policy } = usePolicy()

  useEffect(() => {
    if (loadSaved()) return
    const mode = policy?.themeMode ?? 'dark'
    if (mode !== 'system') {
      applyTheme(mode)
      return
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    applyTheme(mq.matches ? 'dark' : 'light')
    const handler = (e: MediaQueryListEvent): void => applyTheme(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [policy?.themeMode])
}
