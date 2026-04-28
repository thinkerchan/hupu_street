import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { HUPU_PROXIES } from './api/_lib';
import { createViteProxyEntry } from './build-tools/proxy-vite';

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
      // 注意：不要再加 /api 这种宽前缀 proxy，会拦住 vite serve 自己的源码
      // （前端 import api/_shared/hupu-config 时浏览器会请 /api/_shared/hupu-config.ts）
      ...hupuProxy,
    },
  },
});
