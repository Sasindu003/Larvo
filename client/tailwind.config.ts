import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral fashion palette
        ink: {
          50:  '#f7f7f7',
          100: '#efefef',
          200: '#dcdcdc',
          300: '#bdbdbd',
          400: '#989898',
          500: '#7c7c7c',
          600: '#656565',
          700: '#525252',
          800: '#3d3d3d',
          900: '#1a1a1a',
          950: '#0d0d0d',
        },
        cream: {
          50:  '#fdfcfa',
          100: '#faf5ee',
          200: '#f5ebda',
          300: '#ecd9be',
          400: '#dfc09a',
          500: '#cfa676',
          DEFAULT: '#faf5ee',
        },
        sand: {
          100: '#f6f0e8',
          200: '#ece3d4',
          300: '#ddd0b8',
          400: '#c9b898',
          500: '#b09d7a',
        },
        // Feedback colors — restrained, not garish
        success: { light: '#d1fae5', DEFAULT: '#059669', dark: '#065f46' },
        warning: { light: '#fef3c7', DEFAULT: '#d97706', dark: '#92400e' },
        danger:  { light: '#fee2e2', DEFAULT: '#dc2626', dark: '#991b1b' },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
      borderRadius: {
        DEFAULT: '6px',
        lg:      '10px',
        xl:      '14px',
        '2xl':   '20px',
      },
      boxShadow: {
        card:  '0 1px 4px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.05)',
        modal: '0 8px 40px rgba(0,0,0,0.18)',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-600px 0' },
          '100%': { backgroundPosition: '600px 0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        shimmer:  'shimmer 1.5s infinite linear',
        'fade-in':'fade-in 0.15s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
