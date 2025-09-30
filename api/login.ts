import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const HUPU_APP_LOGIN_URL = 'https://games.mobileapi.hupu.com/1/7.5.57/bplapi/user/v1/loginByEmailPassword';
const HUPU_SALT = 'HUPU_SALT_AKJfoiwer394Jeiow4u309';
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Linux; Android 10; Redmi Note 8 Pro Build/QP1A.190711.020; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/83.0.4103.101 Mobile Safari/537.36 kanqiu/7.5.57.12101/9095 isp/1 network/0';

function md5(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex');
}

function generateSign(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  const queryString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
  const stringToSign = queryString + HUPU_SALT;
  return md5(stringToSign);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(200)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      .end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ success: false, message: '用户名和密码不能为空' });
      return;
    }

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

    params.sign = generateSign(params);

    const formData = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const response = await fetch(HUPU_APP_LOGIN_URL, {
      method: 'POST',
      headers: {
        'Host': 'games.mobileapi.hupu.com',
        'user-agent': DEFAULT_USER_AGENT,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await response.json();

    console.log('Login response:', data);

    if (data.result && data.result.authToken) {
      res.status(200)
        .setHeader('Access-Control-Allow-Origin', '*')
        .json({
          success: true,
          data: {
            authToken: data.result.authToken,
            userInfo: data.result.userInfo || {},
          },
          message: '登录成功',
        });
    } else {
      res.status(401)
        .setHeader('Access-Control-Allow-Origin', '*')
        .json({
          success: false,
          message: data.msg || data.message || '登录失败，请检查用户名和密码',
        });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500)
      .setHeader('Access-Control-Allow-Origin', '*')
      .json({
        success: false,
        message: '登录请求失败，请稍后重试',
      });
  }
}