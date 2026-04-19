import * as ftp from 'basic-ftp'
import { EventEmitter } from 'events'

export interface FtpConnectConfig {
  host: string
  port: number
  username: string
  password: string
  secure: boolean // true = FTPS
}

export interface FtpFileEntry {
  name: string
  type: 'file' | 'directory' | 'link' | 'unknown'
  size: number
  modifiedAt?: Date
  permissions?: string
}

class FtpDriver extends EventEmitter {
  private client: ftp.Client
  private connected: boolean = false

  constructor() {
    super()
    this.client = new ftp.Client()
    this.client.ftp.verbose = false
  }

  async connect(config: FtpConnectConfig): Promise<void> {
    await this.client.access({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      secure: config.secure,
      secureOptions: config.secure
        ? { rejectUnauthorized: false }
        : undefined,
    })
    this.connected = true
  }

  async list(remotePath: string): Promise<FtpFileEntry[]> {
    const items = await this.client.list(remotePath)
    return items.map((item) => ({
      name: item.name,
      type:
        item.type === ftp.FileType.Directory
          ? 'directory'
          : item.type === ftp.FileType.SymbolicLink
          ? 'link'
          : item.type === ftp.FileType.File
          ? 'file'
          : 'unknown',
      size: item.size ?? 0,
      modifiedAt: item.modifiedAt,
      permissions: item.permissions
        ? `${item.permissions.user}${item.permissions.group}${item.permissions.world}`
        : undefined,
    }))
  }

  async upload(
    localPath: string,
    remotePath: string,
    onProgress?: (percent: number, transferred: number, total: number) => void
  ): Promise<void> {
    this.client.trackProgress((info) => {
      if (info.type === 'upload') {
        const total = info.bytesOverall
        const transferred = info.bytesOverall
        const percent = total > 0 ? Math.round((transferred / total) * 100) : 0
        onProgress?.(percent, transferred, total)
      }
    })
    await this.client.uploadFrom(localPath, remotePath)
    this.client.trackProgress()
  }

  async download(
    remotePath: string,
    localPath: string,
    onProgress?: (percent: number, transferred: number, total: number) => void
  ): Promise<void> {
    this.client.trackProgress((info) => {
      if (info.type === 'download') {
        const transferred = info.bytesOverall
        onProgress?.(0, transferred, 0)
      }
    })
    await this.client.downloadTo(localPath, remotePath)
    this.client.trackProgress()
  }

  async mkdir(remotePath: string): Promise<void> {
    await this.client.ensureDir(remotePath)
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await this.client.rename(oldPath, newPath)
  }

  async delete(remotePath: string): Promise<void> {
    await this.client.remove(remotePath)
  }

  async deleteDir(remotePath: string): Promise<void> {
    await this.client.removeDir(remotePath)
  }

  async disconnect(): Promise<void> {
    this.client.close()
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected
  }
}

// Connection pool
const activeConnections = new Map<string, FtpDriver>()

export function getFtpDriver(connectionId: string): FtpDriver | undefined {
  return activeConnections.get(connectionId)
}

export function createFtpDriver(connectionId: string): FtpDriver {
  const driver = new FtpDriver()
  activeConnections.set(connectionId, driver)
  return driver
}

export function removeFtpDriver(connectionId: string): void {
  const driver = activeConnections.get(connectionId)
  if (driver) {
    driver.disconnect().catch(console.error)
    activeConnections.delete(connectionId)
  }
}
