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
      '/hupu': {
        target: 'https://m.hupu.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/hupu/, ''),
      },
      ...Object.fromEntries(
        Array.from({ length: 11 }, (_, i) => {
          const num = i + 1;
          const prefix = `/i${num}`;
          const target = `https://i${num}.hoopchina.com.cn`;
          return [
            prefix,
            {
              target,
              changeOrigin: true,
              secure: true,
              rewrite: (path) => path.replace(new RegExp(`^${prefix}`), ''),
              headers: {
                referer: 'https://m.hupu.com/',
                origin: 'https://m.hupu.com',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              },
            },
          ];
        })
      ),

    },
  },
});