import { useState, useEffect, useCallback, useRef } from 'react'
import type { ActiveSession, TransferItem, LocalFileEntry, RemoteFileEntry } from '../types'
import { FilePane } from '../components/FilePane/FilePane'
import './SessionPage.css'

function joinPath(base: string, name: string): string {
  if (base === '/') return `/${name}`
  return `${base}/${name}`
}

interface SessionPageProps {
  session: ActiveSession
  onTransferStart: (t: TransferItem) => void
  onDisconnect: () => void
}

interface ContextMenuState {
  x: number
  y: number
  side: 'local' | 'remote'
  entry: LocalFileEntry | RemoteFileEntry
  entryPath: string
}

function genTransferId(): string {
  return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`
}

export function SessionPage({ session, onTransferStart, onDisconnect }: SessionPageProps) {
  // Local state
  const [localPath, setLocalPath] = useState('')
  const [localEntries, setLocalEntries] = useState<LocalFileEntry[]>([])
  const [localLoading, setLocalLoading] = useState(false)
  const [localError, setLocalError] = useState<string>()
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set())

  // Remote state
  const [remotePath, setRemotePath] = useState(session.remotePath || '/')
  const [remoteEntries, setRemoteEntries] = useState<RemoteFileEntry[]>([])
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [remoteError, setRemoteError] = useState<string>()
  const [remoteSelected, setRemoteSelected] = useState<Set<string>>(new Set())

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  // Show hidden files
  const [showHidden, setShowHidden] = useState(false)

  // Expand pane: null = both visible, 'local' = local expanded, 'remote' = remote expanded
  const [expandedPane, setExpandedPane] = useState<'local' | 'remote' | null>(null)

  // Resizable panes
  const [splitRatio, setSplitRatio] = useState(50) // percentage
  const containerRef = useRef<HTMLDivElement>(null)

  // Rename state
  const [newFolderDialog, setNewFolderDialog] = useState<{ side: 'local' | 'remote' } | null>(null)
  const [newFolderName, setNewFolderName] = useState('')

  const sessionId = session.sessionId
  const protocol = session.protocol

  // Init: load home dir
  useEffect(() => {
    window.electron.local.homedir().then((res) => {
      if (res.success) loadLocal(res.path)
    })
    loadRemote(remotePath)
  }, [])

  // IPC helpers
  const isSftp = protocol === 'sftp'

  const remoteApi = isSftp ? window.electron.sftp : window.electron.ftp

  const loadLocal = useCallback(async (p: string) => {
    setLocalLoading(true)
    setLocalError(undefined)
    setLocalSelected(new Set())
    const res = await window.electron.local.list(p)
    if (res.success) {
      setLocalPath(p)
      setLocalEntries(res.entries || [])
    } else {
      setLocalError(res.error)
    }
    setLocalLoading(false)
  }, [])

  const loadRemote = useCallback(async (p: string) => {
    setRemoteLoading(true)
    setRemoteError(undefined)
    setRemoteSelected(new Set())
    const res = await remoteApi.list(sessionId, p)
    if (res.success) {
      setRemotePath(p)
      setRemoteEntries((res.entries || []) as RemoteFileEntry[])
    } else {
      setRemoteError(res.error)
    }
    setRemoteLoading(false)
  }, [sessionId, remoteApi])

  // Uploading
  const handleUpload = async () => {
    if (localSelected.size === 0) return
    for (const name of localSelected) {
      const lPath = `${localPath}/${name}`.replace('//', '/')
      const rPath = `${remotePath}/${name}`.replace('//', '/')
      const transferId = genTransferId()
      onTransferStart({
        id: transferId,
        type: 'upload',
        fileName: name,
        localPath: lPath,
        remotePath: rPath,
        percent: 0,
        transferred: 0,
        total: 0,
        status: 'pending',
        startedAt: new Date(),
      })
      await remoteApi.upload(sessionId, transferId, lPath, rPath)
    }
    loadRemote(remotePath)
  }

  // Downloading
  const handleDownload = async () => {
    if (remoteSelected.size === 0) return
    for (const name of remoteSelected) {
      const rPath = `${remotePath}/${name}`.replace('//', '/')
      const lPath = `${localPath}/${name}`.replace('//', '/')
      const transferId = genTransferId()
      onTransferStart({
        id: transferId,
        type: 'download',
        fileName: name,
        localPath: lPath,
        remotePath: rPath,
        percent: 0,
        transferred: 0,
        total: 0,
        status: 'pending',
        startedAt: new Date(),
      })
      await remoteApi.download(sessionId, transferId, rPath, lPath)
    }
    loadLocal(localPath)
  }

  // Double-click navigate or open
  const handleLocalDoubleClick = (entry: LocalFileEntry) => {
    if (entry.type === 'directory') {
      loadLocal(`${localPath}/${entry.name}`.replace('//', '/'))
    }
  }

  const handleRemoteDoubleClick = (entry: RemoteFileEntry) => {
    if (entry.type === 'd' || entry.type === 'directory') {
      loadRemote(`${remotePath}/${entry.name}`.replace('//', '/'))
    }
  }

  // Context menu
  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  const handleContextMenu = (
    e: React.MouseEvent,
    entry: LocalFileEntry | RemoteFileEntry,
    entryPath: string,
    side: 'local' | 'remote'
  ) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, side, entry, entryPath })
  }

  const handleDelete = async () => {
    if (!contextMenu) return
    const { side, entry, entryPath } = contextMenu
    const isDirectory = entry.type === 'd' || entry.type === 'directory'
    if (!confirm(`Delete "${entry.name}"?`)) { closeContextMenu(); return }
    if (side === 'local') {
      await window.electron.local.delete(entryPath)
      loadLocal(localPath)
    } else {
      await remoteApi.delete(sessionId, entryPath, isDirectory)
      loadRemote(remotePath)
    }
    closeContextMenu()
  }

  const handleNewFolder = async () => {
    if (!newFolderDialog || !newFolderName.trim()) return
    const { side } = newFolderDialog
    const name = newFolderName.trim()
    if (side === 'local') {
      const p = `${localPath}/${name}`.replace('//', '/')
      await window.electron.local.mkdir(p)
      loadLocal(localPath)
    } else {
      const p = `${remotePath}/${name}`.replace('//', '/')
      await remoteApi.mkdir(sessionId, p)
      loadRemote(remotePath)
    }
    setNewFolderDialog(null)
    setNewFolderName('')
  }

  // Divider resize
  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    
    // Create an overlay to prevent iframes or UI elements from stealing mouse events
    const overlay = document.createElement('div')
    overlay.style.position = 'fixed'
    overlay.style.inset = '0'
    overlay.style.cursor = 'col-resize'
    overlay.style.zIndex = '9999'
    document.body.appendChild(overlay)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      let newRatio = ((moveEvent.clientX - rect.left) / rect.width) * 100
      if (newRatio < 20) newRatio = 20
      if (newRatio > 80) newRatio = 80
      setSplitRatio(newRatio)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.removeChild(overlay)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const canUpload = localSelected.size > 0
  const canDownload = remoteSelected.size > 0

  return (
    <div className="session-page" onClick={closeContextMenu}>
      {/* Toolbar */}
      <div className="session-toolbar">
        <div className="toolbar-group">
          <button
            className="btn btn-primary btn-sm"
            onClick={handleUpload}
            disabled={!canUpload}
            id="btn-upload"
            title="Upload selected local files to remote"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Upload →
          </button>

          <button
            className="btn btn-sm"
            onClick={handleDownload}
            disabled={!canDownload}
            id="btn-download"
            title="Download selected remote files to local"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            ← Download
          </button>
        </div>

        <div className="toolbar-group">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setNewFolderDialog({ side: 'local' })}
            title="New folder on local"
          >
            📁 New Folder (Local)
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setNewFolderDialog({ side: 'remote' })}
            title="New folder on remote"
          >
            📁 New Folder (Remote)
          </button>
        </div>

        <div className="toolbar-group">
          <label className="toolbar-toggle" title="Show hidden files">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
            />
            Show hidden
          </label>
        </div>

        <div className="toolbar-sep" style={{ flex: 1 }} />

        <div className="toolbar-group">
          <span className="badge badge-success">
            <span className="status-dot connected" style={{ width: 5, height: 5 }}></span>
            {session.connection.host}
          </span>
          <button
            className="btn btn-danger btn-sm"
            onClick={onDisconnect}
            id="btn-disconnect"
            title="Disconnect from server"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M18.36 6.64a9 9 0 11-12.73 0M12 2v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Disconnect
          </button>
        </div>
      </div>

      {/* Dual pane */}
      <div className="session-panes" ref={containerRef}>
        {/* LOCAL pane — hidden when remote is expanded */}
        {expandedPane !== 'remote' && (
          <FilePane
            title="Local"
            side="local"
            path={localPath}
            entries={localEntries}
            loading={localLoading}
            error={localError}
            selectedFiles={localSelected}
            onNavigate={loadLocal}
            onSelect={setLocalSelected}
            onRefresh={() => loadLocal(localPath)}
            onDoubleClick={(entry) => handleLocalDoubleClick(entry as LocalFileEntry)}
            onContextMenu={(e, entry, entryPath) =>
              handleContextMenu(e, entry as LocalFileEntry, entryPath, 'local')
            }
            showHidden={showHidden}
            expanded={expandedPane === 'local'}
            style={{ flex: expandedPane === 'local' ? 1 : splitRatio, minWidth: 0 }}
            onToggleExpand={() =>
              setExpandedPane((cur) => (cur === 'local' ? null : 'local'))
            }
          />
        )}

        {/* Divider — hidden when any pane is expanded */}
        {expandedPane === null && (
          <div 
            className="pane-divider" 
            onMouseDown={handleDividerMouseDown}
          />
        )}

        {/* REMOTE pane — hidden when local is expanded */}
        {expandedPane !== 'local' && (
          <FilePane
            title="Remote"
            side="remote"
            path={remotePath}
            entries={remoteEntries}
            loading={remoteLoading}
            error={remoteError}
            selectedFiles={remoteSelected}
            onNavigate={loadRemote}
            onSelect={setRemoteSelected}
            onRefresh={() => loadRemote(remotePath)}
            onDoubleClick={(entry) => handleRemoteDoubleClick(entry as RemoteFileEntry)}
            onContextMenu={(e, entry, entryPath) =>
              handleContextMenu(e, entry as RemoteFileEntry, entryPath, 'remote')
            }
            showHidden={showHidden}
            expanded={expandedPane === 'remote'}
            style={{ flex: expandedPane === 'remote' ? 1 : 100 - splitRatio, minWidth: 0 }}
            onToggleExpand={() =>
              setExpandedPane((cur) => (cur === 'remote' ? null : 'remote'))
            }
          />
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.side === 'local' ? (
            <>
              <div
                className="context-menu-item"
                onClick={() => { handleUpload(); closeContextMenu() }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M17 8l-5-5-5 5M12 3v12M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Upload to Remote
              </div>
              <div className="context-menu-divider" />
              <div
                className="context-menu-item"
                onClick={() => { setNewFolderDialog({ side: 'local' }); closeContextMenu() }}
              >
                📁 New Folder
              </div>
              <div className="context-menu-divider" />
              <div className="context-menu-item danger" onClick={handleDelete}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2"/>
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Delete
              </div>
            </>
          ) : (
            <>
              <div
                className="context-menu-item"
                onClick={() => { handleDownload(); closeContextMenu() }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M7 10l5 5 5-5M12 15V3M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Download to Local
              </div>
              <div className="context-menu-divider" />
              <div
                className="context-menu-item"
                onClick={() => { setNewFolderDialog({ side: 'remote' }); closeContextMenu() }}
              >
                📁 New Folder
              </div>
              <div className="context-menu-divider" />
              <div className="context-menu-item danger" onClick={handleDelete}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2"/>
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Delete
              </div>
            </>
          )}
        </div>
      )}

      {/* New folder dialog */}
      {newFolderDialog && (
        <div className="modal-backdrop" onClick={() => setNewFolderDialog(null)}>
          <div className="modal" style={{ minWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">New Folder ({newFolderDialog.side})</span>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Folder Name</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="my-folder"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleNewFolder()}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setNewFolderDialog(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleNewFolder}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
