import type { LucideIcon } from 'lucide-react'
import { Brain, MessageSquare, Settings2, Shield } from 'lucide-react'

export const SETTINGS_NAV: Array<{ path: string; label: string; icon: LucideIcon }> = [
  { path: 'general', label: 'General', icon: Settings2 },
  { path: 'permissions', label: 'Permissions', icon: Shield },
  { path: 'model', label: 'Model', icon: Brain },
  { path: 'channels', label: 'Channels', icon: MessageSquare }
]

export function isSettingsPath(pathname: string): boolean {
  return pathname === '/settings' || pathname.startsWith('/settings/')
}

export function isTasksPath(pathname: string): boolean {
  return pathname === '/tasks' || pathname.startsWith('/tasks/')
}
