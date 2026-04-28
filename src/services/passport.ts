// 调虎扑 PC 版 passport.hupu.com 的登录接口。和 APK games-api 路径不是一个体系：
// - host: passport.hupu.com（dev/prod 都走 /passport 代理）
// - body: 平铺 JSON，无 sign/RSA
// - 风控: aliRid（阿里云盾滑块）+ deviceId（数美 SDK）
// - 登录态: cookie，由 /api/passport 改写 Domain 后绑定到当前 origin

import { SDK_URLS, ALIYUN_CAPTCHA_CONFIG } from '../../api/_lib';
import { hupuFetch } from './http';

export interface PassportSendCodeBody {
  mobile: string;
  /** PC 版表单都传这个组合 */
  checkList?: string; // 'mobile'
  way?: string; // 'common' | 'bind'
}

export interface PassportLoginBody {
  mobile: string;
  authcode: string;
  aliRid: string;
  deviceId: string;
}

export interface PassportResponse<T = unknown> {
  code: number;
  msg: string;
  data?: T;
}

export const passportApi = {
  sendMobileCode(mobile: string, way: 'common' | 'bind' = 'common'): Promise<PassportResponse> {
    return hupuFetch({
      via: 'passport',
      path: 'v3/m/2/sendCodeApp',
      body: { mobile, checkList: 'mobile', way },
    });
  },

  loginByMobile(body: PassportLoginBody): Promise<PassportResponse<PassportLoginResult>> {
    return hupuFetch({
      via: 'passport',
      path: 'v3/m/2/login/mobile',
      body,
    });
  },
};

// 登录成功后返回结构：根据 PC 端代码 Vr.code === 1000 → 跳 jumpurl，未观察到 token 字段。
// 业务态由 .hupu.com cookie 维护，这里给 data 留个宽松类型即可。
export interface PassportLoginResult {
  uid?: number;
  puid?: number;
  username?: string;
  header?: string;
  jumpurl?: string;
  // 兜底：未来如果接口加字段不会破坏类型
  [k: string]: unknown;
}

// ---- 第三方 SDK loader ----（SDK_URLS 在 lib/hupu-config 里集中维护）

const loaded = new Set<string>();

function loadScript(url: string): Promise<void> {
  if (loaded.has(url)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-src="${url}"]`);
    if (existing) {
      loaded.add(url);
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.dataset.src = url;
    s.onload = () => {
      loaded.add(url);
      resolve();
    };
    s.onerror = () => reject(new Error(`Failed to load ${url}`));
    document.head.appendChild(s);
  });
}

declare global {
  interface Window {
    AliyunCaptchaConfig?: { region: string; prefix: string };
    initAliyunCaptcha?: (opts: AliyunCaptchaInitOpts) => void;
    SMSdk?: { ready: (fn: () => void) => void; getDeviceId: () => string };
    _smReadyFuncs?: Array<() => void>;
  }
}

export interface AliyunCaptchaResult {
  /** 阿里云盾返回的验证 token，对应 PC 版字段名 lot_number/captcha_output 等不同形式 */
  captchaVerifyParam?: string;
  /** PC 版 form 真正使用的字段。SDK 实际把 verify token 存在 lot_number 字段。 */
  lot_number?: string;
  captcha_output?: string;
  pass_token?: string;
  gen_time?: string;
  [k: string]: unknown;
}

export interface AliyunCaptchaInitOpts {
  SceneId: string;
  mode: 'popup' | 'embed';
  element: string;
  button: string;
  // SDK 回调参数可能是字符串（标准 captchaVerifyParam）或混淆对象（这版的实际行为）
  success: (result: AliyunCaptchaResult | string) => void;
  fail?: (err: unknown) => void;
  getInstance?: (instance: { show: () => void; refresh: () => void }) => void;
  onClose?: () => void;
  language?: string;
  slideStyle?: { width: number | string; height: number };
  rem?: number;
}

let captchaInitPromise: Promise<void> | null = null;

/** 加载 + 初始化阿里云盾。返回拿到 verify result 的 thunk。 */
export function loadAliyunCaptcha(opts: {
  containerId: string;
  buttonId: string;
  onSuccess: (result: AliyunCaptchaResult | string) => void;
  onFail?: (e: unknown) => void;
  onClose?: () => void;
}): Promise<void> {
  if (!captchaInitPromise) {
    captchaInitPromise = loadScript(SDK_URLS.aliyunCaptcha);
  }
  return captchaInitPromise.then(() => {
    window.AliyunCaptchaConfig = {
      region: ALIYUN_CAPTCHA_CONFIG.region,
      prefix: ALIYUN_CAPTCHA_CONFIG.prefix,
    };
    if (!window.initAliyunCaptcha) {
      throw new Error('AliyunCaptcha SDK loaded but initAliyunCaptcha missing');
    }
    window.initAliyunCaptcha({
      SceneId: ALIYUN_CAPTCHA_CONFIG.sceneId,
      mode: 'embed',
      element: `#${opts.containerId}`,
      button: `#${opts.buttonId}`,
      success: opts.onSuccess,
      fail: opts.onFail,
      onClose: opts.onClose,
      language: 'cn',
      slideStyle: { width: '100%', height: 44 },
    });
  });
}

let shumeiReadyPromise: Promise<string> | null = null;

/** 加载数美 SDK 并等待 deviceId 可用。返回的字符串可能是空（SDK 还没拿到指纹时返回 ''）。 */
export function getShumeiDeviceId(): Promise<string> {
  if (!shumeiReadyPromise) {
    shumeiReadyPromise = loadScript(SDK_URLS.shumei).then(
      () =>
        new Promise<string>((resolve) => {
          // SMSdk.ready 会等 fp.min.js 加载并初始化完成后再触发
          const tryResolve = () => {
            const id = window.SMSdk?.getDeviceId?.() ?? '';
            resolve(id);
          };
          if (window.SMSdk?.ready) {
            window.SMSdk.ready(tryResolve);
          } else {
            // smDeviceSdk2 在脚本顶部就建好了 SMSdk shim，但为了保险加个超时兜底
            setTimeout(tryResolve, 1500);
          }
        }),
    );
  }
  return shumeiReadyPromise;
}

/**
 * 从 AliyunCaptchaResult 提取 hupu 后端期望的 aliRid。
 * 这个 SDK 版本回调参数是个字段全混淆的对象（设备指纹包），不是固定 schema，
 * passport 前端实际把整个对象通过 securitycheck 事件原样传出，最终 JSON 提交给后端。
 * 我们这里直接 JSON.stringify 兜底。
 */
export function extractAliRid(r: AliyunCaptchaResult | string): string {
  if (typeof r === 'string') return r;
  if (typeof r.captchaVerifyParam === 'string' && r.captchaVerifyParam) return r.captchaVerifyParam;
  try {
    return JSON.stringify(r);
  } catch {
    return '';
  }
}
