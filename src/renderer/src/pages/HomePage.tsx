import type { SavedConnection } from '../types'
import './HomePage.css'

interface HomePageProps {
  connections: SavedConnection[]
  onConnect: (conn: SavedConnection) => void
  onNewConnection: () => void
  onEditConnection: (conn: SavedConnection) => void
  onDeleteConnection: (id: string) => void
}

const PROTOCOL_ICONS: Record<string, string> = { sftp: '🔐', ftp: '📡', ftps: '🔒' }
const PROTOCOL_COLORS: Record<string, string> = {
  sftp: 'var(--primary)', ftp: 'var(--warning)', ftps: 'var(--success)',
}

function formatRelative(iso?: string): string {
  if (!iso) return 'Never connected'
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  const hr = Math.floor(min / 60)
  const day = Math.floor(hr / 24)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min}m ago`
  if (hr < 24) return `${hr}h ago`
  if (day < 7) return `${day}d ago`
  return new Date(iso).toLocaleDateString()
}

export function HomePage({
  connections,
  onConnect,
  onNewConnection,
  onEditConnection,
  onDeleteConnection,
}: HomePageProps) {
  const recent = [...connections]
    .filter((c) => c.lastConnected)
    .sort((a, b) => new Date(b.lastConnected!).getTime() - new Date(a.lastConnected!).getTime())
    .slice(0, 4)

  return (
    <div className="home-page">
      {/* Hero */}
      <div className="home-hero">
        <div className="home-hero-logo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="rgba(88,166,255,0.1)"/>
            <path d="M8 16h32M8 24h32M8 32h32" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round"/>
            <circle cx="36" cy="16" r="4" fill="var(--success)"/>
            <circle cx="36" cy="24" r="4" fill="var(--warning)"/>
          </svg>
        </div>
        <div>
          <h1 className="home-hero-title">NuxSCP</h1>
          <p className="home-hero-sub">
            Secure file transfer for macOS & Linux
          </p>
        </div>
      </div>

      <div className="home-content">
        {/* Quick connect cards */}
        {recent.length > 0 && (
          <section className="home-section">
            <h2 className="home-section-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Recent
            </h2>
            <div className="home-conn-grid">
              {recent.map((conn) => (
                <div
                  key={conn.id}
                  className="home-conn-card"
                  onDoubleClick={() => onConnect(conn)}
                  title="Double-click to connect"
                >
                  <div
                    className="home-conn-card-accent"
                    style={{ background: PROTOCOL_COLORS[conn.protocol] }}
                  />
                  <div className="home-conn-card-body">
                    <div className="home-conn-card-icon">{PROTOCOL_ICONS[conn.protocol]}</div>
                    <div className="home-conn-card-info">
                      <div className="home-conn-card-name">{conn.name}</div>
                      <div className="home-conn-card-host">
                        {conn.username}@{conn.host}:{conn.port}
                      </div>
                      <div className="home-conn-card-last">
                        {formatRelative(conn.lastConnected)}
                      </div>
                    </div>
                  </div>
                  <div className="home-conn-card-actions">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={(e) => { e.stopPropagation(); onConnect(conn) }}
                    >
                      Connect
                    </button>
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={(e) => { e.stopPropagation(); onEditConnection(conn) }}
                      data-tooltip="Edit"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* All connections table */}
        {connections.length > 0 ? (
          <section className="home-section">
            <h2 className="home-section-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M9 12l2 2 4-4M21 12c0 4.97-4.03 9-9 9S3 16.97 3 12 7.03 3 12 3s9 4.03 9 9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              All Connections
              <span className="badge badge-muted">{connections.length}</span>
            </h2>
            <div className="home-conn-table">
              <div className="home-table-head">
                <div className="htc htc-name">Name</div>
                <div className="htc htc-proto">Protocol</div>
                <div className="htc htc-host">Host</div>
                <div className="htc htc-auth">Auth</div>
                <div className="htc htc-last">Last used</div>
                <div className="htc htc-actions"></div>
              </div>
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className="home-table-row"
                  onDoubleClick={() => onConnect(conn)}
                >
                  <div className="htc htc-name">
                    <span className="home-row-icon">{PROTOCOL_ICONS[conn.protocol]}</span>
                    {conn.name}
                  </div>
                  <div className="htc htc-proto">
                    <span className={`badge badge-primary protocol-${conn.protocol}`}
                      style={{ background: 'transparent', border: `1px solid ${PROTOCOL_COLORS[conn.protocol]}`, color: PROTOCOL_COLORS[conn.protocol] }}>
                      {conn.protocol.toUpperCase()}
                    </span>
                  </div>
                  <div className="htc htc-host text-mono text-sm">
                    {conn.host}:{conn.port}
                  </div>
                  <div className="htc htc-auth text-sm text-secondary">
                    {conn.authType === 'key' ? '🗝 SSH Key' : '🔑 Password'}
                  </div>
                  <div className="htc htc-last text-sm text-muted">
                    {formatRelative(conn.lastConnected)}
                  </div>
                  <div className="htc htc-actions">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={(e) => { e.stopPropagation(); onConnect(conn) }}
                    >
                      Connect
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={(e) => { e.stopPropagation(); onEditConnection(conn) }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`Delete "${conn.name}"?`)) onDeleteConnection(conn.id)
                      }}
                    >
                      Del
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <div className="home-empty">
            <div className="home-empty-icon">🖥️</div>
            <h2 className="home-empty-title">No connections yet</h2>
            <p className="home-empty-desc">
              Add your first connection to get started with SFTP, FTP, or FTPS transfers.
            </p>
            <button className="btn btn-primary" onClick={onNewConnection} id="home-new-conn-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              New Connection
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
