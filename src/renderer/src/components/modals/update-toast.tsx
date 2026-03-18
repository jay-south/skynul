import { useCallback, useEffect, useState } from 'react'
import styles from './update-toast.module.css'

type UpdateState = 'idle' | 'available' | 'downloading' | 'ready'

export function UpdateToast(): React.ReactNode {
  const [state, setState] = useState<UpdateState>('idle')
  const [version, setVersion] = useState('')
  const [progress, setProgress] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const offAvailable = window.skynul.onUpdateAvailable((info) => {
      setVersion(info.version)
      setState('available')
      setDismissed(false)
    })
    const offProgress = window.skynul.onUpdateDownloadProgress((info) => {
      setProgress(Math.round(info.percent))
    })
    const offDownloaded = window.skynul.onUpdateDownloaded(() => {
      setState('ready')
    })
    const offNotAvailable = window.skynul.onUpdateNotAvailable(() => {
      setState('idle')
    })
    const offError = window.skynul.onUpdateError(() => {
      setState('idle')
    })
    return () => {
      offAvailable()
      offProgress()
      offDownloaded()
      offNotAvailable()
      offError()
    }
  }, [])

  const handleUpdate = useCallback(() => {
    if (state === 'available') {
      setState('downloading')
      window.skynul.updateDownload()
    } else if (state === 'ready') {
      window.skynul.updateInstall()
    }
  }, [state])

  const handleDismiss = useCallback(() => {
    setDismissed(true)
  }, [])

  if (state === 'idle' || dismissed) return null

  return (
    <div className={styles.updateToast}>
      <div className={styles.updateToastIcon}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M8 1v10M4 7l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      <div className={styles.updateToastBody}>
        <span className={styles.updateToastTitle}>
          {state === 'ready'
            ? 'Update ready to install'
            : state === 'downloading'
              ? `Downloading${progress > 0 ? ` ${progress}%` : '...'}`
              : `Update available — v${version}`}
        </span>
      </div>

      <div className={styles.updateToastActions}>
        {state === 'downloading' ? (
          <div className={styles.updateProgressBar}>
            <div className={styles.updateProgressFill} style={{ width: `${progress}%` }} />
          </div>
        ) : (
          <>
            <button
              type="button"
              className={`${styles.updateToastBtn} ${styles.secondary}`}
              onClick={handleDismiss}
            >
              Later
            </button>
            <button
              type="button"
              className={`${styles.updateToastBtn} ${styles.primary}`}
              onClick={handleUpdate}
            >
              {state === 'ready' ? 'Restart' : 'Update'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
