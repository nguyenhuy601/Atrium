import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, X } from 'lucide-react';
import AuthPageLayout from '../../components/Auth/AuthPageLayout';
import AuthMarketingAside from '../../components/Auth/AuthMarketingAside';
import { AuthFigmaLoginMobileLogo } from '../../components/Auth/AuthFigmaLoginLayout';
import OneTimeCredentialsModal from '../../components/Auth/OneTimeCredentialsModal';
import BrandPageLoader from '../../components/Shared/BrandPageLoader';
import { authInputError, authInputSurface, authPrimaryButtonClass } from '../../components/Auth/authFieldClasses';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useAppStrings } from '../../locales/appStrings';
import { consumeOneTimeLoginCredentials } from '../../utils/oneTimeLoginCredentials';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoginPage({ landingDemo = false } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const { isDarkMode } = useTheme();
  const { t } = useAppStrings();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oneTimeCreds, setOneTimeCreds] = useState(null);
  const [inviteForgotHint, setInviteForgotHint] = useState(null);

  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  const visualNight = Boolean(isDarkMode);
  const inputBase = authInputSurface(visualNight);
  const inputInvalid = authInputError(visualNight);
  const linkCyan = visualNight ? 'text-cyan-300 hover:text-cyan-200' : 'text-cyan-700 hover:text-cyan-800';
  const showPwdBtn = visualNight
    ? 'text-slate-200 hover:bg-slate-800/80 hover:text-white'
    : 'text-slate-600 hover:bg-slate-200/80 hover:text-slate-900';
  const btnPrimary = authPrimaryButtonClass(visualNight);
  const closeColor = visualNight ? 'text-slate-100' : 'text-slate-700';
  const titleColor = visualNight ? 'text-white' : 'text-slate-900';
  const labelColor = visualNight ? 'text-slate-100' : 'text-slate-800';
  const hintColor = visualNight ? 'text-slate-300' : 'text-slate-600';
  const errorColor = visualNight ? 'text-red-300' : 'text-red-700';

  useEffect(() => {
    const creds = consumeOneTimeLoginCredentials();
    const fromInvite = Boolean(location.state?.fromCompanyInvite);
    const prefillEmail = String(location.state?.prefillEmail || '').trim().toLowerCase();
    const hasTempPassword = Boolean(location.state?.hasTempPassword);
    const alreadyHadAccount = Boolean(location.state?.alreadyHadAccount);

    if (creds) {
      setOneTimeCreds(creds);
      setFormData((prev) => ({
        ...prev,
        email: creds.email || prev.email,
        password: creds.password || prev.password,
      }));
      setInviteForgotHint(null);
    } else if (prefillEmail) {
      setFormData((prev) => ({ ...prev, email: prefillEmail }));
    }

    if (fromInvite && !creds && (alreadyHadAccount || !hasTempPassword)) {
      setInviteForgotHint({ email: prefillEmail });
    }

    if (location.state?.message) {
      toast.success(location.state.message, { id: 'company-invite-flash' });
    }
    if (location.state?.message || location.state?.prefillEmail || fromInvite) {
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (landingDemo || authLoading) return;
    if (oneTimeCreds || inviteForgotHint) return;
    if (isAuthenticated) {
      navigate('/app', { replace: true });
    }
  }, [landingDemo, authLoading, isAuthenticated, navigate, oneTimeCreds, inviteForgotHint]);

  const clearFieldError = (field) => {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: '' } : prev));
  };

  const validateFields = () => {
    const email = formData.email.trim();
    const next = { email: '', password: '' };
    if (!email) next.email = t('login.errEmailRequired');
    else if (!EMAIL_SHAPE.test(email)) next.email = t('login.errEmailInvalid');
    if (!formData.password) next.password = t('login.errPasswordRequired');
    setFieldErrors(next);
    if (next.email) emailInputRef.current?.focus();
    else if (next.password) passwordInputRef.current?.focus();
    return !next.email && !next.password;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (landingDemo) {
      toast(t('login.demoToast'), { icon: '🔒' });
      return;
    }

    if (!validateFields()) return;

    setLoading(true);
    try {
      const result = await login(formData.email.trim(), formData.password);
      if (result?.ok) {
        navigate('/app');
      }
    } finally {
      setLoading(false);
    }
  };

  const forgotHref = inviteForgotHint?.email
    ? `/forgot-password?email=${encodeURIComponent(inviteForgotHint.email)}`
    : formData.email
      ? `/forgot-password?email=${encodeURIComponent(formData.email.trim())}`
      : '/forgot-password';

  if (!landingDemo && !authLoading && isAuthenticated && !oneTimeCreds && !inviteForgotHint) {
    return <BrandPageLoader />;
  }

  const emailDescribedBy = fieldErrors.email ? 'login-email-error' : undefined;
  const passwordDescribedBy = fieldErrors.password ? 'login-password-error' : undefined;

  return (
    <AuthPageLayout
      aside={<AuthMarketingAside nightOwl={visualNight} compact={!landingDemo} />}
      landingDemo={landingDemo}
      nightOwl={visualNight}
      glassCard={!landingDemo}
      showcaseAside={!landingDemo}
    >
      <div className={`relative z-20 w-full max-w-[22rem] pointer-events-auto ${closeColor}`}>
        {!landingDemo ? (
          <Link
            to="/"
            className="absolute -right-1 -top-1 z-[5] flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-inherit transition-[opacity,background] duration-150 ease-in-out hover:bg-[color-mix(in_srgb,currentColor_10%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
            aria-label={t('authLayout.home')}
            title={t('authLayout.home')}
          >
            <X className="h-5 w-5" strokeWidth={2} aria-hidden />
          </Link>
        ) : null}

        {!landingDemo ? <AuthFigmaLoginMobileLogo /> : null}

        <h2
          className={`text-center text-[1.65rem] font-bold tracking-tight sm:text-[1.85rem] ${titleColor}`}
        >
          {t('login.title')}
        </h2>
        <p className={`mt-2 text-center text-sm leading-relaxed ${hintColor}`}>{t('login.subtitle')}</p>

        {inviteForgotHint ? (
          <div
            role="status"
            className={`mt-4 rounded-xl border px-4 py-3 text-sm leading-relaxed ${
              visualNight ? 'border-cyan-500/40 bg-cyan-950/30 text-cyan-100' : 'border-cyan-300 bg-cyan-50 text-cyan-950'
            }`}
          >
            <p className="font-semibold">{t('acceptCompanyInvite.loginNoTempTitle')}</p>
            <p className="mt-1 opacity-95">{t('acceptCompanyInvite.loginNoTempBody')}</p>
            <Link to={forgotHref} className={`mt-2 inline-block font-semibold underline-offset-2 hover:underline ${linkCyan}`}>
              {t('acceptCompanyInvite.loginNoTempCta')}
            </Link>
          </div>
        ) : null}

        <form noValidate onSubmit={handleSubmit} className="relative mt-6 space-y-5">
          <div>
            <label htmlFor="email" className={`mb-2 block text-sm font-semibold ${labelColor}`}>
              {t('login.email')}
            </label>
            <input
              ref={emailInputRef}
              id="email"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value });
                clearFieldError('email');
              }}
              className={fieldErrors.email ? inputInvalid : inputBase}
              placeholder={t('login.placeholderEmail')}
              autoComplete="email"
              aria-invalid={fieldErrors.email ? 'true' : 'false'}
              aria-describedby={emailDescribedBy}
              disabled={loading}
            />
            {fieldErrors.email ? (
              <p id="login-email-error" role="alert" className={`mt-1.5 text-sm leading-snug ${errorColor}`}>
                {fieldErrors.email}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="password" className={`mb-2 block text-sm font-semibold ${labelColor}`}>
              {t('login.password')}
            </label>
            <div className="relative">
              <input
                ref={passwordInputRef}
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value });
                  clearFieldError('password');
                }}
                className={`${fieldErrors.password ? inputInvalid : inputBase} pr-14`}
                autoComplete="current-password"
                aria-invalid={fieldErrors.password ? 'true' : 'false'}
                aria-describedby={passwordDescribedBy}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className={`absolute right-1.5 top-1/2 z-[3] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 ${showPwdBtn}`}
                aria-label={showPassword ? t('login.hide') : t('login.show')}
                aria-pressed={showPassword}
                aria-controls="password"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" strokeWidth={2} aria-hidden />
                ) : (
                  <Eye className="h-5 w-5" strokeWidth={2} aria-hidden />
                )}
              </button>
            </div>
            {fieldErrors.password ? (
              <p id="login-password-error" role="alert" className={`mt-1.5 text-sm leading-snug ${errorColor}`}>
                {fieldErrors.password}
              </p>
            ) : null}
            <div className="mt-2 flex justify-end">
              <Link to={forgotHref} className={`text-sm font-semibold underline-offset-2 hover:underline ${linkCyan}`}>
                {t('login.forgot')}
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-bold !text-white shadow-lg vh-transition disabled:cursor-not-allowed disabled:opacity-60 ${btnPrimary}`}
          >
            {loading ? t('login.submitting') : t('login.submit')}
            {!loading && <ArrowRight className="h-5 w-5 text-white" strokeWidth={2} aria-hidden />}
          </button>
        </form>
      </div>

      <OneTimeCredentialsModal
        open={Boolean(oneTimeCreds)}
        email={oneTimeCreds?.email}
        password={oneTimeCreds?.password}
        onClose={() => setOneTimeCreds(null)}
      />
    </AuthPageLayout>
  );
}

export default LoginPage;
