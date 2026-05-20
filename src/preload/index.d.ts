declare global {
  interface Window {
    skynul: {
      // Auth
      getAuthToken: () => string

      // Window Controls
      windowMinimize: () => Promise<void>
      windowMaximize: () => Promise<void>
      windowClose: () => Promise<void>
      onWindowMaximized: (cb: (maximized: boolean) => void) => () => void

      // File Dialogs
      showOpenFilesDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>
      fsSaveTempFile: () => Promise<string | null>

      // Clipboard
      clipboardReadText: () => Promise<string>

      // Auto-Update
      updateCheck: () => Promise<void>
      updateDownload: () => Promise<void>
      updateInstall: () => Promise<void>
      onUpdateAvailable: (
        cb: (info: { version: string; releaseDate?: string }) => void
      ) => () => void
      onUpdateDownloadProgress: (cb: (info: { percent: number }) => void) => () => void
      onUpdateDownloaded: (cb: () => void) => () => void
      onUpdateNotAvailable: (cb: () => void) => () => void
      onUpdateError: (cb: (info: { message: string }) => void) => () => void
    }
  }
}
