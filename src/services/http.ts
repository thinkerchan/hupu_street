/**
 * 前端唯一的虎扑请求入口。所有 services 都走这里，避免 credentials / Content-Type /
 * X-Hupu-Tid header 在多处各写一次。
 *
 * 设计：基于浏览器原生 fetch，不引入 axios（少 30+ KB gzip，且 fetch 已经够用）。
 * 上游域 / 路径前缀全部从 api/_lib 的 HUPU_PROXIES 拿，跟 vercel function / vite proxy 共享同一份配置。
 */

import { HUPU_PROXIES, HUPU_TID_HEADER, type HupuProxyKey } from '../../api/_lib';

export interface HupuFetchOptions<TBody = unknown> {
  /** 走哪个上游通道。passport / bbsPc / gamesApi / m */
  via: HupuProxyKey;
  /** 相对 path（不带 prefix），例如 'pcmapi/pc/bbs/v1/createReply' 或 'api/v1/bbs-thread/123' */
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** 查询参数。会 URL encode 拼到 path 后面。 */
  query?: Record<string, string | number | undefined>;
  /** body 对象。json 默认 JSON.stringify；form 模式做 URL-encoded。 */
  body?: TBody;
  /** body 序列化方式 */
  contentType?: 'json' | 'form';
  /** 帖子 id，自动写到 X-Hupu-Tid 头让代理把 referer 改成具体帖子页（仅 bbsPc 需要） */
  tid?: string | number;
  /** 自定义额外 header */
  headers?: Record<string, string>;
  /** 期望的响应类型：默认按 Content-Type 自动判，json/text 强制覆盖 */
  responseType?: 'json' | 'text';
}

const DEFAULT_HEADERS_JSON = 'application/json';
const DEFAULT_HEADERS_FORM = 'application/x-www-form-urlencoded; charset=UTF-8';

function buildQuery(query?: Record<string, string | number | undefined>): string {
  if (!query) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v == null) continue;
    sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

function serializeBody(
  body: unknown,
  mode: 'json' | 'form',
): { body: string; contentType: string } {
  if (mode === 'form') {
    const text =
      typeof body === 'string'
        ? body
        : new URLSearchParams(body as Record<string, string>).toString();
    return { body: text, contentType: DEFAULT_HEADERS_FORM };
  }
  return {
    body: typeof body === 'string' ? body : JSON.stringify(body ?? {}),
    contentType: DEFAULT_HEADERS_JSON,
  };
}

/**
 * 发起一次虎扑请求。返回 typed JSON / text。
 *
 * @example 拉帖子列表
 * const list = await hupuFetch({ via: 'm', path: 'api/v2/bbs/walkingStreet/threads', query: { page: 1 } });
 *
 * @example 点亮一条评论
 * await hupuFetch({ via: 'bbsPc', path: 'pcmapi/pc/bbs/v1/reply/light', body: {...}, tid });
 *
 * @example 发短信验证码
 * await hupuFetch({ via: 'passport', path: 'v3/m/2/sendCodeApp', body: {mobile, ...} });
 */
export async function hupuFetch<TResp = unknown, TBody = unknown>(
  opts: HupuFetchOptions<TBody>,
): Promise<TResp> {
  const entry = HUPU_PROXIES[opts.via];
  const cleanPath = opts.path.startsWith('/') ? opts.path : `/${opts.path}`;
  const url = `${entry.prefix}${cleanPath}${buildQuery(opts.query)}`;

  const headers: Record<string, string> = { ...opts.headers };
  if (opts.tid != null) headers[HUPU_TID_HEADER] = String(opts.tid);

  let bodyText: string | undefined;
  if (opts.body !== undefined) {
    const { body, contentType } = serializeBody(opts.body, opts.contentType ?? 'json');
    bodyText = body;
    if (!headers['Content-Type']) headers['Content-Type'] = contentType;
  }

  const method = opts.method ?? (opts.body !== undefined ? 'POST' : 'GET');

  const resp = await fetch(url, {
    method,
    credentials: 'include', // 全局带 cookie，hupu 接口都靠 .hupu.com cookie 维护登录态
    headers,
    body: bodyText,
  });

  // 默认走 json：m.hupu.com 等接口虽然 body 是 JSON，但 content-type 经常是 text/html，
  // 不能信赖 content-type。需要 HTML 文本（如 PC SSR 页）调用方显式传 responseType: 'text'。
  if (opts.responseType === 'text') return (await resp.text()) as TResp;
  return (await resp.json()) as TResp;
}
