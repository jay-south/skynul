import { createHashRouter, Navigate } from 'react-router-dom'
import { PageLayout } from '@/layouts/page-layout'
import { RootLayout } from '@/layouts/root-layout'
import { SettingsLayout } from '@/layouts/settings-layout'
import { TasksLayout } from '@/layouts/tasks-layout'
import { DashboardPage } from '@/pages/dashboard-page'
import { NewSchedulePage } from '@/pages/new-schedule-page'
import { ProjectsPage } from '@/pages/projects-page'
import { ScheduleDetailPage } from '@/pages/schedule-detail-page'
import { ScheduledPage } from '@/pages/scheduled-page'
import { ChannelsSettingsPage } from '@/pages/settings/channels-settings-page'
import { ComputerSettingsPage } from '@/pages/settings/computer-settings-page'
import { DeveloperSettingsPage } from '@/pages/settings/developer-settings-page'
import { GeneralSettingsPage } from '@/pages/settings/general-settings-page'
import { ProvidersSettingsPage } from '@/pages/settings/providers-settings-page'
import { SkillsSettingsPage } from '@/pages/settings/skills-settings-page'
import { TaskChatPage } from '@/pages/task-chat-page'
import { TasksIndexPage } from '@/pages/tasks-index-page'

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
        element: (
          <PageLayout title="Dashboard">
            <DashboardPage />
          </PageLayout>
        )
      },
      {
        path: 'projects',
        element: (
          <PageLayout title="Projects">
            <ProjectsPage />
          </PageLayout>
        )
      },
      {
        path: 'schedules',
        children: [
          {
            index: true,
            element: (
              <PageLayout title="Scheduled">
                <ScheduledPage />
              </PageLayout>
            )
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
        path: 'settings',
        element: <SettingsLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="/settings/general" replace />
          },
          {
            path: 'general',
            element: <GeneralSettingsPage />
          },
          {
            path: 'providers',
            element: <ProvidersSettingsPage />
          },
          {
            path: 'computer',
            element: <ComputerSettingsPage />
          },
          {
            path: 'channels',
            element: <ChannelsSettingsPage />
          },
          {
            path: 'skills',
            element: <SkillsSettingsPage />
          },
          {
            path: 'developer',
            element: <DeveloperSettingsPage />
          }
        ]
      }
    ]
  }
])
