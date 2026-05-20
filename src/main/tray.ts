import { join } from 'node:path'
import { app, type BrowserWindow, Menu, nativeImage, Tray } from 'electron'

let tray: Tray | null = null

export function createTray(mainWindow: BrowserWindow): void {
  if (tray) return

  const iconPath = join(__dirname, '../../resources/icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)

  tray.setToolTip('Skynul')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Skynul',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
