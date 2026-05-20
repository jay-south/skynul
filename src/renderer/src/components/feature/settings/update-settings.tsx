import { useEffect, useState } from 'react'
import { Section, SectionField, SectionLabel } from '@/components/common'

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
      setError('Update check not available - running outside Electron')
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
    if (typeof window === 'undefined' || !window.skynul) {
      setError('Update download not available - running outside Electron')
      return
    }
    setState('downloading')
    setError('')
    window.skynul.updateDownload().catch((e) => {
      setState('error')
      setError(e instanceof Error ? e.message : String(e))
    })
  }

  const restart = (): void => {
    if (typeof window === 'undefined' || !window.skynul) {
      setError('Update install not available - running outside Electron')
      return
    }
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
    <Section>
      <SectionLabel>Updates</SectionLabel>
      <SectionField>
        <div className="text-[11px] font-medium text-nb-muted">{title}</div>
        {state === 'downloading' && (
          <div
            className="h-1.5 rounded-full bg-nb-border overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Download progress"
          >
            <div
              className="h-full rounded-full bg-nb-accent-2 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {error ? (
          <div className="text-xs text-nb-danger px-2.5 py-2 rounded-lg bg-nb-danger/10 border border-nb-danger/30">
            {error}
          </div>
        ) : null}
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={checkNow}
            className="text-xs font-medium px-2.5 py-1.5 rounded-md bg-nb-panel-2 border border-nb-border cursor-pointer text-nb-text hover:bg-nb-accent-2/10"
          >
            Check now
          </button>
          {state === 'available' && (
            <button
              type="button"
              onClick={download}
              className="text-xs font-medium px-2.5 py-1.5 rounded-md bg-nb-panel-2 border border-nb-border cursor-pointer text-nb-text hover:bg-nb-accent-2/10"
            >
              Download
            </button>
          )}
          {state === 'ready' && (
            <button
              type="button"
              onClick={restart}
              className="text-xs font-medium px-2.5 py-1.5 rounded-md bg-nb-panel-2 border border-nb-border cursor-pointer text-nb-text hover:bg-nb-accent-2/10"
            >
              Restart to update
            </button>
          )}
        </div>
      </SectionField>
    </Section>
  )
}
