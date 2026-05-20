import { useState } from 'react'
import { SidebarTrigger } from '@/components/ui/sidebar'

export function TitleBar(): React.JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)

  return (
    <header
      className="flex items-center gap-2 px-4 h-12 shrink-0 border-b border-sidebar-border select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <SidebarTrigger />
      </div>
      <div className="flex-1" />
      {[
        {
          label: 'Minimize',
          icon: <rect x="4" y="11" width="16" height="2" rx="1" />,
          viewBox: '0 0 24 24',
          onClick: () => console.log('Minimize')
        },
        {
          label: 'Maximize',
          icon: <rect x="4" y="4" width="16" height="16" rx="2" />,
          viewBox: '0 0 24 24',
          onClick: () => setIsMaximized(!isMaximized)
        },
        {
          label: 'Close',
          icon: (
            <path d="M6.225 4.811a1 1 0 0 0-1.414 1.414L10.586 12l-5.775 5.775a1 1 0 1 0 1.414 1.414L12 13.414l5.775 5.775a1 1 0 0 0 1.414-1.414L13.414 12l5.775-5.775a1 1 0 0 0-1.414-1.414L12 10.586 6.225 4.811Z" />
          ),
          viewBox: '0 0 24 24',
          onClick: () => console.log('Close'),
          isClose: true
        }
      ].map((btn) => (
        <button
          key={btn.label}
          type="button"
          onClick={btn.onClick}
          aria-label={btn.label}
          className={`w-[26px] h-[26px] rounded-md border-none bg-transparent flex items-center justify-center cursor-pointer shrink-0 transition-all duration-100
            ${
              btn.isClose
                ? 'text-sidebar-muted hover:bg-red-500/20 hover:text-red-500'
                : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground'
            }`}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <svg viewBox={btn.viewBox} width="12" height="12" fill="currentColor">
            <title>{btn.label}</title>
            {btn.icon}
          </svg>
        </button>
      ))}
    </header>
  )
}
