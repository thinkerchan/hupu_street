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
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/passport': {
        target: 'https://passport.hupu.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/passport/, ''),
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