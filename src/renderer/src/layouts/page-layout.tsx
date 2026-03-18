import { Outlet } from 'react-router-dom'
import styles from './page-layout.module.css'

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
    <div className={styles.pageLayout}>
      <div className={styles.pageLayoutInner}>
        {(showBackButton || title) && (
          <div className={styles.pageLayoutHeader}>
            {showBackButton && (
              <button
                type="button"
                className={styles.pageLayoutBackBtn}
                onClick={() => window.history.back()}
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
            {title && <h2 className={styles.pageLayoutTitle}>{title}</h2>}
          </div>
        )}
        <div className={styles.pageLayoutContent}>{children || <Outlet />}</div>
      </div>
    </div>
  )
}
