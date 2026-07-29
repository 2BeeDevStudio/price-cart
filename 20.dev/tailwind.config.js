/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#059669',
          dark: '#047857',
          light: '#10b981',
        },
      },
    },
  },
  plugins: [],
}
