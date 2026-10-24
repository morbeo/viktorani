import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'

// The MCP authoring server (ADR 0021): one self-contained Node file, apart from the PWA build.
const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }

export default defineConfig({
  resolve: { alias: { '@': '/src' } },
  define: { __VIKTORANI_VERSION__: JSON.stringify(version) },
  publicDir: false,
  ssr: { noExternal: true, target: 'node' },
  build: {
    ssr: 'src/mcp/cli.ts',
    outDir: 'dist-mcp',
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: 'viktorani-mcp.js',
        inlineDynamicImports: true,
        banner: '#!/usr/bin/env node',
      },
    },
  },
})
