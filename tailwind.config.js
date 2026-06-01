/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
        display: ['Bebas Neue', 'sans-serif'],
      },
      colors: {
        bg: '#07080b',
        surface: '#0d0f14',
        surface2: '#12151c',
        surface3: '#171b24',
        border: '#1c2030',
        border2: '#252b3a',
        green: {
          DEFAULT: '#00ffa3',
          dim: 'rgba(0,255,163,0.15)',
          glow: 'rgba(0,255,163,0.06)',
        },
        blue: {
          DEFAULT: '#3b82f6',
          dim: 'rgba(59,130,246,0.15)',
        },
        orange: {
          DEFAULT: '#f97316',
          dim: 'rgba(249,115,22,0.15)',
        },
        red: {
          DEFAULT: '#ef4444',
          dim: 'rgba(239,68,68,0.15)',
        },
        yellow: {
          DEFAULT: '#eab308',
          dim: 'rgba(234,179,8,0.15)',
        },
        cyan: {
          DEFAULT: '#22d3ee',
          dim: 'rgba(34,211,238,0.12)',
        },
        muted: '#475569',
        text2: '#94a3b8',
      },
      keyframes: {
        pulse2: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        pulse2: 'pulse2 2s ease-in-out infinite',
        slideIn: 'slideIn 0.2s ease-out',
        fadeIn: 'fadeIn 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
