import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        tailwindcss({
          content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
          theme: {
            extend: {
              fontFamily: {
                sans: ['Inter', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
              },
              colors: {
                bg:       '#f0f2f7',
                surface:  '#ffffff',
                surface2: '#f8fafc',
                surface3: '#f1f5f9',
                border:   '#e2e6ef',
                border2:  '#d1d9e0',
                muted:    '#9ca3af',
                text2:    '#6b7280',
                success:  '#22c55e',
                warning:  '#f59e0b',
                danger:   '#ef4444',
                info:     '#06b6d4',
              },
            },
          },
          plugins: [],
        } as any),
        autoprefixer(),
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
