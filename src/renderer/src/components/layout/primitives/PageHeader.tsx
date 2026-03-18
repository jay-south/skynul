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
    <div className="flex flex-col gap-3 mb-6">
      {/* Back button row */}
      {showBack && (
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors w-fit"
        >
          <IconArrowLeft width="18" height="18" />
          Back
        </button>
      )}

      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
