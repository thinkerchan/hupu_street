import CryptoJS from 'crypto-js';

const HUPU_SALT = 'HUPU_SALT_AKJfoiwer394Jeiow4u309';

export function md5(str: string): string {
  return CryptoJS.MD5(str).toString();
}

// 生成APP登录参数（用于移动端API）
export function generateLoginParams(username: string, password: string) {
  const timeline = Math.floor(Date.now() / 1000).toString();
  const crt = Date.now().toString();

  const params: Record<string, string> = {
    password: md5(password),
    timeline,
    username,
    clientId: '108774952',
    crt,
    night: '0',
    channel: 'error',
    client: '4c8f6a75d094a7a0',
    _ssid: 'PHVua25vd24gc3NpZD4=',
    _imei: '4c8f6a75d094a7a0',
    android_id: '4c8f6a75d094a7a0',
    time_zone: 'Asia/Shanghai',
    deviceId: 'BwEHDqdUu5BalI0Qujc05T5UKzTEHxYirVOU+MQFqzfxxLE2oqV6+kGvGwggv9jZWBwDQrg2C6HC7f1aJIwA00A==',
    oaid: '63c82ca94bbeecb0',
  };

  // Generate sign
  const sortedKeys = Object.keys(params).sort();
  const queryString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
  const stringToSign = queryString + HUPU_SALT;
  params.sign = md5(stringToSign);

  return params;
}

// 生成Web登录参数（用于网页版）
export function generateWebLoginParams(username: string, password: string) {
  return {
    account: username,
    password: md5(password),
    remember: '1',
  };
}