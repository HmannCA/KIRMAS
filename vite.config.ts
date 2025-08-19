import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  esbuild: { jsx: 'automatic' },
  server: {
    proxy: {
      // Proxyt alle /api-Calls an den Node-Server (läuft standardmäßig auf 8787)
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true
      }
    }
  }
})
