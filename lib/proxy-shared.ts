/** 共享给 vite proxy 和 vercel function 的纯函数。无运行时依赖，可在两端复用。 */
import type { HupuProxyEntry } from './hupu-config';

/**
 * 改写单条 set-cookie：
 * - Domain=.hupu.com 删掉（让浏览器把 cookie 绑到当前 origin）
 * - Secure 删掉（本地 http 不会丢 cookie）
 * - HttpOnly 删掉（前端要 document.cookie 读 u 拿 uid/username）
 * - SameSite 强制 Lax
 */
export function rewriteSetCookieValue(c: string): string {
  return (
    c
      .replace(/;\s*Domain=[^;]*/i, '')
      .replace(/;\s*Secure/i, '')
      .replace(/;\s*HttpOnly/i, '')
      .replace(/;\s*SameSite=[^;]*/i, '') + '; SameSite=Lax'
  );
}

/** 数组形式（http-proxy 在 Node 端给的 set-cookie 是 string[]） */
export function rewriteSetCookieList(list: string[]): string[] {
  return list.map(rewriteSetCookieValue);
}

/** fetch Response.headers.get('set-cookie') 把多 cookie 合并成一段，需先按 cookie 边界切。 */
export function rewriteSetCookieHeader(raw: string): string {
  return raw
    .split(/,(?=\s*[^;,]+=)/)
    .map((c) => rewriteSetCookieValue(c.trim()))
    .join(', ');
}

/** 根据 entry.referer 配置 + 可选 tid，构造伪装 Referer 头。 */
export function buildReferer(entry: HupuProxyEntry, tid?: string): string | undefined {
  if (!entry.referer) return undefined;
  if (typeof entry.referer === 'string') return entry.referer;
  if (entry.referer.template === 'tid' && tid) {
    return `${entry.referer.base}/${tid}.html`;
  }
  return `${entry.referer.base}/`;
}
