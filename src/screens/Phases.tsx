import { useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, Circle, GripVertical, Pencil, Users } from 'lucide-react'
import { activeProject, actions, useAppState } from '../store'
import { useUi } from '../ui'
import { PhaseEditSheet } from '../components/PhaseEditSheet'
import { DividerEditSheet } from '../components/DividerEditSheet'
import { SubAvatar, SubStack } from '../components/SubAvatars'
import { phaseHasSubcon, phasePct, phaseStatus } from '../selectors'
import { haptic } from '../utils/motion'
import type { Phase, PhaseDivider, SectionStatus } from '../types'

const STATUS_META: Record<SectionStatus, { label: string; bg: string; fg: string; bd: string }> = {
  todo: { label: 'Start', bg: '#fff', fg: 'var(--text-2)', bd: 'var(--card-bd)' },
  started: { label: 'Started', bg: 'var(--warn-bg)', fg: 'var(--warn)', bd: 'var(--warn-bd)' },
  ongoing: { label: 'Ongoing', bg: 'var(--info-bg)', fg: 'var(--info)', bd: '#C7D4EE' },
  done: { label: 'Finished ✓', bg: 'var(--teal-tint)', fg: 'var(--teal)', bd: 'var(--teal-tint-bd)' },
}

interface Group {
  divider: PhaseDivider | null
  items: Phase[]
}

