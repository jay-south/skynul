import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowLeft } from '../../icons'

interface PageHeaderProps {
  title: string
  subtitle?: string
  showBack?: boolean
  backTo?: string
  actions?: ReactNode
}

/**
 * Header de página con título y botón back opcional
 * Usado en: Projects, Dashboard, Schedules
 */
export function PageHeader({
  title,
  subtitle,
  showBack,
  backTo,
  actions
}: PageHeaderProps): React.JSX.Element {
  const navigate = useNavigate()

  const handleBack = () => {
    if (backTo) {
      navigate(backTo)
    } else {
      navigate(-1)
    }
  }

  return (
    <div className="pageHeader">
      {showBack && (
        <div className="pageHeaderTop">
          <button type="button" className="pageHeaderBack" onClick={handleBack}>
            <IconArrowLeft width="22" height="22" />
            Back
          </button>
        </div>
      )}
      <div className="pageHeaderRow">
        <div className="pageHeaderText">
          <h1 className="pageHeaderTitle">{title}</h1>
          {subtitle && <p className="pageHeaderSubtitle">{subtitle}</p>}
        </div>
        {actions && <div className="pageHeaderActions">{actions}</div>}
      </div>
    </div>
  )
}
