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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/Input';
import { 
  Fingerprint, 
  Plus, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  ShieldCheck,
  Smartphone,
  Calendar,
  Pencil
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatDateSafe } from '../../lib/utils';

export function PasskeyManagement() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [passkeySupport, setPasskeySupport] = useState(null);
  const [editingPasskey, setEditingPasskey] = useState(null);
  const [labelDraft, setLabelDraft] = useState('');

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
        return t('profile.passkey.supportReasonInsecureContext');
      case PASSKEY_SUPPORT_REASONS.MISSING_PUBLIC_KEY_CREDENTIAL:
        return t('profile.passkey.supportReasonMissingWebauthn');
      case PASSKEY_SUPPORT_REASONS.MISSING_CREDENTIALS_API:
        return t('profile.passkey.supportReasonMissingCredentialsApi');
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
        queryClient.invalidateQueries('securityActivity');
      },
      onError: (err) => {
        console.error('Passkey registration error:', err);
        if (err?.code === 'PASSKEY_REGISTRATION_CANCELLED') {
          toast.error(t('profile.passkey.registerCancelled'));
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
        queryClient.invalidateQueries('securityActivity');
      },
      onError: (err) => {
        const status = err.response?.status;
        if (status === 404 || status === 405) {
          toast.error(t('profile.passkey.deleteUnavailable'));
          return;
        }
        toast.error(t('profile.passkey.deleteFailed'));
      }
    }
  );

  const updateMutation = useMutation(
    ({ id, label }) => passkeyAPI.updatePasskey(id, { label }),
    {
      onSuccess: () => {
        toast.success(t('profile.passkey.editSuccess'));
        queryClient.invalidateQueries('passkeys');
        queryClient.invalidateQueries('securityActivity');
        setEditingPasskey(null);
        setLabelDraft('');
      },
      onError: () => {
        toast.error(t('profile.passkey.editFailed'));
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
            <Fingerprint className="h-5 w-5 text-muted-foreground" />
            {t('profile.passkey.title')}
          </CardTitle>
          <CardDescription className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            {t('common.loading')}
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

  const openEditDialog = (passkey) => {
    setEditingPasskey(passkey);
    setLabelDraft(passkey?.label || '');
  };

  const closeEditDialog = () => {
    setEditingPasskey(null);
    setLabelDraft('');
  };

  return (
    <>
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
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error && error.response?.status !== 404 ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('common.error')}</AlertTitle>
              <AlertDescription>{t('profile.passkey.loadError')}</AlertDescription>
            </Alert>
          ) : passkeys.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 py-8 text-center">
              <Smartphone className="mx-auto mb-2 h-10 w-10 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">{t('profile.passkey.empty')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {passkeys.map((pk) => (
                <div 
                  key={pk.id} 
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-green-500/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
                      <ShieldCheck className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {pk.label || t('profile.passkey.unnamed')}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
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
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => openEditDialog(pk)}
                      title={t('profile.passkey.edit')}
                      disabled={updateMutation.isLoading}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-red-500"
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editingPasskey)} onOpenChange={(open) => (!open ? closeEditDialog() : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('profile.passkey.editTitle')}</DialogTitle>
            <DialogDescription>{t('profile.passkey.editDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={labelDraft}
              onChange={(event) => setLabelDraft(event.target.value)}
              maxLength={100}
              placeholder={t('profile.passkey.editPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">{t('profile.passkey.editHint')}</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeEditDialog}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => updateMutation.mutate({ id: editingPasskey?.id, label: labelDraft })}
              disabled={!editingPasskey || updateMutation.isLoading}
            >
              {updateMutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
