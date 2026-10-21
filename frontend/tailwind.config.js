/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        industrial: {
          950: '#090d16',
          900: '#0f172a',
          850: '#151f33',
          800: '#1e293b',
          700: '#334155',
          600: '#475569',
        },
        alarm: {
          red: '#ef4444',
          crimson: '#dc2626',
        },
        safe: {
          emerald: '#10b981',
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
