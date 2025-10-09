import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

// 正确的虎扑登录接口
const HUPU_LOGIN_URL = 'https://passport.hupu.com/v3/pc/login/member.action';
const DEFAULT_DEVICE_ID = 'BLt5BDLhLVLjTUoSkAVTMHYmLq/55P9LLM3gmMLhfOk0201cpOMiyEEbOcxMEO3BUgrlSrKMWbAWgM/s9WInq7g==';

function md5(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex');
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
    const { username, password, deviceId, aliRid } = req.body;

    if (!username || !password) {
      res.status(400).json({ success: false, message: '用户名和密码不能为空' });
      return;
    }

    // 构建登录参数
    const loginData = {
      deviceId: deviceId || DEFAULT_DEVICE_ID,
      username,
      password: md5(password),
    };

    // 如果有滑块验证数据，添加到请求中
    if (aliRid) {
      loginData.aliRid = aliRid;
    }

    console.log('Login request:', { ...loginData, password: '***' });

    const response = await fetch(HUPU_LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://passport.hupu.com',
        'Referer': 'https://passport.hupu.com/v2/login',
      },
      body: JSON.stringify(loginData),
    });

    const data = await response.json();
    console.log('Login response:', data);

    // 检查登录是否成功
    if (data.code === 200 || data.status === 200 || data.success) {
      res.status(200)
        .setHeader('Access-Control-Allow-Origin', '*')
        .json({
          success: true,
          data: {
            authToken: data.token || data.authToken || data.data?.token || '',
            userInfo: data.userInfo || data.user || data.data?.userInfo || {
              username: username,
              uid: data.uid || data.data?.uid || '',
            },
          },
          message: '登录成功',
        });
    } else {
      res.status(401)
        .setHeader('Access-Control-Allow-Origin', '*')
        .json({
          success: false,
          message: data.msg || data.message || data.error || '登录失败，请检查用户名和密码',
          code: data.code,
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