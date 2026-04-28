import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Phone, Mail, Loader2, ShieldCheck } from 'lucide-react';
import { hupuApi } from '../services/api';
import {
  passportApi,
  loadAliyunCaptcha,
  getShumeiDeviceId,
  extractAliRid,
} from '../services/passport';
import type { UserSession } from '../types';

type LoginTab = 'phone' | 'account';

interface LoginPageProps {
  onBack: () => void;
  onLoginSuccess: (session: UserSession) => void;
}

const CAPTCHA_ELEMENT_ID = 'passport-captcha-element';
const CAPTCHA_BUTTON_ID = 'passport-captcha-button';

const LoginPage: React.FC<LoginPageProps> = ({ onBack, onLoginSuccess }) => {
  const [tab, setTab] = useState<LoginTab>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [smsSent, setSmsSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // 滑块 + 设备指纹
  const [aliRid, setAliRid] = useState('');
  const [captchaReady, setCaptchaReady] = useState(false);
  const [captchaError, setCaptchaError] = useState('');
  const deviceIdRef = useRef<string>('');

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // 加载滑块 + 数美 SDK
  useEffect(() => {
    let cancelled = false;
    loadAliyunCaptcha({
      containerId: CAPTCHA_ELEMENT_ID,
      buttonId: CAPTCHA_BUTTON_ID,
      onSuccess: (result) => {
        if (cancelled) return;
        // 调试用，看 SDK 回调真实形态
        console.log('[captcha success]', result);
        const rid = extractAliRid(result);
        console.log('[captcha aliRid len]', rid.length);
        setAliRid(rid);
        setCaptchaError('');
      },
      onFail: (e) => {
        if (cancelled) return;
        console.error('captcha fail:', e);
        setCaptchaError('滑块校验失败，请重试');
      },
      onClose: () => {
        if (cancelled) return;
      },
    })
      .then(() => {
        if (!cancelled) setCaptchaReady(true);
      })
      .catch((e) => {
        if (!cancelled) {
          console.error('captcha load failed:', e);
          setCaptchaError('滑块组件加载失败，请检查网络或刷新重试');
        }
      });

    getShumeiDeviceId()
      .then((id) => {
        if (!cancelled) deviceIdRef.current = id;
      })
      .catch((e) => console.warn('shumei sdk load failed:', e));

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSendCode = useCallback(async () => {
    const trimmed = phone.trim().replace(/\s/g, '');
    if (!trimmed || countdown > 0) return;
    setError('');
    setLoading(true);
    try {
      const result = await passportApi.sendMobileCode(trimmed);
      if (result.code !== 1000) {
        setError(result.msg || `发送失败 (${result.code})`);
        return;
      }
      setSmsSent(true);
      setCountdown(60);
    } catch (e) {
      console.error(e);
      setError('发送验证码失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [phone, countdown]);

  const handlePhoneLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedPhone = phone.trim().replace(/\s/g, '');
      const trimmedCode = smsCode.trim();
      if (!trimmedPhone || !trimmedCode) return;
      if (!aliRid) {
        setError('请先完成滑块验证');
        return;
      }
      setError('');
      setLoading(true);
      try {
        const result = await passportApi.loginByMobile({
          mobile: trimmedPhone,
          authcode: trimmedCode,
          aliRid,
          deviceId: deviceIdRef.current || '',
        });
        if (result.code !== 1000) {
          setError(result.msg || `登录失败 (${result.code})`);
          // 滑块结果一次性，登录失败需要重新验证
          setAliRid('');
          return;
        }
        // passport 登录态由 .hupu.com cookie 维护，passport 响应不返用户名。
        // 从 cookie u=<uid>|<base64(username)>|... 解析正确的 uid + 昵称。
        const session =
          hupuApi.syncSessionFromCookie() ?? {
            token: '',
            uid: 0,
            puid: 0,
            nickname: trimmedPhone,
            avatar: '',
          };
        if (!session.nickname || session.nickname === trimmedPhone) {
          // cookie 还没就绪兜底用手机号
          hupuApi.saveSession(session);
        }
        onLoginSuccess(session);
      } catch (err) {
        console.error(err);
        setError('登录失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    },
    [phone, smsCode, aliRid, onLoginSuccess],
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="ml-2 text-lg font-semibold text-gray-900">登录虎扑</h1>
        </div>
      </header>

      <div className="max-w-sm mx-auto px-4 pt-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-2xl font-bold">HP</span>
          </div>
          <p className="text-gray-500 text-sm">登录后可参与社区互动</p>
        </div>

        <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
          <button
            onClick={() => {
              setTab('phone');
              setError('');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === 'phone'
                ? 'bg-white text-orange-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Phone className="h-4 w-4" />
            手机号登录
          </button>
          <button
            disabled
            title="虎扑后端对账密登录路径在 web 端做了风控，统一返回 309"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium text-gray-300 cursor-not-allowed"
          >
            <Mail className="h-4 w-4" />
            账密（暂不可用）
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {tab === 'phone' && (
          <form onSubmit={handlePhoneLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">手机号</label>
              <div className="flex gap-2">
                <span className="inline-flex items-center px-3 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-600">
                  +86
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="请输入手机号"
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  maxLength={11}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">滑块验证</label>
              <div
                id={CAPTCHA_ELEMENT_ID}
                className="min-h-[48px] border border-gray-200 rounded-lg bg-white"
              />
              <div id={CAPTCHA_BUTTON_ID} className="hidden" />
              <div className="mt-1.5 text-xs flex items-center gap-1">
                {aliRid ? (
                  <span className="text-emerald-600 inline-flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    已通过验证
                  </span>
                ) : captchaError ? (
                  <span className="text-red-500">{captchaError}</span>
                ) : (
                  <span className="text-gray-400">
                    {captchaReady ? '请拖动滑块完成验证' : '滑块加载中...'}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">验证码</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value)}
                  placeholder="请输入验证码"
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  maxLength={6}
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={!phone.trim() || countdown > 0 || loading}
                  className="px-4 py-2.5 bg-orange-50 text-orange-600 border border-orange-200 rounded-lg text-sm font-medium hover:bg-orange-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {countdown > 0 ? `${countdown}s` : smsSent ? '重新发送' : '获取验证码'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!phone.trim() || !smsCode.trim() || !aliRid || loading}
              className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              登录
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-gray-400">
          登录即表示同意虎扑用户协议和隐私政策
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
