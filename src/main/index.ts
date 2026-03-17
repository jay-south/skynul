console.log(`
\x1b[1;37m  ███████╗██╗  ██╗██╗   ██╗███╗   ██╗██╗   ██╗██╗
  ██╔════╝██║ ██╔╝╚██╗ ██╔╝████╗  ██║██║   ██║██║
  ███████╗█████╔╝  ╚████╔╝ ██╔██╗ ██║██║   ██║██║
  ╚════██║██╔═██╗   ╚██╔╝  ██║╚██╗██║██║   ██║██║
  ███████║██║  ██╗   ██║   ██║ ╚████║╚██████╔╝███████╗
  ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═══╝ ╚═════╝ ╚══════╝\x1b[0m
`)

// Detect host timezone from Windows when running under WSL (WSL defaults to UTC)
const isWslEnv =
  process.platform === 'linux' && Boolean(process.env.WSL_INTEROP || process.env.WSL_DISTRO_NAME)

if (isWslEnv && !process.env.TZ) {
  try {
    const tz = require('child_process')
      .execSync('powershell.exe -NoProfile -Command "[TimeZoneInfo]::Local.Id"', {
        timeout: 3000,
        stdio: ['ignore', 'pipe', 'ignore']
      })
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
    /* keep system default */
  }
}

import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, nativeTheme, protocol, screen, session, shell } from 'electron'
import { readFile } from 'fs/promises'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import { initAutoUpdater } from './updater'

// Protocolo custom para servir archivos locales al renderer (file:// está bloqueado en dev)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-file',
    privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true }
  }
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

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.skynul.app')

  // Default open or close DevTools by F12 in development
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media' || permission === 'mediaKeySystem')
  })

  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return permission === 'media' || permission === 'mediaKeySystem'
  })

  // Handler del protocolo local-file://
  const MIME: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp'
  }
  protocol.handle('local-file', async (request) => {
    let filePath = decodeURIComponent(request.url.slice('local-file://'.length))
    if (process.platform === 'win32' && filePath.startsWith('/') && /^\/[A-Za-z]:/.test(filePath)) {
      filePath = filePath.slice(1)
    }
    const data = await readFile(filePath)
    const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
    return new Response(data, {
      headers: { 'Content-Type': MIME[ext] ?? 'application/octet-stream' }
    })
  })

  const win = createWindow()

  initAutoUpdater(win)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  // Server handles its own cleanup (playwright, channels, tasks) via SIGTERM
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
