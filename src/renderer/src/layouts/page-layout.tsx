import { Outlet } from 'react-router-dom'

interface PageLayoutProps {
  children?: React.ReactNode
  showBackButton?: boolean
  title?: string
}

export function PageLayout({
  children,
  showBackButton,
  title
}: PageLayoutProps): React.JSX.Element {
  return (
    <div className="h-full overflow-hidden">
      <div className="h-full overflow-y-auto px-6 py-8">
        {(showBackButton || title) && (
          <div className="flex items-center gap-3 mb-6">
            {showBackButton && (
              <button
                type="button"
                onClick={() => window.history.back()}
                className="inline-flex items-center gap-1 px-3.5 py-2 pr-2 rounded-xl border-none bg-nb-panel text-nb-muted cursor-pointer text-sm font-medium transition-all duration-100 hover:bg-nb-accent-2/15 hover:text-nb-text"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                </svg>
                Back
              </button>
            )}
            {title && <h2 className="text-xl font-bold text-nb-text m-0">{title}</h2>}
          </div>
        )}
        <div className="w-full max-w-[640px]">{children || <Outlet />}</div>
      </div>
    </div>
  )
}
