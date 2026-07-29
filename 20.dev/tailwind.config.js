/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#10b981',
          dark: '#059669',
          light: '#34d399',
        },
        ink: '#0f172a',
      },
      boxShadow: {
        card: '0 6px 24px -8px rgba(15, 23, 42, 0.12)',
        hero: '0 18px 40px -14px rgba(15, 23, 42, 0.35)',
      },
    },
  },
  plugins: [],
}
