/** @type {import('tailwindcss').Config} */
import colors from 'tailwindcss/colors'

export default {
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
        blue: {
          ...colors.blue,
          DEFAULT: '#3b82f6',
          light:   '#60a5fa',
          dim:     '#eff6ff',
        },
        green: {
          ...colors.green,
          DEFAULT: '#22c55e',
          dim:     '#f0fdf4',
        },
        orange: {
          ...colors.orange,
          DEFAULT: '#f97316',
          dim:     '#fff7ed',
        },
        red: {
          ...colors.red,
          DEFAULT: '#ef4444',
          dim:     '#fef2f2',
        },
        yellow: {
          ...colors.yellow,
          DEFAULT: '#f59e0b',
          dim:     '#fffbeb',
        },
        purple: {
          ...colors.purple,
          DEFAULT: '#8b5cf6',
          dim:     '#f5f3ff',
        },
        cyan: {
          ...colors.cyan,
          DEFAULT: '#06b6d4',
          dim:     '#ecfeff',
        },
        pink: {
          ...colors.pink,
        },
        slate: {
          ...colors.slate,
        },
        muted:   '#9ca3af',
        text2:   '#6b7280',
        success: '#22c55e',
        warning: '#f59e0b',
        danger:  '#ef4444',
        info:    '#06b6d4',
      },
    },
  },
  plugins: [],
}