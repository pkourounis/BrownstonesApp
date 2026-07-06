import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brownstones brand palette — sampled from the logo wordmark: a warm
        // bronze-brown. Primary buttons/wordmark sit around 600–700.
        brand: {
          50: '#f8f4ea',
          100: '#efe6cf',
          200: '#ddc99b',
          300: '#c9a866',
          400: '#b48c3f',
          500: '#977030',
          600: '#7c5c28', // wordmark bronze
          700: '#664c24',
          800: '#523d20',
          900: '#43331d',
          950: '#241a0d',
        },
        // Tan / gold from the emblem windows — accents and highlights.
        gold: {
          100: '#f4e8ca',
          200: '#e8d19b',
          300: '#d8b878', // window tan
          400: '#c69b4a',
          500: '#a87f30',
          600: '#856325',
        },
        // Brick red from the brownstone facade — sparing accent.
        brick: {
          400: '#b4503b',
          500: '#9c3f2c',
          600: '#823324',
        },
        cream: '#f7f1e2',
      },
      fontFamily: {
        // High-contrast serif matching the Brownstones wordmark. Self-hosted
        // via @fontsource so the PWA stays fully offline-capable.
        serif: ['"Playfair Display"', 'Georgia', 'ui-serif', 'serif'],
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
