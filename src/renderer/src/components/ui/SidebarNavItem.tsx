import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import styles from './SidebarNavItem.module.css'

interface SidebarNavItemProps {
  to: string
  icon: ReactNode
  children: ReactNode
}

export function SidebarNavItem({ to, icon, children }: SidebarNavItemProps): React.JSX.Element {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        isActive ? `${styles.navItem} ${styles.active}` : styles.navItem
      }
    >
      <span className={styles.icon}>{icon}</span>
      {children}
    </NavLink>
  )
}
