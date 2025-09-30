export const normalizeDate = (
  input: string | number | Date | null | undefined,
): Date | null => {
  if (!input) {
    return null;
  }

  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }

  if (typeof input === 'number') {
    const timestamp = input < 1e12 ? input * 1000 : input;
    const dateFromNumber = new Date(timestamp);
    return Number.isNaN(dateFromNumber.getTime()) ? null : dateFromNumber;
  }

  const value = String(input).trim();
  if (!value) {
    return null;
  }

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const replaced = new Date(value.replace(/-/g, '/'));
  if (!Number.isNaN(replaced.getTime())) {
    return replaced;
  }

  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    const timestamp = value.length === 10 ? numeric * 1000 : numeric;
    const fromNumeric = new Date(timestamp);
    if (!Number.isNaN(fromNumeric.getTime())) {
      return fromNumeric;
    }
  }

  return null;
};

export const formatRelativeTime = (
  input: string | number | Date | null | undefined,
  fallback = '',
): string => {
  if (!input) {
    return fallback;
  }

  const date = normalizeDate(input);
  if (!date) {
    if (typeof input === 'string' && input.trim()) {
      return input;
    }
    return fallback;
  }

  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 0) {
    return date.toLocaleDateString('zh-CN');
  }

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString('zh-CN');
};

export const formatDateTime = (
  input: string | number | Date | null | undefined,
  locale = 'zh-CN',
): string => {
  const date = normalizeDate(input);
  if (!date) {
    return '';
  }
  return date.toLocaleString(locale);
};

export const formatCount = (value: number | null | undefined): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '0';
  }

  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`;
  }

  return value.toLocaleString();
};
