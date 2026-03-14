import { useEffect, useState } from 'react'

type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'upToDate'
  | 'error'

export function UpdateSettings(): React.JSX.Element {
  const [state, setState] = useState<UpdateState>('idle')
  const [version, setVersion] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    const offAvailable = window.skynul.onUpdateAvailable((info) => {
      setVersion(info.version)
      setState('available')
      setError('')
    })
    const offProgress = window.skynul.onUpdateDownloadProgress((info) => {
      setProgress(Math.round(info.percent))
      setState('downloading')
    })
    const offDownloaded = window.skynul.onUpdateDownloaded(() => {
      setState('ready')
    })
    const offNotAvailable = window.skynul.onUpdateNotAvailable(() => {
      setState('upToDate')
      setError('')
    })
    const offError = window.skynul.onUpdateError((info) => {
      setState('error')
      setError(info.message)
    })

    return () => {
      offAvailable()
      offProgress()
      offDownloaded()
      offNotAvailable()
      offError()
    }
  }, [])

  const checkNow = (): void => {
    setState('checking')
    setError('')
    window.skynul.updateCheck().catch((e) => {
      setState('error')
      setError(e instanceof Error ? e.message : String(e))
    })
  }

  const download = (): void => {
    setState('downloading')
    setError('')
    window.skynul.updateDownload().catch((e) => {
      setState('error')
      setError(e instanceof Error ? e.message : String(e))
    })
  }

  const restart = (): void => {
    window.skynul.updateInstall().catch((e) => {
      setState('error')
      setError(e instanceof Error ? e.message : String(e))
    })
  }

  const title =
    state === 'ready'
      ? `Update ready — v${version}`
      : state === 'downloading'
        ? `Downloading${progress > 0 ? ` ${progress}%` : '...'}`
        : state === 'available'
          ? `Update available — v${version}`
          : state === 'checking'
            ? 'Checking for updates...'
            : state === 'upToDate'
              ? 'You are up to date'
              : state === 'error'
                ? 'Update check failed'
                : 'Updates'

  return (
    <div className="settingsSection">
      <div className="settingsLabel">Updates</div>
      <div className="settingsField">
        <div className="settingsFieldHint">{title}</div>
        {state === 'downloading' ? (
          <div className="updateProgressBar" aria-label="Download progress">
            <div className="updateProgressFill" style={{ width: `${progress}%` }} />
          </div>
        ) : null}

        {error ? <div className="composerError">{error}</div> : null}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={checkNow}>
            Check now
          </button>
          {state === 'available' ? (
            <button className="btn" onClick={download}>
              Download
            </button>
          ) : null}
          {state === 'ready' ? (
            <button className="btn" onClick={restart}>
              Restart to update
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
