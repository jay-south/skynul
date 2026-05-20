import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ContentCard } from '@/components/content-card'
import { PageHeader } from '@/components/page-header'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb'

const BG_KEY = 'skynul-bg'

function getCustomBg(): string | null {
  try {
    return localStorage.getItem(BG_KEY)
  } catch {
    return null
  }
}

function setCustomBg(dataUrl: string): void {
  try {
    localStorage.setItem(BG_KEY, dataUrl)
    window.dispatchEvent(new CustomEvent('skynul-bg-changed'))
  } catch {
    /* ignore */
  }
}

function clearCustomBg(): void {
  try {
    localStorage.removeItem(BG_KEY)
    window.dispatchEvent(new CustomEvent('skynul-bg-changed'))
  } catch {
    /* ignore */
  }
}

export function ProfilePage(): React.JSX.Element {
  const [bgPreview, setBgPreview] = useState<string | null>(getCustomBg)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFilePick = () => fileInputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setCustomBg(dataUrl)
      setBgPreview(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const handleReset = () => {
    clearCustomBg()
    setBgPreview(null)
  }

  return (
    <div className="h-full overflow-hidden">
      <div className="h-full overflow-y-auto px-6 py-6 mx-auto w-full max-w-6xl">
        <Breadcrumb className="mb-4">
          <BreadcrumbList className="text-base text-nb-muted">
            <BreadcrumbItem>
              <BreadcrumbLink asChild className="text-nb-muted hover:text-nb-text">
                <Link to="/dashboard">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-nb-text">Profile</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageHeader
          title="Profile"
          description="Manage your profile and agent settings."
          className="mb-6"
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ContentCard title="Identity" description="Your personal information.">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center size-10 rounded-full bg-nb-accent-2/10 text-nb-accent-2 shrink-0 text-sm font-semibold">
                S
              </span>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-medium text-nb-text">User</span>
                <span className="text-xs text-nb-muted truncate">user@local</span>
              </div>
            </div>
          </ContentCard>

          <ContentCard title="Agent" description="Active provider and status.">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-nb-muted">Provider</span>
                <span className="text-xs font-medium text-nb-text">OpenAI</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-nb-muted">Model</span>
                <span className="text-xs font-medium text-nb-text">gpt-4o</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-nb-muted">Status</span>
                <span className="text-xs font-medium text-nb-text">Resting</span>
              </div>
            </div>
          </ContentCard>
        </div>

        <ContentCard
          title="Background"
          description="Customize your welcome screen."
          className="mt-4"
        >
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-xl overflow-hidden border border-nb-border shrink-0 bg-nb-panel">
              {bgPreview ? (
                <img src={bgPreview} alt="" className="size-full object-cover" />
              ) : (
                <div className="size-full flex items-center justify-center text-nb-muted text-[10px]">
                  Default
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={handleFilePick}
                className="text-xs px-3 py-1.5 rounded-lg border border-nb-border bg-nb-panel-2 text-nb-text cursor-pointer hover:bg-nb-panel transition-colors"
              >
                Choose image
              </button>
              {bgPreview && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-nb-muted hover:text-nb-text cursor-pointer bg-transparent border-none p-0 text-left"
                >
                  Reset to default
                </button>
              )}
            </div>
          </div>
        </ContentCard>

        <ContentCard title="Activity" description="Recent stats and performance." className="mt-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Tasks', value: '12' },
              { label: 'Schedules', value: '3' },
              { label: 'Uptime', value: '99.2%' }
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-0.5">
                <span className="text-lg font-semibold text-nb-text">{stat.value}</span>
                <span className="text-xs text-nb-muted">{stat.label}</span>
              </div>
            ))}
          </div>
        </ContentCard>
      </div>
    </div>
  )
}
