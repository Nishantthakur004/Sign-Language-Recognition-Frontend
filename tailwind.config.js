/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
          800: '#5B21B6',
        },
        navy: '#172033',
        muted: '#64748B',
        surface: '#F8F7FC',
      },
      fontFamily: {
        heading: ['Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
      },
      boxShadow: {
        soft: '0 12px 35px rgba(23, 32, 51, 0.07)',
        lift: '0 18px 50px rgba(109, 40, 217, 0.14)',
      },
    },
  },
  plugins: [],
};
