interface PathBoxProps {
  children: React.ReactNode
  title?: string
}

export function PathBox({ children, title }: PathBoxProps) {
  return (
    <div
      className="font-mono text-xs text-nb-text/84 border border-nb-border bg-nb-panel px-3 py-2.5 rounded-xl mb-2.5 truncate"
      title={title}
    >
      {children}
    </div>
  )
}
