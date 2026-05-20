import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { AgentStatus } from '@/components/agent-status'
import {
  IconDashboard,
  IconProjects,
  IconScheduled,
  IconSettings,
  IconTasks,
  IconUser,
  LogoSkynulMark
} from '@/components/sidebar-icons'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator
} from '@/components/ui/sidebar'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: IconDashboard },
  { to: '/tasks', label: 'Tasks', icon: IconTasks },
  { to: '/projects', label: 'Projects', icon: IconProjects },
  { to: '/schedules', label: 'Scheduled', icon: IconScheduled }
]

export function AppSidebar(): React.JSX.Element {
  const location = useLocation()
  const [agentStatus] = useState<'idle' | 'active'>('idle')

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border/40 text-sidebar-foreground"
    >
      <SidebarHeader className="px-4 pt-3 pb-3">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <LogoSkynulMark className="size-6 text-sidebar-foreground" />
          <span className="text-base font-semibold tracking-tight text-sidebar-foreground leading-none group-data-[collapsible=icon]:hidden">
            Skynul
          </span>
        </div>
      </SidebarHeader>

      <SidebarSeparator className="mx-3 w-auto bg-sidebar-border/40" />

      <SidebarContent className="py-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {NAV.map((item) => {
                const isActive =
                  location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      size="lg"
                      className="relative transition-all duration-200 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:h-12!"
                    >
                      <NavLink to={item.to} className="relative no-underline hover:no-underline">
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-[hsl(var(--nb-accent-2))] opacity-0 transition-all duration-300 group-data-[active=true]/menu-button:opacity-100"
                          style={{
                            boxShadow: '0 0 10px hsl(var(--nb-accent-2) / 0.6)'
                          }}
                        />

                        <item.icon className="relative z-10 transition-transform duration-200 group-hover/menu-button:scale-110" />
                        <span className="relative z-10 text-[15px] font-medium tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:hidden">
                          {item.label}
                        </span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 pb-4 pt-2">
        <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
          {/* Profile */}
          <NavLink
            to="/profile"
            className="flex items-center gap-2.5 flex-1 rounded-md px-2 py-1.5 hover:bg-sidebar-accent transition-colors no-underline hover:no-underline min-w-0 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:gap-1"
          >
            <span className="flex items-center justify-center size-8 rounded-full bg-sidebar-accent text-sidebar-foreground shrink-0">
              <IconUser className="size-4" />
            </span>
            <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:hidden">
              <span className="text-sm font-medium text-sidebar-foreground leading-tight truncate">
                Profile
              </span>
              <span className="text-[10px] text-sidebar-foreground/40 leading-tight truncate">
                Workspace
              </span>
            </div>
          </NavLink>

          {/* Settings gear */}
          <SidebarMenuButton
            asChild
            isActive={location.pathname === '/settings'}
            tooltip="Settings"
            size="lg"
            className="relative w-auto shrink-0 transition-all duration-200 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:h-12!"
          >
            <NavLink to="/settings" className="relative no-underline hover:no-underline">
              <IconSettings className="relative z-10 transition-transform duration-200 group-hover/menu-button:scale-110" />
            </NavLink>
          </SidebarMenuButton>
        </div>

        <SidebarSeparator className="my-2 w-auto bg-sidebar-border/40" />

        {/* Status + Version */}
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5 group-data-[collapsible=icon]:justify-center">
          <AgentStatus status={agentStatus} />
          <span className="text-xs text-sidebar-foreground/50 truncate group-data-[collapsible=icon]:hidden">
            {agentStatus === 'active' ? 'Thinking' : 'Resting'}
          </span>
          <span className="ml-auto text-xs text-sidebar-foreground/30 whitespace-nowrap group-data-[collapsible=icon]:hidden">
            v0.1
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
