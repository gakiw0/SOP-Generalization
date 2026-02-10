import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  // For GitHub Pages project sites, set base to "/<repo>/" in CI.
  // Local development keeps "/".
  base:
    process.env.VITE_BASE ??
    (() => {
      const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
      return repo ? `/${repo}/` : '/'
    })(),
  plugins: [react()],
})
