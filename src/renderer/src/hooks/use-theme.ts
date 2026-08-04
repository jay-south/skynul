import type { ThemeMode } from '@shared'
import { useEffect } from 'react'
import { useGeneralSettings } from '@/queries'

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

function resolveSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyThemeMode(mode: ThemeMode): void {
  applyTheme(mode === 'system' ? resolveSystemTheme() : mode)
}

const saved = loadSaved()
if (saved) applyTheme(saved)
else applyTheme('dark')

export function useTheme(): void {
  const { data: settings } = useGeneralSettings()

  useEffect(() => {
    if (loadSaved()) return
    applyThemeMode(settings?.themeMode ?? 'dark')
    if (settings?.themeMode !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (): void => applyThemeMode('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [settings?.themeMode])
}
