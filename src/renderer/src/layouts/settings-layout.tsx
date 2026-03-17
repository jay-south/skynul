import { NavLink, Outlet } from 'react-router-dom'

export function SettingsLayout(): React.JSX.Element {
  return (
    <div className="settingsLayout">
      <div className="settingsPanel">
        <div className="settingsPanelInner">
          <div className="settingsBackBar">
            <NavLink to="/tasks" className="backBtn">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
              </svg>
              <span>Back</span>
            </NavLink>
          </div>

          <h2 className="settingsPanelTitle">Settings</h2>

          <div className="seg">
            {[
              { path: 'general', label: 'General' },
              { path: 'providers', label: 'Providers' },
              { path: 'computer', label: 'Computer' },
              { path: 'channels', label: 'Channels' },
              { path: 'skills', label: 'Skills' },
              { path: 'developer', label: 'Developer' }
            ].map(({ path, label }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) => `segBtn${isActive ? ' active' : ''}`}
              >
                {label}
              </NavLink>
            ))}
          </div>

          <Outlet />
        </div>
      </div>
    </div>
  )
}
