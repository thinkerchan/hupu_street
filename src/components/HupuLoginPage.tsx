import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { hupuApi } from '../services/api';

interface HupuLoginPageProps {
  onLoginSuccess: (authToken: string, userInfo: any) => void;
  onBack: () => void;
}

// 阿里云滑动验证码类型定义
declare global {
  interface Window {
    AWSC?: any;
    initializeJsonp_09638431964568233?: any;
  }
}

export default function HupuLoginPage({ onLoginSuccess, onBack }: HupuLoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [agreedPolicy, setAgreedPolicy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaSessionId, setCaptchaSessionId] = useState('');
  const [captchaSig, setCaptchaSig] = useState('');
  const [captchaLoaded, setCaptchaLoaded] = useState(false);
  const captchaRef = useRef<any>(null);

  // 加载阿里云滑动验证码
  useEffect(() => {
    let mounted = true;
    let checkInterval: NodeJS.Timeout | null = null;

    // 加载阿里云 NC 脚本
    const loadCaptcha = () => {
      // 检查是否已经初始化过
      if (captchaRef.current) {
        console.log('Captcha already initialized');
        return;
      }

      if (document.getElementById('nc-script')) {
        // 脚本已存在，等待加载完成
        checkInterval = setInterval(() => {
          if (!mounted) {
            checkInterval && clearInterval(checkInterval);
            return;
          }
          if (window.AWSC) {
            checkInterval && clearInterval(checkInterval);
            initCaptcha();
          }
        }, 100);

        // 10秒超时
        setTimeout(() => {
          if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
          }
          if (mounted && !window.AWSC) {
            console.error('AWSC load timeout');
            setError('验证码加载超时，请刷新页面重试');
          }
        }, 10000);
        return;
      }

      const script = document.createElement('script');
      script.id = 'nc-script';
      script.src = 'https://g.alicdn.com/AWSC/AWSC/awsc.js';
      script.async = true;
      script.onload = () => {
        console.log('AWSC script loaded');
        // 等待一小段时间确保 AWSC 对象完全初始化
        setTimeout(() => {
          if (mounted && window.AWSC) {
            initCaptcha();
          } else if (mounted) {
            console.error('AWSC object not initialized after script load');
            setError('验证码初始化失败，请刷新页面重试');
          }
        }, 100);
      };
      script.onerror = () => {
        if (mounted) {
          console.error('Failed to load AWSC script');
          setError('验证码加载失败，请刷新页面重试');
        }
      };
      document.body.appendChild(script);
    };

    const initCaptcha = () => {
      if (!mounted) return;
      if (captchaRef.current) {
        console.log('Captcha already exists, skipping init');
        return;
      }
      if (!window.AWSC) {
        console.error('AWSC not available');
        return;
      }

      try {
        // 虎扑的 appkey
        const appkey = 'FFFF0N00000000000B27';
        const scene = 'nc_login';

        console.log('Initializing captcha with appkey:', appkey, 'scene:', scene);

        const nc = window.AWSC.use('nc', {
          renderTo: '#captcha-container',
          appkey: appkey,
          scene: scene,
          language: 'cn',
          // 启用二次验证（关键配置）
          trans: { key1: 'code200' },
          elementID: ['captcha-container'],
          is_Opt: 0,
          // 滑块图片
          elements: [
            '//img.alicdn.com/tfs/TB17cwllsLJ8KJjy0FnXXcFDpXa-50-74.png',
            '//img.alicdn.com/tfs/TB17cwllsLJ8KJjy0FnXXcFDpXa-50-74.png'
          ],
          // 文案配置
          upLang: {
            cn: {
              LOADING: '加载中...',
              SLIDE_TEXT: '请向右滑动验证',
              SUCCESS: '验证通过',
              ERROR: '验证失败，请重试',
              FAIL: '验证失败，请重试'
            }
          },
          // 滑动完成回调
          callback: async (data: any) => {
            if (!mounted) return;
            console.log('=== Captcha callback triggered ===');
            console.log('Captcha callback (after slide):', data);
            console.log('Data keys:', Object.keys(data));

            // 滑动成功后，手动调用 analyze.jsonp 获取最终验证结果
            try {
              const token = data.token || '';
              const sessionId = data.sessionId || data.csessionid || '';
              const sig = data.sig || '';

              console.log('Preparing analyze request with:', { token, sessionId, sig });

              if (!sig) {
                console.error('No sig found in callback data, cannot proceed with analyze');
                setError('验证数据异常，请重试');
                return;
              }

              // 构建 analyze.jsonp 请求参数
              // 参考虎扑官网的请求格式
              const analyzeParams = new URLSearchParams({
                a: appkey,
                t: `${appkey}:${scene}:${Date.now()}:${Math.random()}`,
                n: sig, // 这是滑动后生成的签名数据
                p: JSON.stringify({
                  ncbtn: data.ncbtn || '',
                  umidToken: data.umidToken || '',
                  ncSessionID: sessionId,
                  et: '1'
                }),
                scene: scene,
                asyn: '0',
                lang: 'cn',
                v: '1',
                callback: `jsonp_${Math.random().toString().slice(2)}`
              });

              const analyzeUrl = `https://cf.aliyun.com/nocaptcha/analyze.jsonp?${analyzeParams.toString()}`;
              console.log('Calling analyze URL:', analyzeUrl);

              // 使用 JSONP 方式调用
              const callbackName = analyzeParams.get('callback')!;

              await new Promise((resolve, reject) => {
                // 定义全局回调
                (window as any)[callbackName] = (result: any) => {
                  console.log('=== Analyze JSONP response received ===');
                  console.log('Analyze response:', result);

                  if (result.success && result.result) {
                    const aliRidValue = result.result.value || '';
                    const csessionid = result.result.csessionid || '';

                    console.log('Got aliRid from analyze:', aliRidValue);
                    console.log('Got csessionid from analyze:', csessionid);

                    if (aliRidValue) {
                      console.log('Setting captcha state with aliRid');
                      setCaptchaToken(token);
                      setCaptchaSessionId(csessionid);
                      setCaptchaSig(aliRidValue);
                      setCaptchaLoaded(true);
                      console.log('Captcha state updated successfully');
                      resolve(result);
                    } else {
                      console.error('No value in analyze response');
                      reject(new Error('No value in analyze response'));
                    }
                  } else {
                    console.error('Analyze failed, result:', result);
                    reject(new Error('Analyze failed'));
                  }

                  // 清理
                  delete (window as any)[callbackName];
                };

                // 创建 script 标签发起 JSONP 请求
                const script = document.createElement('script');
                script.src = analyzeUrl;
                script.onerror = () => {
                  console.error('Failed to load analyze script');
                  delete (window as any)[callbackName];
                  reject(new Error('Failed to load analyze script'));
                };
                document.body.appendChild(script);
                console.log('Analyze script tag added to DOM');

                // 请求完成后移除 script
                setTimeout(() => {
                  if (document.body.contains(script)) {
                    document.body.removeChild(script);
                  }
                }, 5000);
              });

            } catch (err) {
              console.error('Analyze request failed:', err);
              setError('验证失败，请重试');
            }
          },
          // 这个 success 回调会在滑动完成后被 SDK 调用
          success: async (data: any) => {
            if (!mounted) return;
            console.log('=== Captcha success callback triggered ===');
            console.log('Captcha success (SDK callback), full data:', data);
            console.log('Data keys:', Object.keys(data));

            // 滑动成功后，手动调用 analyze.jsonp 获取最终验证结果
            try {
              const token = data.token || '';
              const sessionId = data.sessionId || data.csessionid || '';
              const sig = data.sig || '';

              console.log('Preparing analyze request with:', { token, sessionId, sig });

              if (!sig) {
                console.error('No sig found in success data, cannot proceed with analyze');
                setError('验证数据异常，请重试');
                return;
              }

              // 构建 analyze.jsonp 请求参数
              // 参考虎扑官网的请求格式
              const analyzeParams = new URLSearchParams({
                a: appkey,
                t: `${appkey}:${scene}:${Date.now()}:${Math.random()}`,
                n: sig, // 这是滑动后生成的签名数据
                p: JSON.stringify({
                  ncbtn: data.ncbtn || '',
                  umidToken: data.umidToken || '',
                  ncSessionID: sessionId,
                  et: '1'
                }),
                scene: scene,
                asyn: '0',
                lang: 'cn',
                v: '1',
                callback: `jsonp_${Math.random().toString().slice(2)}`
              });

              const analyzeUrl = `https://cf.aliyun.com/nocaptcha/analyze.jsonp?${analyzeParams.toString()}`;
              console.log('Calling analyze URL:', analyzeUrl);

              // 使用 JSONP 方式调用
              const callbackName = analyzeParams.get('callback')!;

              await new Promise((resolve, reject) => {
                // 定义全局回调
                (window as any)[callbackName] = (result: any) => {
                  console.log('=== Analyze JSONP response received ===');
                  console.log('Analyze response:', result);

                  if (result.success && result.result) {
                    const aliRidValue = result.result.value || '';
                    const csessionid = result.result.csessionid || '';

                    console.log('Got aliRid from analyze:', aliRidValue);
                    console.log('Got csessionid from analyze:', csessionid);

                    if (aliRidValue) {
                      console.log('Setting captcha state with aliRid');
                      setCaptchaToken(token);
                      setCaptchaSessionId(csessionid);
                      setCaptchaSig(aliRidValue);
                      setCaptchaLoaded(true);
                      console.log('Captcha state updated successfully');
                      resolve(result);
                    } else {
                      console.error('No value in analyze response');
                      reject(new Error('No value in analyze response'));
                    }
                  } else {
                    console.error('Analyze failed, result:', result);
                    reject(new Error('Analyze failed'));
                  }

                  // 清理
                  delete (window as any)[callbackName];
                };

                // 创建 script 标签发起 JSONP 请求
                const script = document.createElement('script');
                script.src = analyzeUrl;
                script.onerror = () => {
                  console.error('Failed to load analyze script');
                  delete (window as any)[callbackName];
                  reject(new Error('Failed to load analyze script'));
                };
                document.body.appendChild(script);
                console.log('Analyze script tag added to DOM');

                // 请求完成后移除 script
                setTimeout(() => {
                  if (document.body.contains(script)) {
                    document.body.removeChild(script);
                  }
                }, 5000);
              });

            } catch (err) {
              console.error('Analyze request failed:', err);
              setError('验证失败，请重试');
            }
          },
          // 验证通过回调（在 analyze 接口返回后触发）
          verified: (data: any) => {
            if (!mounted) return;
            console.log('Captcha verified, data:', data);
          },
          fail: (data: any) => {
            if (!mounted) return;
            console.log('Captcha fail:', data);
            setError('验证失败，请重试');
          },
          error: (data: any) => {
            if (!mounted) return;
            console.error('Captcha error:', data);
            setError('验证码出错，请刷新重试');
          }
        });

        captchaRef.current = nc;
        console.log('NC initialized successfully, instance:', nc);

        // 尝试手动显示验证码（如果有 show 方法）
        if (nc && typeof nc.reset === 'function') {
          setTimeout(() => {
            try {
              nc.reset();
              console.log('Captcha reset called');
            } catch (e) {
              console.log('Reset not needed or failed:', e);
            }
          }, 200);
        }
      } catch (err) {
        if (mounted) {
          console.error('Init captcha error:', err);
          setError('验证码初始化失败');
        }
      }
    };

    loadCaptcha();

    return () => {
      mounted = false;
      if (checkInterval) {
        clearInterval(checkInterval);
      }
      if (captchaRef.current && captchaRef.current.destroy) {
        try {
          captchaRef.current.destroy();
          captchaRef.current = null;
        } catch (err) {
          console.error('Error destroying captcha:', err);
        }
      }
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('请输入账号和密码');
      return;
    }

    if (!agreedPolicy) {
      setError('请阅读并同意用户协议和隐私条款');
      return;
    }

    if (!captchaSig) {
      setError('请完成滑动验证');
      return;
    }

    setLoading(true);

    try {
      // aliRid 直接使用验证码返回的 value/sig
      const aliRid = captchaSig;
      const deviceId = 'BLt5BDLhLVLjTUoSkAVTMHYmLq/55P9LLM3gmMLhfOk0201cpOMiyEEbOcxMEO3BUgrlSrKMWbAWgM/s9WInq7g==';

      console.log('=== Preparing login request ===');
      console.log('Login with captcha data:', {
        username,
        aliRid,
        aliRidLength: aliRid.length,
        deviceId,
      });
      console.log('Full captcha state:', {
        captchaToken,
        captchaSessionId,
        captchaSig,
      });

      const result = await hupuApi.login(username, password, deviceId, aliRid);

      console.log('=== Login response ===');
      console.log('Login result:', result);

      if (result.success && result.data) {
        localStorage.setItem('hupu_auth_token', result.data.authToken);
        localStorage.setItem('hupu_user_info', JSON.stringify(result.data.userInfo));
        onLoginSuccess(result.data.authToken, result.data.userInfo);
      } else {
        setError(result.message || '登录失败');
        // 重置验证码
        if (captchaRef.current && captchaRef.current.reset) {
          captchaRef.current.reset();
        }
        setCaptchaToken('');
        setCaptchaSessionId('');
        setCaptchaSig('');
        setCaptchaLoaded(false);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('网络错误，请稍后重试');
      // 重置验证码
      if (captchaRef.current && captchaRef.current.reset) {
        captchaRef.current.reset();
      }
      setCaptchaToken('');
      setCaptchaSessionId('');
      setCaptchaSig('');
      setCaptchaLoaded(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 relative overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1920&q=80)',
        }}
      />

      {/* Back Button */}
      <button
        onClick={onBack}
        className="absolute top-6 left-6 z-20 flex items-center gap-2 text-white hover:text-orange-400 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>返回</span>
      </button>

      {/* Login Card */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-500 rounded-2xl mb-4 shadow-lg">
              <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">登录虎扑账号</h1>
            <p className="text-gray-400">欢迎回到步行街</p>
          </div>

          {/* Login Form Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Username */}
              <div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="账号"
                  maxLength={50}
                  disabled={loading}
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              {/* Password */}
              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="密码"
                  maxLength={50}
                  disabled={loading}
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              {/* Captcha - 阿里云滑动验证 */}
              <div>
                <div className="relative" style={{ minHeight: '80px' }}>
                  <div
                    id="captcha-container"
                    className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                  />
                  {/* {!captchaLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500 bg-gray-50 rounded-lg pointer-events-none">
                      <svg className="animate-spin h-5 w-5 mr-2 text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      正在加载验证码...
                    </div>
                  )} */}
                </div>
                {captchaLoaded && (
                  <div className="mt-2 text-xs text-green-600 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    验证成功
                  </div>
                )}
              </div>

              {/* Policy Agreement */}
              <div data-desc="policy-agreement">
                <label className="flex items-start gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={agreedPolicy}
                    onChange={(e) => setAgreedPolicy(e.target.checked)}
                    disabled={loading}
                    className="mt-1 w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500 disabled:cursor-not-allowed"
                  />
                  <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                    我已阅读并同意
                    <a
                      href="https://www.hupu.com/policies/user"
                      target="_blank"
                      rel="noreferrer"
                      className="text-orange-500 hover:text-orange-600 mx-1"
                    >
                      《虎扑用户协议》
                    </a>
                    及
                    <a
                      href="https://www.hupu.com/policies/privacy?from=newpc"
                      target="_blank"
                      rel="noreferrer"
                      className="text-orange-500 hover:text-orange-600 mx-1"
                    >
                      《隐私条款》
                    </a>
                  </span>
                </label>
              </div>

              {/* Login Button */}
              <button
                type="submit"

                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3.5 rounded-lg transition-all shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    登录中...
                  </span>
                ) : (
                  '登 录'
                )}
              </button>
            </form>

            {/* Other Login Methods */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-2 px-4 py-2 text-gray-400 cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17 2H7C5.34 2 4 3.34 4 5v14c0 1.66 1.34 3 3 3h10c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3zm-5 18c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm5-4H7V5h10v11z"/>
                  </svg>
                  手机验证码登录
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-2 px-4 py-2 text-gray-400 cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.1 13.8c.3 0 .5.2.5.5v2.4c0 .3-.2.5-.5.5s-.5-.2-.5-.5v-2.4c0-.3.2-.5.5-.5zM20.8 7.5c-.1-.6-.4-1.1-.9-1.5-.5-.4-1.1-.6-1.7-.5L12 7.1 5.8 5.5c-.6-.1-1.2.1-1.7.5-.5.4-.8.9-.9 1.5l-1 8.6c-.1.6.1 1.2.5 1.7.4.5.9.8 1.5.9l8.3 1.5c.1 0 .3 0 .4 0l8.3-1.5c.6-.1 1.1-.4 1.5-.9.4-.5.6-1.1.5-1.7l-1-8.6zm-8.8 1.2l3.9-.9v2.9c0 .9-.7 1.6-1.6 1.6h-2.3V9.7zm-2 7.5l-5.5-1c-.3-.1-.5-.2-.7-.4-.2-.2-.3-.5-.2-.8l.8-6.8 5.6 1.3v7.7zm10 1l-5.5 1V10l5.6-1.3.8 6.8c.1.3 0 .6-.2.8-.2.2-.4.3-.7.4z"/>
                  </svg>
                  QQ登录
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center text-sm text-gray-400">
            <p>提示：使用虎扑账号密码登录</p>
            <p className="text-xs mt-1">使用阿里云滑动验证保护账户安全</p>
          </div>
        </div>
      </div>
    </div>
  );
}