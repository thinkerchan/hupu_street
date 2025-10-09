import crypto from 'crypto';

const username = '13824418699';
const password = 'testdog001%';
const HUPU_SALT = 'HUPU_SALT_AKJfoiwer394Jeiow4u309';
const HUPU_APP_LOGIN_URL = 'https://games.mobileapi.hupu.com/1/7.5.57/bplapi/user/v1/loginByEmailPassword';

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function generateSign(params) {
  const sortedKeys = Object.keys(params).sort();
  const queryString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
  const stringToSign = queryString + HUPU_SALT;
  console.log('String to sign:', stringToSign);
  return md5(stringToSign);
}

async function testLogin() {
  const timeline = Math.floor(Date.now() / 1000).toString();
  const crt = Date.now().toString();

  const params = {
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

  console.log('Password MD5:', params.password);
  params.sign = generateSign(params);
  console.log('Sign:', params.sign);

  const formData = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    formData.append(key, value);
  });

  console.log('\nSending request to:', HUPU_APP_LOGIN_URL);
  console.log('Form data:', formData.toString());

  try {
    const response = await fetch(HUPU_APP_LOGIN_URL, {
      method: 'POST',
      headers: {
        'Host': 'games.mobileapi.hupu.com',
        'user-agent': 'Mozilla/5.0 (Linux; Android 10; Redmi Note 8 Pro Build/QP1A.190711.020; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/83.0.4103.101 Mobile Safari/537.36 kanqiu/7.5.57.12101/9095 isp/1 network/0',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await response.json();
    console.log('\nResponse:', JSON.stringify(data, null, 2));

    if (data.result && data.result.authToken) {
      console.log('\n✅ Login successful!');
      console.log('Auth Token:', data.result.authToken);
      console.log('User Info:', JSON.stringify(data.result.userInfo, null, 2));
    } else {
      console.log('\n❌ Login failed:', data.msg || data.message);
    }
  } catch (error) {
    console.error('\n❌ Request failed:', error);
  }
}

testLogin();