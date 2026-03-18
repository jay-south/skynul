import { useNavigate } from 'react-router-dom'
import styles from './PageHeader.module.css'

interface PageHeaderProps {
  title: string
  showBack?: boolean
  backTo?: string
}

export function PageHeader({ title, showBack, backTo }: PageHeaderProps): React.JSX.Element {
  const navigate = useNavigate()

  const handleBack = () => {
    if (backTo) {
      navigate(backTo)
    } else {
      navigate(-1)
    }
  }

  return (
    <div className={styles.pageHeader}>
      {showBack && (
        <button type="button" className={styles.backButton} onClick={handleBack}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
          Back
        </button>
      )}

      <div className={styles.titleRow}>
        <h1 className={styles.title}>{title}</h1>
      </div>
    </div>
  )
}
