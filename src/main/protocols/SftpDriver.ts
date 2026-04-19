import SftpClientLib from 'ssh2-sftp-client'
import * as fs from 'fs'
import * as path from 'path'
import { EventEmitter } from 'events'

export interface SftpConnectConfig {
  host: string
  port: number
  username: string
  authType: 'password' | 'key'
  password?: string
  privateKeyPath?: string
  passphrase?: string
}

export interface RemoteFileEntry {
  name: string
  type: 'd' | '-' | 'l'
  size: number
  modifyTime: number
  permissions: string
  owner: string
  group: string
}

class SftpDriver extends EventEmitter {
  private client: SftpClientLib
  private connected: boolean = false
  private connectionId: string

  constructor(connectionId: string) {
    super()
    this.client = new SftpClientLib()
    this.connectionId = connectionId

    this.client.on('error', (err) => {
      this.connected = false
      this.emit('error', err)
    })

    this.client.on('close', () => {
      this.connected = false
      this.emit('close')
    })
  }

  async connect(config: SftpConnectConfig): Promise<void> {
    const connectOptions: SftpClientLib.ConnectOptions = {
      host: config.host,
      port: config.port,
      username: config.username,
    }

    if (config.authType === 'key' && config.privateKeyPath) {
      connectOptions.privateKey = fs.readFileSync(config.privateKeyPath)
      if (config.passphrase) {
        connectOptions.passphrase = config.passphrase
      }
    } else {
      connectOptions.password = config.password
    }

    await this.client.connect(connectOptions)
    this.connected = true
  }

  async list(remotePath: string): Promise<RemoteFileEntry[]> {
    const items = await this.client.list(remotePath)
    return items.map((item) => ({
      name: item.name,
      type: item.type as 'd' | '-' | 'l',
      size: item.size,
      modifyTime: item.modifyTime,
      permissions: item.longname?.split(' ')[0] || '',
      owner: String(item.owner),
      group: String(item.group),
    }))
  }

  async upload(
    localPath: string,
    remotePath: string,
    onProgress?: (percent: number, transferred: number, total: number) => void
  ): Promise<void> {
    const stat = fs.statSync(localPath)
    const total = stat.size
    let transferred = 0

    await this.client.put(localPath, remotePath, {
      step: (totalTransferred) => {
        transferred = totalTransferred
        const percent = total > 0 ? Math.round((transferred / total) * 100) : 0
        onProgress?.(percent, transferred, total)
      },
    })
  }

  async download(
    remotePath: string,
    localPath: string,
    onProgress?: (percent: number, transferred: number, total: number) => void
  ): Promise<void> {
    const stat = await this.client.stat(remotePath)
    const total = stat.size
    let transferred = 0

    await this.client.get(remotePath, localPath, {
      step: (totalTransferred) => {
        transferred = totalTransferred
        const percent = total > 0 ? Math.round((transferred / total) * 100) : 0
        onProgress?.(percent, transferred, total)
      },
    })
  }

  async mkdir(remotePath: string): Promise<void> {
    await this.client.mkdir(remotePath, true)
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await this.client.rename(oldPath, newPath)
  }

  async delete(remotePath: string): Promise<void> {
    await this.client.delete(remotePath)
  }

  async deleteDir(remotePath: string): Promise<void> {
    await this.client.rmdir(remotePath, true)
  }

  async stat(remotePath: string): Promise<SftpClientLib.FileStats> {
    return this.client.stat(remotePath)
  }

  async chmod(remotePath: string, mode: string): Promise<void> {
    await this.client.chmod(remotePath, mode)
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.end()
      this.connected = false
    }
  }

  isConnected(): boolean {
    return this.connected
  }
}

// Connection pool — one driver per session
const activeConnections = new Map<string, SftpDriver>()

export function getSftpDriver(connectionId: string): SftpDriver | undefined {
  return activeConnections.get(connectionId)
}

export function createSftpDriver(connectionId: string): SftpDriver {
  const driver = new SftpDriver(connectionId)
  activeConnections.set(connectionId, driver)
  return driver
}

export function removeSftpDriver(connectionId: string): void {
  const driver = activeConnections.get(connectionId)
  if (driver) {
    driver.disconnect().catch(console.error)
    activeConnections.delete(connectionId)
  }
}
