/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        starbucks: {
          50: '#f0f7f1',
          100: '#d4e8d6',
          200: '#a8d1ac',
          300: '#74b67a',
          400: '#4a9a52',
          500: '#00704A',
          600: '#006340',
          700: '#005237',
          800: '#00422d',
          900: '#003322',
        },
      },
    },
  },
  plugins: [],
}
