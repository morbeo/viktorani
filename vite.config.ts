import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/viktorani/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Viktorani',
        short_name: 'Viktorani',
        description:
          'Bar trivia PWA with WebRTC multiplayer, Reveal.js slides, and buzzer gameplay.',
        theme_color: '#f5f0e8',
        background_color: '#f5f0e8',
        display: 'standalone',
        scope: '/viktorani/',
        start_url: '/viktorani/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Prevent the service worker from intercepting requests to the
        // TypeDoc API docs deployed at /viktorani/api/
        navigateFallbackDenylist: [/^\/viktorani\/api\//],
      },
    }),
  ],
  resolve: {
    alias: { '@': '/src' },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'src/main.tsx',
        'src/pages/**', // page-level integration — tested via e2e
        'src/components/AdminLayout.tsx',
        '**/*.d.ts',
        'vite.config.ts',
        'commitlint.config.js',
      ],
    },
  },
})
