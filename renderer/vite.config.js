import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/__tests__/**',
        'src/main.jsx',
        // React components and entry points — rendering only, logic covered by layout engine tests
        'src/App.jsx',
        'src/components/**',
        'src/hooks/**',
        'src/constants.js',
      ],
      thresholds: {
        lines: 80,
        branches: 75,
        functions: 80,
        statements: 80,
      },
    },
  },
})
