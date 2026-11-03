/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 로고 색: 남색(주) + 라임(포인트)
        brand: {
          DEFAULT: '#061A4C',
          dark: '#020D2B',
          light: '#9AA6C4',
        },
        lime: {
          DEFAULT: '#CCF955',
          dark: '#B5E63A',
          soft: '#F1FCD6',
        },
        canvas: '#F3F5F9',
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
