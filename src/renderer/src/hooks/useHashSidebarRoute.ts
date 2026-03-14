import { useEffect, useRef } from 'react'

type SidebarTab = 'tasks' | 'settings' | 'dashboard'
type SettingsTab = 'general' | 'providers' | 'computer' | 'channels' | 'skills' | 'developer'

export function useHashSidebarRoute(opts: {
  sidebarTab: SidebarTab
  setSidebarTab: (tab: SidebarTab) => void
  settingsTab: SettingsTab
  setSettingsTab: (tab: SettingsTab) => void
}): void {
  const updatingHashRef = useRef(false)

  useEffect(() => {
    const applyHashRoute = (): void => {
      if (updatingHashRef.current) {
        updatingHashRef.current = false
        return
      }

      const hash = window.location.hash || ''
      const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
      const root = parts[0] ?? ''

      if (root === 'settings') {
        opts.setSidebarTab('settings')
        const nextTab = parts[1]
        if (
          nextTab === 'general' ||
          nextTab === 'providers' ||
          nextTab === 'computer' ||
          nextTab === 'channels' ||
          nextTab === 'developer' ||
          nextTab === 'skills'
        ) {
          opts.setSettingsTab(nextTab)
        }
        return
      }

      if (root === 'dashboard') {
        opts.setSidebarTab('dashboard')
        return
      }

      opts.setSidebarTab('tasks')
    }

    applyHashRoute()
    window.addEventListener('hashchange', applyHashRoute)
    return () => window.removeEventListener('hashchange', applyHashRoute)
  }, [opts])

  useEffect(() => {
    const nextHash =
      opts.sidebarTab === 'settings'
        ? `#/settings/${opts.settingsTab}`
        : opts.sidebarTab === 'dashboard'
          ? '#/dashboard'
          : ''

    if ((window.location.hash || '') === nextHash) return
    updatingHashRef.current = true
    window.location.hash = nextHash
  }, [opts.sidebarTab, opts.settingsTab])
}
