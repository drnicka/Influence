/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        voice: {
          bg: '#0c0c14',
          surface: '#141420',
          card: '#1c1c2e',
          'card-hover': '#242438',
          accent: '#e94560',
          'accent-soft': 'rgba(233, 69, 96, 0.15)',
          muted: '#2a2a3e',
          text: '#f0f0f5',
          'text-secondary': '#72728a',
          'text-tertiary': '#4a4a60',
          border: '#1e1e30',
          'border-hover': '#2e2e45',
          positive: '#4ade80',
          'positive-soft': 'rgba(74, 222, 128, 0.12)',
          negative: '#f87171',
          'negative-soft': 'rgba(248, 113, 113, 0.12)',
        }
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
