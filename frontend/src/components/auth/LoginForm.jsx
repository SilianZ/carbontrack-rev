import Silian_React, { useRef as Silian_useRef, useState as Silian_useState } from 'react';
import { useForm as Silian_useForm } from 'react-hook-form';
import { Link as Silian_Link, useNavigate as Silian_useNavigate } from 'react-router-dom';
import { Eye as Silian_Eye, EyeOff as Silian_EyeOff, LogIn as Silian_LogIn, Fingerprint as Silian_Fingerprint } from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { authAPI as Silian_authAPI, getReturnUrl as Silian_getReturnUrl, getValidationRules as Silian_getValidationRules } from '../../lib/auth';
import {
  IS_PASSKEY_ENABLED as Silian_IS_PASSKEY_ENABLED,
  getPasskeySupport as Silian_getPasskeySupport,
  PASSKEY_SUPPORT_REASONS as Silian_PASSKEY_SUPPORT_REASONS,
  prepareAuthenticationOptions as Silian_prepareAuthenticationOptions,
  encodeAuthenticationResponse as Silian_encodeAuthenticationResponse
} from '../../lib/passkey';
import { passkeyAPI as Silian_passkeyAPI } from '../../lib/api/passkey';
import { Button as Silian_Button } from '../ui/Button';
import { Input as Silian_Input } from '../ui/Input';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../ui/Card';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription } from '../ui/Alert';
import Silian_Turnstile from '../common/Turnstile';

