/**
 * Hupu 共享代码（配置 + 共享纯函数 + Vercel 工厂）。
 *
 * 单文件，文件名带下划线前缀，Vercel 不会注册成 endpoint，但被 import 时会 bundle 进 lambda。
 * 多文件 / 子目录在 vercel build 时打包行为不稳定，曾经导致 FUNCTION_INVOCATION_FAILED，所以收成单文件。
 *
 * 三个使用方都从这里 import：
 *  - vite.config.ts（dev proxy）
 *  - api/*.ts（vercel function 生产代理）
 *  - src/services/*.ts（前端运行时调用）
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================================================
// 1. 配置数据
// ============================================================================

/** PC web 桌面 UA。bbs.hupu.com / passport.hupu.com 反作弊会拒绝移动 UA。 */
export const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/** APK 模拟 UA，games.mobileapi.hupu.com 用。 */
export const APK_UA =
  'Mozilla/5.0 (Linux; Android 13; HuPu) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 hupu_android_8.1.12';

/** Referer 模板：固定 URL 或基于 X-Hupu-Tid 头动态拼具体帖子页。 */
export type RefererSpec =
  | string
  | { template: 'tid'; base: string };

/** 单条代理通道配置。 */
export interface HupuProxyEntry {
  /** 内部标识，用于打日志 */
  name: string;
  /** 客户端访问的本地前缀（也是 vercel rewrite 的源） */
  prefix: string;
  /** 上游 host */
  origin: string;
  /** 伪装 UA */
  userAgent: string;
  /** Referer 设置；不设则不注入 */
  referer?: RefererSpec;
  /** 是否注入 Origin: <origin> 头 */
  injectOrigin?: boolean;
  /** 是否改写 set-cookie：去 Domain/Secure/HttpOnly，让前端能读且绑当前 origin */
  rewriteCookies?: boolean;
}

/** 客户端读 X-Hupu-Tid 头时拼具体 referer 的传参 header 名。 */
export const HUPU_TID_HEADER = 'X-Hupu-Tid';

/** 全部代理通道。新增子站点只在这里加一条配置。 */
export const HUPU_PROXIES = {
  passport: {
    name: 'passport',
    prefix: '/passport',
    origin: 'https://passport.hupu.com',
    userAgent: DESKTOP_UA,
    referer: 'https://passport.hupu.com/v2/login',
    injectOrigin: true,
    rewriteCookies: true,
  },
  bbsPc: {
    name: 'bbs-pc',
    prefix: '/bbs-pc',
    origin: 'https://bbs.hupu.com',
    userAgent: DESKTOP_UA,
    referer: { template: 'tid', base: 'https://bbs.hupu.com' },
    injectOrigin: true,
    rewriteCookies: true,
  },
  gamesApi: {
    name: 'games-api',
    prefix: '/games-api',
    origin: 'https://games.mobileapi.hupu.com',
    userAgent: APK_UA,
  },
  m: {
    name: 'm',
    prefix: '/hupu',
    origin: 'https://m.hupu.com',
    userAgent: DESKTOP_UA,
    referer: 'https://m.hupu.com/bbs/all-gambia',
    injectOrigin: true,
  },
  /** 虎扑静态资源 CDN（数美 SDK 等）。校验 referer，必须伪装成 hupu 域才不返 403。 */
  hoopchinaCdn: {
    name: 'hoopchina-cdn',
    prefix: '/hoopchina',
    origin: 'https://w1.hoopchina.com.cn',
    userAgent: DESKTOP_UA,
    referer: 'https://m.hupu.com/',
    injectOrigin: true,
  },
} as const satisfies Record<string, HupuProxyEntry>;

export type HupuProxyKey = keyof typeof HUPU_PROXIES;

/** 第三方 SDK 资源。
 * - aliyunCaptcha：阿里云 CDN，无 referer 限制，用绝对 URL 直接加载
 * - shumei：hoopchina CDN 校验 referer，必须经我们代理伪装 hupu referer，所以用相对路径
 */
export const SDK_URLS = {
  aliyunCaptcha: 'https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js',
  shumei: '/hoopchina/bbs/js/smDeviceSdk2.js',
} as const;

/** 阿里云盾滑块场景配置（PC 登录页里反编译得到）。 */
export const ALIYUN_CAPTCHA_CONFIG = {
  region: 'cn',
  prefix: '1ekukj',
  sceneId: '1cn9oros',
} as const;

/** 协议常量（来自 APK 反编译，APK 流程仍然用）。 */
export const APK_SIGN_SALT = 'HUPU_SALT_AKJfoiwer394Jeiow4u309';
export const APK_RSA_PUBLIC_KEY =
  'MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAL9Fnhk8e1caZiFbGsI88M7cZdSt1UJN5bLkGde1eADXnxF6elmL36oXrq23/91hpVvhp1FAg7SB/6WEnFu+9UkCAwEAAQ==';
/** games-api 的 path 前缀，去掉版本段会绕过签名校验回到老 endpoint，不要简化。 */
export const GAMES_API_VERSION_PATH = '/1/8.1.12';

/** 步行街固定 fid，旧代码兜底用。新代码应优先从 PC SSR 拿真实 fid。 */
export const HUPU_FIDS = {
  walkingStreet: '34',
} as const;

// ============================================================================
// 2. 共享纯函数（cookie 改写 / referer 拼接）
// ============================================================================

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

// ============================================================================
// 3. Vercel function 工厂
// ============================================================================

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

      // 用 any cast：tsconfig.node.json 没 DOM lib，BodyInit / RequestInit 的精确签名不可用，
      // 但 vercel runtime 是 Node 18+ undici fetch，运行时接受 string/Buffer/URLSearchParams 都没问题。
      const init: Record<string, unknown> = { method: req.method, headers, redirect: 'manual' };
      if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
        const ct = req.headers['content-type']?.toString();
        if (ct) headers['content-type'] = ct;
        if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
          init.body = req.body;
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

      // 关键：Node fetch 的 headers.get('set-cookie') 只返回一条，hupu 登录会下发多条
      // (u/us/ua/_HUPUSSOID/_CLT...)，必须用 getSetCookie() 拿数组逐条转发，否则浏览器
      // 拿到的 cookie 会缺登录态字段（u）→ 后续接口都判"未登录"。
      // getSetCookie 是 Node 19.7+ / Vercel 现役 runtime 都支持的 fetch 标准方法。
      const upstreamHeaders = upstream.headers as Headers & { getSetCookie?: () => string[] };
      const cookies = upstreamHeaders.getSetCookie?.() ?? [];
      if (cookies.length > 0) {
        const final = entry.rewriteCookies ? cookies.map(rewriteSetCookieValue) : cookies;
        res.setHeader('Set-Cookie', final);
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
