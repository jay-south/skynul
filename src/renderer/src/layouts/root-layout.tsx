import { Outlet, NavLink } from 'react-router-dom'
import { useState } from 'react'
import skynulLogo from '../assets/logo-skynul.svg'

export function RootLayout(): React.JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)

  // TODO: Implement window controls via HTTP API or keep IPC for this
  const handleMinimize = () => {
    console.log('Minimize window')
    // window.skynul.windowMinimize()
  }

  const handleMaximize = () => {
    setIsMaximized(!isMaximized)
    console.log('Maximize window')
    // window.skynul.windowMaximize()
  }

  const handleClose = () => {
    console.log('Close window')
    // window.skynul.windowClose()
  }

  return (
    <div className={`layout${isMaximized ? ' maximized' : ''}`}>
      {/* Title bar */}
      <div className="titleBar">
        <button className="winBtn" onClick={handleMinimize} aria-label="Minimize">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <rect x="4" y="11" width="16" height="2" rx="1" />
          </svg>
        </button>
        <button className="winBtn" onClick={handleMaximize} aria-label="Maximize">
          <svg
            viewBox="0 0 24 24"
            width="11"
            height="11"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="4" y="4" width="16" height="16" rx="2" />
          </svg>
        </button>
        <button className="winBtn close" onClick={handleClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <path d="M6.225 4.811a1 1 0 0 0-1.414 1.414L10.586 12l-5.775 5.775a1 1 0 1 0 1.414 1.414L12 13.414l5.775 5.775a1 1 0 0 0 1.414-1.414L13.414 12l5.775-5.775a1 1 0 0 0-1.414-1.414L12 10.586 6.225 4.811Z" />
          </svg>
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebarBrand">
          <img src={skynulLogo} alt="Skynul" className="sbFooterLogo" />
        </div>

        <nav className="sidebarNav">
          <NavLink
            to="/tasks"
            className={({ isActive }) => `sidebarNavItem${isActive ? ' active' : ''}`}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            Tasks
          </NavLink>

          <NavLink
            to="/dashboard"
            className={({ isActive }) => `sidebarNavItem${isActive ? ' active' : ''}`}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
            </svg>
            Dashboard
          </NavLink>

          <NavLink
            to="/projects"
            className={({ isActive }) => `sidebarNavItem${isActive ? ' active' : ''}`}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            Projects
          </NavLink>

          <NavLink
            to="/schedules"
            className={({ isActive }) => `sidebarNavItem${isActive ? ' active' : ''}`}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Scheduled
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) => `sidebarNavItem${isActive ? ' active' : ''}`}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 1h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.13.52-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 7.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.83 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.3.6.22l2.39-.96c.5.41 1.05.73 1.63.94l.36 2.54c.05.24.25.42.49.42h3.8c.24 0 .44-.18.49-.42l.36-2.54c.58-.22 1.13-.52 1.63-.94l2.39.96c.22.08.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
            </svg>
            Settings
          </NavLink>
        </nav>

        {/* Profile section */}
        <div className="sidebarFooter">{/* Profile dropdown va acá */}</div>
      </aside>

      {/* Main content area */}
      <section className="main">
        <Outlet />
      </section>
    </div>
  )
}
