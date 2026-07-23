import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps asset paths relative so the build works from any sub-folder
// on shared hosting (e.g. example.com/gush/).
export default defineConfig({
  plugins: [react()],
  base: './',
})
