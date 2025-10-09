import express from 'express';
import crypto from 'crypto';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 通过前端代理调用，前端会将 /passport 代理到 https://passport.hupu.com
const HUPU_LOGIN_PATH = '/v3/pc/login/member.action';
const DEFAULT_DEVICE_ID = 'BLt5BDLhLVLjTUoSkAVTMHYmLq/55P9LLM3gmMLhfOk0201cpOMiyEEbOcxMEO3BUgrlSrKMWbAWgM/s9WInq7g==';

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

app.post('/api/login', async (req, res) => {
  try {
    const { username, password, deviceId, aliRid } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
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

    // 直接调用虎扑 API（不经过 Vite 代理）
    const response = await fetch('https://passport.hupu.com/v3/pc/login/member.action', {
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
    console.log('Login response status:', response.status);
    console.log('Login response:', data);

    // 检查登录是否成功
    if (data.code === 200 || data.status === 200 || data.success) {
      res.json({
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
      res.status(401).json({
        success: false,
        message: data.msg || data.message || data.error || '登录失败，请检查用户名和密码',
        code: data.code,
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: '登录请求失败，请稍后重试',
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Dev API server running on http://localhost:${PORT}`);
  console.log(`📝 Login endpoint: http://localhost:${PORT}/api/login`);
  console.log(`🔗 Using Hupu API: https://passport.hupu.com${HUPU_LOGIN_PATH}`);
});