/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
        display: ['Inter', 'sans-serif'],
      },
      colors: {
        bg:       '#0f1117',
        surface:  '#161b27',
        surface2: '#1c2333',
        surface3: '#222840',
        border:   '#2a3347',
        border2:  '#334060',
        accent: {
          DEFAULT: '#3b7de8',
          light:   '#5b9af5',
          dim:     'rgba(59,125,232,0.12)',
          glow:    'rgba(59,125,232,0.06)',
        },
        success: {
          DEFAULT: '#22c55e',
          dim:     'rgba(34,197,94,0.12)',
        },
        warning: {
          DEFAULT: '#f59e0b',
          dim:     'rgba(245,158,11,0.12)',
        },
        danger: {
          DEFAULT: '#ef4444',
          dim:     'rgba(239,68,68,0.12)',
        },
        info: {
          DEFAULT: '#06b6d4',
          dim:     'rgba(6,182,212,0.12)',
        },
        purple: {
          DEFAULT: '#8b5cf6',
          dim:     'rgba(139,92,246,0.12)',
        },
        muted:  '#64748b',
        text2:  '#94a3b8',
      },
      keyframes: {
        pulse2: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        pulse2:  'pulse2 2s ease-in-out infinite',
        slideIn: 'slideIn 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
