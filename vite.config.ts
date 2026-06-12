import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves project sites from /<repo-name>/.
  // Keep dev at / so local Vite usage stays unchanged.
  base: command === 'build' ? '/world-cup-bracket-26/' : '/',
  plugins: [react()],
}))
