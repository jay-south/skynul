import { useEffect, useState } from 'react'
import { SettingsInset, SettingsRow } from '@/components/feature/settings/settings-primitives'
import { Button } from '@/components/ui/button'

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
    if (typeof window === 'undefined' || !window.skynul) return
    const offAvailable = window.skynul.onUpdateAvailable((info) => {
      setVersion(info.version)
      setState('available')
      setError('')
    })
    const offProgress = window.skynul.onUpdateDownloadProgress((info) => {
      setProgress(Math.round(info.percent))
      setState('downloading')
    })
    const offDownloaded = window.skynul.onUpdateDownloaded(() => setState('ready'))
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
    if (typeof window === 'undefined' || !window.skynul) {
      setError('Update check not available — running outside Electron')
      return
    }
    setState('checking')
    setError('')
    window.skynul.updateCheck().catch((e) => {
      setState('error')
      setError(e instanceof Error ? e.message : String(e))
    })
  }

  const download = (): void => {
    if (typeof window === 'undefined' || !window.skynul) return
    setState('downloading')
    setError('')
    window.skynul.updateDownload().catch((e) => {
      setState('error')
      setError(e instanceof Error ? e.message : String(e))
    })
  }

  const restart = (): void => {
    if (typeof window === 'undefined' || !window.skynul) return
    window.skynul.updateInstall().catch((e) => {
      setState('error')
      setError(e instanceof Error ? e.message : String(e))
    })
  }

  const statusLabel =
    state === 'ready'
      ? `Ready — v${version}`
      : state === 'downloading'
        ? `Downloading${progress > 0 ? ` ${progress}%` : '…'}`
        : state === 'available'
          ? `Available — v${version}`
          : state === 'checking'
            ? 'Checking…'
            : state === 'upToDate'
              ? 'Up to date'
              : state === 'error'
                ? 'Check failed'
                : 'Not checked yet'

  return (
    <>
      <SettingsRow title="Skynul desktop" description={statusLabel}>
        <Button variant="outline" size="sm" onClick={checkNow}>
          Check
        </Button>
      </SettingsRow>
      {(state === 'available' || state === 'ready' || state === 'downloading' || error) && (
        <SettingsInset>
          {state === 'downloading' && (
            <div
              className="h-1 rounded-full bg-nb-border overflow-hidden mb-2"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className="h-full rounded-full bg-nb-accent-2 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          {error && <p className="text-xs text-nb-danger mb-2">{error}</p>}
          <div className="flex gap-2">
            {state === 'available' && (
              <Button size="sm" className="bg-nb-accent-2 text-white" onClick={download}>
                Download
              </Button>
            )}
            {state === 'ready' && (
              <Button size="sm" className="bg-nb-accent-2 text-white" onClick={restart}>
                Restart to update
              </Button>
            )}
          </div>
        </SettingsInset>
      )}
    </>
  )
}
