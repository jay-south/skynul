import { useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'

const SIDEBAR_TAB = {
  tasks: 'tasks',
  settings: 'settings',
  dashboard: 'dashboard'
} as const

type SidebarTab = (typeof SIDEBAR_TAB)[keyof typeof SIDEBAR_TAB]

const SETTINGS_TAB = {
  general: 'general',
  providers: 'providers',
  computer: 'computer',
  channels: 'channels',
  skills: 'skills',
  developer: 'developer'
} as const

type SettingsTab = (typeof SETTINGS_TAB)[keyof typeof SETTINGS_TAB]

export function parseHashRoute(hash: string): { sidebarTab: SidebarTab; settingsTab: SettingsTab } {
  const cleaned = String(hash || '').replace(/^#\/?/, '')
  const parts = cleaned.split('/').filter(Boolean)
  const root = parts[0] ?? ''

  if (root === 'settings') {
    const nextTab = parts[1]
    const settingsTab =
      nextTab && Object.values(SETTINGS_TAB).includes(nextTab as SettingsTab)
        ? (nextTab as SettingsTab)
        : SETTINGS_TAB.general
    return { sidebarTab: SIDEBAR_TAB.settings, settingsTab }
  }

  if (root === 'dashboard') {
    return { sidebarTab: SIDEBAR_TAB.dashboard, settingsTab: SETTINGS_TAB.general }
  }

  return { sidebarTab: SIDEBAR_TAB.tasks, settingsTab: SETTINGS_TAB.general }
}

export function buildHashRoute(sidebarTab: SidebarTab, settingsTab: SettingsTab): string {
  if (sidebarTab === SIDEBAR_TAB.settings) return `#/settings/${settingsTab}`
  if (sidebarTab === SIDEBAR_TAB.dashboard) return '#/dashboard'
  return ''
}

export function useHashSidebarRoute(opts: {
  sidebarTab: SidebarTab
  setSidebarTab: Dispatch<SetStateAction<SidebarTab>>
  settingsTab: SettingsTab
  setSettingsTab: Dispatch<SetStateAction<SettingsTab>>
}): void {
  const updatingHashRef = useRef(false)

  // IMPORTANT: Only subscribe once.
  // If we re-run this effect on every render (due to object identity), we can
  // read the OLD hash and overwrite in-app navigation, causing a visible flicker.
  useEffect(() => {
    const applyHashRoute = (): void => {
      if (updatingHashRef.current) {
        updatingHashRef.current = false
        return
      }

      const next = parseHashRoute(window.location.hash || '')
      opts.setSidebarTab((prev) => (prev === next.sidebarTab ? prev : next.sidebarTab))
      opts.setSettingsTab((prev) => (prev === next.settingsTab ? prev : next.settingsTab))
    }

    applyHashRoute()
    window.addEventListener('hashchange', applyHashRoute)
    return () => window.removeEventListener('hashchange', applyHashRoute)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const nextHash = buildHashRoute(opts.sidebarTab, opts.settingsTab)
    if ((window.location.hash || '') === nextHash) return

    updatingHashRef.current = true
    window.location.hash = nextHash
  }, [opts.sidebarTab, opts.settingsTab])
}
