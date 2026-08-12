import { Home, Layers, Package, PenLine, CalendarDays } from 'lucide-react'
import { useUi, type Tab } from '../ui'

const TABS: { key: Tab; label: string; Icon: typeof Home }[] = [
  { key: 'home', label: 'Home', Icon: Home },
  { key: 'phases', label: 'Phases', Icon: Layers },
  { key: 'supplies', label: 'Supplies', Icon: Package },
  { key: 'report', label: 'Report', Icon: PenLine },
  { key: 'history', label: 'History', Icon: CalendarDays },
]

export function TabBar() {
  const ui = useUi()
  const activeKey = ui.stack.length === 0 ? ui.tab : null
  return (
    <nav className="tabbar">
      {TABS.map(({ key, label, Icon }) => (
        <button key={key} className={activeKey === key ? 'active' : ''} onClick={() => ui.goTab(key)}>
          <Icon size={18} strokeWidth={activeKey === key ? 2.2 : 1.8} style={{ display: 'block', margin: '0 auto' }} />
          <div className="tab-label">{label}</div>
        </button>
      ))}
    </nav>
  )
}
