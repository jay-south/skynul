import { Outlet } from 'react-router-dom'

export function TasksLayout(): React.JSX.Element {
  return (
    <div className="h-full min-h-0">
      <Outlet />
    </div>
  )
}
