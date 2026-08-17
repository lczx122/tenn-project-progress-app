// Small shared form controls used by the edit sheets.
import { useState, type ReactNode } from 'react'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block', marginTop: 10 }}>
      <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500, marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  )
}

export function TextField(props: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <Field label={props.label}>
      <input
        className="text-input"
        type={props.type ?? 'text'}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </Field>
  )
}

export function NumField(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={props.label}>
      <input
        className="text-input"
        type="number"
        inputMode="decimal"
        min={0}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </Field>
  )
}

export function ChipSelect(props: {
  label: string
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Field label={props.label}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {props.options.map((o) => (
          <button
            key={o}
            type="button"
            className={`chip ${props.value === o ? 'active' : ''}`}
            style={{ padding: '5px 12px' }}
            onClick={() => props.onChange(o)}
          >
            {o}
          </button>
        ))}
      </div>
    </Field>
  )
}

/** Destructive action that needs a second tap to confirm. */
export function ConfirmButton(props: { label: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false)
  return (
    <button
      type="button"
      style={{
        width: '100%', borderRadius: 10, padding: 12, fontWeight: 600, fontSize: 14, textAlign: 'center',
        background: armed ? 'var(--danger)' : '#fff',
        color: armed ? '#fff' : 'var(--danger)',
        border: '1px solid ' + (armed ? 'var(--danger)' : '#EBCFCD'),
      }}
      onClick={() => (armed ? props.onConfirm() : setArmed(true))}
      onBlur={() => setArmed(false)}
    >
      {armed ? 'Tap again to confirm' : props.label}
    </button>
  )
}

export function parseNum(s: string, fallback = 0): number {
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}
