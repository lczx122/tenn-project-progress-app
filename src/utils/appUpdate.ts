// Service-worker update handling.
//
// The SW auto-updates (skipWaiting + clientsClaim), but the running page keeps
// using the assets it booted with — which is why "close and reopen" sometimes
// still shows an old version. Two remedies:
//   1. When a new SW takes control, reload once automatically → the app
//      self-refreshes to the new version.
//   2. refreshApp() for the in-app button: actively re-check for a new SW,
//      then hard-reload regardless.
import { registerSW } from 'virtual:pwa-register'

declare const __BUILD_DATE__: string

let registration: ServiceWorkerRegistration | null = null

export function initAppUpdates(): void {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, r) {
      registration = r ?? null
      // re-check for a new deploy periodically while the app stays open
      if (r) setInterval(() => r.update().catch(() => {}), 30 * 60 * 1000)
    },
  })

  if ('serviceWorker' in navigator) {
    // reload once when a new SW takes over — never on the very first install
    let hadController = !!navigator.serviceWorker.controller
    let reloaded = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloaded) {
        reloaded = true
        location.reload()
      }
      hadController = true
    })
  }
}

/** Manual refresh: pull the newest service worker if there is one, then reload. */
export async function refreshApp(): Promise<void> {
  try {
    await registration?.update()
  } catch {
    // offline or SW unavailable — plain reload still helps
  }
  location.reload()
}

/** Build timestamp baked in at compile time — shown so users can verify freshness. */
export const BUILD_VERSION: string = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : 'dev'
