import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { passkeyAPI } from '../../lib/api/passkey';
import { 
  IS_PASSKEY_ENABLED, 
  getPasskeySupport,
  PASSKEY_SUPPORT_REASONS,
  prepareRegistrationOptions, 
  encodeRegistrationResponse 
} from '../../lib/passkey';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../ui/Card';
import { Alert, AlertTitle, AlertDescription } from '../ui/Alert';
import { 
  Fingerprint, 
  Plus, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  ShieldCheck,
  Smartphone,
  Calendar
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatDateSafe } from '../../lib/utils';

export function PasskeyManagement() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [passkeySupport, setPasskeySupport] = useState(null);

  // Check support on mount
  React.useEffect(() => {
    getPasskeySupport().then(setPasskeySupport);
  }, []);

  const { data: passkeysData, isLoading, error } = useQuery(
    'passkeys',
    () => passkeyAPI.listPasskeys(),
    { 
      enabled: IS_PASSKEY_ENABLED && passkeySupport?.canRegister === true,
      retry: false,
      onError: (err) => {
        // If 404, backend might not have the endpoint yet, which is fine for Phase A
        if (err.response?.status === 404) {
          console.warn('Passkey endpoints not found on backend');
        }
      }
    }
  );

  const passkeySupportMessage = (() => {
    if (!passkeySupport || passkeySupport.canRegister) {
      return '';
    }

    switch (passkeySupport.reason) {
      case PASSKEY_SUPPORT_REASONS.INSECURE_CONTEXT:
        return t('profile.passkey.supportReasonInsecureContext', '当前页面不是安全上下文，请使用 HTTPS 或 localhost。');
      case PASSKEY_SUPPORT_REASONS.MISSING_PUBLIC_KEY_CREDENTIAL:
        return t('profile.passkey.supportReasonMissingWebauthn', '当前浏览器未提供 WebAuthn 能力。');
      case PASSKEY_SUPPORT_REASONS.MISSING_CREDENTIALS_API:
        return t('profile.passkey.supportReasonMissingCredentialsApi', '当前浏览器未提供凭据管理接口。');
      default:
        return t('profile.passkey.notSupported');
    }
  })();

  const registerMutation = useMutation(
    async () => {
      // 1. Get options from backend
      const optionsRes = await passkeyAPI.getRegistrationOptions();
      const optionsData = optionsRes.data?.data || optionsRes.data;
      const publicKeyOptions = optionsData.public_key || optionsData;
      
      // 2. Prepare options for the browser
      const publicKeyCredentialCreationOptions = prepareRegistrationOptions(publicKeyOptions);
      
      // 3. Create credential in browser
      const credential = await navigator.credentials.create(publicKeyCredentialCreationOptions);
      if (!credential) {
        const cancellationError = new Error('Passkey registration was cancelled.');
        cancellationError.code = 'PASSKEY_REGISTRATION_CANCELLED';
        throw cancellationError;
      }
      
      // 4. Encode and send to backend
      const encodedCredential = encodeRegistrationResponse(credential);
      return passkeyAPI.register({
        challenge_id: optionsData.challenge_id,
        credential: encodedCredential,
        label: `Passkey ${new Date().toLocaleDateString()}`
      });
    },
    {
      onSuccess: () => {
        toast.success(t('profile.passkey.registerSuccess'));
        queryClient.invalidateQueries('passkeys');
      },
      onError: (err) => {
        console.error('Passkey registration error:', err);
        if (err?.code === 'PASSKEY_REGISTRATION_CANCELLED') {
          toast.error(t('profile.passkey.registerCancelled', '通行密钥注册已取消'));
          return;
        }
        toast.error(t('profile.passkey.registerFailed'));
      }
    }
  );

  const deleteMutation = useMutation(
    (id) => passkeyAPI.deletePasskey(id),
    {
      onSuccess: () => {
        toast.success(t('profile.passkey.deleteSuccess'));
        queryClient.invalidateQueries('passkeys');
      },
      onError: (err) => {
        const status = err.response?.status;
        if (status === 404 || status === 405) {
          toast.error(t('profile.passkey.deleteUnavailable', '通行密钥删除功能暂未上线'));
          return;
        }
        toast.error(t('profile.passkey.deleteFailed'));
      }
    }
  );

  if (!IS_PASSKEY_ENABLED) {
    return (
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5" />
            {t('profile.passkey.title')}
          </CardTitle>
          <CardDescription>
            {t('profile.passkey.disabled')}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (passkeySupport === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-gray-400" />
            {t('profile.passkey.title')}
          </CardTitle>
          <CardDescription className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            {t('common.loading', '正在加载...')}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (passkeySupport.canRegister === false) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5" />
            {t('profile.passkey.title')}
          </CardTitle>
          <CardDescription className="text-amber-600 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {passkeySupportMessage}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const passkeys = passkeysData?.data?.data?.passkeys || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-green-600" />
            {t('profile.passkey.title')}
          </CardTitle>
          <CardDescription>
            {t('profile.passkey.description')}
          </CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => registerMutation.mutate()}
          disabled={registerMutation.isLoading}
          className="flex items-center gap-1"
        >
          {registerMutation.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {t('profile.passkey.add')}
        </Button>
      </CardHeader>
      <CardContent className="pt-4">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : error && error.response?.status !== 404 ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('common.error')}</AlertTitle>
            <AlertDescription>{t('profile.passkey.loadError', '加载通行密钥失败')}</AlertDescription>
          </Alert>
        ) : passkeys.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <Smartphone className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">{t('profile.passkey.empty')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {passkeys.map((pk) => (
              <div 
                key={pk.id} 
                className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-white hover:border-green-200 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {pk.label || t('profile.passkey.unnamed')}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDateSafe(pk.created_at)}
                      </span>
                      {pk.last_used_at && (
                        <span>
                          {t('profile.passkey.lastUsed')}: {formatDateSafe(pk.last_used_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-gray-400 hover:text-red-500"
                  onClick={() => {
                    if (window.confirm(t('profile.passkey.deleteConfirm'))) {
                      deleteMutation.mutate(pk.id);
                    }
                  }}
                  disabled={deleteMutation.isLoading}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
