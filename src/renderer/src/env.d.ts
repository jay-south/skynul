/// <reference types="vite/client" />

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  readonly length: number
  readonly isFinal: boolean
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

declare class SpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((e: Event) => void) | null
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface Window {
  SpeechRecognition: typeof SpeechRecognition | undefined
  webkitSpeechRecognition: typeof SpeechRecognition | undefined
  skynul: {
    getAuthToken: () => string
    windowMinimize: () => Promise<void>
    windowMaximize: () => Promise<void>
    windowClose: () => Promise<void>
    onWindowMaximized: (cb: (maximized: boolean) => void) => () => void
    showOpenFilesDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>
    fsSaveTempFile: () => Promise<string | null>
    clipboardReadText: () => Promise<string>
    updateCheck: () => Promise<void>
    updateDownload: () => Promise<void>
    updateInstall: () => Promise<void>
    onUpdateAvailable: (cb: (info: { version: string; releaseDate?: string }) => void) => () => void
    onUpdateDownloadProgress: (cb: (info: { percent: number }) => void) => () => void
    onUpdateDownloaded: (cb: () => void) => () => void
    onUpdateNotAvailable: (cb: () => void) => () => void
    onUpdateError: (cb: (info: { message: string }) => void) => () => void
  }
}
