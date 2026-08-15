import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Reno Tracker',
        short_name: 'Reno Tracker',
        description: 'Renovation progress tracking — phases, supplies, daily SOP reports and drawings.',
        theme_color: '#0F766E',
        background_color: '#F6F5F3',
        display: 'standalone',
        orientation: 'portrait',
        // relative so the app installs correctly at "/" locally and under
        // a subpath on GitHub Pages (resolved against the manifest URL)
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Bundled + future drawing PDFs are heavy; cache on first open instead of precaching
            urlPattern: /\/drawings\/.*\.pdf$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'drawings',
              expiration: { maxEntries: 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
