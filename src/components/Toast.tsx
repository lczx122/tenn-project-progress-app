import { useUi } from '../ui'

export function Toast() {
  const { toast } = useUi()
  if (!toast) return null
  return <div className="toast">{toast}</div>
}
