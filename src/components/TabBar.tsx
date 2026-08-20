import { Home, Layers, Package, PenLine, CalendarDays } from 'lucide-react'
import { useUi, type Tab } from '../ui'
import { assetUrl } from '../utils/base'

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
      {/* desktop sidebar brand — hidden on phones via CSS */}
      <div className="side-brand">
        <img src={assetUrl('icons/icon-192.png')} alt="" width={30} height={30} />
        <div>
          <div className="side-brand-name">Reno Tracker</div>
          <div className="side-brand-sub">Site progress</div>
        </div>
      </div>
      {TABS.map(({ key, label, Icon }) => (
        <button key={key} className={activeKey === key ? 'active' : ''} onClick={() => ui.goTab(key)}>
          <Icon className="tab-icon" size={18} strokeWidth={activeKey === key ? 2.2 : 1.8} />
          <div className="tab-label">{label}</div>
        </button>
      ))}
    </nav>
  )
}
