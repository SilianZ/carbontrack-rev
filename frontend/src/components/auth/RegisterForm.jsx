import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useTranslation } from '../../hooks/useTranslation';
import { authAPI, getValidationRules } from '../../lib/auth';
import { schoolAPI } from '../../lib/api';
import { RegionSelector } from '../common/RegionSelector';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Alert, AlertDescription } from '../ui/Alert';
import Turnstile from '../common/Turnstile';

export function RegisterForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [schools, setSchools] = useState([]);
  const [customSchool, setCustomSchool] = useState('');
  const turnstileRef = useRef(null);
  const [turnstileToken, setTurnstileToken] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm();
  const validationRules = getValidationRules();

  const password = watch('password');
  const countryCode = watch('country_code');
  const stateCode = watch('state_code');

  useEffect(() => {
    register('country_code', { required: t('auth.countryRequired', 'Country is required') });
    register('state_code', { required: t('auth.stateRequired', 'State is required') });
  }, [register, t]);

  // 获取学校列表
  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const response = await schoolAPI.getSchools({ limit: 100, page: 1 });
        if (response.data?.success) {
          const list = response.data?.data?.schools || [];
          setSchools(list);
        }
      } catch (error) {
        console.error('Failed to fetch schools:', error);
      }
    };

    fetchSchools();
  }, []);

  const onSubmit = async (data) => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        username: data.username,
        email: data.email,
        password: data.password,
        confirm_password: data.confirmPassword,
        country_code: data.country_code,
        state_code: data.state_code,
  // real_name 已废弃，不再发送
        cf_turnstile_response: turnstileToken || undefined
      };
      if (data.schoolId) {
        const sid = parseInt(data.schoolId, 10);
        if (!Number.isNaN(sid)) payload.school_id = sid;
      } else if (customSchool.trim()) {
        payload.new_school_name = customSchool.trim();
      }
      // class_name 已废弃

      const result = await authAPI.register(payload);

      if (result.success) {
        const verificationEmail = data.email;
        const verificationData = result.data ?? {};
        sessionStorage.setItem('pending_verification_email', verificationEmail);
        if (verificationData.verification_resend_available_at) {
          sessionStorage.setItem('verification_resend_available_at', verificationData.verification_resend_available_at);
        } else {
          sessionStorage.removeItem('verification_resend_available_at');
        }
        sessionStorage.setItem('verification_return_path', '/dashboard');
        const successMessage = t('auth.verification.checkInbox', { email: verificationEmail });
        setSuccess(successMessage);
        toast.success(successMessage);
        navigate(`/auth/verify-email?email=${encodeURIComponent(verificationEmail)}`, { replace: true });
      } else {
        setError(result.message || t('auth.registerFailed'));
      }
    } catch (err) {
      setError(err.message || t('auth.registerFailed'));
      // 失败时重置（容错）
      turnstileRef.current?.reset?.();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100">
            <UserPlus className="h-6 w-6 text-green-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {t('auth.createAccount')}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {t('auth.orSignInPrompt')}{' '}
            <Link
              to="/auth/login"
              className="font-medium text-green-600 hover:text-green-500"
            >
              {t('auth.signIn')}
            </Link>
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('auth.signUp')}</CardTitle>
            <CardDescription>
              {t('auth.fillInformation')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert variant="success">
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 gap-6">
                {/* 用户名 */}
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                    {t('auth.username')}
                  </label>
                  <div className="mt-1">
                    <Input
                      id="username"
                      type="text"
                      autoComplete="username"
                      placeholder={t('auth.usernamePlaceholder')}
                      error={errors.username}
                      {...register('username', validationRules.username)}
                    />
                    {errors.username && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.username.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* 邮箱 */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    {t('auth.email')}
                  </label>
                  <div className="mt-1">
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder={t('auth.emailPlaceholder')}
                      error={errors.email}
                      {...register('email', validationRules.email)}
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.email.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* real_name 字段已移除 */}

                <RegionSelector
                  countryCode={countryCode}
                  stateCode={stateCode}
                  onCountryChange={(val) => setValue('country_code', val, { shouldValidate: true })}
                  onStateChange={(val) => setValue('state_code', val, { shouldValidate: true })}
                  errors={{
                    country: errors.country_code,
                    state: errors.state_code
                  }}
                />

                {/* 学校（可选，可选择或自定义新学校） */}
                <div>
                  <label htmlFor="schoolId" className="block text-sm font-medium text-gray-700">
                    {t('auth.school')}（{t('common.optional') || '可选'}）
                  </label>
                  <div className="mt-1 space-y-2">
                    <select
                      id="schoolId"
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      {...register('schoolId')}
                      onChange={(e)=>{ if(e.target.value) setCustomSchool(''); }}
                    >
                      <option value="">{t('auth.selectSchool')}</option>
                      {schools.map((school) => (
                        <option key={school.id} value={school.id}>
                          {school.name}
                        </option>
                      ))}
                    </select>
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder={t('auth.schoolPlaceholder', '输入以创建新学校 (可选)')}
                        value={customSchool}
                        onChange={(e)=>{ setCustomSchool(e.target.value); if(e.target.value) { /* 清空选择 */ } }}
                        disabled={!!watch('schoolId')}
                      />
                      {watch('schoolId') && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">{t('common.selected','Selected')}</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {t('auth.schoolOptionalHint')}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {t('auth.newSchoolNote')}
                    </p>
                  </div>
                </div>

                {/* class_name 字段已移除 */}

                {/* 密码 */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    {t('auth.password')}
                  </label>
                  <div className="mt-1 relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
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
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                    {errors.password && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.password.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* 确认密码 */}
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                    {t('auth.confirmPassword')}
                  </label>
                  <div className="mt-1 relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder={t('auth.confirmPasswordPlaceholder')}
                      error={errors.confirmPassword}
                      {...register('confirmPassword', {
                        required: t('auth.confirmPasswordRequired'),
                        validate: value => value === password || t('auth.passwordMismatch')
                      })}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                    {errors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
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
                  {isLoading ? t('auth.registering') : t('auth.signUp')}
                </Button>
              </div>

              <div className="text-sm text-gray-600">
                <p>
                  {t('auth.agreementText')}{' '}
                  <Link to="/terms" className="text-green-600 hover:text-green-500">
                    {t('auth.termsOfService')}
                  </Link>{' '}
                  {t('auth.and')}{' '}
                  <Link to="/privacy" className="text-green-600 hover:text-green-500">
                    {t('auth.privacyPolicy')}
                  </Link>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            {t('auth.haveAccount')}{' '}
            <Link
              to="/auth/login"
              className="font-medium text-green-600 hover:text-green-500"
            >
              {t('auth.signInNow')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

