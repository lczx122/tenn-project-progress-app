import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './styles.css'
import App from './App'
import { UiProvider } from './ui'
import { initStore } from './store'
import { startSync } from './sync/engine'

registerSW({ immediate: true })

initStore().then(() => {
  void startSync()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <UiProvider>
        <App />
      </UiProvider>
    </StrictMode>,
  )
})
