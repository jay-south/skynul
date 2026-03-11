console.log(`
\x1b[1;37m  ███████╗██╗  ██╗██╗   ██╗███╗   ██╗██╗   ██╗██╗
  ██╔════╝██║ ██╔╝╚██╗ ██╔╝████╗  ██║██║   ██║██║
  ███████╗█████╔╝  ╚████╔╝ ██╔██╗ ██║██║   ██║██║
  ╚════██║██╔═██╗   ╚██╔╝  ██║╚██╗██║██║   ██║██║
  ███████║██║  ██╗   ██║   ██║ ╚████║╚██████╔╝███████╗
  ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═══╝ ╚═════╝ ╚══════╝\x1b[0m
`)

// Detect host timezone from Windows (WSL defaults to UTC)
if (!process.env.TZ) {
  try {
    const tz = require('child_process')
      .execSync('powershell.exe -NoProfile -Command "[TimeZoneInfo]::Local.Id"', { timeout: 3000 })
      .toString()
      .trim()
    // Map common Windows timezone IDs to IANA
    const winToIana: Record<string, string> = {
      'Argentina Standard Time': 'America/Argentina/Buenos_Aires',
      'SA Western Standard Time': 'America/La_Paz',
      'Pacific Standard Time': 'America/Los_Angeles',
      'Eastern Standard Time': 'America/New_York',
      'Central Standard Time': 'America/Chicago',
      'Mountain Standard Time': 'America/Denver',
      UTC: 'UTC'
    }
    process.env.TZ = winToIana[tz] || tz
  } catch {
    /* not on WSL or powershell not available — keep system default */
  }
}

import { app, shell, BrowserWindow, screen, session, nativeTheme, protocol } from 'electron'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initPolicy, registerIpcHandlers, tryHandleChatGPTCallback } from './ipc'
import { initAutoUpdater } from './updater'
import { startAuthCallbackServer } from './auth-callback-server'
import { TaskManager } from './agent/task-manager'
import { closeSharedPlaywrightChromeCdp } from './browser/playwright-cdp'
import { ChannelManager } from './channels/channel-manager'
import { ScheduleRunner } from './schedule-runner'

let authServer: { close: () => Promise<void> } | null = null
let authWindow: BrowserWindow | null = null
let taskManager: TaskManager | null = null
let channelManager: ChannelManager | null = null
let scheduleRunner: ScheduleRunner | null = null

// Protocolo custom para servir archivos locales al renderer (file:// está bloqueado en dev)
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-file', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true } }
])

// WSL/VMs often fail GPU init; disable to avoid crashes/noise.
app.disableHardwareAcceleration()

// Propagate detected timezone to renderer (Chromium)
if (process.env.TZ && process.env.TZ !== 'UTC') {
  app.commandLine.appendSwitch('timezone', process.env.TZ)
}

nativeTheme.themeSource = 'dark'

function isWslHost(): boolean {
  if (process.platform !== 'linux') return false
  if (process.env.WSL_INTEROP || process.env.WSL_DISTRO_NAME) return true
  try {
    const version = require('fs').readFileSync('/proc/version', 'utf8') as string
    return version.toLowerCase().includes('microsoft')
  } catch {
    return false
  }
}

function createWindow(): BrowserWindow {
  // Create the browser window.
  const useNativeFrame = process.platform === 'linux' && !isWslHost()
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    minWidth: 600,
    minHeight: 400,
    show: false,
    frame: useNativeFrame,
    transparent: !useNativeFrame,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Show window immediately (ready-to-show not firing on some Wayland setups)
  mainWindow.show()

  // Notify renderer when maximize state changes so it can adapt the layout.
  // On Windows, frameless+transparent windows overflow the work area when maximized.
  // We constrain to the display work area so the UI doesn't hide behind the taskbar.
  mainWindow.on('maximize', () => {
    const { workArea } = screen.getDisplayMatching(mainWindow.getBounds())
    mainWindow.setBounds(workArea)
    mainWindow.webContents.send('skynul:window:maximized', true)
  })
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('skynul:window:maximized', false)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const url = new URL(details.url)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        shell.openExternal(details.url)
      }
    } catch {
      // ignore
    }
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function openAuthUrl(parent: BrowserWindow, url: string): void {
  if (authWindow && !authWindow.isDestroyed()) {
    authWindow.focus()
    return
  }

  authWindow = new BrowserWindow({
    width: 520,
    height: 720,
    resizable: true,
    show: true,
    autoHideMenuBar: true,
    parent,
    modal: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  authWindow.on('closed', () => {
    authWindow = null
  })

  authWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const u = new URL(details.url)
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        shell.openExternal(details.url)
      }
    } catch {
      // ignore
    }
    return { action: 'deny' }
  })

  authWindow.webContents.on('will-navigate', (evt, nextUrl) => {
    try {
      const u = new URL(nextUrl)
      if (u.protocol === 'https:') return
      if (
        u.protocol === 'http:' &&
        (u.hostname === '127.0.0.1' || u.hostname === 'localhost') &&
        u.port === '1455'
      ) {
        return
      }
    } catch {
      // ignore
    }
    evt.preventDefault()
  })

  void authWindow.loadURL(url)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.skynul.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media' || permission === 'mediaKeySystem')
  })

  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return permission === 'media' || permission === 'mediaKeySystem'
  })

  void initPolicy()

  // Handler del protocolo local-file://  — sirve archivos del filesystem al renderer
  const MIME: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp'
  }
  protocol.handle('local-file', async (request) => {
    // local-file:///tmp/file.png  → /tmp/file.png   (Linux/Mac)
    // local-file://C:\path\file   → C:\path\file    (Windows)
    let filePath = decodeURIComponent(request.url.slice('local-file://'.length))
    // En URLs bien formadas para Windows el path llega como /C:/path — normalizar
    if (process.platform === 'win32' && filePath.startsWith('/') && /^\/[A-Za-z]:/.test(filePath)) {
      filePath = filePath.slice(1)
    }
    const data = await readFile(filePath)
    const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
    return new Response(data, { headers: { 'Content-Type': MIME[ext] ?? 'application/octet-stream' } })
  })

  const win = createWindow()

  taskManager = new TaskManager()
  taskManager.setMainWindow(win)

  scheduleRunner = new ScheduleRunner(taskManager)
  scheduleRunner.start()

  channelManager = new ChannelManager(taskManager)
  void channelManager
    .loadGlobal()
    .then(() => channelManager!.startAll())
    .catch((e) => {
      console.warn('[ChannelManager] Failed to start:', e)
    })

  registerIpcHandlers({
    openAuthUrl: (url) => openAuthUrl(win, url),
    taskManager,
    channelManager
  })

  initAutoUpdater(win)

  // Local callback server used for OAuth redirects.
  // Uses a fixed port so it can be allowed in provider redirect URL settings.
  startAuthCallbackServer({
    port: 1455,
    mainWindow: win,
    onCallback: () => {
      if (authWindow && !authWindow.isDestroyed()) {
        authWindow.close()
      }
    },
    onCodeCallback: tryHandleChatGPTCallback
  })
    .then((s) => {
      authServer = s
    })
    .catch(() => {
      // If the port is taken, auth flows won't work.
      // We keep the app running; renderer will show an error on login.
    })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  scheduleRunner?.stop()
  taskManager?.destroyAll()
  void channelManager?.stopAll()
  void authServer?.close()
  void closeSharedPlaywrightChromeCdp()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
