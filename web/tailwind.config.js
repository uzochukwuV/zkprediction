/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f0ff',
          100: '#ebe2ff',
          200: '#d8c5ff',
          300: '#b99aff',
          400: '#9870ff',
          500: '#8052ff',
          600: '#6b3ef0',
          700: '#5932c7',
          800: '#452799',
          900: '#311d6d',
        },
        secondary: {
          50: '#fff8e7',
          100: '#fff0c7',
          200: '#ffe28f',
          300: '#ffd04d',
          400: '#ffbf1f',
          500: '#ffb829',
          600: '#d79516',
          700: '#a9710f',
          800: '#7d540d',
          900: '#563907',
        },
        dark: {
          100: '#0b0b0f',
          200: '#050507',
          300: '#000000',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'ui-sans-serif', 'system-ui'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
