import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './styles.css'
import App from './App'
import { UiProvider } from './ui'
import { initStore } from './store'

registerSW({ immediate: true })

initStore().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <UiProvider>
        <App />
      </UiProvider>
    </StrictMode>,
  )
})
