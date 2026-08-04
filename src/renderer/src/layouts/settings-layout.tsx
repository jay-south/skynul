import { Outlet } from 'react-router-dom'

export function SettingsLayout(): React.JSX.Element {
  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto w-full max-w-[560px] px-8 py-8">
        <Outlet />
      </div>
    </div>
  )
}
