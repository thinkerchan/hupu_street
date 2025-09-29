import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPPORTED_PREFIXES = new Set(
  Array.from({ length: 11 }, (_, i) => `i${i + 1}`)
);
SUPPORTED_PREFIXES.add('w1');

const DEFAULT_HEADERS = {
  referer: 'https://m.hupu.com/bbs/all-gambia',
  origin: 'https://m.hupu.com',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const prefixParam = req.query.prefix;
  const pathSegments = req.query.path;

  const prefix = Array.isArray(prefixParam) ? prefixParam[0] : prefixParam;
  const segments = Array.isArray(pathSegments) ? pathSegments : pathSegments ? [pathSegments] : [];

  const host = prefix ? prefix.toLowerCase() : '';

  if (!host || !SUPPORTED_PREFIXES.has(host)) {
    res.status(400).json({ error: 'unsupported image host' });
    return;
  }

  const restPath = segments.join('/');
  const searchParams = new URLSearchParams();
  Object.entries(req.query).forEach(([key, value]) => {
    if (key === 'prefix' || key === 'path') return;
    if (Array.isArray(value)) {
      value.forEach((v) => searchParams.append(key, v));
    } else if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  const target = `https://${host}.hoopchina.com.cn/${restPath}${queryString ? `?${queryString}` : ''}`;

  try {
    const upstream = await fetch(target, {
      headers: DEFAULT_HEADERS,
    });

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    res.setHeader('Access-Control-Allow-Origin', '*');

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    console.error('Image proxy failed:', error);
    res.status(502).json({ error: 'image proxy failed' });
  }
}
