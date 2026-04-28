import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { HUPU_PROXIES } from './lib/hupu-config';
import { createViteProxyEntry } from './lib/proxy-vite';

const hupuProxy = Object.fromEntries(
  Object.values(HUPU_PROXIES).map((entry) => [entry.prefix, createViteProxyEntry(entry)]),
);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      ...hupuProxy,
    },
  },
});
