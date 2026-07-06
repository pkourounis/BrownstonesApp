import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brownstones brand palette — warm brownstone / turn-of-the-century tones,
        // inspired by Brooklyn rowhouse facades: sienna brick, cream, espresso.
        brand: {
          50: '#faf5ee',
          100: '#f3e8d9',
          200: '#e6cfb2',
          300: '#d5ad83',
          400: '#c48a5c',
          500: '#b06f42',
          600: '#9a5836',
          700: '#7e442c', // brownstone brick
          800: '#663829',
          900: '#553025',
          950: '#301811',
        },
        // Vintage signage gold — used sparingly for accents.
        gold: {
          100: '#f7ecd0',
          200: '#ecd39a',
          300: '#dcb45f',
          400: '#c8992f',
          500: '#a97e26',
          600: '#87631f',
        },
        cream: '#f7f1e6',
      },
      fontFamily: {
        // Classic serif for the wordmark / display headings (system stack — no
        // network fonts, keeps the PWA fully offline-capable).
        serif: ['Georgia', '"Times New Roman"', 'ui-serif', 'serif'],
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
