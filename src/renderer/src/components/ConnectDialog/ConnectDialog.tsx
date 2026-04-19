import { useState, useEffect } from 'react'
import type { SavedConnection } from '../../types'
import './ConnectDialog.css'

interface ConnectDialogProps {
  initialValues?: SavedConnection | null
  onSave: (conn: Omit<SavedConnection, 'id' | 'createdAt'>) => void
  onClose: () => void
}

const DEFAULT_PORTS: Record<string, number> = {
  sftp: 22,
  ftp: 21,
  ftps: 21,
}

export function ConnectDialog({ initialValues, onSave, onClose }: ConnectDialogProps) {
  const [protocol, setProtocol] = useState<'sftp' | 'ftp' | 'ftps'>(
    initialValues?.protocol || 'sftp'
  )
  const [name, setName] = useState(initialValues?.name || '')
  const [host, setHost] = useState(initialValues?.host || '')
  const [port, setPort] = useState(initialValues?.port ?? DEFAULT_PORTS['sftp'])
  const [username, setUsername] = useState(initialValues?.username || '')
  const [authType, setAuthType] = useState<'password' | 'key'>(
    initialValues?.authType || 'password'
  )
  const [password, setPassword] = useState('')
  const [privateKeyPath, setPrivateKeyPath] = useState(initialValues?.privateKeyPath || '')
  const [passphrase, setPassphrase] = useState('')
  const [remotePath, setRemotePath] = useState(initialValues?.remotePath || '/')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!initialValues) {
      setPort(DEFAULT_PORTS[protocol])
    }
  }, [protocol])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Name is required'
    if (!host.trim()) e.host = 'Host is required'
    if (!port || port < 1 || port > 65535) e.port = 'Invalid port'
    if (!username.trim()) e.username = 'Username is required'
    if (authType === 'password' && !password && !initialValues?.password)
      e.password = 'Password is required'
    if (authType === 'key' && !privateKeyPath)
      e.privateKeyPath = 'Private key file is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    onSave({
      name: name.trim(),
      protocol,
      host: host.trim(),
      port,
      username: username.trim(),
      authType,
      password: password || undefined,
      privateKeyPath: privateKeyPath || undefined,
      passphrase: passphrase || undefined,
      remotePath: remotePath || '/',
    })
  }

  const handleBrowseKey = async () => {
    const result = await window.electron.local.openDialog('file')
    if (result.success && result.path) {
      setPrivateKeyPath(result.path)
    }
  }

  const autoName = () => {
    if (!name && host) {
      setName(`${username || 'user'}@${host}`)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal connect-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="connect-modal-title">
            <div className="connect-modal-icon">
              {initialValues ? '✏️' : '🔌'}
            </div>
            <div>
              <div className="modal-title">
                {initialValues ? 'Edit Connection' : 'New Connection'}
              </div>
              <div className="text-secondary text-xs">
                {initialValues ? `Editing: ${initialValues.name}` : 'Configure a new remote connection'}
              </div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Protocol selector */}
        <div className="connect-protocol-bar">
          {(['sftp', 'ftp', 'ftps'] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={`connect-protocol-btn ${protocol === p ? 'active' : ''} protocol-${p}`}
              onClick={() => setProtocol(p)}
            >
              <span className="connect-protocol-icon">
                {p === 'sftp' ? '🔐' : p === 'ftps' ? '🔒' : '📡'}
              </span>
              {p.toUpperCase()}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <div className="form-section-title">Basic Settings</div>
            <div className="connect-tab-content">
                <div className="form-group">
                  <label className="form-label">Connection Name</label>
                  <input
                    className={`form-input ${errors.name ? 'error' : ''}`}
                    type="text"
                    placeholder='e.g. "Production Server"'
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    id="conn-name"
                  />
                  {errors.name && <span className="form-error">{errors.name}</span>}
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Host / IP Address</label>
                    <input
                      className={`form-input ${errors.host ? 'error' : ''}`}
                      type="text"
                      placeholder="192.168.1.1 or server.example.com"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      onBlur={autoName}
                      id="conn-host"
                    />
                    {errors.host && <span className="form-error">{errors.host}</span>}
                  </div>
                  <div className="form-group" style={{ width: '90px' }}>
                    <label className="form-label">Port</label>
                    <input
                      className={`form-input ${errors.port ? 'error' : ''}`}
                      type="number"
                      value={port}
                      onChange={(e) => setPort(Number(e.target.value))}
                      min="1"
                      max="65535"
                      id="conn-port"
                    />
                    {errors.port && <span className="form-error">{errors.port}</span>}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    className={`form-input ${errors.username ? 'error' : ''}`}
                    type="text"
                    placeholder="root, ubuntu, admin..."
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onBlur={autoName}
                    id="conn-username"
                  />
                  {errors.username && <span className="form-error">{errors.username}</span>}
                </div>
              </div>

            <div className="form-section-title">Authentication</div>
            <div className="connect-tab-content">
                {/* Auth type toggle */}
                <div className="form-group">
                  <label className="form-label">Authentication Method</label>
                  <div className="auth-type-toggle">
                    <button
                      type="button"
                      className={`auth-type-btn ${authType === 'password' ? 'active' : ''}`}
                      onClick={() => setAuthType('password')}
                    >
                      🔑 Password
                    </button>
                    {protocol === 'sftp' && (
                      <button
                        type="button"
                        className={`auth-type-btn ${authType === 'key' ? 'active' : ''}`}
                        onClick={() => setAuthType('key')}
                      >
                        📄 SSH Key File
                      </button>
                    )}
                  </div>
                </div>

                {authType === 'password' ? (
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      className={`form-input ${errors.password ? 'error' : ''}`}
                      type="password"
                      placeholder={initialValues?.password ? '(unchanged)' : 'Enter password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      id="conn-password"
                    />
                    {errors.password && <span className="form-error">{errors.password}</span>}
                  </div>
                ) : (
                  <>
                    <div className="form-group">
                      <label className="form-label">Private Key File</label>
                      <div className="form-input-group">
                        <input
                          className={`form-input ${errors.privateKeyPath ? 'error' : ''}`}
                          type="text"
                          placeholder="~/.ssh/id_rsa  or  /path/to/key.pem"
                          value={privateKeyPath}
                          onChange={(e) => setPrivateKeyPath(e.target.value)}
                          id="conn-keypath"
                        />
                        <button type="button" className="btn" onClick={handleBrowseKey}>
                          Browse
                        </button>
                      </div>
                      {errors.privateKeyPath && (
                        <span className="form-error">{errors.privateKeyPath}</span>
                      )}
                      <span className="form-hint">
                        Supports OpenSSH keys (id_rsa, id_ed25519), .pem files
                      </span>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Key Passphrase (optional)</label>
                      <input
                        className="form-input"
                        type="password"
                        placeholder="Leave empty if key has no passphrase"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        id="conn-passphrase"
                      />
                    </div>

                    <div className="key-hint">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="9" stroke="var(--primary)" strokeWidth="2"/>
                        <path d="M12 8v4M12 16h.01" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      <span>
                        Your SSH key is read from the local file system and never stored in the app database.
                      </span>
                    </div>
                  </>
                )}
              </div>

            <div className="form-section-title">Advanced Settings</div>
            <div className="connect-tab-content">
                <div className="form-group">
                  <label className="form-label">Initial Remote Path</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="/"
                    value={remotePath}
                    onChange={(e) => setRemotePath(e.target.value)}
                    id="conn-remote-path"
                  />
                  <span className="form-hint">
                    Directory to open on the remote side when connecting
                  </span>
                </div>
              </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" id="btn-save-connection">
              {initialValues ? 'Save Changes' : 'Save Connection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
