import Silian_React, { useState as Silian_useState } from 'react';
import { useQuery as Silian_useQuery, useMutation as Silian_useMutation, useQueryClient as Silian_useQueryClient } from 'react-query';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { passkeyAPI as Silian_passkeyAPI } from '../../lib/api/passkey';
import {
  IS_PASSKEY_ENABLED as Silian_IS_PASSKEY_ENABLED,
  getPasskeySupport as Silian_getPasskeySupport,
  PASSKEY_SUPPORT_REASONS as Silian_PASSKEY_SUPPORT_REASONS,
  prepareRegistrationOptions as Silian_prepareRegistrationOptions,
  encodeRegistrationResponse as Silian_encodeRegistrationResponse
} from '../../lib/passkey';
import { Button as Silian_Button } from '../ui/Button';
import { Card as Silian_Card, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription } from '../ui/Card';
import { Alert as Silian_Alert, AlertTitle as Silian_AlertTitle, AlertDescription as Silian_AlertDescription } from '../ui/Alert';
import { Dialog as Silian_Dialog, DialogContent as Silian_DialogContent, DialogDescription as Silian_DialogDescription, DialogFooter as Silian_DialogFooter, DialogHeader as Silian_DialogHeader, DialogTitle as Silian_DialogTitle } from '../ui/dialog';
import { Input as Silian_Input } from '../ui/Input';
import {
  Fingerprint as Silian_Fingerprint,
  Plus as Silian_Plus,
  Trash2 as Silian_Trash2,
  Loader2 as Silian_Loader2,
  AlertCircle as Silian_AlertCircle,
  ShieldCheck as Silian_ShieldCheck,
  Smartphone as Silian_Smartphone,
  Calendar as Silian_Calendar,
  Pencil as Silian_Pencil
} from 'lucide-react';
import { toast as Silian_toast } from 'react-hot-toast';
import { formatDateSafe as Silian_formatDateSafe } from '../../lib/utils';

