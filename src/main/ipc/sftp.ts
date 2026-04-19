import { ipcMain, BrowserWindow } from 'electron'
import { createSftpDriver, getSftpDriver, removeSftpDriver } from '../protocols/SftpDriver'

export function registerSftpHandlers(): void {
  // Connect
  ipcMain.handle('sftp:connect', async (event, { connectionId, config }) => {
    try {
      const driver = createSftpDriver(connectionId)

      driver.on('close', () => {
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send('sftp:disconnected', { connectionId })
        })
      })

      driver.on('error', (err) => {
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send('sftp:error', { connectionId, error: err.message })
        })
      })

      await driver.connect(config)
      return { success: true }
    } catch (err: any) {
      removeSftpDriver(connectionId)
      return { success: false, error: err.message }
    }
  })

  // Disconnect
  ipcMain.handle('sftp:disconnect', async (_event, { connectionId }) => {
    removeSftpDriver(connectionId)
    return { success: true }
  })

  // List directory
  ipcMain.handle('sftp:list', async (_event, { connectionId, remotePath }) => {
    try {
      const driver = getSftpDriver(connectionId)
      if (!driver) throw new Error('Not connected')
      const entries = await driver.list(remotePath)
      return { success: true, entries }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Upload file
  ipcMain.handle(
    'sftp:upload',
    async (event, { connectionId, transferId, localPath, remotePath }) => {
      try {
        const driver = getSftpDriver(connectionId)
        if (!driver) throw new Error('Not connected')
        const win = BrowserWindow.fromWebContents(event.sender)

        await driver.upload(localPath, remotePath, (percent, transferred, total) => {
          win?.webContents.send('transfer:progress', {
            transferId,
            percent,
            transferred,
            total,
          })
        })

        win?.webContents.send('transfer:complete', { transferId })
        return { success: true }
      } catch (err: any) {
        BrowserWindow.fromWebContents(event.sender)?.webContents.send('transfer:error', {
          transferId,
          error: err.message,
        })
        return { success: false, error: err.message }
      }
    }
  )

  // Download file
  ipcMain.handle(
    'sftp:download',
    async (event, { connectionId, transferId, remotePath, localPath }) => {
      try {
        const driver = getSftpDriver(connectionId)
        if (!driver) throw new Error('Not connected')
        const win = BrowserWindow.fromWebContents(event.sender)

        await driver.download(remotePath, localPath, (percent, transferred, total) => {
          win?.webContents.send('transfer:progress', {
            transferId,
            percent,
            transferred,
            total,
          })
        })

        win?.webContents.send('transfer:complete', { transferId })
        return { success: true }
      } catch (err: any) {
        return { success: false, error: err.message }
      }
    }
  )

  // Mkdir
  ipcMain.handle('sftp:mkdir', async (_event, { connectionId, remotePath }) => {
    try {
      const driver = getSftpDriver(connectionId)
      if (!driver) throw new Error('Not connected')
      await driver.mkdir(remotePath)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Rename
  ipcMain.handle('sftp:rename', async (_event, { connectionId, oldPath, newPath }) => {
    try {
      const driver = getSftpDriver(connectionId)
      if (!driver) throw new Error('Not connected')
      await driver.rename(oldPath, newPath)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Delete file
  ipcMain.handle('sftp:delete', async (_event, { connectionId, remotePath, isDir }) => {
    try {
      const driver = getSftpDriver(connectionId)
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

  // Chmod
  ipcMain.handle('sftp:chmod', async (_event, { connectionId, remotePath, mode }) => {
    try {
      const driver = getSftpDriver(connectionId)
      if (!driver) throw new Error('Not connected')
      await driver.chmod(remotePath, mode)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
