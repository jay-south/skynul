import { createHashRouter, Navigate, useLocation } from 'react-router-dom'
import { PageLayout } from '@/layouts/page-layout'
import { RootLayout } from '@/layouts/root-layout'
import { SettingsLayout } from '@/layouts/settings-layout'
import { TasksLayout } from '@/layouts/tasks-layout'
import { DashboardPage } from '@/pages/dashboard-page'
import { NewSchedulePage } from '@/pages/new-schedule-page'
import { ProfilePage } from '@/pages/profile-page'
import { ProjectsPage } from '@/pages/projects-page'
import { ScheduleDetailPage } from '@/pages/schedule-detail-page'
import { ScheduledPage } from '@/pages/scheduled-page'
import { ChannelsPage } from '@/pages/settings/channels-page'
import { GeneralPage } from '@/pages/settings/general-page'
import { ModelPage } from '@/pages/settings/model-page'
import { PermissionsPage } from '@/pages/settings/permissions-page'
import { TaskChatPage } from '@/pages/task-chat-page'
import { TasksIndexPage } from '@/pages/tasks-index-page'
import { WelcomePage } from '@/pages/welcome-page'

function AppShell(): React.JSX.Element {
  const location = useLocation()
  if (location.pathname === '/') return <Navigate to="/welcome" replace />
  return <RootLayout />
}

export const router = createHashRouter([
  {
    path: '/welcome',
    element: <WelcomePage />
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />
      },
      {
        path: 'tasks',
        element: <TasksLayout />,
        children: [
          {
            index: true,
            element: <TasksIndexPage />
          },
          {
            path: ':taskId',
            element: <TaskChatPage />
          }
        ]
      },
      {
        path: 'dashboard',
        element: <DashboardPage />
      },
      {
        path: 'projects',
        element: <ProjectsPage />
      },
      {
        path: 'schedules',
        children: [
          {
            index: true,
            element: <ScheduledPage />
          },
          {
            path: 'new',
            element: (
              <PageLayout title="New Schedule">
                <NewSchedulePage />
              </PageLayout>
            )
          },
          {
            path: ':scheduleId',
            element: (
              <PageLayout title="Schedule Detail">
                <ScheduleDetailPage />
              </PageLayout>
            )
          }
        ]
      },
      {
        path: 'profile',
        element: <ProfilePage />
      },
      {
        path: 'settings',
        element: <SettingsLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="/settings/general" replace />
          },
          {
            path: 'general',
            element: <GeneralPage />
          },
          {
            path: 'permissions',
            element: <PermissionsPage />
          },
          {
            path: 'model',
            element: <ModelPage />
          },
          {
            path: 'channels',
            element: <ChannelsPage />
          }
        ]
      }
    ]
  }
])
