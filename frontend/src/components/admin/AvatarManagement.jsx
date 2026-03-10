import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { adminAPI } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { Loader2, RefreshCw, Edit, Trash2, RotateCcw, Star, Image as ImageIcon, Upload } from 'lucide-react';
import { uploadViaPresign } from '@/lib/r2Upload';
import { resolveR2ImageSource } from '@/lib/r2Image';
import R2Image from '@/components/common/R2Image';

const DEFAULT_FORM = {
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
const sanitizeCategory = (category) => {
  const raw = typeof category === 'string' ? category : '';
  const trimmed = raw.trim();
  if (!trimmed) {
    return 'default';
  }
  const normalized = trimmed
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .toLowerCase();
  return normalized || 'default';
};

const normalizeAvatar = (avatar = {}) => {
  if (!avatar || typeof avatar !== 'object') {
    return { ...DEFAULT_FORM };
  }
  const rawFilePath = typeof avatar.file_path === 'string' && avatar.file_path ? avatar.file_path : '';
  const sanitizedIconPath = typeof avatar.icon_path === 'string' ? avatar.icon_path.replace(/^[/]+/, '') : '';
  const normalizedPath = rawFilePath || (sanitizedIconPath ? `/${sanitizedIconPath}` : '');
  const iconUrl = avatar.icon_url || avatar.url || avatar.image_url || '';
  const normalizedCategory = sanitizeCategory(avatar.category);
  return {
    ...avatar,
    category: normalizedCategory,
    file_path: normalizedPath,
    icon_path: sanitizedIconPath || normalizedPath.replace(/^[/]+/, ''),
    icon_url: iconUrl,
    icon_presigned_url: avatar.icon_presigned_url || '',
    image_url: avatar.image_url || iconUrl || '',
    url: avatar.url || iconUrl || '',
  };
};

const resolveAvatarImage = (avatar = {}) => resolveR2ImageSource({
  urlCandidates: [avatar.icon_url, avatar.icon_presigned_url],
  pathCandidates: [avatar.file_path],
});


export function AvatarManagement() {
  const { t } = useTranslation();
  const [avatars, setAvatars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [formValues, setFormValues] = useState(DEFAULT_FORM);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, avatar: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const avatarInputRef = useRef(null);

  const fetchAvatars = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getAvatars({ include_inactive: true });
      if (response.data?.success) {
        const items = (response.data.data || []).map((item) => normalizeAvatar(item));
        setAvatars(items);
      }
    } catch (error) {
      console.error('Avatar list fetch failed:', error);
      toast.error(t('admin.avatars.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchAvatars();
  }, [fetchAvatars]);

  const resetForm = () => {
    setFormValues({ ...DEFAULT_FORM });
  };

  const handleEdit = (avatar) => {
    const normalized = normalizeAvatar(avatar);
    setFormValues({
      id: normalized.id,
      name: normalized.name || '',
      description: normalized.description || '',
      category: sanitizeCategory(normalized.category),
      file_path: normalized.file_path || '',
      icon_url: normalized.icon_url || normalized.image_url || '',
      icon_presigned_url: normalized.icon_presigned_url || '',
      sort_order: normalized.sort_order || 0,
      is_active: normalized.is_active === undefined ? true : !!normalized.is_active,
      is_default: !!normalized.is_default,
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: name === 'category' ? sanitizeCategory(value) : value,
    }));
  };

  const handleToggle = (field) => (checked) => {
    setFormValues((prev) => ({ ...prev, [field]: checked }));
  };

  const handleAvatarFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('admin.avatars.fileTooLarge'));
      event.target.value = '';
      return;
    }
    setUploadingAvatar(true);
    const category = sanitizeCategory(formValues.category);
    try {
      const result = await uploadViaPresign(file, {
        directory: `avatars/${category}`,
        entityType: 'avatar',
        entityId: formValues.id || undefined,
      });
      const info = result?.data || result;
      setFormValues((prev) => ({
        ...prev,
        file_path: info.file_path || prev.file_path,
        icon_url: info.url || info.public_url || prev.icon_url,
        icon_presigned_url: info.presigned_url || prev.icon_presigned_url,
      }));
      toast.success(t('admin.avatars.uploadSuccess'));
    } catch (error) {
      toast.error(error?.message || t('admin.avatars.uploadFailed'));
    } finally {
      setUploadingAvatar(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formValues.file_path) {
      toast.error(t('admin.avatars.fileRequired'));
      return;
    }

    const payload = {
      name: formValues.name,
      description: formValues.description,
      category: sanitizeCategory(formValues.category),
      file_path: formValues.file_path,
      sort_order: Number(formValues.sort_order) || 0,
      is_active: !!formValues.is_active,
      is_default: !!formValues.is_default,
    };

    try {
      setSaving(true);
      if (formValues.id) {
        await adminAPI.updateAvatar(formValues.id, payload);
        toast.success(t('admin.avatars.updateSuccess'));
      } else {
        await adminAPI.createAvatar(payload);
        toast.success(t('admin.avatars.createSuccess'));
      }
      resetForm();
      fetchAvatars();
    } catch (error) {
      toast.error(error.response?.data?.message || t('admin.avatars.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (avatar) => {
    const nextActive = !avatar.is_active;
    try {
      await adminAPI.updateAvatar(avatar.id, { is_active: nextActive });
      toast.success(nextActive
        ? t('admin.avatars.enabled')
        : t('admin.avatars.disabled'));
      setAvatars((prev) => prev.map((item) => (item.id === avatar.id ? { ...item, is_active: nextActive } : item)));
      setFormValues((prev) => {
        if (prev.id !== avatar.id) {
          return prev;
        }
        return { ...prev, is_active: nextActive };
      });
    } catch (error) {
      toast.error(error.response?.data?.message || t('admin.avatars.toggleFailed'));
    }
  };


  const setDefault = async (avatarId) => {
    try {
      await adminAPI.setDefaultAvatar(avatarId);
      toast.success(t('admin.avatars.setDefaultSuccess'));
      fetchAvatars();
    } catch (error) {
      toast.error(error.response?.data?.message || t('admin.avatars.setDefaultFailed'));
    }
  };

  const closeDeleteDialog = () => {
    setDeleteDialog({ open: false, avatar: null });
    setIsDeleting(false);
  };

  const requestDeleteAvatar = (avatar) => {
    setDeleteDialog({ open: true, avatar });
  };

  const handleDeleteAvatar = async () => {
    if (!deleteDialog.avatar) {
      return;
    }
    try {
      setIsDeleting(true);
      await adminAPI.deleteAvatar(deleteDialog.avatar.id);
      toast.success(t('admin.avatars.deleteSuccess'));
      closeDeleteDialog();
      fetchAvatars();
    } catch (error) {
      toast.error(error.response?.data?.message || t('admin.avatars.deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  const restoreAvatar = async (avatarId) => {
    try {
      await adminAPI.restoreAvatar(avatarId);
      toast.success(t('admin.avatars.restoreSuccess'));
      fetchAvatars();
    } catch (error) {
      toast.error(error.response?.data?.message || t('admin.avatars.restoreFailed'));
    }
  };

  const formattedAvatars = useMemo(() => avatars || [], [avatars]);
  const previewImage = resolveAvatarImage(formValues);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>{t('admin.avatars.listTitle')}</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchAvatars} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('common.refresh')}
            </Button>
            <Button variant="secondary" onClick={resetForm}>
              {t('admin.avatars.newAvatar')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              {t('common.loading')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.avatars.table.icon')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.avatars.table.name')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.avatars.table.category')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.avatars.table.status')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.avatars.table.sort')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.avatars.table.updated')}
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">
                      {t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {formattedAvatars.map((avatar) => {
                    const avatarImage = resolveAvatarImage(avatar);
                    return (
                      <tr key={avatar.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="w-12 h-12 rounded-full overflow-hidden border bg-gray-100 flex items-center justify-center">
                          {avatarImage.src || avatarImage.filePath ? (
                            <R2Image
                              src={avatarImage.src || undefined}
                              filePath={avatarImage.filePath || undefined}
                              alt={avatar.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{avatar.name}</div>
                        <div className="text-xs text-gray-500 truncate max-w-[180px]">{avatar.description}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{avatar.category || 'default'}</td>
                      <td className="px-4 py-3 space-x-2">
                        <Badge variant={avatar.is_active ? 'success' : 'secondary'}>
                          {avatar.is_active
                            ? t('admin.avatars.active')
                            : t('admin.avatars.inactive')}
                        </Badge>
                        {avatar.is_default && (
                          <Badge variant="outline">{t('admin.avatars.default')}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{avatar.sort_order}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {avatar.updated_at
                          ? format(new Date(avatar.updated_at), 'yyyy-MM-dd HH:mm')
                          : '--'}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(avatar)}>
                          <Edit className="h-4 w-4 mr-1" />
                          {t('common.edit')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleActive(avatar)}>
                          {avatar.is_active
                            ? t('admin.avatars.disable')
                            : t('admin.avatars.enable')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDefault(avatar.id)} disabled={avatar.is_default}>
                          <Star className="h-4 w-4 mr-1" />
                          {t('admin.avatars.setDefault')}
                        </Button>
                        {avatar.deleted_at ? (
                          <Button variant="ghost" size="sm" onClick={() => restoreAvatar(avatar.id)}>
                            <RotateCcw className="h-4 w-4 mr-1" />
                            {t('admin.avatars.restore')}
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => requestDeleteAvatar(avatar)}>
                            <Trash2 className="h-4 w-4 mr-1" />
                            {t('admin.avatars.delete')}
                          </Button>
                        )}
                      </td>
                      </tr>
                    );
                  })}
                  {formattedAvatars.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500">
                        {t('admin.avatars.empty')} 
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {formValues.id
              ? t('admin.avatars.editTitle')
              : t('admin.avatars.createTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {t('admin.avatars.fields.name')}
                </label>
                <Input
                  name="name"
                  value={formValues.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {t('admin.avatars.fields.description')}
                </label>
                <Textarea
                  name="description"
                  value={formValues.description}
                  onChange={handleInputChange}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {t('admin.avatars.fields.category')}
                </label>
                <Input
                  name="category"
                  value={formValues.category}
                  onChange={handleInputChange}
                  placeholder="default"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {t('admin.avatars.fields.icon')}
                </label>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="flex items-center gap-2"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {t('admin.avatars.selectFile')}
                </Button>
                <p className="text-xs text-gray-500">
                  {t('admin.avatars.uploadHint')}
                </p>
                {(formValues.icon_presigned_url || formValues.icon_url || formValues.file_path) && (
                  <div className="mt-2 w-20 h-20 rounded-full overflow-hidden border">
                    <R2Image
                      src={previewImage.src || undefined}
                      filePath={previewImage.filePath || undefined}
                      alt={formValues.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {t('admin.avatars.fields.sortOrder')}
                </label>
                <Input
                  type="number"
                  name="sort_order"
                  value={formValues.sort_order}
                  onChange={handleInputChange}
                />
              </div>
              <div className="flex items-center justify-between bg-gray-50 border rounded-md px-3 py-2">
                <span className="text-sm text-gray-700">{t('admin.avatars.fields.active')}</span>
                <Switch
                  checked={formValues.is_active}
                  onCheckedChange={handleToggle('is_active')}
                  aria-label={t('admin.avatars.fields.active')}
                />
              </div>
              <div className="flex items-center justify-between bg-gray-50 border rounded-md px-3 py-2">
                <span className="text-sm text-gray-700">{t('admin.avatars.fields.default')}</span>
                <Switch
                  checked={formValues.is_default}
                  onCheckedChange={handleToggle('is_default')}
                  aria-label={t('admin.avatars.fields.default')}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ImageIcon className="h-4 w-4 mr-2" />
                  )}
                  {formValues.id
                    ? t('admin.avatars.updateAction')
                    : t('admin.avatars.createAction')}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => (!open ? closeDeleteDialog() : null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.avatars.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.avatars.deleteConfirm')}
              {deleteDialog.avatar?.name ? ` (${deleteDialog.avatar.name})` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDeleteDialog}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAvatar}
              className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-600"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

export default AvatarManagement;
