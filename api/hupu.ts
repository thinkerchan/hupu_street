import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUPU_ORIGIN = 'https://m.hupu.com';
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(200)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
      .end();
    return;
  }

  // Extract path from query parameter (set by vercel rewrite)
  const pathParam = req.query.path;
  const restPath = typeof pathParam === 'string' ? pathParam : Array.isArray(pathParam) ? pathParam.join('/') : '';

  const searchParams = new URLSearchParams();
  Object.entries(req.query).forEach(([key, value]) => {
    if (key === 'path') return;
    if (Array.isArray(value)) {
      value.forEach((v) => searchParams.append(key, v));
    } else if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  const targetUrl = `${HUPU_ORIGIN}/${restPath}${queryString ? `?${queryString}` : ''}`;

  console.log('Proxying request:', { restPath, queryString, targetUrl });

  try {
    const headers: Record<string, string> = {
      'accept': req.headers['accept']?.toString() ?? 'application/json, text/plain, */*',
      'accept-language': req.headers['accept-language']?.toString() ?? 'zh-CN,zh;q=0.9',
      'user-agent': req.headers['user-agent']?.toString() ?? DEFAULT_USER_AGENT,
      'referer': 'https://m.hupu.com/bbs/all-gambia',
      'origin': 'https://m.hupu.com',
      'x-requested-with': 'XMLHttpRequest',
    };

    const init: RequestInit = {
      method: req.method,
      headers,
    };

    if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
      if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
        init.body = req.body as BodyInit;
      } else if (req.body) {
        init.body = JSON.stringify(req.body);
        headers['content-type'] = 'application/json';
      }
    }

    const response = await fetch(targetUrl, init);
    const data = await response.arrayBuffer();

    console.log('Response status:', response.status, 'Size:', data.byteLength);

    res.status(response.status);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Copy relevant headers
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    res.send(Buffer.from(data));
  } catch (error) {
    console.error('Proxy request failed:', error);
    res
      .status(502)
      .setHeader('Access-Control-Allow-Origin', '*')
      .json({ success: false, message: 'Proxy request failed' });
  }
}
