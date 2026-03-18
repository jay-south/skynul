import { NavLink, Outlet } from 'react-router-dom'
import { BackBar, PanelTitle, SettingsPanel } from '../components/layout'
import styles from './SettingsLayout.module.css'

export function SettingsLayout(): React.JSX.Element {
  return (
    <div className={styles.settingsLayout}>
      <SettingsPanel>
        <BackBar>
          <NavLink to="/tasks" className={styles.backBtn}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
            <span>Back</span>
          </NavLink>
        </BackBar>

        <PanelTitle>Settings</PanelTitle>

        <div className={styles.seg}>
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
              className={({ isActive }) => `${styles.segBtn}${isActive ? ` ${styles.active}` : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </div>

        <Outlet />
      </SettingsPanel>
    </div>
  )
}
