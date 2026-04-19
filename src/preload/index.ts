import { contextBridge, ipcRenderer } from 'electron'

// Expose a safe API to the renderer process
contextBridge.exposeInMainWorld('electron', {
  // SFTP
  sftp: {
    connect: (connectionId: string, config: any) =>
      ipcRenderer.invoke('sftp:connect', { connectionId, config }),
    disconnect: (connectionId: string) =>
      ipcRenderer.invoke('sftp:disconnect', { connectionId }),
    list: (connectionId: string, remotePath: string) =>
      ipcRenderer.invoke('sftp:list', { connectionId, remotePath }),
    upload: (connectionId: string, transferId: string, localPath: string, remotePath: string) =>
      ipcRenderer.invoke('sftp:upload', { connectionId, transferId, localPath, remotePath }),
    download: (connectionId: string, transferId: string, remotePath: string, localPath: string) =>
      ipcRenderer.invoke('sftp:download', { connectionId, transferId, remotePath, localPath }),
    mkdir: (connectionId: string, remotePath: string) =>
      ipcRenderer.invoke('sftp:mkdir', { connectionId, remotePath }),
    rename: (connectionId: string, oldPath: string, newPath: string) =>
      ipcRenderer.invoke('sftp:rename', { connectionId, oldPath, newPath }),
    delete: (connectionId: string, remotePath: string, isDir: boolean) =>
      ipcRenderer.invoke('sftp:delete', { connectionId, remotePath, isDir }),
    chmod: (connectionId: string, remotePath: string, mode: string) =>
      ipcRenderer.invoke('sftp:chmod', { connectionId, remotePath, mode }),
  },

  // FTP
  ftp: {
    connect: (connectionId: string, config: any) =>
      ipcRenderer.invoke('ftp:connect', { connectionId, config }),
    disconnect: (connectionId: string) =>
      ipcRenderer.invoke('ftp:disconnect', { connectionId }),
    list: (connectionId: string, remotePath: string) =>
      ipcRenderer.invoke('ftp:list', { connectionId, remotePath }),
    upload: (connectionId: string, transferId: string, localPath: string, remotePath: string) =>
      ipcRenderer.invoke('ftp:upload', { connectionId, transferId, localPath, remotePath }),
    download: (connectionId: string, transferId: string, remotePath: string, localPath: string) =>
      ipcRenderer.invoke('ftp:download', { connectionId, transferId, remotePath, localPath }),
    mkdir: (connectionId: string, remotePath: string) =>
      ipcRenderer.invoke('ftp:mkdir', { connectionId, remotePath }),
    rename: (connectionId: string, oldPath: string, newPath: string) =>
      ipcRenderer.invoke('ftp:rename', { connectionId, oldPath, newPath }),
    delete: (connectionId: string, remotePath: string, isDir: boolean) =>
      ipcRenderer.invoke('ftp:delete', { connectionId, remotePath, isDir }),
  },

  // Local FS
  local: {
    list: (dirPath: string) => ipcRenderer.invoke('local:list', { dirPath }),
    homedir: () => ipcRenderer.invoke('local:homedir'),
    openDialog: (type: 'file' | 'folder') => ipcRenderer.invoke('local:openDialog', { type }),
    saveDialog: (defaultName: string) => ipcRenderer.invoke('local:saveDialog', { defaultName }),
    mkdir: (dirPath: string) => ipcRenderer.invoke('local:mkdir', { dirPath }),
    delete: (filePath: string) => ipcRenderer.invoke('local:delete', { filePath }),
    rename: (oldPath: string, newPath: string) =>
      ipcRenderer.invoke('local:rename', { oldPath, newPath }),
    roots: () => ipcRenderer.invoke('local:roots'),
  },

  // Connections
  connections: {
    list: () => ipcRenderer.invoke('connections:list'),
    save: (connection: any) => ipcRenderer.invoke('connections:save', { connection }),
    update: (id: string, updates: any) => ipcRenderer.invoke('connections:update', { id, updates }),
    delete: (id: string) => ipcRenderer.invoke('connections:delete', { id }),
    get: (id: string) => ipcRenderer.invoke('connections:get', { id }),
    touch: (id: string) => ipcRenderer.invoke('connections:touch', { id }),
  },

  // Event listeners (transfer progress, connection events)
  on: (channel: string, callback: (...args: any[]) => void) => {
    const validChannels = [
      'transfer:progress',
      'transfer:complete',
      'transfer:error',
      'sftp:disconnected',
      'sftp:error',
    ]
    if (validChannels.includes(channel)) {
      const subscription = (_event: any, ...args: any[]) => callback(...args)
      ipcRenderer.on(channel, subscription)
      return () => ipcRenderer.removeListener(channel, subscription)
    }
    return () => {}
  },

  off: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback)
  },

  // Platform
  platform: process.platform,
})
