import { createHashRouter, Navigate } from 'react-router-dom'
import { RootLayout } from './layouts/root-layout'
import { DashboardPage } from './pages/dashboard-page'
import { NewSchedulePage } from './pages/new-schedule-page'
import { ProjectsPage } from './pages/projects-page'
import { ScheduleDetailPage } from './pages/schedule-detail-page'
import { ScheduledPage } from './pages/scheduled-page'
import { ChannelsSettingsPage } from './pages/settings/channels-settings-page'
import { ComputerSettingsPage } from './pages/settings/computer-settings-page'
import { DeveloperSettingsPage } from './pages/settings/developer-settings-page'
import { GeneralSettingsPage } from './pages/settings/general-settings-page'
import { ProvidersSettingsPage } from './pages/settings/providers-settings-page'
import { SkillsSettingsPage } from './pages/settings/skills-settings-page'
import { TaskChatPage } from './pages/task-chat-page'
// Pages
import { TasksIndexPage } from './pages/tasks-index-page'

export const router = createHashRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/tasks" replace />
      },
      {
        path: 'tasks',
        element: <TasksIndexPage />
      },
      {
        path: 'tasks/:taskId',
        element: <TaskChatPage />
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
            element: <NewSchedulePage />
          },
          {
            path: ':scheduleId',
            element: <ScheduleDetailPage />
          }
        ]
      },
      {
        path: 'settings',
        element: <Navigate to="/settings/general" replace />
      },
      {
        path: 'settings/general',
        element: <GeneralSettingsPage />
      },
      {
        path: 'settings/providers',
        element: <ProvidersSettingsPage />
      },
      {
        path: 'settings/computer',
        element: <ComputerSettingsPage />
      },
      {
        path: 'settings/channels',
        element: <ChannelsSettingsPage />
      },
      {
        path: 'settings/skills',
        element: <SkillsSettingsPage />
      },
      {
        path: 'settings/developer',
        element: <DeveloperSettingsPage />
      }
    ]
  }
])
