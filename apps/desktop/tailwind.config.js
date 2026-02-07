/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx,html}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'color-mix(in srgb, var(--color-primary) 5%, white)',
          100: 'color-mix(in srgb, var(--color-primary) 15%, white)',
          200: 'color-mix(in srgb, var(--color-primary) 30%, white)',
          300: 'color-mix(in srgb, var(--color-primary) 50%, white)',
          400: 'color-mix(in srgb, var(--color-primary) 70%, white)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          700: 'color-mix(in srgb, var(--color-primary) 100%, black 15%)',
          800: 'color-mix(in srgb, var(--color-primary) 100%, black 30%)',
          900: 'color-mix(in srgb, var(--color-primary) 100%, black 45%)',
          950: 'color-mix(in srgb, var(--color-primary) 100%, black 60%)',
        },
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'slide-up': 'slideUp 200ms ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
