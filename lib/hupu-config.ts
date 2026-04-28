/**
 * 虎扑相关配置的单一来源（Single Source of Truth）。
 *
 * 任何对虎扑请求伪装的调整 —— UA、Origin、Referer、cookie 处理、host 变更、
 * SDK URL、协议常量（签名盐、RSA 公钥、API 版本路径）—— 都只在这里改一次。
 *
 * 三个使用方都从这里 import：
 *  - vite.config.ts（dev proxy）
 *  - api/*.ts（vercel function 生产代理）
 *  - src/services/*.ts（前端运行时调用）
 */

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
  /** 登录、短信、滑块。passport.hupu.com */
  passport: {
    name: 'passport',
    prefix: '/passport',
    origin: 'https://passport.hupu.com',
    userAgent: DESKTOP_UA,
    referer: 'https://passport.hupu.com/v2/login',
    injectOrigin: true,
    rewriteCookies: true,
  },
  /** PC web 互动接口（点亮 / 取消亮 / 发回复 / 收藏等）。bbs.hupu.com */
  bbsPc: {
    name: 'bbs-pc',
    prefix: '/bbs-pc',
    origin: 'https://bbs.hupu.com',
    userAgent: DESKTOP_UA,
    referer: { template: 'tid', base: 'https://bbs.hupu.com' },
    injectOrigin: true,
    rewriteCookies: true,
  },
  /** APK 兼容接口（games-api 域）。当前主要用作历史回退。 */
  gamesApi: {
    name: 'games-api',
    prefix: '/games-api',
    origin: 'https://games.mobileapi.hupu.com',
    userAgent: APK_UA,
  },
  /** m 站只读接口（帖子列表、详情、搜索）。m.hupu.com */
  m: {
    name: 'm',
    prefix: '/hupu',
    origin: 'https://m.hupu.com',
    userAgent: DESKTOP_UA,
    referer: 'https://m.hupu.com/bbs/all-gambia',
    injectOrigin: true,
  },
} as const satisfies Record<string, HupuProxyEntry>;

export type HupuProxyKey = keyof typeof HUPU_PROXIES;

/** 第三方 SDK 资源。 */
export const SDK_URLS = {
  aliyunCaptcha: 'https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js',
  shumei: 'https://w1.hoopchina.com.cn/bbs/js/smDeviceSdk2.js',
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
