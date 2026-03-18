import styles from './PathBox.module.css'

interface PathBoxProps {
  children: React.ReactNode
  title?: string
}

export function PathBox({ children, title }: PathBoxProps) {
  return (
    <div className={styles.pathBox} title={title}>
      {children}
    </div>
  )
}
