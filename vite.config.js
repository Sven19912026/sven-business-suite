import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',

  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',

      manifest: {
        name: 'Sven Business Suite',
        short_name: 'Business Suite',
        description:
          'Business Suite für Aufgaben, Verträge, Verhandlungen, Lieferanten und Mitarbeiter',

        start_url: './',
        scope: './',

        display: 'standalone',
        orientation: 'portrait-primary',

        background_color: '#f5f7fb',
        theme_color: '#173c9f',

        icons: [
          {
            src: 'icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },

      workbox: {
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})