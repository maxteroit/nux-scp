import type { TransferItem } from '../../types'
import './TransferQueue.css'

interface TransferQueueProps {
  transfers: TransferItem[]
  open: boolean
  onClose: () => void
  onClearCompleted: () => void
}

function formatSize(bytes: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function TransferQueue({ transfers, open, onClose, onClearCompleted }: TransferQueueProps) {
  const active = transfers.filter((t) => t.status === 'transferring' || t.status === 'pending')
  const done = transfers.filter((t) => t.status === 'done')
  const errored = transfers.filter((t) => t.status === 'error')

  return (
    <div className={`transfer-queue ${open ? 'open' : ''}`}>
      <div className="transfer-queue-header">
        <div className="tq-header-left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
              stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="tq-title">Transfer Queue</span>
          {active.length > 0 && (
            <span className="badge badge-primary">{active.length}</span>
          )}
        </div>
        <div className="tq-header-right">
          {(done.length > 0 || errored.length > 0) && (
            <button className="btn btn-ghost btn-sm" onClick={onClearCompleted}>
              Clear done
            </button>
          )}
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="transfer-list">
        {transfers.length === 0 && (
          <div className="tq-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" opacity="0.2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>No transfers yet</span>
          </div>
        )}

        {transfers.map((t) => (
          <div key={t.id} className={`transfer-item ${t.status}`}>
            <div className="transfer-item-icon">
              {t.type === 'upload' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>

            <div className="transfer-item-body">
              <div className="transfer-item-header">
                <span className="transfer-filename">{t.fileName}</span>
                <span className={`transfer-status-text ${t.status}`}>
                  {t.status === 'transferring' && `${t.percent}%`}
                  {t.status === 'pending' && 'Queued'}
                  {t.status === 'done' && '✓ Done'}
                  {t.status === 'error' && '✗ Error'}
                </span>
              </div>

              {(t.status === 'transferring' || t.status === 'pending') && (
                <div className="progress-bar">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${t.percent}%` }}
                  />
                </div>
              )}

              {t.status === 'error' && t.error && (
                <div className="transfer-error-msg">{t.error}</div>
              )}

              <div className="transfer-meta">
                <span>{t.type === 'upload' ? '↑ Upload' : '↓ Download'}</span>
                {t.total > 0 && (
                  <span>{formatSize(t.transferred)} / {formatSize(t.total)}</span>
                )}
                <span className="text-muted">{t.remotePath}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
