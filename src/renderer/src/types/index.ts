// ============================================================
// Global type declarations for the renderer process
// ============================================================

export interface SavedConnection {
  id: string
  name: string
  protocol: 'sftp' | 'ftp' | 'ftps'
  host: string
  port: number
  username: string
  authType: 'password' | 'key'
  password?: string
  privateKeyPath?: string
  passphrase?: string
  remotePath?: string
  createdAt: string
  lastConnected?: string
}

export interface RemoteFileEntry {
  name: string
  type: 'd' | '-' | 'l' | 'file' | 'directory' | 'link' | 'unknown'
  size: number
  modifyTime?: number
  modifiedAt?: Date
  permissions: string
  owner?: string
  group?: string
}

export interface LocalFileEntry {
  name: string
  type: 'file' | 'directory' | 'link' | 'unknown'
  size: number
  modifiedAt: Date
  permissions: string
  hidden: boolean
}

export type FileEntry = RemoteFileEntry | LocalFileEntry

export interface TransferItem {
  id: string
  type: 'upload' | 'download'
  fileName: string
  localPath: string
  remotePath: string
  percent: number
  transferred: number
  total: number
  status: 'pending' | 'transferring' | 'done' | 'error'
  error?: string
  startedAt: Date
}

export interface ActiveSession {
  sessionId: string
  connectionId: string
  connection: SavedConnection
  remotePath: string
  connected: boolean
  protocol: 'sftp' | 'ftp' | 'ftps'
}

// ============================================================
// Electron API interface (exposed via preload/contextBridge)
// ============================================================
declare global {
  interface Window {
    electron: {
      sftp: {
        connect(connectionId: string, config: any): Promise<{ success: boolean; error?: string }>
        disconnect(connectionId: string): Promise<{ success: boolean }>
        list(connectionId: string, remotePath: string): Promise<{ success: boolean; entries?: RemoteFileEntry[]; error?: string }>
        upload(connectionId: string, transferId: string, localPath: string, remotePath: string): Promise<{ success: boolean; error?: string }>
        download(connectionId: string, transferId: string, remotePath: string, localPath: string): Promise<{ success: boolean; error?: string }>
        mkdir(connectionId: string, remotePath: string): Promise<{ success: boolean; error?: string }>
        rename(connectionId: string, oldPath: string, newPath: string): Promise<{ success: boolean; error?: string }>
        delete(connectionId: string, remotePath: string, isDir: boolean): Promise<{ success: boolean; error?: string }>
        chmod(connectionId: string, remotePath: string, mode: string): Promise<{ success: boolean; error?: string }>
      }
      ftp: {
        connect(connectionId: string, config: any): Promise<{ success: boolean; error?: string }>
        disconnect(connectionId: string): Promise<{ success: boolean }>
        list(connectionId: string, remotePath: string): Promise<{ success: boolean; entries?: RemoteFileEntry[]; error?: string }>
        upload(connectionId: string, transferId: string, localPath: string, remotePath: string): Promise<{ success: boolean; error?: string }>
        download(connectionId: string, transferId: string, remotePath: string, localPath: string): Promise<{ success: boolean; error?: string }>
        mkdir(connectionId: string, remotePath: string): Promise<{ success: boolean; error?: string }>
        rename(connectionId: string, oldPath: string, newPath: string): Promise<{ success: boolean; error?: string }>
        delete(connectionId: string, remotePath: string, isDir: boolean): Promise<{ success: boolean; error?: string }>
      }
      local: {
        list(dirPath: string): Promise<{ success: boolean; entries?: LocalFileEntry[]; error?: string }>
        homedir(): Promise<{ success: boolean; path: string }>
        openDialog(type: 'file' | 'folder'): Promise<{ success: boolean; canceled?: boolean; path?: string }>
        saveDialog(defaultName: string): Promise<{ success: boolean; canceled?: boolean; path?: string }>
        mkdir(dirPath: string): Promise<{ success: boolean; error?: string }>
        delete(filePath: string): Promise<{ success: boolean; error?: string }>
        rename(oldPath: string, newPath: string): Promise<{ success: boolean; error?: string }>
        roots(): Promise<{ success: boolean; roots: Array<{ path: string; label: string }> }>
      }
      connections: {
        list(): Promise<{ success: boolean; connections: SavedConnection[] }>
        save(connection: Omit<SavedConnection, 'id' | 'createdAt'>): Promise<{ success: boolean; id: string }>
        update(id: string, updates: Partial<SavedConnection>): Promise<{ success: boolean }>
        delete(id: string): Promise<{ success: boolean }>
        get(id: string): Promise<{ success: boolean; connection?: SavedConnection }>
        touch(id: string): Promise<{ success: boolean }>
      }
      on(channel: string, callback: (...args: any[]) => void): () => void
      off(channel: string, callback: (...args: any[]) => void): void
      platform: 'darwin' | 'linux' | 'win32'
    }
  }
}
