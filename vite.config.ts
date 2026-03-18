import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { defineConfig } from 'vite'

// This config is for ShadCN CLI compatibility
// The actual build uses electron-vite
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src'),
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  }
})
