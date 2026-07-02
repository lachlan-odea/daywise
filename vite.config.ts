import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://lachlan-odea.github.io/project-daybook-website/
export default defineConfig({
  base: '/project-daybook-website/',
  plugins: [react()],
})
