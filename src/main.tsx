import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'
import { UiProvider } from './ui'
import { initStore } from './store'
import { startSync } from './sync/engine'
import { initAppUpdates } from './utils/appUpdate'

initAppUpdates()

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