export function LoginForm() {
  const { t: Silian_t } = Silian_useTranslation(['auth', 'errors']);
  const Silian_navigate = Silian_useNavigate();
  const [Silian_showPassword, Silian_setShowPassword] = Silian_useState(false);
  const [Silian_error, Silian_setError] = Silian_useState('');
  const [Silian_isLoading, Silian_setIsLoading] = Silian_useState(false);
  const Silian_turnstileRef = Silian_useRef(null);
  const [Silian_turnstileToken, Silian_setTurnstileToken] = Silian_useState('');
  const [Silian_passkeySupport, Silian_setPasskeySupport] = Silian_useState(null);

  Silian_React.useEffect(() => {
    Silian_getPasskeySupport().then(Silian_setPasskeySupport);
  }, []);

  const {
    register: Silian_register,
    handleSubmit: Silian_handleSubmit,
    watch: Silian_watch,
    formState: { errors: Silian_errors }
  } = Silian_useForm();
  const Silian_validationRules = Silian_getValidationRules();

  const Silian_resolveErrorMessage = (Silian_payload, Silian_fallback = Silian_t('auth.loginFailed')) => {
    if (!Silian_payload || typeof Silian_payload !== 'object') {
      return Silian_fallback;
    }
    const Silian_message = Silian_payload.message || Silian_payload.error || Silian_fallback;
    const Silian_code = Silian_payload.code;
    if (Silian_code) {
      return Silian_t(`auth.errors.${Silian_code}`, { defaultValue: Silian_message });
    }
    return Silian_message;
  };

  const Silian_onPasskeyLogin = async () => {
    const Silian_identifier = Silian_watch('identifier')?.trim();
    Silian_setIsLoading(true);
    Silian_setError('');
    try {
      const Silian_optionsRes = await Silian_passkeyAPI.getAuthenticationOptions(Silian_identifier);
      const Silian_optionsData = Silian_optionsRes.data?.data || Silian_optionsRes.data;
      const Silian_publicKeyOptions = Silian_optionsData.public_key || Silian_optionsData;

      const Silian_publicKeyCredentialRequestOptions = Silian_prepareAuthenticationOptions(Silian_publicKeyOptions);
      const Silian_credential = await navigator.credentials.get(Silian_publicKeyCredentialRequestOptions);
      if (!Silian_credential) {
        return;
      }

      const Silian_encodedCredential = Silian_encodeAuthenticationResponse(Silian_credential);
      const Silian_result = await Silian_authAPI.loginWithPasskey({
        challenge_id: Silian_optionsData.challenge_id,
        credential: Silian_encodedCredential
      });

      if (Silian_result.success) {
        const Silian_returnUrl = Silian_getReturnUrl();
        Silian_navigate(Silian_returnUrl);
      } else {
        Silian_setError(Silian_resolveErrorMessage(Silian_result));
      }
    } catch (Silian_err) {
      console.error('Passkey login error:', Silian_err);
      if (Silian_err.name === 'NotAllowedError') {
        return;
      }
      const Silian_responseData = Silian_err.response?.data;
      const Silian_fallbackMessage = Silian_err.response ? Silian_t('auth.loginFailed') : Silian_t('errors.network');
      Silian_setError(Silian_resolveErrorMessage(Silian_responseData, Silian_fallbackMessage));
    } finally {
      Silian_setIsLoading(false);
    }
  };

  const Silian_passkeySupportMessage = (() => {
    if (!Silian_passkeySupport || Silian_passkeySupport.canAuthenticate) {
      return '';
    }

    switch (Silian_passkeySupport.reason) {
      case Silian_PASSKEY_SUPPORT_REASONS.INSECURE_CONTEXT:
        return Silian_t('auth.passkeySupportReasonInsecureContext');
      case Silian_PASSKEY_SUPPORT_REASONS.MISSING_PUBLIC_KEY_CREDENTIAL:
        return Silian_t('auth.passkeySupportReasonMissingWebauthn');
      case Silian_PASSKEY_SUPPORT_REASONS.MISSING_CREDENTIALS_API:
        return Silian_t('auth.passkeySupportReasonMissingCredentialsApi');
      default:
        return Silian_t('auth.passkeySupportUnavailable');
    }
  })();

  const Silian_onSubmit = async (Silian_data) => {
    Silian_setIsLoading(true);
    Silian_setError('');

    try {
      const Silian_result = await Silian_authAPI.login({
        identifier: Silian_data.identifier,
        password: Silian_data.password,
        cf_turnstile_response: Silian_turnstileToken || undefined
      });

      if (Silian_result.success) {
        const Silian_returnUrl = Silian_getReturnUrl();
        Silian_navigate(Silian_returnUrl);
      } else {
        Silian_setError(Silian_resolveErrorMessage(Silian_result));
      }
    } catch (Silian_err) {
      const Silian_responseData = Silian_err.response?.data;
      const Silian_fallbackMessage = Silian_err.response ? Silian_t('auth.loginFailed') : Silian_t('errors.network');
      Silian_setError(Silian_resolveErrorMessage(Silian_responseData, Silian_fallbackMessage));
      // 失败时重置，便于再次尝试
      Silian_turnstileRef.current?.reset?.();
    } finally {
      Silian_setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100">
            <Silian_LogIn className="h-6 w-6 text-green-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-foreground">
            {Silian_t('auth.signInToAccount')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {Silian_t('auth.orSignUpPrompt')}{' '}
            <Silian_Link
              to="/auth/register"
              className="font-medium text-green-600 hover:text-green-500"
            >
              {Silian_t('auth.signUp')}
            </Silian_Link>
          </p>
        </div>

        <Silian_Card>
          <Silian_CardHeader>
            <Silian_CardTitle>{Silian_t('auth.signIn')}</Silian_CardTitle>
            <Silian_CardDescription>
              {Silian_t('auth.enterCredentials')}
            </Silian_CardDescription>
          </Silian_CardHeader>
          <Silian_CardContent>
            <form onSubmit={Silian_handleSubmit(Silian_onSubmit)} className="space-y-6">
              {Silian_error && (
                <Silian_Alert variant="destructive">
                  <Silian_AlertDescription>{Silian_error}</Silian_AlertDescription>
                </Silian_Alert>
              )}

              <div>
                <label htmlFor="identifier" className="block text-sm font-medium text-foreground">
                  {Silian_t('auth.usernameOrEmail')}
                </label>
                <div className="mt-1">
                  <Silian_Input
                    id="identifier"
                    type="text"
                    autoComplete="username webauthn"
                    placeholder={Silian_t('auth.usernameOrEmailPlaceholder')}
                    error={Silian_errors.identifier}
                    {...Silian_register('identifier', Silian_validationRules.usernameOrEmail)}
                  />
                  {Silian_errors.identifier && (
                    <p className="mt-1 text-sm text-red-600">
                      {Silian_errors.identifier.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                  {Silian_t('auth.password')}
                </label>
                <div className="mt-1 relative">
                  <Silian_Input
                    id="password"
                    type={Silian_showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder={Silian_t('auth.passwordPlaceholder')}
                    error={Silian_errors.password}
                    {...Silian_register('password', Silian_validationRules.password)}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => Silian_setShowPassword(!Silian_showPassword)}
                  >
                    {Silian_showPassword ? (
                      <Silian_EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Silian_Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {Silian_errors.password && (
                    <p className="mt-1 text-sm text-red-600">
                      {Silian_errors.password.message}
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
                    {Silian_t('auth.rememberMe')}
                  </label>
                </div>

                <div className="text-sm">
                  <Silian_Link
                    to="/auth/forgot-password"
                    className="font-medium text-green-600 hover:text-green-500"
                  >
                    {Silian_t('auth.forgotPassword')}
                  </Silian_Link>
                </div>
              </div>

              {/* Turnstile 验证码 */}
              <div className="flex justify-center">
                <Silian_Turnstile
                  ref={Silian_turnstileRef}
                  className="mt-2"
                  onVerify={(Silian_tk) => Silian_setTurnstileToken(Silian_tk)}
                  onExpire={() => Silian_setTurnstileToken('')}
                  onError={() => Silian_setTurnstileToken('')}
                />
              </div>

              <div>
                <Silian_Button
                  type="submit"
                  className="w-full"
                  loading={Silian_isLoading}
                  disabled={Silian_isLoading || (!!import.meta.env?.VITE_TURNSTILE_SITE_KEY && !Silian_turnstileToken)}
                >
                  {Silian_isLoading ? Silian_t('auth.signingIn') : Silian_t('auth.signIn')}
                </Silian_Button>
              </div>

              {Silian_IS_PASSKEY_ENABLED && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    <span className="shrink-0">
                      {Silian_t('auth.orContinueWith')}
                    </span>
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  {Silian_passkeySupport?.canAuthenticate ? (
                    <Silian_Button
                      type="button"
                      variant="outline"
                      className="w-full flex items-center justify-center gap-2"
                      onClick={Silian_onPasskeyLogin}
                      disabled={Silian_isLoading}
                    >
                      <Silian_Fingerprint className="h-5 w-5 text-green-600" />
                      {Silian_t('auth.signInWithPasskey')}
                    </Silian_Button>
                  ) : (
                    <Silian_Alert>
                      <Silian_AlertDescription>
                        {Silian_passkeySupport
                          ? Silian_passkeySupportMessage
                          : Silian_t('auth.passkeyCheckingSupport')}
                      </Silian_AlertDescription>
                    </Silian_Alert>
                  )}
                </div>
              )}
            </form>
          </Silian_CardContent>
        </Silian_Card>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {Silian_t('auth.noAccount')}{' '}
            <Silian_Link
              to="/auth/register"
              className="font-medium text-green-600 hover:text-green-500"
            >
              {Silian_t('auth.createAccount')}
            </Silian_Link>
          </p>
        </div>
      </div>
    </div>
  );
}
