import { ipcMain, dialog } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export interface LocalFileEntry {
  name: string
  type: 'file' | 'directory' | 'link' | 'unknown'
  size: number
  modifiedAt: Date
  permissions: string
  hidden: boolean
}

function statToEntry(name: string, fullPath: string): LocalFileEntry | null {
  try {
    const stat = fs.statSync(fullPath)
    let type: LocalFileEntry['type'] = 'unknown'
    if (stat.isDirectory()) type = 'directory'
    else if (stat.isFile()) type = 'file'
    else if (stat.isSymbolicLink()) type = 'link'

    const mode = stat.mode
    const perms = [
      type === 'directory' ? 'd' : '-',
      mode & 0o400 ? 'r' : '-',
      mode & 0o200 ? 'w' : '-',
      mode & 0o100 ? 'x' : '-',
      mode & 0o040 ? 'r' : '-',
      mode & 0o020 ? 'w' : '-',
      mode & 0o010 ? 'x' : '-',
      mode & 0o004 ? 'r' : '-',
      mode & 0o002 ? 'w' : '-',
      mode & 0o001 ? 'x' : '-',
    ].join('')

    return {
      name,
      type,
      size: stat.size,
      modifiedAt: stat.mtime,
      permissions: perms,
      hidden: name.startsWith('.'),
    }
  } catch {
    return null
  }
}

export function registerLocalHandlers(): void {
  // List local directory
  ipcMain.handle('local:list', async (_event, { dirPath }) => {
    try {
      const names = fs.readdirSync(dirPath)
      const entries: LocalFileEntry[] = []

      for (const name of names) {
        const fullPath = path.join(dirPath, name)
        const entry = statToEntry(name, fullPath)
        if (entry) entries.push(entry)
      }

      // Sort: directories first, then files
      entries.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1
        if (a.type !== 'directory' && b.type === 'directory') return 1
        return a.name.localeCompare(b.name)
      })

      return { success: true, entries }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Get home directory
  ipcMain.handle('local:homedir', async () => {
    return { success: true, path: os.homedir() }
  })

  // Open file/folder picker dialog
  ipcMain.handle('local:openDialog', async (_event, { type }) => {
    const result = await dialog.showOpenDialog({
      properties: type === 'folder' ? ['openDirectory'] : ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }
    return { success: true, path: result.filePaths[0] }
  })

  // Save dialog for download destination
  ipcMain.handle('local:saveDialog', async (_event, { defaultName }) => {
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(os.homedir(), 'Downloads', defaultName || 'download'),
    })
    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }
    return { success: true, path: result.filePath }
  })

  // Mkdir local
  ipcMain.handle('local:mkdir', async (_event, { dirPath }) => {
    try {
      fs.mkdirSync(dirPath, { recursive: true })
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Delete local
  ipcMain.handle('local:delete', async (_event, { filePath }) => {
    try {
      const stat = fs.statSync(filePath)
      if (stat.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true })
      } else {
        fs.unlinkSync(filePath)
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Rename local
  ipcMain.handle('local:rename', async (_event, { oldPath, newPath }) => {
    try {
      fs.renameSync(oldPath, newPath)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Get drives/roots (for Linux: /  for Mac: /)
  ipcMain.handle('local:roots', async () => {
    const roots = [{ path: '/', label: 'Root /' }]
    const home = os.homedir()
    if (home !== '/') {
      roots.unshift({ path: home, label: `Home (${path.basename(home)})` })
    }
    return { success: true, roots }
  })
}
