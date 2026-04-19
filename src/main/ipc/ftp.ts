import { ipcMain, BrowserWindow } from 'electron'
import { createFtpDriver, getFtpDriver, removeFtpDriver } from '../protocols/FtpDriver'

export function registerFtpHandlers(): void {
  // Connect
  ipcMain.handle('ftp:connect', async (_event, { connectionId, config }) => {
    try {
      const driver = createFtpDriver(connectionId)
      await driver.connect(config)
      return { success: true }
    } catch (err: any) {
      removeFtpDriver(connectionId)
      return { success: false, error: err.message }
    }
  })

  // Disconnect
  ipcMain.handle('ftp:disconnect', async (_event, { connectionId }) => {
    removeFtpDriver(connectionId)
    return { success: true }
  })

  // List
  ipcMain.handle('ftp:list', async (_event, { connectionId, remotePath }) => {
    try {
      const driver = getFtpDriver(connectionId)
      if (!driver) throw new Error('Not connected')
      const entries = await driver.list(remotePath)
      return { success: true, entries }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Upload
  ipcMain.handle(
    'ftp:upload',
    async (event, { connectionId, transferId, localPath, remotePath }) => {
      try {
        const driver = getFtpDriver(connectionId)
        if (!driver) throw new Error('Not connected')
        const win = BrowserWindow.fromWebContents(event.sender)

        await driver.upload(localPath, remotePath, (percent, transferred, total) => {
          win?.webContents.send('transfer:progress', { transferId, percent, transferred, total })
        })

        win?.webContents.send('transfer:complete', { transferId })
        return { success: true }
      } catch (err: any) {
        return { success: false, error: err.message }
      }
    }
  )

  // Download
  ipcMain.handle(
    'ftp:download',
    async (event, { connectionId, transferId, remotePath, localPath }) => {
      try {
        const driver = getFtpDriver(connectionId)
        if (!driver) throw new Error('Not connected')
        const win = BrowserWindow.fromWebContents(event.sender)

        await driver.download(remotePath, localPath, (percent, transferred, total) => {
          win?.webContents.send('transfer:progress', { transferId, percent, transferred, total })
        })

        win?.webContents.send('transfer:complete', { transferId })
        return { success: true }
      } catch (err: any) {
        return { success: false, error: err.message }
      }
    }
  )

  // Mkdir
  ipcMain.handle('ftp:mkdir', async (_event, { connectionId, remotePath }) => {
    try {
      const driver = getFtpDriver(connectionId)
      if (!driver) throw new Error('Not connected')
      await driver.mkdir(remotePath)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Rename
  ipcMain.handle('ftp:rename', async (_event, { connectionId, oldPath, newPath }) => {
    try {
      const driver = getFtpDriver(connectionId)
      if (!driver) throw new Error('Not connected')
      await driver.rename(oldPath, newPath)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Delete
  ipcMain.handle('ftp:delete', async (_event, { connectionId, remotePath, isDir }) => {
    try {
      const driver = getFtpDriver(connectionId)
      if (!driver) throw new Error('Not connected')
      if (isDir) {
        await driver.deleteDir(remotePath)
      } else {
        await driver.delete(remotePath)
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
