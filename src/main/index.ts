import { app, BrowserWindow, shell, ipcMain, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerSftpHandlers } from './ipc/sftp'
import { registerFtpHandlers } from './ipc/ftp'
import { registerLocalHandlers } from './ipc/local'
import { registerConnectionHandlers } from './ipc/connections'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0d1117',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
    // Set for Windows/Linux
    ...(process.platform !== 'darwin' ? { icon: join(__dirname, '../../resources/icon.png') } : {}),
  })

  // Set for macOS Dock icon in development (in production the packaged app bundle has its own icon)
  if (process.platform === 'darwin' && !app.isPackaged) {
    const iconPath = join(__dirname, '../../resources/icon.png')
    app.dock.setIcon(nativeImage.createFromPath(iconPath))
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.nuxscp.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register all IPC handlers
  registerSftpHandlers()
  registerFtpHandlers()
  registerLocalHandlers()
  registerConnectionHandlers()

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Export mainWindow getter for IPC handlers
export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
