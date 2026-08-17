// UI-only state: active tab, pushed views, filters, toast, project switcher.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

export type Tab = 'home' | 'phases' | 'supplies' | 'report' | 'history'

export type Pushed =
  | { type: 'supplyDetail'; id: string }
  | { type: 'drawings' }
  | { type: 'pdfViewer'; drawingId: string }
  | { type: 'reportView'; reportId: string }

export type StackItem = Pushed & { key: number }

export type SupplyFilter = 'all' | 'low' | 'transit'

interface UiState {
  tab: Tab
  stack: StackItem[]
  phaseFilter: string
  supplyFilter: SupplyFilter
  query: string
  switcherOpen: boolean
  toast: string
  goTab: (t: Tab) => void
  push: (v: Pushed) => void
  pop: () => void
  setPhaseFilter: (f: string) => void
  setSupplyFilter: (f: SupplyFilter) => void
  setQuery: (q: string) => void
  setSwitcherOpen: (open: boolean) => void
  showToast: (msg: string) => void
  goSupplies: (filter: SupplyFilter) => void
  goPhases: (subcon: string) => void
}

const UiContext = createContext<UiState | null>(null)

let nextStackKey = 1

export function UiProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<Tab>('home')
  const [stack, setStack] = useState<StackItem[]>([])
  const [phaseFilter, setPhaseFilter] = useState('All')
  const [supplyFilter, setSupplyFilter] = useState<SupplyFilter>('all')
  const [query, setQuery] = useState('')
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }, [])

  const goTab = useCallback((t: Tab) => {
    setTab(t)
    setStack([])
  }, [])

  const push = useCallback((v: Pushed) => setStack((s) => [...s, { ...v, key: nextStackKey++ }]), [])
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), [])

  const goSupplies = useCallback((filter: SupplyFilter) => {
    setSupplyFilter(filter)
    setTab('supplies')
    setStack([])
  }, [])

  const goPhases = useCallback((subcon: string) => {
    setPhaseFilter(subcon)
    setTab('phases')
    setStack([])
  }, [])

  const value = useMemo<UiState>(
    () => ({
      tab, stack, phaseFilter, supplyFilter, query, switcherOpen, toast,
      goTab, push, pop, setPhaseFilter, setSupplyFilter, setQuery, setSwitcherOpen, showToast, goSupplies, goPhases,
    }),
    [tab, stack, phaseFilter, supplyFilter, query, switcherOpen, toast, goTab, push, pop, showToast, goSupplies, goPhases],
  )

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>
}

export function useUi(): UiState {
  const ctx = useContext(UiContext)
  if (!ctx) throw new Error('useUi outside UiProvider')
  return ctx
}
