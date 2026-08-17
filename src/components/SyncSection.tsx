// Sync & account section shown inside the project settings sheet.
import { useState } from 'react'
import { Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { supabase } from '../sync/client'
import { signIn, signOut, signUp, syncNow, useSyncStatus } from '../sync/engine'
import { useUi } from '../ui'
import { TextField } from './form'

const STATUS_TEXT: Record<string, string> = {
  synced: 'Synced',
  syncing: 'Syncing…',
  offline: 'Offline — will sync when back online',
  error: 'Sync error',
  'signed-out': 'Not signed in',
}

export function SyncSection() {
  const ui = useUi()
  const { status, error, email } = useSyncStatus()
  const [emailInput, setEmailInput] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

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

  const doAuth = async (mode: 'in' | 'up') => {
    setBusy(true)
    setNotice('')
    try {
      if (mode === 'in') {
        const err = await signIn(emailInput.trim(), password)
        if (err) setNotice(err)
        else {
          ui.showToast('Signed in — syncing')
          setPassword('')
        }
      } else {
        const r = await signUp(emailInput.trim(), password)
        if (r.error) setNotice(r.error)
        else if (r.needsConfirm) setNotice('Account created — check your email to confirm, then sign in.')
        else {
          ui.showToast('Account created — syncing')
          setPassword('')
        }
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="section-label" style={{ marginTop: 18 }}>SYNC</div>

      {email ? (
        <>
          <div className="sheet-row" style={{ cursor: 'default' }}>
            {status === 'offline' || status === 'error' ? (
              <CloudOff size={18} color={status === 'error' ? 'var(--danger)' : 'var(--muted)'} />
            ) : (
              <Cloud size={18} color="var(--teal)" />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</div>
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
            Sign in with the same account on your other devices and everything stays in sync.
          </div>
          <button
            className="chip"
            style={{ marginTop: 8 }}
            onClick={async () => {
              await signOut()
              ui.showToast('Signed out — data stays on this device')
            }}
          >
            Sign out
          </button>
        </>
      ) : (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }}>
            Sign in to back up this device and sync live with your other devices.
          </div>
          <TextField label="Email" value={emailInput} onChange={setEmailInput} type="email" placeholder="you@example.com" />
          <TextField label="Password" value={password} onChange={setPassword} type="password" placeholder="min. 6 characters" />
          {notice && <div style={{ fontSize: 12, color: 'var(--warn)', marginTop: 8 }}>{notice}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="primary-btn" disabled={busy || !emailInput.trim() || password.length < 6} onClick={() => doAuth('in')}>
              Sign in
            </button>
            <button
              className="chip"
              style={{ whiteSpace: 'nowrap' }}
              disabled={busy || !emailInput.trim() || password.length < 6}
              onClick={() => doAuth('up')}
            >
              Create account
            </button>
          </div>
        </>
      )}
    </>
  )
}
