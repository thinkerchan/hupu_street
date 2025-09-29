const DEFAULT_BASE_URL = 'http://localhost';
const MEDIA_HOSTS = new Set([
  'i1.hoopchina.com.cn',
  'i2.hoopchina.com.cn',
  'i3.hoopchina.com.cn',
  'i4.hoopchina.com.cn',
  'i5.hoopchina.com.cn',
  'i6.hoopchina.com.cn',
  'i7.hoopchina.com.cn',
  'i8.hoopchina.com.cn',
  'i9.hoopchina.com.cn',
  'i10.hoopchina.com.cn',
  'i11.hoopchina.com.cn',
  'w1.hoopchina.com.cn',
]);

export function rewriteMediaUrl(url?: string | null): string {
  if (!url) {
    return '';
  }
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : DEFAULT_BASE_URL;
    const parsed = new URL(url, base);
    if (!MEDIA_HOSTS.has(parsed.host)) {
      return parsed.href;
    }
    const match = parsed.host.match(/^(i\d+|w1)\.hoopchina\.com\.cn$/i);
    if (!match) {
      return parsed.href;
    }
    const prefix = match[1].toLowerCase();
    return `/${prefix}${parsed.pathname}${parsed.search}`;
  } catch (error) {
    console.warn('rewriteMediaUrl failed:', error);
    return url;
  }
}

export function rewriteMediaUrls(urls?: string[] | null): string[] {
  if (!Array.isArray(urls)) {
    return [];
  }
  return urls
    .map((item) => {
      const formatted = rewriteMediaUrl(item);
      return formatted || item;
    })
    .filter((item): item is string => Boolean(item));
}

export function rewriteHtmlMedia(html?: string | null): string {
  if (!html) {
    return '';
  }

  return html.replace(/(src|poster)=(["'])(https?:\/\/[^"'\s>]+)\2/gi, (match, attr, quote, originalUrl) => {
    const proxied = rewriteMediaUrl(originalUrl);
    if (proxied && proxied !== originalUrl) {
      return `${attr}=${quote}${proxied}${quote}`;
    }
    return match;
  });
}

const MEDIA_SELECTOR = 'img, video, source';
const MEDIA_ATTRIBUTES: Array<'src' | 'poster' | 'data-src'> = ['src', 'poster', 'data-src'];

function applyProxyToElement(element: Element | null) {
  if (!element) {
    return;
  }
  MEDIA_ATTRIBUTES.forEach((attr) => {
    if (!element.hasAttribute(attr)) {
      return;
    }
    const value = element.getAttribute(attr);
    if (!value) {
      return;
    }
    const proxied = rewriteMediaUrl(value);
    if (proxied && proxied !== value) {
      element.setAttribute(attr, proxied);
    }
  });
}

function scanAndApply(root: ParentNode) {
  if (!(root instanceof Document || root instanceof DocumentFragment || root instanceof Element)) {
    return;
  }
  if (root instanceof Element && root.matches(MEDIA_SELECTOR)) {
    applyProxyToElement(root);
  }
  root.querySelectorAll?.(MEDIA_SELECTOR).forEach((el) => applyProxyToElement(el));
}

declare global {
  interface Window {
    __mediaProxyInitialized?: boolean;
  }
}

export function setupMediaProxy(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  if (window.__mediaProxyInitialized) {
    return;
  }
  const targetNode = document.documentElement || document.body;
  if (!targetNode) {
    return;
  }
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.target instanceof Element) {
        applyProxyToElement(mutation.target);
        return;
      }
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element || node instanceof DocumentFragment) {
          scanAndApply(node);
        }
      });
    });
  });
  scanAndApply(document);
  observer.observe(targetNode, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: MEDIA_ATTRIBUTES,
  });
  window.__mediaProxyInitialized = true;
}
