/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Aptos', 'Segoe UI', '-apple-system', 'BlinkMacSystemFont', 'Roboto', 'sans-serif'],
        display: ['Aptos Display', 'Aptos', 'Plus Jakarta Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'Aptos Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        paper: {
          DEFAULT: '#FFFFFF',
          canvas: '#FBFBFC',
          subtle: '#F8FAFC',
          surface: '#FFFFFF',
          border: '#E2E8F0',
          'border-subtle': '#F1F5F9',
          'border-soft': '#CBD5E1',
          'border-active': '#2563EB',
          ink: '#0F172A',
          'ink-muted': '#475569',
          'ink-faint': '#94A3B8',
          blue: '#1D4ED8',
          green: '#047857',
          red: '#B91C1C',
          amber: '#D97706',
        },
      },
      boxShadow: {
        hairline: '0 0 0 1px #E2E8F0',
      },
    },
  },
  plugins: [],
};
