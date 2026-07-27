/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: {
          50: '#FBF8F2',
          100: '#F5F1E8',
          200: '#E9E2D0',
          300: '#D7CEB3',
          400: '#C2B68E',
          500: '#A79969',
        },
        ink: {
          900: '#1C1917',
          800: '#292524',
          700: '#44403C',
          600: '#57534E',
          500: '#78716C',
          400: '#A8A29E',
          300: '#D6D3D1',
          200: '#E7E5E4',
          100: '#F5F5F4',
        },
        accent: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        moss: {
          DEFAULT: '#6B705C',
          50: '#F7F7EE',
          100: '#EDEDE0',
          600: '#6B705C',
          700: '#555843',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'ui-serif', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      spacing: {
        '128': '32rem',
        '144': '36rem',
      },
      maxWidth: {
        '2xs': '16rem',
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: '100%',
          },
        },
      },
      letterSpacing: {
        'tightest': '-0.04em',
      },
      boxShadow: {
        paper:
          '0 1px 1px rgba(28,25,23,0.04), 0 6px 18px -6px rgba(28,25,23,0.10), 0 20px 40px -20px rgba(28,25,23,0.12)',
        'paper-sm': '0 1px 2px rgba(28,25,23,0.04), 0 4px 12px -6px rgba(28,25,23,0.08)',
        'paper-lg':
          '0 2px 4px rgba(28,25,23,0.05), 0 16px 32px -10px rgba(28,25,23,0.14), 0 40px 80px -30px rgba(28,25,23,0.18)',
      },
      keyframes: {
        'caret-blink': {
          '0%,70%,100%': { opacity: '1' },
          '20%,50%': { opacity: '0' },
        },
        'type-in': {
          '0%': { opacity: '0', transform: 'translateY(2px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'stagger-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        underline: {
          '0%': { width: '0%' },
          '100%': { width: '100%' },
        },
      },
      animation: {
        'caret-blink': 'caret-blink 1.1s steps(1) infinite',
        'type-in': 'type-in 0.3s ease-out forwards',
        'fade-in': 'fade-in 0.5s ease-out forwards',
        'slide-up': 'slide-up 0.5s ease-out forwards',
        'stagger-in': 'stagger-in 0.4s ease-out forwards',
      },
    },
  },
  plugins: [],
};
