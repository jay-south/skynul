import { useEffect, useState } from 'react'

export function useAppVersion(): string {
  const [version, setVersion] = useState('')

  useEffect(() => {
    let alive = true
    window.skynul
      .appGetVersion()
      .then((v) => {
        if (alive) setVersion(v)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  return version
}
