import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Loader2, MailCheck } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { authAPI, tokenManager, userManager } from '../lib/auth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Alert, AlertDescription } from '../components/ui/Alert';
import Turnstile from '../components/common/Turnstile';

const toTimestamp = (value) => {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
};

const getSessionValue = (key) => {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(key);
};

const VerifyEmailPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get('token');
  const returnParam = searchParams.get('return');

  const initialEmail = useMemo(() => {
    return searchParams.get('email')
      || getSessionValue('pending_verification_email')
      || userManager.getUser()?.email
      || '';
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    watch,
    formState: { errors }
  } = useForm({
    defaultValues: {
      email: initialEmail,
      code: ''
    }
  });

  useEffect(() => {
    if (initialEmail) {
      setValue('email', initialEmail);
    }
  }, [initialEmail, setValue]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tokenHandled, setTokenHandled] = useState(false);
  const [tokenStatus, setTokenStatus] = useState(tokenParam ? 'pending' : 'idle');
  const [status, setStatus] = useState(null);
  const [resendAvailableAt, setResendAvailableAt] = useState(() => toTimestamp(getSessionValue('verification_resend_available_at')));
  const [resendCountdown, setResendCountdown] = useState(0);
  const turnstileRef = useRef(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const requiresTurnstile = Boolean(import.meta.env?.VITE_TURNSTILE_SITE_KEY);

  const emailValue = watch('email');

  const processVerifiedSession = useCallback((payload) => {
    const token = payload?.token;
    const user = payload?.user;

    if (token) {
      tokenManager.setToken(token);
    }
    if (user) {
      userManager.setUser(user);
    }

    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('pending_verification_email');
      sessionStorage.removeItem('verification_resend_available_at');
      const storedReturn = sessionStorage.getItem('verification_return_path');
      sessionStorage.removeItem('verification_return_path');
      const target = returnParam || storedReturn || '/dashboard';
      navigate(target, { replace: true });
    } else {
      navigate(returnParam || '/dashboard', { replace: true });
    }
  }, [navigate, returnParam]);

  useEffect(() => {
    if (!resendAvailableAt) {
      setResendCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const diff = resendAvailableAt - Date.now();
      if (diff <= 0) {
        setResendCountdown(0);
        setResendAvailableAt(null);
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('verification_resend_available_at');
        }
      } else {
        setResendCountdown(diff);
      }
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [resendAvailableAt]);

  useEffect(() => {
    if (tokenParam && !tokenHandled) {
      const verifyWithToken = async () => {
        setTokenStatus('pending');
        setIsSubmitting(true);
        setStatus(null);
        try {
          const response = await authAPI.verifyEmail({ token: tokenParam });
          if (response.success) {
            toast.success(t('auth.verification.tokenSuccess'));
            processVerifiedSession(response.data);
          } else {
            setTokenStatus('failed');
            const message = response.message || t('auth.verification.tokenFailed');
            setStatus({ variant: 'destructive', message });
            toast.error(message);
          }
        } catch (error) {
          setTokenStatus('failed');
          const message = error?.response?.data?.message || error.message || t('auth.verification.tokenFailed');
          setStatus({ variant: 'destructive', message });
          toast.error(message);
        } finally {
          setIsSubmitting(false);
          setTokenHandled(true);
        }
      };

      verifyWithToken();
    }
  }, [processVerifiedSession, t, tokenHandled, tokenParam]);

  const ensureTurnstile = () => {
    if (requiresTurnstile && !turnstileToken) {
      const message = t('auth.verification.turnstileRequired');
      setStatus({ variant: 'warning', message });
      toast.error(message);
      return false;
    }
    return true;
  };

  const resetTurnstile = () => {
    setTurnstileToken('');
    turnstileRef.current?.reset?.();
  };

  const handleManualVerify = async (values) => {
    const email = values.email.trim();
    const code = values.code.trim();

    if (!email) {
      setStatus({ variant: 'warning', message: t('auth.verification.emailRequired') });
      return;
    }
    if (!code) {
      setStatus({ variant: 'warning', message: t('auth.verification.codeRequired') });
      return;
    }

    if (!ensureTurnstile()) {
      return;
    }

    setIsSubmitting(true);
    setStatus(null);

    try {
      const response = await authAPI.verifyEmail({ email, code, cf_turnstile_response: turnstileToken });
      if (response.success) {
        toast.success(t('auth.verification.codeSuccess'));
        processVerifiedSession(response.data);
      } else {
        const message = response.message || t('auth.verification.codeFailed');
        setStatus({ variant: 'destructive', message });
        toast.error(message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || error.message || t('auth.verification.codeFailed');
      setStatus({ variant: 'destructive', message });
      toast.error(message);
    } finally {
      resetTurnstile();
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    const email = getValues('email').trim();
    if (!email) {
      setStatus({ variant: 'warning', message: t('auth.verification.emailRequired') });
      return;
    }

    if (!ensureTurnstile()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authAPI.sendVerificationCode({ email, cf_turnstile_response: turnstileToken });
      if (response.success) {
        const meta = response.data || {};
        const nextAt = toTimestamp(meta.verification_resend_available_at);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('pending_verification_email', email);
          if (meta.verification_resend_available_at) {
            sessionStorage.setItem('verification_resend_available_at', meta.verification_resend_available_at);
          } else {
            sessionStorage.removeItem('verification_resend_available_at');
          }
        }
        setResendAvailableAt(nextAt);
        const message = response.message || t('auth.verification.resendSuccess');
        setStatus({ variant: 'info', message });
        toast.success(message);
      } else {
        const message = response.message || t('auth.verification.tokenFailed');
        setStatus({ variant: 'destructive', message });
        toast.error(message);
      }
    } catch (error) {
        const message = error?.response?.data?.message || error.message || t('auth.verification.tokenFailed');
        setStatus({ variant: 'destructive', message });
        toast.error(message);
      } finally {
      resetTurnstile();
        setIsSubmitting(false);
      }
    };

  const resendDisabled = isSubmitting
    || (resendAvailableAt !== null && resendAvailableAt > Date.now())
    || (requiresTurnstile && !turnstileToken);
  const secondsRemaining = Math.max(0, Math.ceil(resendCountdown / 1000));

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <MailCheck className="h-6 w-6 text-green-600" />
              <CardTitle>{t('auth.verification.title')}</CardTitle>
            </div>
            <CardDescription>
              {t('auth.verification.description', { email: emailValue || t('auth.verification.yourEmail') })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tokenStatus === 'pending' && (
              <Alert variant="info">
                <AlertDescription className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('auth.verification.tokenVerifying')}
                </AlertDescription>
              </Alert>
            )}

            {status?.message && (
              <Alert variant={status.variant || 'info'}>
                <AlertDescription>{status.message}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit(handleManualVerify)} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground" htmlFor="email">
                  {t('auth.verification.emailLabel')}
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t('auth.verification.emailPlaceholder')}
                  {...register('email', { required: t('auth.verification.emailRequired') })}
                />
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground" htmlFor="code">
                  {t('auth.verification.codeLabel')}
                </label>
                <Input
                  id="code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  {...register('code', {
                    required: t('auth.verification.codeRequired'),
                    pattern: {
                      value: /^\d{6}$/,
                      message: t('auth.verification.codePattern')
                    }
                  })}
                />
                {errors.code && (
                  <p className="text-sm text-red-600">{errors.code.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Turnstile
                  ref={turnstileRef}
                  className="flex justify-center"
                  require={requiresTurnstile}
                  onVerify={(token) => setTurnstileToken(token)}
                  onExpire={() => setTurnstileToken('')}
                  onError={() => setTurnstileToken('')}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || (requiresTurnstile && !turnstileToken)}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('auth.verification.submitting')}
                  </span>
                ) : (
                  t('auth.verification.submit')
                )}
              </Button>
            </form>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <Button
                variant="outline"
                onClick={handleResend}
                disabled={resendDisabled}
              >
                {resendDisabled && secondsRemaining > 0
                  ? t('auth.verification.resendCountdown', { seconds: secondsRemaining })
                  : t('auth.verification.resend')}
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate('/auth/login')}
              >
                {t('auth.verification.backToLogin')}
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              {t('auth.verification.helper')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
