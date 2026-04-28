/** Vite dev proxy 工厂：把一条 HupuProxyEntry 转成 vite proxy 配置项。 */
import type { ProxyOptions } from 'vite';
import { type HupuProxyEntry, HUPU_TID_HEADER, buildReferer, rewriteSetCookieList } from '../api/_lib';

const TID_HEADER_LOWER = HUPU_TID_HEADER.toLowerCase();

export function createViteProxyEntry(entry: HupuProxyEntry): ProxyOptions {
  return {
    target: entry.origin,
    changeOrigin: true,
    secure: true,
    rewrite: (p) => p.replace(new RegExp(`^${entry.prefix}`), ''),
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq, req) => {
        proxyReq.setHeader('User-Agent', entry.userAgent);
        if (entry.injectOrigin) proxyReq.setHeader('Origin', entry.origin);

        const tidRaw = req.headers[TID_HEADER_LOWER];
        const tid = Array.isArray(tidRaw) ? tidRaw[0] : tidRaw;
        const referer = buildReferer(entry, tid);
        if (referer) proxyReq.setHeader('Referer', referer);
        // 自定义头不必透传到上游
        if (tid) proxyReq.removeHeader(TID_HEADER_LOWER);
      });

      if (entry.rewriteCookies) {
        proxy.on('proxyRes', (proxyRes) => {
          const sc = proxyRes.headers['set-cookie'];
          if (Array.isArray(sc)) {
            proxyRes.headers['set-cookie'] = rewriteSetCookieList(sc);
          }
        });
      }
    },
  };
}
