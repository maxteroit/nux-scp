import { useState, useEffect, useCallback } from 'react'
import { Sidebar } from './components/Sidebar/Sidebar'
import { HomePage } from './pages/HomePage'
import { SessionPage } from './pages/SessionPage'
import { ConnectDialog } from './components/ConnectDialog/ConnectDialog'
import { TransferQueue } from './components/TransferQueue/TransferQueue'
import type { SavedConnection, ActiveSession, TransferItem } from './types'
import './styles/app.css'

type AppView = 'home' | 'session'

export default function App() {
  const [view, setView] = useState<AppView>('home')
  const [savedConnections, setSavedConnections] = useState<SavedConnection[]>([])
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [showConnectDialog, setShowConnectDialog] = useState(false)
  const [editingConnection, setEditingConnection] = useState<SavedConnection | null>(null)
  const [transfers, setTransfers] = useState<TransferItem[]>([])
  const [transferQueueOpen, setTransferQueueOpen] = useState(false)

  // Load saved connections on mount
  useEffect(() => {
    loadConnections()
  }, [])

  // Listen to transfer progress events
  useEffect(() => {
    const unsubProgress = window.electron.on('transfer:progress', (data) => {
      setTransfers((prev) =>
        prev.map((t) =>
          t.id === data.transferId
            ? { ...t, percent: data.percent, transferred: data.transferred, total: data.total, status: 'transferring' }
            : t
        )
      )
    })
    const unsubComplete = window.electron.on('transfer:complete', (data) => {
      setTransfers((prev) =>
        prev.map((t) =>
          t.id === data.transferId ? { ...t, percent: 100, status: 'done' } : t
        )
      )
    })
    const unsubError = window.electron.on('transfer:error', (data) => {
      setTransfers((prev) =>
        prev.map((t) =>
          t.id === data.transferId ? { ...t, status: 'error', error: data.error } : t
        )
      )
    })

    return () => {
      unsubProgress()
      unsubComplete()
      unsubError()
    }
  }, [])

  const loadConnections = async () => {
    const result = await window.electron.connections.list()
    if (result.success) {
      setSavedConnections(result.connections)
    }
  }

  const handleConnect = async (connection: SavedConnection) => {
    // Get full connection with real password
    const result = await window.electron.connections.get(connection.id)
    if (!result.success || !result.connection) return

    const fullConn = result.connection
    const sessionId = `session_${Date.now()}`

    // Connect based on protocol
    let connectResult
    if (fullConn.protocol === 'sftp') {
      connectResult = await window.electron.sftp.connect(sessionId, {
        host: fullConn.host,
        port: fullConn.port,
        username: fullConn.username,
        authType: fullConn.authType,
        password: fullConn.password,
        privateKeyPath: fullConn.privateKeyPath,
        passphrase: fullConn.passphrase,
      })
    } else {
      connectResult = await window.electron.ftp.connect(sessionId, {
        host: fullConn.host,
        port: fullConn.port,
        username: fullConn.username,
        password: fullConn.password,
        secure: fullConn.protocol === 'ftps',
      })
    }

    if (connectResult.success) {
      setActiveSession({
        sessionId,
        connectionId: connection.id,
        connection: fullConn,
        remotePath: fullConn.remotePath || '/',
        connected: true,
        protocol: fullConn.protocol,
      })
      setView('session')
      window.electron.connections.touch(connection.id)
      loadConnections()
    } else {
      alert(`Connection failed: ${connectResult.error}`)
    }
  }

  const handleDisconnect = async () => {
    if (!activeSession) return
    if (activeSession.protocol === 'sftp') {
      await window.electron.sftp.disconnect(activeSession.sessionId)
    } else {
      await window.electron.ftp.disconnect(activeSession.sessionId)
    }
    setActiveSession(null)
    setView('home')
  }

  const handleSaveConnection = async (conn: Omit<SavedConnection, 'id' | 'createdAt'>) => {
    if (editingConnection) {
      await window.electron.connections.update(editingConnection.id, conn)
    } else {
      await window.electron.connections.save(conn)
    }
    setShowConnectDialog(false)
    setEditingConnection(null)
    loadConnections()
  }

  const handleDeleteConnection = async (id: string) => {
    await window.electron.connections.delete(id)
    loadConnections()
  }

  const handleQuickConnect = (conn: Omit<SavedConnection, 'id' | 'createdAt'>) => {
    // Connect without saving
    const sessionId = `session_${Date.now()}`
    const fakeConn: SavedConnection = {
      ...conn,
      id: sessionId,
      createdAt: new Date().toISOString(),
    }
    // TODO: direct connect flow
    handleConnect(fakeConn)
  }

  const addTransfer = useCallback((transfer: TransferItem) => {
    setTransfers((prev) => [transfer, ...prev])
    setTransferQueueOpen(true)
  }, [])

  const clearCompletedTransfers = () => {
    setTransfers((prev) => prev.filter((t) => t.status !== 'done' && t.status !== 'error'))
  }

  const activeTransfers = transfers.filter(
    (t) => t.status === 'pending' || t.status === 'transferring'
  ).length

  return (
    <div className="app-layout">
      {/* macOS drag region */}
      <div className="app-titlebar">
        <div className="app-titlebar-logo app-titlebar-nodrag">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M3 7h18M3 12h18M3 17h18" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="19" cy="7" r="2" fill="var(--success)"/>
          </svg>
          <span className="app-titlebar-name">NuxSCP</span>
        </div>

        {activeSession && (
          <div className="app-titlebar-session app-titlebar-nodrag">
            <span className="badge badge-success">
              <span className="status-dot connected"></span>
              {activeSession.connection.host}
            </span>
            <span className="text-muted text-xs" style={{ opacity: 0.5 }}>
              {activeSession.protocol.toUpperCase()}
            </span>
          </div>
        )}

        <div className="app-titlebar-actions app-titlebar-nodrag" style={{ marginLeft: 'auto' }}>
          {activeTransfers > 0 && (
            <button
              className="btn btn-sm"
              onClick={() => setTransferQueueOpen((v) => !v)}
            >
              <span className="spinner spinner-sm"></span>
              {activeTransfers} transferring
            </button>
          )}
          <button
            className="btn btn-primary btn-sm"
            id="btn-new-connection"
            onClick={() => {
              setEditingConnection(null)
              setShowConnectDialog(true)
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            New Connection
          </button>
        </div>
      </div>

      <div className="app-body">
        <Sidebar
          connections={savedConnections}
          activeSession={activeSession}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onNewConnection={() => {
            setEditingConnection(null)
            setShowConnectDialog(true)
          }}
          onEditConnection={(conn) => {
            setEditingConnection(conn)
            setShowConnectDialog(true)
          }}
          onDeleteConnection={handleDeleteConnection}
          onOpenTransferQueue={() => setTransferQueueOpen(true)}
          transferCount={activeTransfers}
        />

        <div className="app-main">
          {view === 'home' ? (
            <HomePage
              connections={savedConnections}
              onConnect={handleConnect}
              onNewConnection={() => setShowConnectDialog(true)}
              onEditConnection={(conn) => {
                setEditingConnection(conn)
                setShowConnectDialog(true)
              }}
              onDeleteConnection={handleDeleteConnection}
            />
          ) : (
            activeSession && (
              <SessionPage
                session={activeSession}
                onTransferStart={addTransfer}
                onDisconnect={handleDisconnect}
              />
            )
          )}
        </div>
      </div>

      {/* Transfer queue panel */}
      <TransferQueue
        transfers={transfers}
        open={transferQueueOpen}
        onClose={() => setTransferQueueOpen(false)}
        onClearCompleted={clearCompletedTransfers}
      />

      {/* Connect dialog */}
      {showConnectDialog && (
        <ConnectDialog
          initialValues={editingConnection}
          onSave={handleSaveConnection}
          onClose={() => {
            setShowConnectDialog(false)
            setEditingConnection(null)
          }}
        />
      )}
    </div>
  )
}
