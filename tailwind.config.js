/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          // בחנות הגוונים נגזרים מצבע המשתלה (lib/theme-vars.ts); בלי המשתנים — הירוק של ברירת המחדל
          DEFAULT: 'rgb(var(--brand-600, 22 163 74) / <alpha-value>)',
          50: 'rgb(var(--brand-50, 240 253 244) / <alpha-value>)',
          100: 'rgb(var(--brand-100, 220 252 231) / <alpha-value>)',
          200: 'rgb(var(--brand-200, 187 247 208) / <alpha-value>)',
          300: 'rgb(var(--brand-300, 134 239 172) / <alpha-value>)',
          400: 'rgb(var(--brand-400, 74 222 128) / <alpha-value>)',
          500: 'rgb(var(--brand-500, 34 197 94) / <alpha-value>)',
          600: 'rgb(var(--brand-600, 22 163 74) / <alpha-value>)',
          700: 'rgb(var(--brand-700, 21 128 61) / <alpha-value>)',
          800: 'rgb(var(--brand-800, 22 101 52) / <alpha-value>)',
          900: 'rgb(var(--brand-900, 20 83 45) / <alpha-value>)',
        },
        surface: 'var(--surface, #ffffff)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
