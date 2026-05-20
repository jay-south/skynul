import { contextBridge, ipcRenderer } from 'electron'

const authToken =
  process.argv.find((arg) => arg.startsWith('--skynul-auth-token='))?.split('=')[1] ?? ''

const skynul = {
  // ── Auth ──────────────────────────────────────────────────────────────
  getAuthToken: (): string => authToken,

  // ── Window Controls ──────────────────────────────────────────────────
  windowMinimize: (): Promise<void> => ipcRenderer.invoke('skynul:window:minimize'),
  windowMaximize: (): Promise<void> => ipcRenderer.invoke('skynul:window:maximize'),
  windowClose: (): Promise<void> => ipcRenderer.invoke('skynul:window:close'),
  onWindowMaximized: (cb: (maximized: boolean) => void): (() => void) => {
    const handler = (_evt: unknown, maximized: boolean): void => cb(maximized)
    ipcRenderer.on('skynul:window:maximized', handler)
    return () => ipcRenderer.off('skynul:window:maximized', handler)
  },

  // ── File Dialogs ─────────────────────────────────────────────────────
  showOpenFilesDialog: (): Promise<{ canceled: boolean; filePaths: string[] }> =>
    ipcRenderer.invoke('skynul:dialog:showOpenFiles'),
  fsSaveTempFile: (): Promise<string | null> => ipcRenderer.invoke('skynul:fs:saveTempFile'),

  // ── Clipboard ────────────────────────────────────────────────────────
  clipboardReadText: (): Promise<string> => ipcRenderer.invoke('skynul:clipboard:readText'),

  // ── Auto-Update ──────────────────────────────────────────────────────
  updateCheck: (): Promise<void> => ipcRenderer.invoke('skynul:update:check'),
  updateDownload: (): Promise<void> => ipcRenderer.invoke('skynul:update:download'),
  updateInstall: (): Promise<void> => ipcRenderer.invoke('skynul:update:install'),
  onUpdateAvailable: (
    cb: (info: { version: string; releaseDate?: string }) => void
  ): (() => void) => {
    const handler = (_evt: unknown, info: { version: string; releaseDate?: string }): void =>
      cb(info)
    ipcRenderer.on('skynul:update:available', handler)
    return () => ipcRenderer.off('skynul:update:available', handler)
  },
  onUpdateDownloadProgress: (cb: (info: { percent: number }) => void): (() => void) => {
    const handler = (_evt: unknown, info: { percent: number }): void => cb(info)
    ipcRenderer.on('skynul:update:download-progress', handler)
    return () => ipcRenderer.off('skynul:update:download-progress', handler)
  },
  onUpdateDownloaded: (cb: () => void): (() => void) => {
    const handler = (): void => cb()
    ipcRenderer.on('skynul:update:downloaded', handler)
    return () => ipcRenderer.off('skynul:update:downloaded', handler)
  },
  onUpdateNotAvailable: (cb: () => void): (() => void) => {
    const handler = (): void => cb()
    ipcRenderer.on('skynul:update:not-available', handler)
    return () => ipcRenderer.off('skynul:update:not-available', handler)
  },
  onUpdateError: (cb: (info: { message: string }) => void): (() => void) => {
    const handler = (_evt: unknown, info: { message: string }): void => cb(info)
    ipcRenderer.on('skynul:update:error', handler)
    return () => ipcRenderer.off('skynul:update:error', handler)
  }
}

if (!process.contextIsolated) {
  throw new Error('Skynul requires contextIsolation')
}

contextBridge.exposeInMainWorld('skynul', skynul)
