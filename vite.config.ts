import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const BASE = '/daywise/'

// Served from https://lachlan-odea.github.io/daywise/
export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      // The installed app is scoped to launch into the app (/app), not the marketing site.
      manifest: {
        name: 'daywise',
        short_name: 'daywise',
        description: 'Turn everyday teaching into professional evidence — automatically.',
        id: `${BASE}app`,
        start_url: `${BASE}app`,
        scope: BASE,
        display: 'standalone',
        theme_color: '#132145',
        background_color: '#ffffff',
        categories: ['education', 'productivity'],
        icons: [
          { src: `${BASE}pwa-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: `${BASE}pwa-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: `${BASE}pwa-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${BASE}index.html`,
        navigateFallbackDenylist: [/404\.html$/],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          motion: ['framer-motion'],
        },
      },
    },
  },
})
