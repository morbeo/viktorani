import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// GitHub Pages can't send headers, so the CSP ships as a <meta> tag. It is
// injected only into production builds: the dev server relies on inline
// scripts (React Refresh preamble), inline <style> tags and ws: for HMR.
// Note: frame-ancestors is ignored in meta CSP, so it is omitted.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' https://0.peerjs.com wss://0.peerjs.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const cspMeta = (): Plugin => ({
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
      injectTo: 'head-prepend',
    },
  ],
})

// Build metadata shown in the hidden Settings debug panel (src/buildInfo.ts).
// deploy.yml builds on every deploy, so builtAt is also the last deploy time.
function commitSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'unknown'
  }
}

const buildInfo = {
  version: (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }).version,
  commit: commitSha(),
  builtAt: new Date().toISOString(),
  runId: process.env.GITHUB_RUN_ID ?? null,
  runNumber: process.env.GITHUB_RUN_NUMBER ?? null,
  ref: process.env.GITHUB_REF_NAME ?? null,
}

export default defineConfig({
  base: '/viktorani/',
  define: {
    __BUILD_INFO__: JSON.stringify(buildInfo),
  },
  plugins: [
    react(),
    tailwindcss(),
    cspMeta(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Viktorani',
        short_name: 'Viktorani',
        description:
          'Bar trivia PWA with WebRTC multiplayer and buzzer gameplay.',
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
    exclude: [
      'node_modules/',
      'archives',
      'deploy/',
      'dist/',
      'src/main.tsx',
      'src/pages/**',
      'src/components/AdminLayout.tsx',
      '**/*.d.ts',
      'vite.config.ts',
      'commitlint.config.js',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      // Files excluded from coverage entirely (untestable boilerplate,
      // entry points, or page-level files covered by integration tests).
      exclude: [
        'src/main.tsx',
        'src/pages/**',
        'src/components/AdminLayout.tsx',
        '**/*.d.ts',
        'vite.config.ts',
        'commitlint.config.js',
      ],
      // Global thresholds — CI fails if the whole suite drops below these.
      // Per-file thresholds are intentionally omitted: files with known-low
      // coverage (useBuzzer.ts, db/index.ts) are annotated with
      // /* c8 ignore */ at the untestable callsites and tracked in
      // docs/coverage-notes.md until their epics are complete.
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 70,
        statements: 75,
      },
    },
  },
})
