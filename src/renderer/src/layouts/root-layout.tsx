import { type CSSProperties, useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import skynulLogo from '../assets/logo-skynul.svg'
import { SUPABASE_CONFIGURED, supabase } from '../supabase'
import { Button } from '../components/ui/button'
import { cn } from '../lib/utils'

export function RootLayout(): React.JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)
  const [accountEmail, setAccountEmail] = useState('')
  const [accountConnected, setAccountConnected] = useState(false)

  // Check auth status
  useState(() => {
    if (!SUPABASE_CONFIGURED || !supabase) return

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setAccountConnected(true)
        setAccountEmail(data.user.email ?? '')
      }
    })

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccountConnected(!!session)
      setAccountEmail(session?.user?.email ?? '')
    })

    return () => subscription.unsubscribe()
  })

  const handleMinimize = () => {
    console.log('Minimize window')
  }

  const handleMaximize = () => {
    setIsMaximized(!isMaximized)
    console.log('Maximize window')
  }

  const handleClose = () => {
    console.log('Close window')
  }

  const handleSignOut = async () => {
    if (!SUPABASE_CONFIGURED || !supabase) return
    await supabase.auth.signOut()
  }

  useEffect(() => {
    const rootEl = document.getElementById('root')
    if (!rootEl) return
    rootEl.style.padding = isMaximized ? '0' : '1px'
  }, [isMaximized])

  return (
    <div
      className={cn(
        'h-full min-h-0 grid grid-cols-[320px_1fr] grid-rows-[38px_1fr] overflow-hidden rounded-[10px] bg-[var(--nb-bg)]',
        'max-[860px]:grid-cols-1',
        'shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_24px_48px_rgba(0,0,0,0.5)]',
        isMaximized && 'rounded-none shadow-none'
      )}
    >
      {/* Title bar */}
      <div
        className={cn(
          'col-span-2 max-[860px]:col-span-1 flex items-center justify-end gap-[6px] px-[8px] border-b border-[var(--nb-border)]',
          'bg-[var(--nb-bg)] select-none'
        )}
        style={{ WebkitAppRegion: 'drag' } as CSSProperties}
      >
        <button
          type="button"
          className={cn(
            'w-[26px] h-[26px] rounded-[6px] border-none bg-transparent text-[var(--nb-muted)]',
            'flex items-center justify-center cursor-pointer flex-shrink-0 transition-colors duration-100',
            'hover:bg-[color-mix(in_srgb,var(--nb-text),transparent_88%)] hover:text-[var(--nb-text)]'
          )}
          onClick={handleMinimize}
          aria-label="Minimize"
          style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <rect x="4" y="11" width="16" height="2" rx="1" />
          </svg>
        </button>
        <button
          type="button"
          className={cn(
            'w-[26px] h-[26px] rounded-[6px] border-none bg-transparent text-[var(--nb-muted)]',
            'flex items-center justify-center cursor-pointer flex-shrink-0 transition-colors duration-100',
            'hover:bg-[color-mix(in_srgb,var(--nb-text),transparent_88%)] hover:text-[var(--nb-text)]'
          )}
          onClick={handleMaximize}
          aria-label="Maximize"
          style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
        >
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
        <button
          type="button"
          className={cn(
            'w-[26px] h-[26px] rounded-[6px] border-none bg-transparent text-[var(--nb-muted)]',
            'flex items-center justify-center cursor-pointer flex-shrink-0 transition-colors duration-100',
            'hover:bg-[color-mix(in_srgb,var(--nb-danger),transparent_82%)] hover:text-[var(--nb-danger)]'
          )}
          onClick={handleClose}
          aria-label="Close"
          style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <path d="M6.225 4.811a1 1 0 0 0-1.414 1.414L10.586 12l-5.775 5.775a1 1 0 1 0 1.414 1.414L12 13.414l5.775 5.775a1 1 0 0 0 1.414-1.414L13.414 12l5.775-5.775a1 1 0 0 0-1.414-1.414L12 10.586 6.225 4.811Z" />
          </svg>
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={cn(
          'min-h-0 p-[14px] border-r border-[var(--nb-border)] bg-[var(--nb-sidebar-bg,var(--nb-panel-2))]',
          'max-[860px]:hidden',
          'backdrop-blur-[18px] overflow-hidden flex flex-col gap-[12px] select-none'
        )}
        style={{ WebkitBackdropFilter: 'blur(18px)' } as CSSProperties}
      >
        <div className="flex-shrink-0 p-[4px_8px_20px]">
          <img src={skynulLogo} alt="Skynul" className="sbFooterLogo" />
        </div>

        <nav className="flex flex-col gap-[4px] p-[8px_12px]">
          <NavLink
            to="/tasks"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-[12px] px-[12px] py-[10px] rounded-[8px] text-[var(--nb-muted)]',
                'no-underline text-[14px] font-[500] transition-all duration-[150ms]',
                '[&>svg]:shrink-0',
                'hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--nb-text)]',
                isActive && 'bg-[rgba(108,140,255,0.12)] text-[var(--nb-accent)]'
              )
            }
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              <path d="M4 1l.5 1.5L6 3l-1.5.5L4 5l-.5-1.5L2 3l1.5-.5L4 1z" />
            </svg>
            Tasks
          </NavLink>

          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-[12px] px-[12px] py-[10px] rounded-[8px] text-[var(--nb-muted)]',
                'no-underline text-[14px] font-[500] transition-all duration-[150ms]',
                '[&>svg]:shrink-0',
                'hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--nb-text)]',
                isActive && 'bg-[rgba(108,140,255,0.12)] text-[var(--nb-accent)]'
              )
            }
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
            </svg>
            Dashboard
          </NavLink>

          <NavLink
            to="/projects"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-[12px] px-[12px] py-[10px] rounded-[8px] text-[var(--nb-muted)]',
                'no-underline text-[14px] font-[500] transition-all duration-[150ms]',
                '[&>svg]:shrink-0',
                'hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--nb-text)]',
                isActive && 'bg-[rgba(108,140,255,0.12)] text-[var(--nb-accent)]'
              )
            }
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            Projects
          </NavLink>

          <NavLink
            to="/schedules"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-[12px] px-[12px] py-[10px] rounded-[8px] text-[var(--nb-muted)]',
                'no-underline text-[14px] font-[500] transition-all duration-[150ms]',
                '[&>svg]:shrink-0',
                'hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--nb-text)]',
                isActive && 'bg-[rgba(108,140,255,0.12)] text-[var(--nb-accent)]'
              )
            }
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Scheduled
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-[12px] px-[12px] py-[10px] rounded-[8px] text-[var(--nb-muted)]',
                'no-underline text-[14px] font-[500] transition-all duration-[150ms]',
                '[&>svg]:shrink-0',
                'hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--nb-text)]',
                isActive && 'bg-[rgba(108,140,255,0.12)] text-[var(--nb-accent)]'
              )
            }
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 1h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.13.52-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 7.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.83 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.3.6.22l2.39-.96c.5.41 1.05.73 1.63.94l.36 2.54c.05.24.25.42.49.42h3.8c.24 0 .44-.18.49-.42l.36-2.54c.58-.22 1.13-.52 1.63-.94l2.39.96c.22.08.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
            </svg>
            Settings
          </NavLink>
        </nav>

        {/* Sign In button at bottom */}
        <div
          className="mt-auto p-[16px] border-t border-[var(--nb-border)]"
        >
          {accountConnected ? (
            <button
              type="button"
              onClick={() => void handleSignOut()}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                background: 'transparent',
                border: '1px solid var(--nb-border)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'var(--nb-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'white'
                }}
              >
                {accountEmail.slice(0, 2).toUpperCase()}
              </div>
              <span
                style={{
                  flex: 1,
                  textAlign: 'left',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {accountEmail}
              </span>
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="currentColor"
                style={{ opacity: 0.6 }}
              >
                <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
              </svg>
            </button>
          ) : (
            <Button
              onClick={() => {
                // TODO: Open auth modal
                console.log('Open auth modal')
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 16px'
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M10 17l5-5-5-5v10zm9-14H5c-1.1 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
              </svg>
              Sign In
            </Button>
          )}
        </div>
      </aside>

      {/* Main content area */}
      <section className="main">
        <Outlet />
      </section>
    </div>
  )
}
