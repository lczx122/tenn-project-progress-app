import { useRef, useState } from 'react'
import { useUi, type StackItem, type Tab } from './ui'
import { TabBar } from './components/TabBar'
import { Toast } from './components/Toast'
import { ProjectSwitcher } from './components/ProjectSwitcher'
import { WhatsAppFab } from './components/WhatsAppFab'
import { PushedLayer } from './components/PushedLayer'
import { Home } from './screens/Home'
import { Phases } from './screens/Phases'
import { Supplies } from './screens/Supplies'
import { SupplyDetail } from './screens/SupplyDetail'
import { Report } from './screens/Report'
import { History } from './screens/History'
import { Drawings } from './screens/Drawings'
import { PdfViewer } from './screens/PdfViewer'
import { ReportView } from './screens/ReportView'

function tabScreen(tab: Tab) {
  switch (tab) {
    case 'home': return <Home />
    case 'phases': return <Phases />
    case 'supplies': return <Supplies />
    case 'report': return <Report />
    case 'history': return <History />
  }
}

function pushedScreen(item: StackItem) {
  switch (item.type) {
    case 'supplyDetail': return <SupplyDetail id={item.id} />
    case 'drawings': return <Drawings />
    case 'reportView': return <ReportView reportId={item.reportId} />
    case 'pdfViewer': return null // rendered as a full overlay below
  }
}

export default function App() {
  const ui = useUi()
  const baseRef = useRef<HTMLDivElement>(null)
  const layerRefs = useRef(new Map<number, HTMLDivElement | null>())
  // Layers linger here (exiting) after being popped so they can animate out.
  const [exitingItems, setExitingItems] = useState<StackItem[]>([])
  const prevStack = useRef<StackItem[]>(ui.stack)
  const prevTab = useRef(ui.tab)

  // Detect a pop (same tab, top removed) → keep the removed layer for its exit animation.
  if (prevStack.current !== ui.stack) {
    const old = prevStack.current
    const sameTab = prevTab.current === ui.tab
    if (sameTab && old.length === ui.stack.length + 1 && old[old.length - 1].type !== 'pdfViewer') {
      const removed = old[old.length - 1]
      if (!exitingItems.some((x) => x.key === removed.key)) {
        setExitingItems((xs) => [...xs, removed])
      }
    } else if (!sameTab) {
      if (exitingItems.length) setExitingItems([])
    }
    prevStack.current = ui.stack
    prevTab.current = ui.tab
  }

  const pdfTop = ui.stack.length > 0 && ui.stack[ui.stack.length - 1].type === 'pdfViewer'
    ? (ui.stack[ui.stack.length - 1] as StackItem & { type: 'pdfViewer' })
    : null
  const layers: { item: StackItem; exiting: boolean }[] = [
    ...ui.stack.filter((v) => v.type !== 'pdfViewer').map((item) => ({ item, exiting: false })),
    ...exitingItems.map((item) => ({ item, exiting: true })),
  ]

  const belowOf = (idx: number): HTMLElement | null => {
    if (idx <= 0) return baseRef.current
    return layerRefs.current.get(layers[idx - 1].item.key) ?? baseRef.current
  }

  return (
    <div className="app-frame">
      <div className="stack-area">
        <div className="stack-base" ref={baseRef}>
          <div className="screen">{tabScreen(ui.tab)}</div>
        </div>
        {layers.map(({ item, exiting }, i) => (
          <div key={item.key} ref={(el) => layerRefs.current.set(item.key, el)} className="stack-holder">
            <PushedLayer
              exiting={exiting}
              getBelow={() => belowOf(i)}
              onPop={ui.pop}
              onExited={() => {
                layerRefs.current.delete(item.key)
                setExitingItems((xs) => xs.filter((x) => x.key !== item.key))
              }}
            >
              <div className="screen">{pushedScreen(item)}</div>
            </PushedLayer>
          </div>
        ))}
      </div>
      <WhatsAppFab />
      <TabBar />
      {pdfTop && <PdfViewer drawingId={pdfTop.drawingId} />}
      <ProjectSwitcher />
      {/* sheets portal here so they stack above the tab bar and transformed layers */}
      <div id="overlay-root" />
      <Toast />
    </div>
  )
}
