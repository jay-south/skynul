import { clipboard, dialog, ipcMain, BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { checkForUpdates, downloadUpdate, installUpdate } from './updater'

/**
 * Register all IPC handlers for OS-level operations.
 * Called once when the app is ready.
 */
export function registerIpcHandlers(win: BrowserWindow): void {
  // ── Window Controls ────────────────────────────────────────────────
  ipcMain.handle('skynul:window:minimize', () => {
    win.minimize()
  })

  ipcMain.handle('skynul:window:maximize', () => {
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  })

  ipcMain.handle('skynul:window:close', () => {
    win.close()
  })

  // ── File Dialogs ───────────────────────────────────────────────────
  ipcMain.handle('skynul:dialog:showOpenFiles', async () => {
    return dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections']
    })
  })

  ipcMain.handle('skynul:fs:saveTempFile', async () => {
    try {
      const image = clipboard.readImage()
      if (image.isEmpty()) return null
      const png = image.toPNG()
      const path = `${tmpdir()}/skynul-clip-${randomUUID()}.png`
      await mkdir(tmpdir(), { recursive: true })
      await writeFile(path, png)
      return path
    } catch {
      return null
    }
  })

  // ── Clipboard ──────────────────────────────────────────────────────
  ipcMain.handle('skynul:clipboard:readText', () => {
    return clipboard.readText()
  })

  // ── Auto-Update ────────────────────────────────────────────────────
  ipcMain.handle('skynul:update:check', async () => {
    await checkForUpdates()
  })

  ipcMain.handle('skynul:update:download', async () => {
    await downloadUpdate()
  })

  ipcMain.handle('skynul:update:install', () => {
    installUpdate()
  })
}
