import { useState } from 'react'
import type { SavedConnection, ActiveSession } from '../../types'
import './Sidebar.css'

interface SidebarProps {
  connections: SavedConnection[]
  activeSession: ActiveSession | null
  onConnect: (conn: SavedConnection) => void
  onDisconnect: () => void
  onNewConnection: () => void
  onEditConnection: (conn: SavedConnection) => void
  onDeleteConnection: (id: string) => void
  onOpenTransferQueue: () => void
  transferCount: number
}

const PROTOCOL_ICONS: Record<string, string> = {
  sftp:  '🔐',
  ftp:   '📡',
  ftps:  '🔒',
}

const PROTOCOL_LABELS: Record<string, string> = {
  sftp:  'SFTP',
  ftp:   'FTP',
  ftps:  'FTPS',
}

function formatDate(iso?: string): string {
  if (!iso) return 'Never'
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString()
}

export function Sidebar({
  connections,
  activeSession,
  onConnect,
  onDisconnect,
  onNewConnection,
  onEditConnection,
  onDeleteConnection,
  onOpenTransferQueue,
  transferCount,
}: SidebarProps) {
  const [search, setSearch] = useState('')
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; conn: SavedConnection
  } | null>(null)

  const filtered = connections.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.host.toLowerCase().includes(search.toLowerCase())
  )

  const handleContextMenu = (e: React.MouseEvent, conn: SavedConnection) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, conn })
  }

  const closeContext = () => setContextMenu(null)

  return (
    <aside className="sidebar" onClick={closeContext}>
      <div className="sidebar-header">
        <span className="sidebar-title">Connections</span>
        <button
          className="btn btn-ghost btn-icon"
          onClick={onNewConnection}
          id="sidebar-new-connection"
          data-tooltip="New Connection"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div className="sidebar-search">
        <svg className="sidebar-search-icon" width="12" height="12" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="var(--text-muted)" strokeWidth="2"/>
          <path d="M16.5 16.5L21 21" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <input
          className="sidebar-search-input"
          type="text"
          placeholder="Filter..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="sidebar-connections">
        {filtered.length === 0 && (
          <div className="sidebar-empty">
            {search ? 'No matches' : 'No saved connections'}
          </div>
        )}

        {filtered.map((conn) => {
          const isActive = activeSession?.connectionId === conn.id
          return (
            <div
              key={conn.id}
              className={`sidebar-conn-item ${isActive ? 'active' : ''}`}
              onDoubleClick={() => onConnect(conn)}
              onContextMenu={(e) => handleContextMenu(e, conn)}
            >
              <div className="conn-icon">
                {PROTOCOL_ICONS[conn.protocol] || '🖥️'}
              </div>
              <div className="conn-info">
                <div className="conn-name">{conn.name}</div>
                <div className="conn-host">
                  <span className={`protocol-${conn.protocol}`}>
                    {PROTOCOL_LABELS[conn.protocol]}
                  </span>
                  &nbsp;·&nbsp;
                  <span className="text-muted">{conn.host}</span>
                </div>
              </div>
              {isActive && (
                <div className="conn-active-dot">
                  <span className="status-dot connected"></span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom section */}
      <div className="sidebar-footer">
        <button
          className="sidebar-footer-btn"
          onClick={onOpenTransferQueue}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Transfers
          {transferCount > 0 && (
            <span className="badge badge-primary" style={{ marginLeft: 'auto', padding: '1px 6px' }}>
              {transferCount}
            </span>
          )}
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Show Disconnect if this connection is currently active */}
          {activeSession?.connectionId === contextMenu.conn.id ? (
            <>
              <div
                className="context-menu-item danger"
                onClick={() => { onDisconnect(); closeContext() }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M18.36 6.64a9 9 0 11-12.73 0M12 2v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Disconnect
              </div>
              <div className="context-menu-divider" />
            </>
          ) : (
            <div
              className="context-menu-item"
              onClick={() => { onConnect(contextMenu.conn); closeContext() }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M15 3h6v6M10 14L21 3M21 9v12a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Connect
            </div>
          )}
          <div
            className="context-menu-item"
            onClick={() => { onEditConnection(contextMenu.conn); closeContext() }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Edit
          </div>
          <div className="context-menu-divider" />
          <div
            className="context-menu-item danger"
            onClick={() => {
              if (confirm(`Delete "${contextMenu.conn.name}"?`)) {
                onDeleteConnection(contextMenu.conn.id)
              }
              closeContext()
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2"/>
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Delete
          </div>
        </div>
      )}
    </aside>
  )
}
