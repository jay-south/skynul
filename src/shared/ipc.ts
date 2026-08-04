export const IPC = {
  windowMinimize: 'skynul:window:minimize',
  windowMaximize: 'skynul:window:maximize',
  windowClose: 'skynul:window:close',
  showOpenFilesDialog: 'skynul:dialog:showOpenFiles',
  fsSaveTempFile: 'skynul:fs:saveTempFile',
  clipboardReadText: 'skynul:clipboard:readText',
  updateCheck: 'skynul:update:check',
  updateDownload: 'skynul:update:download',
  updateInstall: 'skynul:update:install'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
