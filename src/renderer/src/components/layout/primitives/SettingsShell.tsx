import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { PageContent } from './PageContent'

interface SettingsShellProps {
  children: ReactNode
}

export function SettingsShell({ children }: SettingsShellProps): React.JSX.Element {
  return (
    <PageContent title="Settings" showBack backTo="/tasks">
      <div className="seg">
        {[
          { path: '/settings/general', label: 'General' },
          { path: '/settings/providers', label: 'Providers' },
          { path: '/settings/computer', label: 'Computer' },
          { path: '/settings/channels', label: 'Channels' },
          { path: '/settings/skills', label: 'Skills' },
          { path: '/settings/developer', label: 'Developer' }
        ].map(({ path, label }) => (
          <NavLink key={path} to={path} className={({ isActive }) => `segBtn${isActive ? ' active' : ''}`}>
            {label}
          </NavLink>
        ))}
      </div>
      {children}
    </PageContent>
  )
}
