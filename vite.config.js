import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',  // ← AIXÒ! Rutes relatives
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
