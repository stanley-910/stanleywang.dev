/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
        condensed: ['var(--font-condensed)'],
        script: ['var(--font-script)'],
        serif: ['var(--font-serif)'],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
} 