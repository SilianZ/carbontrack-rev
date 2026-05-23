import Silian_React, { useEffect as Silian_useEffect, useRef as Silian_useRef, useState as Silian_useState } from 'react';
import { useForm as Silian_useForm } from 'react-hook-form';
import { Link as Silian_Link, useNavigate as Silian_useNavigate } from 'react-router-dom';
import { Eye as Silian_Eye, EyeOff as Silian_EyeOff, UserPlus as Silian_UserPlus } from 'lucide-react';
import { toast as Silian_toast } from 'react-hot-toast';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { authAPI as Silian_authAPI, getValidationRules as Silian_getValidationRules } from '../../lib/auth';
import { schoolAPI as Silian_schoolAPI } from '../../lib/api';
import { RegionSelector as Silian_RegionSelector } from '../common/RegionSelector';
import { Button as Silian_Button } from '../ui/Button';
import { Input as Silian_Input } from '../ui/Input';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../ui/Card';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription } from '../ui/Alert';
import Silian_Turnstile from '../common/Turnstile';

export function RegisterForm() {
  const { t: Silian_t } = Silian_useTranslation(['auth', 'common', 'errors', 'success']);
  const Silian_navigate = Silian_useNavigate();
  const [Silian_showPassword, Silian_setShowPassword] = Silian_useState(false);
  const [Silian_showConfirmPassword, Silian_setShowConfirmPassword] = Silian_useState(false);
  const [Silian_error, Silian_setError] = Silian_useState('');
  const [Silian_success, Silian_setSuccess] = Silian_useState('');
  const [Silian_isLoading, Silian_setIsLoading] = Silian_useState(false);
  const [Silian_schools, Silian_setSchools] = Silian_useState([]);
  const [Silian_customSchool, Silian_setCustomSchool] = Silian_useState('');
  const Silian_turnstileRef = Silian_useRef(null);
  const [Silian_turnstileToken, Silian_setTurnstileToken] = Silian_useState('');

  const {
    register: Silian_register,
    handleSubmit: Silian_handleSubmit,
    watch: Silian_watch,
    setValue: Silian_setValue,
    formState: { errors: Silian_errors }
  } = Silian_useForm();
  const Silian_validationRules = Silian_getValidationRules();

  const Silian_password = Silian_watch('password');
  const Silian_countryCode = Silian_watch('country_code');
  const Silian_stateCode = Silian_watch('state_code');

  Silian_useEffect(() => {
    Silian_register('country_code', { required: Silian_t('auth.countryRequired') });
    Silian_register('state_code', { required: Silian_t('auth.stateRequired') });
  }, [Silian_register, Silian_t]);

  // 获取学校列表
  Silian_useEffect(() => {
    const Silian_fetchSchools = async () => {
      try {
        const Silian_response = await Silian_schoolAPI.getSchools({ limit: 100, page: 1 });
        if (Silian_response.data?.success) {
          const Silian_list = Silian_response.data?.data?.schools || [];
          Silian_setSchools(Silian_list);
        }
      } catch (Silian_error) {
        console.error('Failed to fetch schools:', Silian_error);
      }
    };

    Silian_fetchSchools();
  }, []);

  const Silian_onSubmit = async (Silian_data) => {
    Silian_setIsLoading(true);
    Silian_setError('');
    Silian_setSuccess('');

    try {
      const Silian_payload = {
        username: Silian_data.username,
        email: Silian_data.email,
        password: Silian_data.password,
        confirm_password: Silian_data.confirmPassword,
        country_code: Silian_data.country_code,
        state_code: Silian_data.state_code,
  // real_name 已废弃，不再发送
        cf_turnstile_response: Silian_turnstileToken || undefined
      };
      if (Silian_data.schoolId) {
        const Silian_sid = parseInt(Silian_data.schoolId, 10);
        if (!Number.isNaN(Silian_sid)) Silian_payload.school_id = Silian_sid;
      } else if (Silian_customSchool.trim()) {
        Silian_payload.new_school_name = Silian_customSchool.trim();
      }
      // class_name 已废弃

      const Silian_result = await Silian_authAPI.register(Silian_payload);

      if (Silian_result.success) {
        const Silian_verificationEmail = Silian_data.email;
        const Silian_verificationData = Silian_result.data ?? {};
        sessionStorage.setItem('pending_verification_email', Silian_verificationEmail);
        if (Silian_verificationData.verification_resend_available_at) {
          sessionStorage.setItem('verification_resend_available_at', Silian_verificationData.verification_resend_available_at);
        } else {
          sessionStorage.removeItem('verification_resend_available_at');
        }
        sessionStorage.setItem('verification_return_path', '/dashboard');
        const Silian_successMessage = Silian_t('auth.verification.checkInbox', { email: Silian_verificationEmail });
        Silian_setSuccess(Silian_successMessage);
        Silian_toast.success(Silian_successMessage);
        Silian_navigate(`/auth/verify-email?email=${encodeURIComponent(Silian_verificationEmail)}`, { replace: true });
      } else {
        Silian_setError(Silian_result.message || Silian_t('auth.registerFailed'));
      }
    } catch (Silian_err) {
      Silian_setError(Silian_err.message || Silian_t('auth.registerFailed'));
      // 失败时重置（容错）
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
            <Silian_UserPlus className="h-6 w-6 text-green-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-foreground">
            {Silian_t('auth.createAccount')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {Silian_t('auth.orSignInPrompt')}{' '}
            <Silian_Link
              to="/auth/login"
              className="font-medium text-green-600 hover:text-green-500"
            >
              {Silian_t('auth.signIn')}
            </Silian_Link>
          </p>
        </div>

        <Silian_Card>
          <Silian_CardHeader>
            <Silian_CardTitle>{Silian_t('auth.signUp')}</Silian_CardTitle>
            <Silian_CardDescription>
              {Silian_t('auth.fillInformation')}
            </Silian_CardDescription>
          </Silian_CardHeader>
          <Silian_CardContent>
            <form onSubmit={Silian_handleSubmit(Silian_onSubmit)} className="space-y-6">
              {Silian_error && (
                <Silian_Alert variant="destructive">
                  <Silian_AlertDescription>{Silian_error}</Silian_AlertDescription>
                </Silian_Alert>
              )}

              {Silian_success && (
                <Silian_Alert variant="success">
                  <Silian_AlertDescription>{Silian_success}</Silian_AlertDescription>
                </Silian_Alert>
              )}

              <div className="grid grid-cols-1 gap-6">
                {/* 用户名 */}
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-foreground">
                    {Silian_t('auth.username')}
                  </label>
                  <div className="mt-1">
                    <Silian_Input
                      id="username"
                      type="text"
                      autoComplete="username"
                      placeholder={Silian_t('auth.usernamePlaceholder')}
                      error={Silian_errors.username}
                      {...Silian_register('username', Silian_validationRules.username)}
                    />
                    {Silian_errors.username && (
                      <p className="mt-1 text-sm text-red-600">
                        {Silian_errors.username.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* 邮箱 */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground">
                    {Silian_t('auth.email')}
                  </label>
                  <div className="mt-1">
                    <Silian_Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder={Silian_t('auth.emailPlaceholder')}
                      error={Silian_errors.email}
                      {...Silian_register('email', Silian_validationRules.email)}
                    />
                    {Silian_errors.email && (
                      <p className="mt-1 text-sm text-red-600">
                        {Silian_errors.email.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* real_name 字段已移除 */}

                <Silian_RegionSelector
                  countryCode={Silian_countryCode}
                  stateCode={Silian_stateCode}
                  onCountryChange={(Silian_val) => Silian_setValue('country_code', Silian_val, { shouldValidate: true })}
                  onStateChange={(Silian_val) => Silian_setValue('state_code', Silian_val, { shouldValidate: true })}
                  errors={{
                    country: Silian_errors.country_code,
                    state: Silian_errors.state_code
                  }}
                />

                {/* 学校（可选，可选择或自定义新学校） */}
                <div>
                  <label htmlFor="schoolId" className="block text-sm font-medium text-foreground">
                    {Silian_t('auth.school')}（{Silian_t('common.optional') || '可选'}）
                  </label>
                  <div className="mt-1 space-y-2">
                    <select
                      id="schoolId"
                      className="block w-full rounded-md border border-input bg-background px-3 py-2 text-foreground shadow-sm focus:border-green-500 focus:outline-none focus:ring-green-500"
                      {...Silian_register('schoolId')}
                      onChange={(Silian_e)=>{ if(Silian_e.target.value) Silian_setCustomSchool(''); }}
                    >
                      <option value="">{Silian_t('auth.selectSchool')}</option>
                      {Silian_schools.map((Silian_school) => (
                        <option key={Silian_school.id} value={Silian_school.id}>
                          {Silian_school.name}
                        </option>
                      ))}
                    </select>
                    <div className="relative">
                      <Silian_Input
                        type="text"
                        placeholder={Silian_t('auth.schoolPlaceholder')}
                        value={Silian_customSchool}
                        onChange={(Silian_e)=>{ Silian_setCustomSchool(Silian_e.target.value); if(Silian_e.target.value) { /* 清空选择 */ } }}
                        disabled={!!Silian_watch('schoolId')}
                      />
                      {Silian_watch('schoolId') && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{Silian_t('common.selected')}</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {Silian_t('auth.schoolOptionalHint')}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/80">
                      {Silian_t('auth.newSchoolNote')}
                    </p>
                  </div>
                </div>

                {/* class_name 字段已移除 */}

                {/* 密码 */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-foreground">
                    {Silian_t('auth.password')}
                  </label>
                  <div className="mt-1 relative">
                    <Silian_Input
                      id="password"
                      type={Silian_showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
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

                {/* 确认密码 */}
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
                    {Silian_t('auth.confirmPassword')}
                  </label>
                  <div className="mt-1 relative">
                    <Silian_Input
                      id="confirmPassword"
                      type={Silian_showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder={Silian_t('auth.confirmPasswordPlaceholder')}
                      error={Silian_errors.confirmPassword}
                      {...Silian_register('confirmPassword', {
                        required: Silian_t('auth.confirmPasswordRequired'),
                        validate: Silian_value => Silian_value === Silian_password || Silian_t('auth.passwordMismatch')
                      })}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => Silian_setShowConfirmPassword(!Silian_showConfirmPassword)}
                    >
                      {Silian_showConfirmPassword ? (
                        <Silian_EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Silian_Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    {Silian_errors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-600">
                        {Silian_errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
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
                  {Silian_isLoading ? Silian_t('auth.registering') : Silian_t('auth.signUp')}
                </Silian_Button>
              </div>

              <div className="text-sm text-muted-foreground">
                <p>
                  {Silian_t('auth.agreementText')}{' '}
                  <Silian_Link to="/terms" className="text-green-600 hover:text-green-500">
                    {Silian_t('auth.termsOfService')}
                  </Silian_Link>{' '}
                  {Silian_t('auth.and')}{' '}
                  <Silian_Link to="/privacy" className="text-green-600 hover:text-green-500">
                    {Silian_t('auth.privacyPolicy')}
                  </Silian_Link>
                </p>
              </div>
            </form>
          </Silian_CardContent>
        </Silian_Card>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {Silian_t('auth.haveAccount')}{' '}
            <Silian_Link
              to="/auth/login"
              className="font-medium text-green-600 hover:text-green-500"
            >
              {Silian_t('auth.signInNow')}
            </Silian_Link>
          </p>
        </div>
      </div>
    </div>
  );
}

