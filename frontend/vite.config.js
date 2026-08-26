import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    // Vite's dev-time esbuild pre-bundling breaks this package's internal
    // WASM/dynamic-import resolution when it's imported inside a worker —
    // excluding it makes the dev server behave like the production build.
    exclude: ['@huggingface/transformers'],
  },
})
