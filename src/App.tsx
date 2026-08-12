import { useUi } from './ui'
import { TabBar } from './components/TabBar'
import { Toast } from './components/Toast'
import { ProjectSwitcher } from './components/ProjectSwitcher'
import { Home } from './screens/Home'
import { Phases } from './screens/Phases'
import { Supplies } from './screens/Supplies'
import { SupplyDetail } from './screens/SupplyDetail'
import { Report } from './screens/Report'
import { History } from './screens/History'
import { Drawings } from './screens/Drawings'
import { PdfViewer } from './screens/PdfViewer'
import { ReportView } from './screens/ReportView'

export default function App() {
  const ui = useUi()
  const top = ui.stack[ui.stack.length - 1]

  let content
  if (top?.type === 'supplyDetail') content = <SupplyDetail id={top.id} />
  else if (top?.type === 'drawings') content = <Drawings />
  else if (top?.type === 'reportView') content = <ReportView reportId={top.reportId} />
  else if (top?.type === 'pdfViewer') content = null // rendered as overlay below
  else {
    switch (ui.tab) {
      case 'home': content = <Home />; break
      case 'phases': content = <Phases />; break
      case 'supplies': content = <Supplies />; break
      case 'report': content = <Report />; break
      case 'history': content = <History />; break
    }
  }

  // keep the underlying screen when the PDF viewer is on top
  const under = top?.type === 'pdfViewer' ? ui.stack[ui.stack.length - 2] : undefined
  if (top?.type === 'pdfViewer') {
    if (under?.type === 'drawings') content = <Drawings />
    else if (under?.type === 'supplyDetail') content = <SupplyDetail id={under.id} />
    else content = <Home />
  }

  return (
    <div className="app-frame">
      <div className="screen" key={top ? `${top.type}` : ui.tab}>{content}</div>
      <TabBar />
      {top?.type === 'pdfViewer' && <PdfViewer drawingId={top.drawingId} />}
      <ProjectSwitcher />
      <Toast />
    </div>
  )
}
