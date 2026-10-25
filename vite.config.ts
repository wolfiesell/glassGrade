import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(rootDir, 'index.html'),
        verify: path.resolve(rootDir, 'verify.html'),
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3000',
      '/health': 'http://127.0.0.1:3000',
      '/ledger': 'http://127.0.0.1:3000',
      '/analyze-transaction': 'http://127.0.0.1:3000',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
})
