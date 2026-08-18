// Compact subcontractor identity: deterministic color + monogram avatars,
// shown as an overlapping stack instead of rows of name tags.

const PALETTE = ['#0F766E', '#4A5FA5', '#8A5FA0', '#B45309', '#5F7A4A', '#A04A5F', '#5B6B70', '#8B7A4A']

export function subColor(name: string): string {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0
  return PALETTE[h % PALETTE.length]
}

/** "Classic Home" → CH · "Fanmuli 木工" → F木 · "Tenn" → Te */
export function monogram(name: string): string {
  const words = name.trim().split(/\s+/)
  const first = (s: string) => [...s][0] ?? ''
  const mono = words.length === 1 ? [...words[0]].slice(0, 2).join('') : first(words[0]) + first(words[words.length - 1])
  return mono.replace(/[a-z]/g, (c, i) => (i === 0 ? c.toUpperCase() : c))
}

export function SubAvatar({ name, size = 20 }: { name: string; size?: number }) {
  const fg = subColor(name)
  return (
    <div
      className="sub-avatar"
      title={name}
      aria-label={name}
      style={{ width: size, height: size, background: `${fg}22`, color: fg, fontSize: size * 0.42 }}
    >
      {monogram(name)}
    </div>
  )
}

export function SubStack({ names, max = 4, size = 20 }: { names: string[]; max?: number; size?: number }) {
  const shown = names.slice(0, max)
  const extra = names.length - shown.length
  return (
    <div className="sub-stack" style={{ flexShrink: 0 }}>
      {shown.map((n) => (
        <SubAvatar key={n} name={n} size={size} />
      ))}
      {extra > 0 && (
        <div className="sub-avatar" style={{ width: size, height: size, background: 'var(--fill)', color: 'var(--text-2)', fontSize: size * 0.42 }}>
          +{extra}
        </div>
      )}
    </div>
  )
}
