import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
      '/hupu': {
        target: 'https://m.hupu.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/hupu/, ''),
      }
    },
  },
});