export function PasskeyManagement() {
  const { t: Silian_t } = Silian_useTranslation(['common', 'profile']);
  const Silian_queryClient = Silian_useQueryClient();
  const [Silian_passkeySupport, Silian_setPasskeySupport] = Silian_useState(null);
  const [Silian_editingPasskey, Silian_setEditingPasskey] = Silian_useState(null);
  const [Silian_labelDraft, Silian_setLabelDraft] = Silian_useState('');

  // Check support on mount
  Silian_React.useEffect(() => {
    Silian_getPasskeySupport().then(Silian_setPasskeySupport);
  }, []);

  const { data: Silian_passkeysData, isLoading: Silian_isLoading, error: Silian_error } = Silian_useQuery(
    'passkeys',
    () => Silian_passkeyAPI.listPasskeys(),
    {
      enabled: Silian_IS_PASSKEY_ENABLED && Silian_passkeySupport?.canRegister === true,
      retry: false,
      onError: (Silian_err) => {
        // If 404, backend might not have the endpoint yet, which is fine for Phase A
        if (Silian_err.response?.status === 404) {
          console.warn('Passkey endpoints not found on backend');
        }
      }
    }
  );

  const Silian_passkeySupportMessage = (() => {
    if (!Silian_passkeySupport || Silian_passkeySupport.canRegister) {
      return '';
    }

    switch (Silian_passkeySupport.reason) {
      case Silian_PASSKEY_SUPPORT_REASONS.INSECURE_CONTEXT:
        return Silian_t('profile.passkey.supportReasonInsecureContext');
      case Silian_PASSKEY_SUPPORT_REASONS.MISSING_PUBLIC_KEY_CREDENTIAL:
        return Silian_t('profile.passkey.supportReasonMissingWebauthn');
      case Silian_PASSKEY_SUPPORT_REASONS.MISSING_CREDENTIALS_API:
        return Silian_t('profile.passkey.supportReasonMissingCredentialsApi');
      default:
        return Silian_t('profile.passkey.notSupported');
    }
  })();

  const Silian_registerMutation = Silian_useMutation(
    async () => {
      // 1. Get options from backend
      const Silian_optionsRes = await Silian_passkeyAPI.getRegistrationOptions();
      const Silian_optionsData = Silian_optionsRes.data?.data || Silian_optionsRes.data;
      const Silian_publicKeyOptions = Silian_optionsData.public_key || Silian_optionsData;

      // 2. Prepare options for the browser
      const Silian_publicKeyCredentialCreationOptions = Silian_prepareRegistrationOptions(Silian_publicKeyOptions);

      // 3. Create credential in browser
      const Silian_credential = await navigator.credentials.create(Silian_publicKeyCredentialCreationOptions);
      if (!Silian_credential) {
        const Silian_cancellationError = new Error('Passkey registration was cancelled.');
        Silian_cancellationError.code = 'PASSKEY_REGISTRATION_CANCELLED';
        throw Silian_cancellationError;
      }

      // 4. Encode and send to backend
      const Silian_encodedCredential = Silian_encodeRegistrationResponse(Silian_credential);
      return Silian_passkeyAPI.register({
        challenge_id: Silian_optionsData.challenge_id,
        credential: Silian_encodedCredential,
        label: `Passkey ${new Date().toLocaleDateString()}`
      });
    },
    {
      onSuccess: () => {
        Silian_toast.success(Silian_t('profile.passkey.registerSuccess'));
        Silian_queryClient.invalidateQueries('passkeys');
        Silian_queryClient.invalidateQueries('securityActivity');
      },
      onError: (Silian_err) => {
        console.error('Passkey registration error:', Silian_err);
        if (Silian_err?.code === 'PASSKEY_REGISTRATION_CANCELLED') {
          Silian_toast.error(Silian_t('profile.passkey.registerCancelled'));
          return;
        }
        Silian_toast.error(Silian_t('profile.passkey.registerFailed'));
      }
    }
  );

  const Silian_deleteMutation = Silian_useMutation(
    (Silian_id) => Silian_passkeyAPI.deletePasskey(Silian_id),
    {
      onSuccess: () => {
        Silian_toast.success(Silian_t('profile.passkey.deleteSuccess'));
        Silian_queryClient.invalidateQueries('passkeys');
        Silian_queryClient.invalidateQueries('securityActivity');
      },
      onError: (Silian_err) => {
        const Silian_status = Silian_err.response?.status;
        if (Silian_status === 404 || Silian_status === 405) {
          Silian_toast.error(Silian_t('profile.passkey.deleteUnavailable'));
          return;
        }
        Silian_toast.error(Silian_t('profile.passkey.deleteFailed'));
      }
    }
  );

  const Silian_updateMutation = Silian_useMutation(
    ({ id: Silian_id, label: Silian_label }) => Silian_passkeyAPI.updatePasskey(Silian_id, { label: Silian_label }),
    {
      onSuccess: () => {
        Silian_toast.success(Silian_t('profile.passkey.editSuccess'));
        Silian_queryClient.invalidateQueries('passkeys');
        Silian_queryClient.invalidateQueries('securityActivity');
        Silian_setEditingPasskey(null);
        Silian_setLabelDraft('');
      },
      onError: () => {
        Silian_toast.error(Silian_t('profile.passkey.editFailed'));
      }
    }
  );

  if (!Silian_IS_PASSKEY_ENABLED) {
    return (
      <Silian_Card className="opacity-60">
        <Silian_CardHeader>
          <Silian_CardTitle className="flex items-center gap-2">
            <Silian_Fingerprint className="h-5 w-5" />
            {Silian_t('profile.passkey.title')}
          </Silian_CardTitle>
          <Silian_CardDescription>
            {Silian_t('profile.passkey.disabled')}
          </Silian_CardDescription>
        </Silian_CardHeader>
      </Silian_Card>
    );
  }

  if (Silian_passkeySupport === null) {
    return (
      <Silian_Card>
        <Silian_CardHeader>
          <Silian_CardTitle className="flex items-center gap-2">
            <Silian_Fingerprint className="h-5 w-5 text-muted-foreground" />
            {Silian_t('profile.passkey.title')}
          </Silian_CardTitle>
          <Silian_CardDescription className="flex items-center gap-2">
            <Silian_Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            {Silian_t('common.loading')}
          </Silian_CardDescription>
        </Silian_CardHeader>
      </Silian_Card>
    );
  }

  if (Silian_passkeySupport.canRegister === false) {
    return (
      <Silian_Card>
        <Silian_CardHeader>
          <Silian_CardTitle className="flex items-center gap-2">
            <Silian_Fingerprint className="h-5 w-5" />
            {Silian_t('profile.passkey.title')}
          </Silian_CardTitle>
          <Silian_CardDescription className="text-amber-600 flex items-center gap-1">
            <Silian_AlertCircle className="h-4 w-4" />
            {Silian_passkeySupportMessage}
          </Silian_CardDescription>
        </Silian_CardHeader>
      </Silian_Card>
    );
  }

  const Silian_passkeys = Silian_passkeysData?.data?.data?.passkeys || [];

  const Silian_openEditDialog = (Silian_passkey) => {
    Silian_setEditingPasskey(Silian_passkey);
    Silian_setLabelDraft(Silian_passkey?.label || '');
  };

  const Silian_closeEditDialog = () => {
    Silian_setEditingPasskey(null);
    Silian_setLabelDraft('');
  };

  return (
    <>
      <Silian_Card>
        <Silian_CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <Silian_CardTitle className="flex items-center gap-2">
              <Silian_Fingerprint className="h-5 w-5 text-green-600" />
              {Silian_t('profile.passkey.title')}
            </Silian_CardTitle>
            <Silian_CardDescription>
              {Silian_t('profile.passkey.description')}
            </Silian_CardDescription>
          </div>
          <Silian_Button
            variant="outline"
            size="sm"
            onClick={() => Silian_registerMutation.mutate()}
            disabled={Silian_registerMutation.isLoading}
            className="flex items-center gap-1"
          >
            {Silian_registerMutation.isLoading ? (
              <Silian_Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Silian_Plus className="h-4 w-4" />
            )}
            {Silian_t('profile.passkey.add')}
          </Silian_Button>
        </Silian_CardHeader>
        <Silian_CardContent className="pt-4">
          {Silian_isLoading ? (
            <div className="flex justify-center py-4">
              <Silian_Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : Silian_error && Silian_error.response?.status !== 404 ? (
            <Silian_Alert variant="destructive">
              <Silian_AlertCircle className="h-4 w-4" />
              <Silian_AlertTitle>{Silian_t('common.error')}</Silian_AlertTitle>
              <Silian_AlertDescription>{Silian_t('profile.passkey.loadError')}</Silian_AlertDescription>
            </Silian_Alert>
          ) : Silian_passkeys.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 py-8 text-center">
              <Silian_Smartphone className="mx-auto mb-2 h-10 w-10 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">{Silian_t('profile.passkey.empty')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Silian_passkeys.map((Silian_pk) => (
                <div
                  key={Silian_pk.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-green-500/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
                      <Silian_ShieldCheck className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {Silian_pk.label || Silian_t('profile.passkey.unnamed')}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Silian_Calendar className="h-3 w-3" />
                          {Silian_formatDateSafe(Silian_pk.created_at)}
                        </span>
                        {Silian_pk.last_used_at && (
                          <span>
                            {Silian_t('profile.passkey.lastUsed')}: {Silian_formatDateSafe(Silian_pk.last_used_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Silian_Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => Silian_openEditDialog(Silian_pk)}
                      title={Silian_t('profile.passkey.edit')}
                      disabled={Silian_updateMutation.isLoading}
                    >
                      <Silian_Pencil className="h-4 w-4" />
                    </Silian_Button>
                    <Silian_Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-500"
                      onClick={() => {
                        if (window.confirm(Silian_t('profile.passkey.deleteConfirm'))) {
                          Silian_deleteMutation.mutate(Silian_pk.id);
                        }
                      }}
                      disabled={Silian_deleteMutation.isLoading}
                    >
                      <Silian_Trash2 className="h-4 w-4" />
                    </Silian_Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Silian_CardContent>
      </Silian_Card>

      <Silian_Dialog open={Boolean(Silian_editingPasskey)} onOpenChange={(Silian_open) => (!Silian_open ? Silian_closeEditDialog() : null)}>
        <Silian_DialogContent>
          <Silian_DialogHeader>
            <Silian_DialogTitle>{Silian_t('profile.passkey.editTitle')}</Silian_DialogTitle>
            <Silian_DialogDescription>{Silian_t('profile.passkey.editDescription')}</Silian_DialogDescription>
          </Silian_DialogHeader>
          <div className="space-y-2">
            <Silian_Input
              value={Silian_labelDraft}
              onChange={(Silian_event) => Silian_setLabelDraft(Silian_event.target.value)}
              maxLength={100}
              placeholder={Silian_t('profile.passkey.editPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">{Silian_t('profile.passkey.editHint')}</p>
          </div>
          <Silian_DialogFooter>
            <Silian_Button variant="ghost" onClick={Silian_closeEditDialog}>
              {Silian_t('common.cancel')}
            </Silian_Button>
            <Silian_Button
              onClick={() => Silian_updateMutation.mutate({ id: Silian_editingPasskey?.id, label: Silian_labelDraft })}
              disabled={!Silian_editingPasskey || Silian_updateMutation.isLoading}
            >
              {Silian_updateMutation.isLoading && <Silian_Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {Silian_t('common.save')}
            </Silian_Button>
          </Silian_DialogFooter>
        </Silian_DialogContent>
      </Silian_Dialog>
    </>
  );
}
