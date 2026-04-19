import { useState, useEffect, useCallback } from 'react'
import type { RemoteFileEntry, LocalFileEntry } from '../../types'
import './FilePane.css'

type FileEntry = RemoteFileEntry | LocalFileEntry

interface FilePaneProps {
  title: string
  side: 'local' | 'remote'
  path: string
  entries: FileEntry[]
  loading: boolean
  error?: string
  selectedFiles: Set<string>
  onNavigate: (path: string) => void
  onSelect: (names: Set<string>) => void
  onRefresh: () => void
  onContextMenu: (e: React.MouseEvent, entry: FileEntry, path: string) => void
  onDoubleClick: (entry: FileEntry, path: string) => void
  showHidden?: boolean
  expanded?: boolean
  onToggleExpand?: () => void
  style?: React.CSSProperties
}

function getFileIcon(entry: FileEntry): string {
  const type = entry.type
  if (type === 'd' || type === 'directory') {
    return '📁'
  }
  if (type === 'l' || type === 'link') {
    return '🔗'
  }

  const name = entry.name.toLowerCase()
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'].some((e) => name.endsWith(e))) return '🖼️'
  if (['.mp4', '.mov', '.avi', '.mkv', '.webm'].some((e) => name.endsWith(e))) return '🎬'
  if (['.mp3', '.wav', '.flac', '.aac', '.ogg'].some((e) => name.endsWith(e))) return '🎵'
  if (['.zip', '.tar', '.gz', '.bz2', '.7z', '.rar'].some((e) => name.endsWith(e))) return '📦'
  if (['.pdf'].some((e) => name.endsWith(e))) return '📄'
  if (['.doc', '.docx'].some((e) => name.endsWith(e))) return '📝'
  if (['.xls', '.xlsx', '.csv'].some((e) => name.endsWith(e))) return '📊'
  if (['.js', '.ts', '.jsx', '.tsx', '.py', '.php', '.rb', '.go', '.rs', '.java', '.cpp', '.c', '.h'].some((e) => name.endsWith(e))) return '💻'
  if (['.json', '.yaml', '.yml', '.xml', '.toml', '.ini', '.env'].some((e) => name.endsWith(e))) return '⚙️'
  if (['.sh', '.bash', '.zsh', '.fish'].some((e) => name.endsWith(e))) return '📜'
  if (['.sql'].some((e) => name.endsWith(e))) return '🗄️'
  if (name.endsWith('.txt') || name.endsWith('.md')) return '📃'

  return '📄'
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatDate(entry: FileEntry): string {
  let ts: number | Date | undefined
  if ('modifyTime' in entry && entry.modifyTime) {
    ts = entry.modifyTime
  } else if ('modifiedAt' in entry && entry.modifiedAt) {
    ts = entry.modifiedAt
  }
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleString('en-US', {
    month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function isDir(entry: FileEntry): boolean {
  return entry.type === 'd' || entry.type === 'directory'
}

function joinPath(base: string, name: string): string {
  if (base === '/') return `/${name}`
  return `${base}/${name}`
}

function parentPath(p: string): string {
  if (p === '/') return '/'
  const parts = p.split('/').filter(Boolean)
  parts.pop()
  return parts.length === 0 ? '/' : '/' + parts.join('/')
}

type SortKey = 'name' | 'size' | 'date' | 'type'
type SortDir = 'asc' | 'desc'

export function FilePane({
  title,
  side,
  path,
  entries,
  loading,
  error,
  selectedFiles,
  onNavigate,
  onSelect,
  onRefresh,
  onContextMenu,
  onDoubleClick,
  showHidden = false,
  expanded = false,
  onToggleExpand,
  style,
}: FilePaneProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [lastClicked, setLastClicked] = useState<string | null>(null)
  const [pathInput, setPathInput] = useState(path)
  const [editingPath, setEditingPath] = useState(false)

  useEffect(() => {
    setPathInput(path)
  }, [path])

  const visibleEntries = entries.filter(
    (e) => showHidden || !e.name.startsWith('.')
  )

  const sorted = [...visibleEntries].sort((a, b) => {
    // Dirs always first
    const aDir = isDir(a); const bDir = isDir(b)
    if (aDir && !bDir) return -1
    if (!aDir && bDir) return 1

    if (sortKey === 'name') {
      const cmp = a.name.localeCompare(b.name)
      return sortDir === 'asc' ? cmp : -cmp
    }
    if (sortKey === 'size') {
      const cmp = a.size - b.size
      return sortDir === 'asc' ? cmp : -cmp
    }
    if (sortKey === 'date') {
      const aTime = 'modifyTime' in a ? (a.modifyTime || 0) : (a.modifiedAt?.getTime() || 0)
      const bTime = 'modifyTime' in b ? (b.modifyTime || 0) : (b.modifiedAt?.getTime() || 0)
      const cmp = aTime - bTime
      return sortDir === 'asc' ? cmp : -cmp
    }
    return 0
  })

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const handleClick = (e: React.MouseEvent, entry: FileEntry) => {
    const name = entry.name
    if (e.metaKey || e.ctrlKey) {
      // Multi-select
      const next = new Set(selectedFiles)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      onSelect(next)
    } else if (e.shiftKey && lastClicked) {
      // Range select
      const names = sorted.map((x) => x.name)
      const start = names.indexOf(lastClicked)
      const end = names.indexOf(name)
      const [lo, hi] = start < end ? [start, end] : [end, start]
      const range = new Set(names.slice(lo, hi + 1))
      onSelect(range)
    } else {
      onSelect(new Set([name]))
    }
    setLastClicked(name)
  }

  const handleDblClick = (entry: FileEntry) => {
    onDoubleClick(entry, joinPath(path, entry.name))
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      <span className="sort-icon">{sortDir === 'asc' ? '↑' : '↓'}</span>
    ) : null

  const pathParts = path.split('/').filter(Boolean)

  return (
    <div className={`file-pane ${side} ${expanded ? 'expanded' : ''}`} style={style}>
      {/* Header */}
      <div className="file-pane-header">
        <span className="file-pane-title">{title}</span>
        <div className="file-pane-header-actions">
          <button
            className="btn btn-ghost btn-icon"
            onClick={onRefresh}
            data-tooltip="Refresh"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {onToggleExpand && (
            <button
              className="btn btn-ghost btn-icon"
              onClick={onToggleExpand}
              data-tooltip={expanded ? 'Restore' : 'Expand'}
              title={expanded ? 'Restore' : `Expand ${title} pane`}
            >
              {expanded ? (
                // Collapse / restore icon
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                // Expand icon
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Path breadcrumb */}
      <div className="file-pane-path">
        <button
          className="path-up-btn"
          onClick={() => onNavigate(parentPath(path))}
          disabled={path === '/'}
          data-tooltip="Go up"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M19 11H7.83l4.88-4.88c.39-.39.39-1.03 0-1.42-.39-.39-1.02-.39-1.41 0l-6.59 6.59c-.39.39-.39 1.02 0 1.41l6.59 6.59c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L7.83 13H19c.55 0 1-.45 1-1s-.45-1-1-1z" fill="currentColor"/>
          </svg>
        </button>

        {editingPath ? (
          <input
            className="path-input"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onBlur={() => { onNavigate(pathInput); setEditingPath(false) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { onNavigate(pathInput); setEditingPath(false) }
              if (e.key === 'Escape') { setPathInput(path); setEditingPath(false) }
            }}
            autoFocus
          />
        ) : (
          <div className="path-breadcrumb" onClick={() => setEditingPath(true)}>
            <span className="path-crumb" onClick={(e) => { e.stopPropagation(); onNavigate('/') }}>
              /
            </span>
            {pathParts.map((part, i) => {
              const toPath = '/' + pathParts.slice(0, i + 1).join('/')
              return (
                <span key={i} className="path-crumb-group">
                  <span className="path-sep">/</span>
                  <span
                    className="path-crumb"
                    onClick={(e) => { e.stopPropagation(); onNavigate(toPath) }}
                  >
                    {part}
                  </span>
                </span>
              )
            })}
            <span className="path-cursor">▊</span>
          </div>
        )}
      </div>

      {/* Column headers */}
      <div className="file-pane-cols">
        <div className="file-col file-col-name" onClick={() => handleSort('name')}>
          Name <SortIcon k="name" />
        </div>
        <div className="file-col file-col-size" onClick={() => handleSort('size')}>
          Size <SortIcon k="size" />
        </div>
        <div className="file-col file-col-date" onClick={() => handleSort('date')}>
          Modified <SortIcon k="date" />
        </div>
        <div className="file-col file-col-perms">Perms</div>
      </div>

      {/* File list */}
      <div className="file-pane-list">
        {loading && (
          <div className="file-pane-loading">
            <div className="spinner"></div>
            <span>Loading...</span>
          </div>
        )}

        {!loading && error && (
          <div className="file-pane-error">
            <span>⚠️ {error}</span>
            <button className="btn btn-sm" onClick={onRefresh}>Retry</button>
          </div>
        )}

        {!loading && !error && sorted.length === 0 && (
          <div className="file-pane-empty">
            <span>📂</span>
            <span>Empty directory</span>
          </div>
        )}

        {!loading && !error && sorted.map((entry) => {
          const selected = selectedFiles.has(entry.name)
          const dir = isDir(entry)
          return (
            <div
              key={entry.name}
              className={`file-row ${selected ? 'selected' : ''} ${dir ? 'is-dir' : ''}`}
              onClick={(e) => handleClick(e, entry)}
              onDoubleClick={() => handleDblClick(entry)}
              onContextMenu={(e) => onContextMenu(e, entry, joinPath(path, entry.name))}
              draggable
            >
              <div className="file-col file-col-name">
                <span className="file-icon">{getFileIcon(entry)}</span>
                <span className="file-name">{entry.name}</span>
              </div>
              <div className="file-col file-col-size text-mono text-sm text-secondary">
                {dir ? '—' : formatSize(entry.size)}
              </div>
              <div className="file-col file-col-date text-sm text-secondary">
                {formatDate(entry)}
              </div>
              <div className="file-col file-col-perms text-mono text-xs text-muted">
                {entry.permissions?.slice(0, 10) || '—'}
              </div>
            </div>
          )
        })}
      </div>

      {/* Status bar */}
      <div className="file-pane-status">
        <span>
          {sorted.length} item{sorted.length !== 1 ? 's' : ''}
          {selectedFiles.size > 0 && ` · ${selectedFiles.size} selected`}
        </span>
      </div>
    </div>
  )
}
