import { autoUpdater } from 'electron-updater'
import { BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'

let mainWindow: BrowserWindow | null = null

/** How often to re-check after the user dismisses the toast (ms). */
const RECHECK_INTERVAL = 4 * 60 * 60 * 1000 // 4 hours

export function initAutoUpdater(win: BrowserWindow): void {
  mainWindow = win

  // Don't check for updates in dev mode
  if (is.dev) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('skynul:update:available', {
      version: info.version,
      releaseDate: info.releaseDate
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('skynul:update:download-progress', {
      percent: progress.percent
    })
  })

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('skynul:update:downloaded')
  })

  autoUpdater.on('error', (err) => {
    console.warn('[AutoUpdater] Error:', err.message)
  })

  // Initial check after a short delay so the window is ready
  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch(() => {})
  }, 5_000)

  // Periodic check
  setInterval(
    () => {
      void autoUpdater.checkForUpdates().catch(() => {})
    },
    RECHECK_INTERVAL
  )
}

export function downloadUpdate(): void {
  void autoUpdater.downloadUpdate().catch(() => {})
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall(false, true)
}

export function checkForUpdates(): void {
  void autoUpdater.checkForUpdates().catch(() => {})
}
