import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      '@testing-library/react': path.resolve(__dirname, './node_modules/@testing-library/react'),
      '@testing-library/jest-dom/vitest': path.resolve(__dirname, './node_modules/@testing-library/jest-dom/dist/vitest.mjs'),
      '@testing-library/jest-dom': path.resolve(__dirname, './node_modules/@testing-library/jest-dom'),
      'vitest': path.resolve(__dirname, './node_modules/vitest'),
      'lightweight-charts': path.resolve(__dirname, './node_modules/lightweight-charts'),
      'lucide-react': path.resolve(__dirname, './node_modules/lucide-react'),
    },
  },
  server: {
    port: 5173,
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    root: path.resolve(__dirname, '..'),
    include: ['tests/frontend/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: [],
  },
});
