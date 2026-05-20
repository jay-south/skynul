import { useNavigate } from 'react-router-dom'

interface PageHeaderProps {
  title: string
  subtitle?: string
  showBack?: boolean
  backTo?: string
}

export function PageHeader({
  title,
  subtitle,
  showBack,
  backTo
}: PageHeaderProps): React.JSX.Element {
  const navigate = useNavigate()

  const handleBack = () => {
    if (backTo) navigate(backTo)
    else navigate(-1)
  }

  return (
    <div className="flex flex-col gap-3 mb-6">
      {showBack && (
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1 px-3.5 py-2 pr-2 rounded-xl border-none bg-nb-panel text-nb-muted cursor-pointer text-sm font-medium w-fit transition-all duration-100 hover:bg-nb-accent-2/15 hover:text-nb-text"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
            <title>Back</title>
            <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
          Back
        </button>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-nb-text m-0">{title}</h1>
        {subtitle && <p className="text-nb-muted text-sm m-0">{subtitle}</p>}
      </div>
    </div>
  )
}
