import { Link, NavLink, Outlet } from 'react-router-dom'
import { PageHeader } from '@/components/page-header'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb'

const SETTINGS_TABS = [
  { path: 'general', label: 'General' },
  { path: 'agent', label: 'Agent' },
  { path: 'integrations', label: 'Integrations' },
  { path: 'developer', label: 'Developer' }
]

export function SettingsLayout(): React.JSX.Element {
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
              <BreadcrumbPage className="text-nb-text">Settings</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageHeader
          title="Settings"
          description="Configure your workspace, providers, and preferences."
          className="mb-6"
        />

        <div className="flex gap-1 rounded-xl bg-nb-panel border border-nb-border p-1 mb-6">
          {SETTINGS_TABS.map(({ path, label }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex-1 rounded-lg px-2 py-2 text-center text-xs font-medium no-underline transition-all duration-100
                ${
                  isActive
                    ? 'bg-nb-panel-2 text-nb-text shadow-sm'
                    : 'text-nb-muted hover:text-nb-text'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>

        <Outlet />
      </div>
    </div>
  )
}