export function Phases() {
  const s = useAppState()
  const ui = useUi()
  const p = activeProject(s)
  const pf = ui.phaseFilter
  // item edit: null = closed, '' = adding, otherwise item id
  const [editing, setEditing] = useState<string | null>(null)
  // divider edit: null = closed, '' = adding, otherwise divider id
  const [editingDivider, setEditingDivider] = useState<string | null>(null)
  // groups whose completed items are expanded
  const [expandedDone, setExpandedDone] = useState<Set<string>>(new Set())

  const matches = (ph: Phase) => pf === 'All' || phaseHasSubcon(ph, pf)

  // group items in list order, splitting where dividers are anchored
  // (several dividers can share an anchor — the earlier ones become empty phases)
  const groups: Group[] = []
  let current: Group = { divider: null, items: [] }
  const seenDividers = new Set<string>()
  for (const ph of p.phases) {
    for (const dv of p.dividers.filter((d) => d.beforeItemId === ph.id)) {
      if (current.divider || current.items.length > 0) groups.push(current)
      current = { divider: dv, items: [] }
      seenDividers.add(dv.id)
    }
    current.items.push(ph)
  }
  if (current.divider || current.items.length > 0) groups.push(current)
  // dividers at the end of the list, or whose anchor no longer exists
  for (const dv of p.dividers) {
    if (!seenDividers.has(dv.id)) groups.push({ divider: dv, items: [] })
  }

  const chips = ['All', ...p.subcons.map((g) => g.name)]

  const advance = (ph: Phase, sectionId: string) => {
    const completed = actions.advanceSection(ph.id, sectionId)
    if (completed) {
      haptic([12, 60, 12])
      ui.showToast(`${ph.name} marked done 🎉`)
    }
  }

  // ---- drag & drop reordering (grip handles; drop indicator; cross-phase moves) ----
  const listRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLDivElement>(null)

  const commitDrop = (id: string, slot: { g: number; i: number }) => {
    const g2 = groups.map((g) => ({ divider: g.divider, ids: g.items.map((it) => it.id) }))
    let sg = -1
    let si = -1
    g2.forEach((g, gi2) => {
      const idx = g.ids.indexOf(id)
      if (idx >= 0) {
        sg = gi2
        si = idx
      }
    })
    if (sg < 0 || !g2[slot.g]) return
    g2[sg].ids.splice(si, 1)
    let ti = slot.i
    if (slot.g === sg && ti > si) ti -= 1
    ti = Math.max(0, Math.min(ti, g2[slot.g].ids.length))
    g2[slot.g].ids.splice(ti, 0, id)
    const orderedIds = g2.flatMap((g) => g.ids)
    // rebuild divider anchors from group membership, in display order
    const anchors: { id: string; beforeItemId: string | null }[] = []
    let nextFirst: string | null = null
    for (let gi2 = g2.length - 1; gi2 >= 0; gi2--) {
      const first: string | null = g2[gi2].ids[0] ?? nextFirst
      if (g2[gi2].divider) anchors.push({ id: g2[gi2].divider!.id, beforeItemId: first })
      nextFirst = first
    }
    anchors.reverse()
    const unchanged =
      orderedIds.every((oid, i2) => p.phases[i2]?.id === oid) &&
      anchors.every((a) => p.dividers.find((d) => d.id === a.id)?.beforeItemId === a.beforeItemId)
    if (!unchanged) {
      actions.applyReorder(orderedIds, anchors)
      haptic(8)
    }
  }

  const onGripDown = (e: React.PointerEvent, id: string) => {
    if (pf !== 'All') return
    const gripEl = e.currentTarget as HTMLElement
    const wrapper = gripEl.closest('[data-drag-item]') as HTMLElement | null
    const list = listRef.current
    const screen = list?.closest('.screen') as HTMLElement | null
    const indicator = indicatorRef.current
    if (!wrapper || !list || !screen || !indicator) return
    e.preventDefault()
    gripEl.setPointerCapture(e.pointerId)
    const startY = e.clientY
    const startScroll = screen.scrollTop
    wrapper.classList.add('drag-float')
    haptic(5)
    let slot: { g: number; i: number } | null = null

    const onMove = (ev: PointerEvent) => {
      const dy = ev.clientY - startY + (screen.scrollTop - startScroll)
      wrapper.style.transform = `translateY(${dy}px) scale(1.02)`
      const sr = screen.getBoundingClientRect()
      if (ev.clientY < sr.top + 90) screen.scrollTop -= (sr.top + 90 - ev.clientY) * 0.25
      else if (ev.clientY > sr.bottom - 120) screen.scrollTop += (ev.clientY - (sr.bottom - 120)) * 0.25
      // candidate slots from live geometry
      const byGroup = new Map<number, { rects: { i: number; top: number; bottom: number }[]; emptyMid?: number }>()
      list.querySelectorAll<HTMLElement>('[data-drag-item]:not(.drag-float), [data-empty-slot]').forEach((el) => {
        const g = Number(el.dataset.group)
        const r = el.getBoundingClientRect()
        const info = byGroup.get(g) ?? { rects: [] }
        if (el.hasAttribute('data-empty-slot')) info.emptyMid = r.top + r.height / 2
        else info.rects.push({ i: Number(el.dataset.index), top: r.top, bottom: r.bottom })
        byGroup.set(g, info)
      })
      const cands: { g: number; i: number; y: number }[] = []
      for (const [g, info] of byGroup) {
        if (info.emptyMid !== undefined && info.rects.length === 0) {
          cands.push({ g, i: 0, y: info.emptyMid })
          continue
        }
        info.rects.sort((a, b) => a.i - b.i)
        for (const r of info.rects) cands.push({ g, i: r.i, y: r.top - 5 })
        const last = info.rects[info.rects.length - 1]
        if (last) cands.push({ g, i: last.i + 1, y: last.bottom + 5 })
      }
      let best: { g: number; i: number; y: number } | null = null
      for (const c of cands) {
        if (!best || Math.abs(ev.clientY - c.y) < Math.abs(ev.clientY - best.y)) best = c
      }
      if (best) {
        slot = { g: best.g, i: best.i }
        const listRect = list.getBoundingClientRect()
        indicator.style.top = `${best.y - listRect.top}px`
        indicator.style.display = 'block'
      }
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      wrapper.classList.remove('drag-float')
      wrapper.style.transform = ''
      indicator.style.display = 'none'
      if (slot) commitDrop(id, slot)
    }
    const onCancel = () => {
      slot = null
      onUp()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }

  const gripFor = (ph: Phase) =>
    pf === 'All' ? (
      <div
        className="drag-grip"
        role="button"
        aria-label={`Reorder ${ph.name}`}
        onPointerDown={(e) => onGripDown(e, ph.id)}
      >
        <GripVertical size={14} />
      </div>
    ) : null

  const editBtn = (ph: Phase) => (
    <button onClick={() => setEditing(ph.id)} aria-label={`Edit ${ph.name}`} style={{ padding: 4, color: 'var(--muted)' }}>
      <Pencil size={14} />
    </button>
  )

  const sectionRow = (ph: Phase, sec: Phase['sections'][number]) => {
    const meta = STATUS_META[sec.status]
    return (
      <div key={sec.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <SubAvatar name={sec.subcon} />
        <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sec.name}</div>
        {sec.status === 'done' ? (
          <div className="badge" style={{ background: meta.bg, color: meta.fg, border: `1px solid ${meta.bd}`, padding: '5px 10px' }}>
            {meta.label}
          </div>
        ) : (
          <button
            aria-label={`Advance ${sec.name}`}
            className="badge pressable"
            style={{ background: meta.bg, color: meta.fg, border: `1px solid ${meta.bd}`, padding: '5px 10px', minWidth: 76, textAlign: 'center' }}
            onClick={() => advance(ph, sec.id)}
          >
            {meta.label} ›
          </button>
        )}
      </div>
    )
  }

  const itemCard = (ph: Phase, grip: React.ReactNode) => {
    const status = phaseStatus(ph)
    if (status === 'done') {
      return (
        <div key={ph.id} className="card" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          {grip}
          {ph.kind === 'task' && <Users size={13} color="var(--muted)" style={{ flexShrink: 0 }} />}
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-2)', textDecoration: 'line-through', flex: 1, minWidth: 0 }}>{ph.name}</div>
          {editBtn(ph)}
          <div style={{ color: 'var(--teal)', fontSize: 15 }}>✓</div>
        </div>
      )
    }
    if (ph.kind === 'task') {
      // pending meeting/task: one line — avatars say who, the circle marks it done
      return (
        <div key={ph.id} className="card" style={{ padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {grip}
            <Users size={13} color="var(--muted)" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 14, fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ph.name}</div>
            <SubStack names={ph.taskSubcons ?? []} />
            {editBtn(ph)}
            <button
              aria-label={`Mark ${ph.name} done`}
              style={{ color: 'var(--teal)', display: 'flex', padding: 2, flexShrink: 0 }}
              onClick={() => {
                actions.setTaskDone(ph.id, true)
                haptic(10)
                ui.showToast(`${ph.name} done ✓`)
              }}
            >
              <Circle size={22} strokeWidth={1.6} />
            </button>
          </div>
          {ph.note && <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6, paddingLeft: 26 }}>{ph.note}</div>}
        </div>
      )
    }
    if (status === 'todo') {
      const subcons = [...new Set(ph.sections.map((sec) => sec.subcon))]
      return (
        <div key={ph.id} className="card" style={{ padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {grip}
            <div style={{ fontSize: 14, fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ph.name}</div>
            <SubStack names={subcons} />
            {editBtn(ph)}
            <button
              style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal)', border: '1px solid var(--teal-tint-bd)', borderRadius: 6, padding: '3px 9px', flexShrink: 0 }}
              onClick={() => {
                actions.startPhase(ph.id)
                ui.showToast(`${ph.name} started`)
              }}
            >
              Start
            </button>
          </div>
        </div>
      )
    }
    return (
      <div key={ph.id} className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          {grip}
          <div style={{ fontSize: 15, fontWeight: 600, flex: 1, minWidth: 0 }}>{ph.name}</div>
          {editBtn(ph)}
          <div className="mono" style={{ fontSize: 13, color: 'var(--teal)' }}>{phasePct(ph)}%</div>
        </div>
        <div className="bar" style={{ height: 5, margin: '9px 0' }}>
          <div style={{ width: `${phasePct(ph)}%` }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ph.sections.map((sec) => sectionRow(ph, sec))}
        </div>
        {ph.note && (
          <div style={{ fontSize: 12, color: ph.blocked ? 'var(--danger)' : 'var(--text-2)', marginTop: 8 }}>
            {ph.note}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div style={{ padding: '18px 20px 10px' }}>
        <div className="screen-title">Phases</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto', paddingBottom: 2 }}>
          {chips.map((n) => (
            <button key={n} className={`chip ${pf === n ? 'active' : ''}`} onClick={() => ui.setPhaseFilter(n)}>
              {n === 'All' ? `All ${p.phases.length}` : n}
            </button>
          ))}
        </div>
      </div>

      <div ref={listRef} style={{ padding: '4px 20px 16px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
        <div ref={indicatorRef} className="drop-indicator" />
        {groups.map((g, gi) => {
          const visible = g.items.filter(matches)
          if (g.divider && pf !== 'All' && visible.length === 0) return null
          const activeItems = visible.filter((ph) => phaseStatus(ph) !== 'done')
          const doneItems = visible.filter((ph) => phaseStatus(ph) === 'done')
          const doneCount = g.items.filter((ph) => phaseStatus(ph) === 'done').length
          const avg = g.items.length
            ? Math.round(g.items.reduce((a, ph) => a + phasePct(ph), 0) / g.items.length)
            : 0
          const groupKey = g.divider?.id ?? 'lead'
          const doneOpen = expandedDone.has(groupKey)
          const toggleDone = () => {
            setExpandedDone((prev) => {
              const next = new Set(prev)
              if (next.has(groupKey)) next.delete(groupKey)
              else next.add(groupKey)
              return next
            })
          }
          return (
            <div key={g.divider?.id ?? `head-${gi}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {g.divider && (
                <div style={{ marginTop: gi === 0 ? 2 : 12 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal)', letterSpacing: '0.06em', textTransform: 'uppercase', flex: 1, minWidth: 0 }}>
                      {g.divider.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
                      {doneCount}/{g.items.length} · <span className="mono">{avg}%</span>
                    </div>
                    <button
                      onClick={() => setEditingDivider(g.divider!.id)}
                      aria-label={`Edit divider ${g.divider.name}`}
                      style={{ padding: 4, color: 'var(--muted)' }}
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                  <div className="bar" style={{ height: 3, marginTop: 7 }}>
                    <div style={{ width: `${avg}%` }} />
                  </div>
                </div>
              )}
              {activeItems.map((ph) => (
                <div key={ph.id} data-drag-item data-group={gi} data-index={g.items.indexOf(ph)}>
                  {itemCard(ph, gripFor(ph))}
                </div>
              ))}
              {doneItems.length > 0 && (
                <>
                  <button className={`card done-cluster ${doneOpen ? 'open' : ''}`} onClick={toggleDone} aria-label={`Toggle completed items`}>
                    <CheckCircle2 size={15} color="var(--teal)" />
                    <span style={{ flex: 1, textAlign: 'left' }}>{doneItems.length} completed</span>
                    <span className="chev"><ChevronDown size={15} /></span>
                  </button>
                  {doneOpen &&
                    doneItems.map((ph) => (
                      <div key={ph.id} data-drag-item data-group={gi} data-index={g.items.indexOf(ph)}>
                        {itemCard(ph, gripFor(ph))}
                      </div>
                    ))}
                </>
              )}
              {g.divider && g.items.length === 0 && (
                <div data-empty-slot data-group={gi} style={{ fontSize: 12, color: 'var(--muted)', padding: '2px 2px 6px' }}>No items in this phase yet</div>
              )}
            </div>
          )
        })}

        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button
            className="pressable"
            style={{ flex: 1, border: '1.5px dashed #C9C4BA', borderRadius: 12, padding: 14, textAlign: 'center', color: 'var(--teal)', fontSize: 13, fontWeight: 600 }}
            onClick={() => setEditing('')}
          >
            + Add item
          </button>
          <button
            className="pressable"
            style={{ flex: 1, border: '1.5px dashed #C9C4BA', borderRadius: 12, padding: 14, textAlign: 'center', color: 'var(--teal)', fontSize: 13, fontWeight: 600 }}
            onClick={() => setEditingDivider('')}
          >
            + Add divider
          </button>
        </div>
      </div>

      {editing !== null && (
        <PhaseEditSheet phaseId={editing || undefined} onClose={() => setEditing(null)} />
      )}
      {editingDivider !== null && (
        <DividerEditSheet dividerId={editingDivider || undefined} onClose={() => setEditingDivider(null)} />
      )}
    </>
  )
}
