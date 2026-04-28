/** Vercel function 工厂：把一条 HupuProxyEntry 转成完整的 default handler。 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { type HupuProxyEntry, HUPU_TID_HEADER } from './hupu-config';
import { buildReferer, rewriteSetCookieHeader } from './proxy-shared';

const TID_HEADER_LOWER = HUPU_TID_HEADER.toLowerCase();

export function createVercelHupuHandler(entry: HupuProxyEntry) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'OPTIONS') {
      res
        .status(200)
        .setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*')
        .setHeader('Access-Control-Allow-Credentials', 'true')
        .setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
        .setHeader('Access-Control-Allow-Headers', `Content-Type,Authorization,Cookie,${HUPU_TID_HEADER}`)
        .end();
      return;
    }

    const restPath = pickPath(req.query.path);
    const targetUrl = `${entry.origin}/${restPath}${buildQuery(req.query)}`;

    const tidRaw = req.headers[TID_HEADER_LOWER];
    const tid = Array.isArray(tidRaw) ? tidRaw[0] : tidRaw;

    try {
      const headers: Record<string, string> = {
        accept: req.headers['accept']?.toString() ?? 'application/json, text/plain, */*',
        'accept-language': req.headers['accept-language']?.toString() ?? 'zh-CN,zh;q=0.9',
        'user-agent': entry.userAgent,
      };
      if (entry.injectOrigin) headers.origin = entry.origin;
      const referer = buildReferer(entry, tid);
      if (referer) headers.referer = referer;
      if (req.headers.cookie) headers.cookie = req.headers.cookie.toString();

      const init: RequestInit = { method: req.method, headers, redirect: 'manual' };
      if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
        const ct = req.headers['content-type']?.toString();
        if (ct) headers['content-type'] = ct;
        if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
          init.body = req.body as BodyInit;
        } else if (req.body && ct?.includes('application/x-www-form-urlencoded')) {
          init.body = new URLSearchParams(req.body as Record<string, string>).toString();
        } else if (req.body) {
          init.body = JSON.stringify(req.body);
          if (!ct) headers['content-type'] = 'application/json';
        }
      }

      const upstream = await fetch(targetUrl, init);
      const buf = await upstream.arrayBuffer();

      res.status(upstream.status);
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
      res.setHeader('Access-Control-Allow-Credentials', 'true');

      const contentType = upstream.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);

      const sc = upstream.headers.get('set-cookie');
      if (sc) {
        res.setHeader('Set-Cookie', entry.rewriteCookies ? rewriteSetCookieHeader(sc) : sc);
      }

      res.send(Buffer.from(buf));
    } catch (error) {
      console.error(`[${entry.name}] proxy failed:`, error);
      res
        .status(502)
        .setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*')
        .json({ code: -1, msg: 'Proxy request failed' });
    }
  };
}

function pickPath(p: string | string[] | undefined): string {
  if (typeof p === 'string') return p;
  if (Array.isArray(p)) return p.join('/');
  return '';
}

function buildQuery(query: Record<string, string | string[] | undefined>): string {
  const sp = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (k === 'path') return;
    if (Array.isArray(v)) v.forEach((vv) => sp.append(k, vv));
    else if (v !== undefined) sp.append(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}
