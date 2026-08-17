// Sync status section shown inside the project settings sheet.
// No accounts: every device opening the app shares the same synced data.
import { Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { supabase } from '../sync/client'
import { syncNow, useSyncStatus } from '../sync/engine'

const STATUS_TEXT: Record<string, string> = {
  synced: 'Synced — all devices share this data',
  syncing: 'Syncing…',
  offline: 'Offline — will sync when back online',
  error: 'Sync error',
}

export function SyncSection() {
  const { status, error } = useSyncStatus()

  if (!supabase) {
    return (
      <>
        <div className="section-label" style={{ marginTop: 18 }}>SYNC</div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }}>
          Cross-device sync is not set up for this build — data stays on this device only.
          See the README for the Supabase setup steps.
        </div>
      </>
    )
  }

  return (
    <>
      <div className="section-label" style={{ marginTop: 18 }}>SYNC</div>
      <div className="sheet-row" style={{ cursor: 'default' }}>
        {status === 'offline' || status === 'error' ? (
          <CloudOff size={18} color={status === 'error' ? 'var(--danger)' : 'var(--muted)'} />
        ) : (
          <Cloud size={18} color="var(--teal)" />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Shared sync</div>
          <div style={{ fontSize: 12, color: status === 'error' ? 'var(--danger)' : 'var(--text-2)' }}>
            {STATUS_TEXT[status] ?? status}
            {status === 'error' && error ? ` — ${error}` : ''}
          </div>
        </div>
        <button onClick={() => syncNow()} aria-label="Sync now" style={{ padding: 6, color: 'var(--teal)' }}>
          <RefreshCw size={16} className={status === 'syncing' ? 'spin' : ''} />
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
        No sign-in needed — open the app on any device and it shows the same live data.
        Changes made offline upload automatically when connectivity returns.
      </div>
    </>
  )
}
