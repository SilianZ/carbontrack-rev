import Silian_React, { useCallback as Silian_useCallback, useEffect as Silian_useEffect, useMemo as Silian_useMemo, useRef as Silian_useRef, useState as Silian_useState } from 'react';
import { Card as Silian_Card, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle, CardContent as Silian_CardContent } from '@/components/ui/Card';
import { Button as Silian_Button } from '@/components/ui/Button';
import { Input as Silian_Input } from '@/components/ui/Input';
import { Textarea as Silian_Textarea } from '@/components/ui/textarea';
import { Switch as Silian_Switch } from '@/components/ui/switch';
import { Badge as Silian_Badge } from '@/components/ui/badge';
import {
  AlertDialog as Silian_AlertDialog,
  AlertDialogAction as Silian_AlertDialogAction,
  AlertDialogCancel as Silian_AlertDialogCancel,
  AlertDialogContent as Silian_AlertDialogContent,
  AlertDialogDescription as Silian_AlertDialogDescription,
  AlertDialogFooter as Silian_AlertDialogFooter,
  AlertDialogHeader as Silian_AlertDialogHeader,
  AlertDialogTitle as Silian_AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { adminAPI as Silian_adminAPI } from '@/lib/api';
import { useTranslation as Silian_useTranslation } from '@/hooks/useTranslation';
import { toast as Silian_toast } from 'react-hot-toast';
import { format as Silian_format } from 'date-fns';
import { Loader2 as Silian_Loader2, RefreshCw as Silian_RefreshCw, Edit as Silian_Edit, Trash2 as Silian_Trash2, RotateCcw as Silian_RotateCcw, Star as Silian_Star, Image as Silian_ImageIcon, Upload as Silian_Upload } from 'lucide-react';
import { uploadViaPresign as Silian_uploadViaPresign } from '@/lib/r2Upload';
import { resolveR2ImageSource as Silian_resolveR2ImageSource } from '@/lib/r2Image';
import Silian_R2Image from '@/components/common/R2Image';

const Silian_DEFAULT_FORM = {
  id: null,
  name: '',
  description: '',
  category: 'default',
  file_path: '',
  icon_url: '',
  icon_presigned_url: '',
  sort_order: 0,
  is_active: true,
  is_default: false,
};
const Silian_sanitizeCategory = (Silian_category) => {
  const Silian_raw = typeof Silian_category === 'string' ? Silian_category : '';
  const Silian_trimmed = Silian_raw.trim();
  if (!Silian_trimmed) {
    return 'default';
  }
  const Silian_normalized = Silian_trimmed
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .toLowerCase();
  return Silian_normalized || 'default';
};

const Silian_normalizeAvatar = (Silian_avatar = {}) => {
  if (!Silian_avatar || typeof Silian_avatar !== 'object') {
    return { ...Silian_DEFAULT_FORM };
  }
  const Silian_rawFilePath = typeof Silian_avatar.file_path === 'string' && Silian_avatar.file_path ? Silian_avatar.file_path : '';
  const Silian_sanitizedIconPath = typeof Silian_avatar.icon_path === 'string' ? Silian_avatar.icon_path.replace(/^[/]+/, '') : '';
  const Silian_normalizedPath = Silian_rawFilePath || (Silian_sanitizedIconPath ? `/${Silian_sanitizedIconPath}` : '');
  const Silian_iconUrl = Silian_avatar.icon_url || Silian_avatar.url || Silian_avatar.image_url || '';
  const Silian_normalizedCategory = Silian_sanitizeCategory(Silian_avatar.category);
  return {
    ...Silian_avatar,
    category: Silian_normalizedCategory,
    file_path: Silian_normalizedPath,
    icon_path: Silian_sanitizedIconPath || Silian_normalizedPath.replace(/^[/]+/, ''),
    icon_url: Silian_iconUrl,
    icon_presigned_url: Silian_avatar.icon_presigned_url || '',
    image_url: Silian_avatar.image_url || Silian_iconUrl || '',
    url: Silian_avatar.url || Silian_iconUrl || '',
  };
};

const Silian_resolveAvatarImage = (Silian_avatar = {}) => Silian_resolveR2ImageSource({
  urlCandidates: [Silian_avatar.icon_url, Silian_avatar.icon_presigned_url],
  pathCandidates: [Silian_avatar.file_path],
});


export function AvatarManagement() {
  const { t: Silian_t } = Silian_useTranslation(['admin', 'common']);
  const [Silian_avatars, Silian_setAvatars] = Silian_useState([]);
  const [Silian_loading, Silian_setLoading] = Silian_useState(true);
  const [Silian_saving, Silian_setSaving] = Silian_useState(false);
  const [Silian_uploadingAvatar, Silian_setUploadingAvatar] = Silian_useState(false);
  const [Silian_formValues, Silian_setFormValues] = Silian_useState(Silian_DEFAULT_FORM);
  const [Silian_deleteDialog, Silian_setDeleteDialog] = Silian_useState({ open: false, avatar: null });
  const [Silian_isDeleting, Silian_setIsDeleting] = Silian_useState(false);
  const Silian_avatarInputRef = Silian_useRef(null);

  const Silian_fetchAvatars = Silian_useCallback(async () => {
    try {
      Silian_setLoading(true);
      const Silian_response = await Silian_adminAPI.getAvatars({ include_inactive: true });
      if (Silian_response.data?.success) {
        const Silian_items = (Silian_response.data.data || []).map((Silian_item) => Silian_normalizeAvatar(Silian_item));
        Silian_setAvatars(Silian_items);
      }
    } catch (Silian_error) {
      console.error('Avatar list fetch failed:', Silian_error);
      Silian_toast.error(Silian_t('admin.avatars.loadFailed'));
    } finally {
      Silian_setLoading(false);
    }
  }, [Silian_t]);

  Silian_useEffect(() => {
    Silian_fetchAvatars();
  }, [Silian_fetchAvatars]);

  const Silian_resetForm = () => {
    Silian_setFormValues({ ...Silian_DEFAULT_FORM });
  };

  const Silian_handleEdit = (Silian_avatar) => {
    const Silian_normalized = Silian_normalizeAvatar(Silian_avatar);
    Silian_setFormValues({
      id: Silian_normalized.id,
      name: Silian_normalized.name || '',
      description: Silian_normalized.description || '',
      category: Silian_sanitizeCategory(Silian_normalized.category),
      file_path: Silian_normalized.file_path || '',
      icon_url: Silian_normalized.icon_url || Silian_normalized.image_url || '',
      icon_presigned_url: Silian_normalized.icon_presigned_url || '',
      sort_order: Silian_normalized.sort_order || 0,
      is_active: Silian_normalized.is_active === undefined ? true : !!Silian_normalized.is_active,
      is_default: !!Silian_normalized.is_default,
    });
  };

  const Silian_handleInputChange = (Silian_e) => {
    const { name: Silian_name, value: Silian_value } = Silian_e.target;
    Silian_setFormValues((Silian_prev) => ({
      ...Silian_prev,
      [Silian_name]: Silian_name === 'category' ? Silian_sanitizeCategory(Silian_value) : Silian_value,
    }));
  };

  const Silian_handleToggle = (Silian_field) => (Silian_checked) => {
    Silian_setFormValues((Silian_prev) => ({ ...Silian_prev, [Silian_field]: Silian_checked }));
  };

  const Silian_handleAvatarFileChange = async (Silian_event) => {
    const Silian_file = Silian_event.target.files?.[0];
    if (!Silian_file) return;
    if (Silian_file.size > 5 * 1024 * 1024) {
      Silian_toast.error(Silian_t('admin.avatars.fileTooLarge'));
      Silian_event.target.value = '';
      return;
    }
    Silian_setUploadingAvatar(true);
    const Silian_category = Silian_sanitizeCategory(Silian_formValues.category);
    try {
      const Silian_result = await Silian_uploadViaPresign(Silian_file, {
        directory: `avatars/${Silian_category}`,
        entityType: 'avatar',
        entityId: Silian_formValues.id || undefined,
      });
      const Silian_info = Silian_result?.data || Silian_result;
      Silian_setFormValues((Silian_prev) => ({
        ...Silian_prev,
        file_path: Silian_info.file_path || Silian_prev.file_path,
        icon_url: Silian_info.url || Silian_info.public_url || Silian_prev.icon_url,
        icon_presigned_url: Silian_info.presigned_url || Silian_prev.icon_presigned_url,
      }));
      Silian_toast.success(Silian_t('admin.avatars.uploadSuccess'));
    } catch (Silian_error) {
      Silian_toast.error(Silian_error?.message || Silian_t('admin.avatars.uploadFailed'));
    } finally {
      Silian_setUploadingAvatar(false);
      if (Silian_event.target) {
        Silian_event.target.value = '';
      }
    }
  };

  const Silian_handleSubmit = async (Silian_e) => {
    Silian_e.preventDefault();
    if (!Silian_formValues.file_path) {
      Silian_toast.error(Silian_t('admin.avatars.fileRequired'));
      return;
    }

    const Silian_payload = {
      name: Silian_formValues.name,
      description: Silian_formValues.description,
      category: Silian_sanitizeCategory(Silian_formValues.category),
      file_path: Silian_formValues.file_path,
      sort_order: Number(Silian_formValues.sort_order) || 0,
      is_active: !!Silian_formValues.is_active,
      is_default: !!Silian_formValues.is_default,
    };

    try {
      Silian_setSaving(true);
      if (Silian_formValues.id) {
        await Silian_adminAPI.updateAvatar(Silian_formValues.id, Silian_payload);
        Silian_toast.success(Silian_t('admin.avatars.updateSuccess'));
      } else {
        await Silian_adminAPI.createAvatar(Silian_payload);
        Silian_toast.success(Silian_t('admin.avatars.createSuccess'));
      }
      Silian_resetForm();
      Silian_fetchAvatars();
    } catch (Silian_error) {
      Silian_toast.error(Silian_error.response?.data?.message || Silian_t('admin.avatars.saveFailed'));
    } finally {
      Silian_setSaving(false);
    }
  };

  const Silian_toggleActive = async (Silian_avatar) => {
    const Silian_nextActive = !Silian_avatar.is_active;
    try {
      await Silian_adminAPI.updateAvatar(Silian_avatar.id, { is_active: Silian_nextActive });
      Silian_toast.success(Silian_nextActive
        ? Silian_t('admin.avatars.enabled')
        : Silian_t('admin.avatars.disabled'));
      Silian_setAvatars((Silian_prev) => Silian_prev.map((Silian_item) => (Silian_item.id === Silian_avatar.id ? { ...Silian_item, is_active: Silian_nextActive } : Silian_item)));
      Silian_setFormValues((Silian_prev) => {
        if (Silian_prev.id !== Silian_avatar.id) {
          return Silian_prev;
        }
        return { ...Silian_prev, is_active: Silian_nextActive };
      });
    } catch (Silian_error) {
      Silian_toast.error(Silian_error.response?.data?.message || Silian_t('admin.avatars.toggleFailed'));
    }
  };


  const Silian_setDefault = async (Silian_avatarId) => {
    try {
      await Silian_adminAPI.setDefaultAvatar(Silian_avatarId);
      Silian_toast.success(Silian_t('admin.avatars.setDefaultSuccess'));
      Silian_fetchAvatars();
    } catch (Silian_error) {
      Silian_toast.error(Silian_error.response?.data?.message || Silian_t('admin.avatars.setDefaultFailed'));
    }
  };

  const Silian_closeDeleteDialog = () => {
    Silian_setDeleteDialog({ open: false, avatar: null });
    Silian_setIsDeleting(false);
  };

  const Silian_requestDeleteAvatar = (Silian_avatar) => {
    Silian_setDeleteDialog({ open: true, avatar: Silian_avatar });
  };

  const Silian_handleDeleteAvatar = async () => {
    if (!Silian_deleteDialog.avatar) {
      return;
    }
    try {
      Silian_setIsDeleting(true);
      await Silian_adminAPI.deleteAvatar(Silian_deleteDialog.avatar.id);
      Silian_toast.success(Silian_t('admin.avatars.deleteSuccess'));
      Silian_closeDeleteDialog();
      Silian_fetchAvatars();
    } catch (Silian_error) {
      Silian_toast.error(Silian_error.response?.data?.message || Silian_t('admin.avatars.deleteFailed'));
    } finally {
      Silian_setIsDeleting(false);
    }
  };

  const Silian_restoreAvatar = async (Silian_avatarId) => {
    try {
      await Silian_adminAPI.restoreAvatar(Silian_avatarId);
      Silian_toast.success(Silian_t('admin.avatars.restoreSuccess'));
      Silian_fetchAvatars();
    } catch (Silian_error) {
      Silian_toast.error(Silian_error.response?.data?.message || Silian_t('admin.avatars.restoreFailed'));
    }
  };

  const Silian_formattedAvatars = Silian_useMemo(() => Silian_avatars || [], [Silian_avatars]);
  const Silian_previewImage = Silian_resolveAvatarImage(Silian_formValues);

  return (
    <div className="space-y-6">
      <Silian_Card>
        <Silian_CardHeader className="flex items-center justify-between">
          <Silian_CardTitle>{Silian_t('admin.avatars.listTitle')}</Silian_CardTitle>
          <div className="flex items-center gap-2">
            <Silian_Button variant="outline" onClick={Silian_fetchAvatars} disabled={Silian_loading}>
              <Silian_RefreshCw className={`h-4 w-4 mr-2 ${Silian_loading ? 'animate-spin' : ''}`} />
              {Silian_t('common.refresh')}
            </Silian_Button>
            <Silian_Button variant="secondary" onClick={Silian_resetForm}>
              {Silian_t('admin.avatars.newAvatar')}
            </Silian_Button>
          </div>
        </Silian_CardHeader>
        <Silian_CardContent>
          {Silian_loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <Silian_Loader2 className="h-5 w-5 mr-2 animate-spin" />
              {Silian_t('common.loading')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium uppercase tracking-wider text-muted-foreground">
                      {Silian_t('admin.avatars.table.icon')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium uppercase tracking-wider text-muted-foreground">
                      {Silian_t('admin.avatars.table.name')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium uppercase tracking-wider text-muted-foreground">
                      {Silian_t('admin.avatars.table.category')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium uppercase tracking-wider text-muted-foreground">
                      {Silian_t('admin.avatars.table.status')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium uppercase tracking-wider text-muted-foreground">
                      {Silian_t('admin.avatars.table.sort')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium uppercase tracking-wider text-muted-foreground">
                      {Silian_t('admin.avatars.table.updated')}
                    </th>
                    <th className="px-4 py-3 text-right font-medium uppercase tracking-wider text-muted-foreground">
                      {Silian_t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {Silian_formattedAvatars.map((Silian_avatar) => {
                    const Silian_avatarImage = Silian_resolveAvatarImage(Silian_avatar);
                    return (
                      <tr key={Silian_avatar.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border bg-muted">
                          {Silian_avatarImage.src || Silian_avatarImage.filePath ? (
                            <Silian_R2Image
                              src={Silian_avatarImage.src || undefined}
                              filePath={Silian_avatarImage.filePath || undefined}
                              alt={Silian_avatar.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Silian_ImageIcon className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{Silian_avatar.name}</div>
                        <div className="max-w-[180px] truncate text-xs text-muted-foreground">{Silian_avatar.description}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground/80">{Silian_avatar.category || 'default'}</td>
                      <td className="px-4 py-3 space-x-2">
                        <Silian_Badge variant={Silian_avatar.is_active ? 'success' : 'secondary'}>
                          {Silian_avatar.is_active
                            ? Silian_t('admin.avatars.active')
                            : Silian_t('admin.avatars.inactive')}
                        </Silian_Badge>
                        {Silian_avatar.is_default && (
                          <Silian_Badge variant="outline">{Silian_t('admin.avatars.default')}</Silian_Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground/80">{Silian_avatar.sort_order}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {Silian_avatar.updated_at
                          ? Silian_format(new Date(Silian_avatar.updated_at), 'yyyy-MM-dd HH:mm')
                          : '--'}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Silian_Button variant="ghost" size="sm" onClick={() => Silian_handleEdit(Silian_avatar)}>
                          <Silian_Edit className="h-4 w-4 mr-1" />
                          {Silian_t('common.edit')}
                        </Silian_Button>
                        <Silian_Button variant="ghost" size="sm" onClick={() => Silian_toggleActive(Silian_avatar)}>
                          {Silian_avatar.is_active
                            ? Silian_t('admin.avatars.disable')
                            : Silian_t('admin.avatars.enable')}
                        </Silian_Button>
                        <Silian_Button variant="ghost" size="sm" onClick={() => Silian_setDefault(Silian_avatar.id)} disabled={Silian_avatar.is_default}>
                          <Silian_Star className="h-4 w-4 mr-1" />
                          {Silian_t('admin.avatars.setDefault')}
                        </Silian_Button>
                        {Silian_avatar.deleted_at ? (
                          <Silian_Button variant="ghost" size="sm" onClick={() => Silian_restoreAvatar(Silian_avatar.id)}>
                            <Silian_RotateCcw className="h-4 w-4 mr-1" />
                            {Silian_t('admin.avatars.restore')}
                          </Silian_Button>
                        ) : (
                          <Silian_Button variant="ghost" size="sm" onClick={() => Silian_requestDeleteAvatar(Silian_avatar)}>
                            <Silian_Trash2 className="h-4 w-4 mr-1" />
                            {Silian_t('admin.avatars.delete')}
                          </Silian_Button>
                        )}
                      </td>
                      </tr>
                    );
                  })}
                  {Silian_formattedAvatars.length === 0 && !Silian_loading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
                        {Silian_t('admin.avatars.empty')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Silian_CardContent>
      </Silian_Card>

      <Silian_Card>
        <Silian_CardHeader>
          <Silian_CardTitle>
            {Silian_formValues.id
              ? Silian_t('admin.avatars.editTitle')
              : Silian_t('admin.avatars.createTitle')}
          </Silian_CardTitle>
        </Silian_CardHeader>
        <Silian_CardContent>
          <form onSubmit={Silian_handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {Silian_t('admin.avatars.fields.name')}
                </label>
                <Silian_Input
                  name="name"
                  value={Silian_formValues.name}
                  onChange={Silian_handleInputChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {Silian_t('admin.avatars.fields.description')}
                </label>
                <Silian_Textarea
                  name="description"
                  value={Silian_formValues.description}
                  onChange={Silian_handleInputChange}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {Silian_t('admin.avatars.fields.category')}
                </label>
                <Silian_Input
                  name="category"
                  value={Silian_formValues.category}
                  onChange={Silian_handleInputChange}
                  placeholder="default"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {Silian_t('admin.avatars.fields.icon')}
                </label>
                <input
                  ref={Silian_avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={Silian_handleAvatarFileChange}
                />
                <Silian_Button
                  type="button"
                  variant="outline"
                  onClick={() => Silian_avatarInputRef.current?.click()}
                  disabled={Silian_uploadingAvatar}
                  className="flex items-center gap-2"
                >
                  {Silian_uploadingAvatar ? (
                    <Silian_Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Silian_Upload className="h-4 w-4" />
                  )}
                  {Silian_t('admin.avatars.selectFile')}
                </Silian_Button>
                <p className="text-xs text-muted-foreground">
                  {Silian_t('admin.avatars.uploadHint')}
                </p>
                {(Silian_formValues.icon_presigned_url || Silian_formValues.icon_url || Silian_formValues.file_path) && (
                  <div className="mt-2 w-20 h-20 rounded-full overflow-hidden border">
                    <Silian_R2Image
                      src={Silian_previewImage.src || undefined}
                      filePath={Silian_previewImage.filePath || undefined}
                      alt={Silian_formValues.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {Silian_t('admin.avatars.fields.sortOrder')}
                </label>
                <Silian_Input
                  type="number"
                  name="sort_order"
                  value={Silian_formValues.sort_order}
                  onChange={Silian_handleInputChange}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                <span className="text-sm text-foreground">{Silian_t('admin.avatars.fields.active')}</span>
                <Silian_Switch
                  checked={Silian_formValues.is_active}
                  onCheckedChange={Silian_handleToggle('is_active')}
                  aria-label={Silian_t('admin.avatars.fields.active')}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                <span className="text-sm text-foreground">{Silian_t('admin.avatars.fields.default')}</span>
                <Silian_Switch
                  checked={Silian_formValues.is_default}
                  onCheckedChange={Silian_handleToggle('is_default')}
                  aria-label={Silian_t('admin.avatars.fields.default')}
                />
              </div>

              <div className="flex items-center gap-2">
                <Silian_Button type="submit" disabled={Silian_saving}>
                  {Silian_saving ? (
                    <Silian_Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Silian_ImageIcon className="h-4 w-4 mr-2" />
                  )}
                  {Silian_formValues.id
                    ? Silian_t('admin.avatars.updateAction')
                    : Silian_t('admin.avatars.createAction')}
                </Silian_Button>
                <Silian_Button type="button" variant="outline" onClick={Silian_resetForm}>
                  {Silian_t('common.cancel')}
                </Silian_Button>
              </div>
            </div>
          </form>
        </Silian_CardContent>
      </Silian_Card>
      <Silian_AlertDialog open={Silian_deleteDialog.open} onOpenChange={(Silian_open) => (!Silian_open ? Silian_closeDeleteDialog() : null)}>
        <Silian_AlertDialogContent className="sm:max-w-md">
          <Silian_AlertDialogHeader>
            <Silian_AlertDialogTitle>{Silian_t('admin.avatars.deleteTitle')}</Silian_AlertDialogTitle>
            <Silian_AlertDialogDescription>
              {Silian_t('admin.avatars.deleteConfirm')}
              {Silian_deleteDialog.avatar?.name ? ` (${Silian_deleteDialog.avatar.name})` : ''}
            </Silian_AlertDialogDescription>
          </Silian_AlertDialogHeader>
          <Silian_AlertDialogFooter>
            <Silian_AlertDialogCancel onClick={Silian_closeDeleteDialog}>{Silian_t('common.cancel')}</Silian_AlertDialogCancel>
            <Silian_AlertDialogAction
              onClick={Silian_handleDeleteAvatar}
              className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-600"
              disabled={Silian_isDeleting}
            >
              {Silian_isDeleting ? (
                <Silian_Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Silian_Trash2 className="mr-2 h-4 w-4" />
              )}
              {Silian_t('common.confirm')}
            </Silian_AlertDialogAction>
          </Silian_AlertDialogFooter>
        </Silian_AlertDialogContent>
      </Silian_AlertDialog>

    </div>
  );
}

export default AvatarManagement;
