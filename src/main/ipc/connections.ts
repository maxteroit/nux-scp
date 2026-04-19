import { ipcMain } from 'electron'
import Store from 'electron-store'
import { v4 as uuidv4 } from 'crypto'

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

interface StoreSchema {
  connections: SavedConnection[]
}

const store = new Store<StoreSchema>({
  name: 'nux-scp-config',
  defaults: { connections: [] },
})

function generateId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function registerConnectionHandlers(): void {
  // Get all connections
  ipcMain.handle('connections:list', async () => {
    const connections = store.get('connections', [])
    // Never expose passwords in plain — mask them
    return {
      success: true,
      connections: connections.map((c) => ({
        ...c,
        password: c.password ? '••••••••' : undefined,
        passphrase: c.passphrase ? '••••••••' : undefined,
      })),
    }
  })

  // Save new connection
  ipcMain.handle('connections:save', async (_event, { connection }) => {
    const connections = store.get('connections', [])
    const newConn: SavedConnection = {
      ...connection,
      id: generateId(),
      createdAt: new Date().toISOString(),
    }
    connections.push(newConn)
    store.set('connections', connections)
    return { success: true, id: newConn.id }
  })

  // Update existing connection
  ipcMain.handle('connections:update', async (_event, { id, updates }) => {
    const connections = store.get('connections', [])
    const idx = connections.findIndex((c) => c.id === id)
    if (idx === -1) return { success: false, error: 'Connection not found' }
    connections[idx] = { ...connections[idx], ...updates }
    store.set('connections', connections)
    return { success: true }
  })

  // Delete connection
  ipcMain.handle('connections:delete', async (_event, { id }) => {
    const connections = store.get('connections', [])
    store.set(
      'connections',
      connections.filter((c) => c.id !== id)
    )
    return { success: true }
  })

  // Get full connection (with real password for connecting)
  ipcMain.handle('connections:get', async (_event, { id }) => {
    const connections = store.get('connections', [])
    const conn = connections.find((c) => c.id === id)
    if (!conn) return { success: false, error: 'Not found' }
    return { success: true, connection: conn }
  })

  // Update lastConnected timestamp
  ipcMain.handle('connections:touch', async (_event, { id }) => {
    const connections = store.get('connections', [])
    const idx = connections.findIndex((c) => c.id === id)
    if (idx !== -1) {
      connections[idx].lastConnected = new Date().toISOString()
      store.set('connections', connections)
    }
    return { success: true }
  })
}
