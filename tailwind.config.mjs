/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        vault: {
          darkest: '#030102',
          dark: '#0c0507',
          midnight: '#1c0a0e',
          card: 'rgba(28, 10, 14, 0.8)',
          border: 'rgba(239, 68, 68, 0.2)',
          red: '#EF4444',
          crimson: '#DC2626',
          deep: '#991B1B',
          blood: '#7F1D1D',
          muted: '#9CA3AF',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      screens: {
        xs: '375px',
      }
    },
  },
  plugins: [],
};
