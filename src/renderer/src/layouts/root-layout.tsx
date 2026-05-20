import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppSidebar } from '@/components/app-sidebar'
import { ErrorBoundary } from '@/components/error-boundary'
import { TitleBar } from '@/components/title-bar'
import { SidebarProvider } from '@/components/ui/sidebar'
import { useTheme } from '@/hooks/use-theme'

const BG_KEY = 'skynul-bg'

function getCustomBg(): string | null {
  try {
    return localStorage.getItem(BG_KEY)
  } catch {
    return null
  }
}

export function RootLayout(): React.JSX.Element {
  useTheme()

  const [bgUrl, setBgUrl] = useState(getCustomBg)

  useEffect(() => {
    const handler = () => setBgUrl(getCustomBg())
    window.addEventListener('skynul-bg-changed', handler)
    return () => window.removeEventListener('skynul-bg-changed', handler)
  }, [])

  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="relative flex flex-col flex-1 h-screen overflow-hidden">
        {bgUrl && (
          <div
            className="pointer-events-none fixed inset-0"
            style={{
              backgroundImage: `url("${bgUrl}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundAttachment: 'fixed',
              mixBlendMode: 'soft-light'
            }}
          />
        )}
        <TitleBar />
        <main className="relative flex-1 overflow-hidden">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </SidebarProvider>
  )
}
