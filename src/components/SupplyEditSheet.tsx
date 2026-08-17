import { useState } from 'react'
import { activeProject, actions, useAppState } from '../store'
import { useUi } from '../ui'
import { ChipSelect, ConfirmButton, NumField, TextField, parseNum } from './form'

/** Add (no supplyId) or edit (supplyId) a supply item. */
export function SupplyEditSheet({ supplyId, onClose }: { supplyId?: string; onClose: () => void }) {
  const s = useAppState()
  const ui = useUi()
  const p = activeProject(s)
  const existing = supplyId ? p.supplies.find((su) => su.id === supplyId) : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [unit, setUnit] = useState(existing?.unit ?? 'pcs')
  const [stock, setStock] = useState(String(existing?.stock ?? 0))
  const [max, setMax] = useState(String(existing?.max ?? 0))
  const [min, setMin] = useState(String(existing?.min ?? 0))
  const [reorderQty, setReorderQty] = useState(String(existing?.reorderQty ?? 0))
  const [cost, setCost] = useState(String(existing?.cost ?? 0))
  const [loc, setLoc] = useState(existing?.loc ?? '')
  const [usedBy, setUsedBy] = useState(existing?.usedBy ?? p.subcons[0]?.name ?? '')
  const [supName, setSupName] = useState(existing?.supplier.name ?? '')
  const [supPhone, setSupPhone] = useState(existing?.supplier.phone ?? '')
  const [supNote, setSupNote] = useState(existing?.supplier.note ?? '')

  const save = () => {
    const stockN = parseNum(stock)
    const maxN = Math.max(parseNum(max), stockN, 1)
    const fields = {
      name: name.trim(),
      unit: unit.trim() || 'pcs',
      stock: stockN,
      max: maxN,
      min: parseNum(min),
      reorderQty: parseNum(reorderQty),
      cost: parseNum(cost),
      loc: loc.trim() || 'On site',
      usedBy,
      supplier: { name: supName.trim() || '—', phone: supPhone.trim(), note: supNote.trim() },
    }
    if (existing) {
      actions.updateSupply(existing.id, fields)
      ui.showToast('Supply updated')
    } else {
      actions.addSupply(fields)
      ui.showToast(`${fields.name} added`)
    }
    onClose()
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{existing ? 'Edit supply' : 'Add supply'}</div>

        <TextField label="Material name" value={name} onChange={setName} placeholder="e.g. Plywood 18mm" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <TextField label="Unit" value={unit} onChange={setUnit} placeholder="pcs / m / L" />
          <NumField label="Stock on site" value={stock} onChange={setStock} />
          <NumField label="Full stock (max)" value={max} onChange={setMax} />
          <NumField label="Minimum level" value={min} onChange={setMin} />
          <NumField label="Reorder quantity" value={reorderQty} onChange={setReorderQty} />
          <NumField label="Unit cost (RM)" value={cost} onChange={setCost} />
        </div>
        {existing && parseNum(stock) !== existing.stock && (
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }}>
            Stock change will be logged as a manual adjustment ({parseNum(stock) - existing.stock > 0 ? '+' : ''}
            {parseNum(stock) - existing.stock} {unit})
          </div>
        )}
        <TextField label="Location" value={loc} onChange={setLoc} placeholder="e.g. On site · Store room A" />
        {p.subcons.length > 0 && (
          <ChipSelect label="Used by" options={p.subcons.map((g) => g.name)} value={usedBy} onChange={setUsedBy} />
        )}
        <TextField label="Supplier" value={supName} onChange={setSupName} placeholder="Supplier name" />
        <TextField label="Supplier phone" value={supPhone} onChange={setSupPhone} placeholder="+60…" type="tel" />
        <TextField label="Supplier note" value={supNote} onChange={setSupNote} placeholder="e.g. Lead time 2–3 days" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          <button className="primary-btn" disabled={!name.trim()} onClick={save}>
            {existing ? 'Save changes' : 'Add supply'}
          </button>
          {existing && (
            <ConfirmButton
              label="Delete supply"
              onConfirm={() => {
                actions.deleteSupply(existing.id)
                ui.showToast(`${existing.name} deleted`)
                onClose()
                ui.pop()
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
