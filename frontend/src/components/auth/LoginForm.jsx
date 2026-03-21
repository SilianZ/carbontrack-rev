import React, { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Fingerprint } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { authAPI, getReturnUrl, getValidationRules } from '../../lib/auth';
import { 
  IS_PASSKEY_ENABLED, 
  getPasskeySupport,
  PASSKEY_SUPPORT_REASONS,
  prepareAuthenticationOptions, 
  encodeAuthenticationResponse 
} from '../../lib/passkey';
import { passkeyAPI } from '../../lib/api/passkey';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Alert, AlertDescription } from '../ui/Alert';
import Turnstile from '../common/Turnstile';

export function LoginForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const turnstileRef = useRef(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [passkeySupport, setPasskeySupport] = useState(null);

  React.useEffect(() => {
    getPasskeySupport().then(setPasskeySupport);
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm();
  const validationRules = getValidationRules();

  const resolveErrorMessage = (payload, fallback = t('auth.loginFailed')) => {
    if (!payload || typeof payload !== 'object') {
      return fallback;
    }
    const message = payload.message || payload.error || fallback;
    const code = payload.code;
    if (code) {
      return t(`auth.errors.${code}`, { defaultValue: message });
    }
    return message;
  };

  const onPasskeyLogin = async () => {
    const identifier = watch('identifier')?.trim();
    setIsLoading(true);
    setError('');
    try {
      const optionsRes = await passkeyAPI.getAuthenticationOptions(identifier);
      const optionsData = optionsRes.data?.data || optionsRes.data;
      const publicKeyOptions = optionsData.public_key || optionsData;

      const publicKeyCredentialRequestOptions = prepareAuthenticationOptions(publicKeyOptions);
      const credential = await navigator.credentials.get(publicKeyCredentialRequestOptions);
      if (!credential) {
        return;
      }

      const encodedCredential = encodeAuthenticationResponse(credential);
      const result = await authAPI.loginWithPasskey({
        challenge_id: optionsData.challenge_id,
        credential: encodedCredential
      });

      if (result.success) {
        const returnUrl = getReturnUrl();
        navigate(returnUrl);
      } else {
        setError(resolveErrorMessage(result));
      }
    } catch (err) {
      console.error('Passkey login error:', err);
      if (err.name === 'NotAllowedError') {
        return;
      }
      const status = err.response?.status;
      if (status === 404 || status === 405) {
        setError(t('auth.errors.PASSKEY_LOGIN_UNAVAILABLE'));
        return;
      }
      const responseData = err.response?.data;
      const fallbackMessage = err.response ? t('auth.loginFailed') : t('errors.network');
      setError(resolveErrorMessage(responseData, fallbackMessage));
    } finally {
      setIsLoading(false);
    }
  };

  const passkeySupportMessage = (() => {
    if (!passkeySupport || passkeySupport.canAuthenticate) {
      return '';
    }

    switch (passkeySupport.reason) {
      case PASSKEY_SUPPORT_REASONS.INSECURE_CONTEXT:
        return t('auth.passkeySupportReasonInsecureContext');
      case PASSKEY_SUPPORT_REASONS.MISSING_PUBLIC_KEY_CREDENTIAL:
        return t('auth.passkeySupportReasonMissingWebauthn');
      case PASSKEY_SUPPORT_REASONS.MISSING_CREDENTIALS_API:
        return t('auth.passkeySupportReasonMissingCredentialsApi');
      default:
        return t('auth.passkeySupportUnavailable');
    }
  })();

  const onSubmit = async (data) => {
    setIsLoading(true);
    setError('');

    try {
      const result = await authAPI.login({
        identifier: data.identifier,
        password: data.password,
        cf_turnstile_response: turnstileToken || undefined
      });

      if (result.success) {
        const returnUrl = getReturnUrl();
        navigate(returnUrl);
      } else {
        setError(resolveErrorMessage(result));
      }
    } catch (err) {
      const responseData = err.response?.data;
      const fallbackMessage = err.response ? t('auth.loginFailed') : t('errors.network');
      setError(resolveErrorMessage(responseData, fallbackMessage));
      // 失败时重置，便于再次尝试
      turnstileRef.current?.reset?.();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100">
            <LogIn className="h-6 w-6 text-green-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-foreground">
            {t('auth.signInToAccount')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('auth.orSignUpPrompt')}{' '}
            <Link
              to="/auth/register"
              className="font-medium text-green-600 hover:text-green-500"
            >
              {t('auth.signUp')}
            </Link>
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('auth.signIn')}</CardTitle>
            <CardDescription>
              {t('auth.enterCredentials')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div>
                <label htmlFor="identifier" className="block text-sm font-medium text-foreground">
                  {t('auth.usernameOrEmail')}
                </label>
                <div className="mt-1">
                  <Input
                    id="identifier"
                    type="text"
                    autoComplete="username webauthn"
                    placeholder={t('auth.usernameOrEmailPlaceholder')}
                    error={errors.identifier}
                    {...register('identifier', validationRules.usernameOrEmail)}
                  />
                  {errors.identifier && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.identifier.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                  {t('auth.password')}
                </label>
                <div className="mt-1 relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder={t('auth.passwordPlaceholder')}
                    error={errors.password}
                    {...register('password', validationRules.password)}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.password.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 rounded border-input bg-background text-green-600 focus:ring-green-500"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-foreground">
                    {t('auth.rememberMe')}
                  </label>
                </div>

                <div className="text-sm">
                  <Link
                    to="/auth/forgot-password"
                    className="font-medium text-green-600 hover:text-green-500"
                  >
                    {t('auth.forgotPassword')}
                  </Link>
                </div>
              </div>

              {/* Turnstile 验证码 */}
              <div className="flex justify-center">
                <Turnstile
                  ref={turnstileRef}
                  className="mt-2"
                  onVerify={(tk) => setTurnstileToken(tk)}
                  onExpire={() => setTurnstileToken('')}
                  onError={() => setTurnstileToken('')}
                />
              </div>

              <div>
                <Button
                  type="submit"
                  className="w-full"
                  loading={isLoading}
                  disabled={isLoading || (!!import.meta.env?.VITE_TURNSTILE_SITE_KEY && !turnstileToken)}
                >
                  {isLoading ? t('auth.signingIn') : t('auth.signIn')}
                </Button>
              </div>

              {IS_PASSKEY_ENABLED && (
                <div className="space-y-4">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="bg-card px-2 text-muted-foreground">
                        {t('auth.orContinueWith')}
                      </span>
                    </div>
                  </div>

                  {passkeySupport?.canAuthenticate ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full flex items-center justify-center gap-2"
                      onClick={onPasskeyLogin}
                      disabled={isLoading}
                    >
                      <Fingerprint className="h-5 w-5 text-green-600" />
                      {t('auth.signInWithPasskey')}
                    </Button>
                  ) : (
                    <Alert>
                      <AlertDescription>
                        {passkeySupport
                          ? passkeySupportMessage
                          : t('auth.passkeyCheckingSupport')}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {t('auth.noAccount')}{' '}
            <Link
              to="/auth/register"
              className="font-medium text-green-600 hover:text-green-500"
            >
              {t('auth.createAccount')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
