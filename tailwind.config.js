/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand palette derived from the Project Daybook logo
        navy: {
          50: '#eef2fb',
          100: '#d6def4',
          200: '#aebfe8',
          300: '#7e98d7',
          400: '#5372c2',
          500: '#3654a8',
          600: '#294188',
          700: '#20336c',
          800: '#182957',
          900: '#132145',
          950: '#0c1530',
        },
        teal: {
          50: '#eafaf5',
          100: '#c9f2e5',
          200: '#96e5cd',
          300: '#5dd2b1',
          400: '#2fba93',
          500: '#17a085',
          600: '#0f8570',
          700: '#0f6a5b',
          800: '#10554a',
          900: '#0f463e',
          950: '#032722',
        },
        sky: {
          50: '#eef7ff',
          100: '#d9eeff',
          200: '#bce0ff',
          300: '#8ecdff',
          400: '#59b0fb',
          500: '#3491f0',
          600: '#1f72d6',
          700: '#1a5bad',
          800: '#1c4d8d',
          900: '#1c4274',
          950: '#152a48',
        },
        ink: '#0c1530',
        cloud: '#f6f9fc',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 4px 24px -8px rgba(19, 33, 69, 0.12)',
        card: '0 12px 40px -12px rgba(19, 33, 69, 0.18)',
        glow: '0 20px 60px -18px rgba(23, 160, 133, 0.45)',
        'glow-navy': '0 24px 70px -20px rgba(24, 41, 87, 0.55)',
      },
      backgroundImage: {
        'grid-navy':
          'linear-gradient(to right, rgba(24,41,87,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(24,41,87,0.06) 1px, transparent 1px)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out forwards',
        float: 'float 6s ease-in-out infinite',
        marquee: 'marquee 40s linear infinite',
      },
    },
  },
  plugins: [],
}
