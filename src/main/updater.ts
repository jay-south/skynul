import { autoUpdater } from 'electron-updater'
import { app, BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import log from 'electron-log'

let mainWindow: BrowserWindow | null = null

/** How often to re-check after the user dismisses the toast (ms). */
const RECHECK_INTERVAL = 4 * 60 * 60 * 1000 // 4 hours

function getUpdateChannel(version: string): 'alpha' | 'beta' | 'latest' {
  const match = version.match(/-(alpha|beta)(?:\.\d+)?$/i)
  if (!match) return 'latest'
  return match[1].toLowerCase() === 'beta' ? 'beta' : 'alpha'
}

function emit(channel: string, payload?: unknown): void {
  mainWindow?.webContents.send(channel, payload)
}

function reportUpdaterError(error: unknown): Error {
  const normalized = error instanceof Error ? error : new Error(String(error))
  const message = normalized.message || 'Unknown auto-update error'
  log.error('[AutoUpdater] Error:', normalized)
  emit('skynul:update:error', { message })
  return normalized
}

export function initAutoUpdater(win: BrowserWindow): void {
  mainWindow = win

  // Don't check for updates in dev mode
  if (is.dev) return

  const channel = getUpdateChannel(app.getVersion())
  autoUpdater.channel = channel
  autoUpdater.allowPrerelease = channel !== 'latest'
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  log.info(`[AutoUpdater] Initialized on channel '${channel}' for v${app.getVersion()}`)

  autoUpdater.on('update-available', (info) => {
    log.info(`[AutoUpdater] Update available: ${info.version}`)
    emit('skynul:update:available', {
      version: info.version,
      releaseDate: info.releaseDate
    })
  })

  autoUpdater.on('update-not-available', () => {
    log.info('[AutoUpdater] No update available')
    emit('skynul:update:not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    emit('skynul:update:download-progress', {
      percent: progress.percent
    })
  })

  autoUpdater.on('update-downloaded', () => {
    log.info('[AutoUpdater] Update downloaded')
    emit('skynul:update:downloaded')
  })

  autoUpdater.on('error', (err) => {
    reportUpdaterError(err)
  })

  // Initial check after a short delay so the window is ready
  setTimeout(() => {
    void checkForUpdates().catch(reportUpdaterError)
  }, 5_000)

  // Periodic check
  setInterval(() => {
    void checkForUpdates().catch(reportUpdaterError)
  }, RECHECK_INTERVAL)
}

export async function downloadUpdate(): Promise<void> {
  try {
    await autoUpdater.downloadUpdate()
  } catch (error) {
    throw reportUpdaterError(error)
  }
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall(false, true)
}

export async function checkForUpdates(): Promise<void> {
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    throw reportUpdaterError(error)
  }
}
