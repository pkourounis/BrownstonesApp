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
        // Themeable at runtime via CSS variables (see globals.css defaults and
        // App Settings). Default ramp is the logo bronze.
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
          950: 'rgb(var(--brand-950) / <alpha-value>)',
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
