import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { format } from 'date-fns';
import { PlusCircle, Edit, Trash2, RotateCcw, Loader2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { adminAPI } from '../../lib/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Pagination } from '../ui/Pagination';
import { toast } from 'react-hot-toast';

const DEFAULT_FORM = {
  id: null,
  name_zh: '',
  name_en: '',
  category: '',
  unit: 'times',
  carbon_factor: '',
  description_zh: '',
  description_en: '',
  icon: '',
  sort_order: 0,
  is_active: true,
};

const UNIT_OPTIONS = ['times', 'km', 'kg', 'hours', 'kWh', 'liters', 'days', 'minutes', 'sheets'];

export default function ActivityLibrary() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ search: '', category: '', status: 'active', page: 1, limit: 10 });
  const [formState, setFormState] = useState(DEFAULT_FORM);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, activity: null });

  const queryKey = ['adminActivitiesLibrary', filters];
  const query = useQuery(queryKey, async () => {
    const includeInactive = filters.status === 'inactive' || filters.status === 'all';
    const includeDeleted = filters.status === 'deleted';
    const statusParam = filters.status && filters.status !== 'all' ? filters.status : undefined;

    const params = {
      page: filters.page,
      limit: filters.limit,
      search: filters.search || undefined,
      category: filters.category || undefined,
      include_inactive: includeInactive ? 'true' : undefined,
      include_deleted: includeDeleted ? 'true' : undefined,
      status: statusParam,
    };

    const response = await adminAPI.getActivities(params);
    return response.data;
  }, { keepPreviousData: true });

  const activities = query.data?.data?.activities ?? [];
  const pagination = query.data?.data?.pagination ?? { page: filters.page, limit: filters.limit, total: activities.length, pages: 1 };
  const categories = useMemo(() => query.data?.data?.categories ?? [], [query.data]);

  const closeModal = () => {
    setIsModalOpen(false);
    setFormError('');
    setFormState(DEFAULT_FORM);
    setEditingId(null);
  };

  const openCreate = () => {
    setEditingId(null);
    setFormState({ ...DEFAULT_FORM });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEdit = (activity) => {
    setEditingId(activity.id);
    setFormState({
      id: activity.id,
      name_zh: activity.name_zh || '',
      name_en: activity.name_en || '',
      category: activity.category || '',
      unit: activity.unit || 'times',
      carbon_factor: activity.carbon_factor ?? '',
      description_zh: activity.description_zh || '',
      description_en: activity.description_en || '',
      icon: activity.icon || '',
      sort_order: activity.sort_order ?? 0,
      is_active: Boolean(activity.is_active),
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const createMutation = useMutation((payload) => adminAPI.createActivity(payload), {
    onSuccess: () => {
      toast.success(t('admin.activities.library.saveSuccess'));
      queryClient.invalidateQueries('adminActivitiesLibrary');
      closeModal();
    },
    onError: () => toast.error(t('common.error')),
  });

  const updateMutation = useMutation((payload) => adminAPI.updateActivity(payload.id, payload.data), {
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries('adminActivitiesLibrary');
      if (variables?.mode === 'toggle') {
        toast.success(t('admin.activities.library.toggleActiveSuccess'));
      } else {
        toast.success(t('admin.activities.library.saveSuccess'));
        closeModal();
      }
    },
    onError: () => toast.error(t('common.error')),
  });

  const deleteMutation = useMutation((id) => adminAPI.deleteActivity(id), {
    onSuccess: () => {
      toast.success(t('admin.activities.library.deleteSuccess'));
      queryClient.invalidateQueries('adminActivitiesLibrary');
      setConfirmDelete({ open: false, activity: null });
    },
    onError: () => toast.error(t('common.error')),
  });

  const restoreMutation = useMutation((id) => adminAPI.restoreActivity(id), {
    onSuccess: () => {
      toast.success(t('admin.activities.library.restoreSuccess'));
      queryClient.invalidateQueries('adminActivitiesLibrary');
    },
    onError: () => toast.error(t('common.error')),
  });

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: key === 'page' ? value : 1 }));
  };

  const handleFormChange = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleFormSubmit = () => {
    const payload = {
      name_zh: formState.name_zh.trim(),
      name_en: formState.name_en.trim(),
      category: formState.category.trim(),
      unit: formState.unit.trim() || 'times',
      carbon_factor: parseFloat(formState.carbon_factor),
      description_zh: formState.description_zh.trim() || null,
      description_en: formState.description_en.trim() || null,
      icon: formState.icon.trim() || null,
      sort_order: Number.isFinite(Number(formState.sort_order)) ? Number(formState.sort_order) : 0,
      is_active: Boolean(formState.is_active),
    };

    if (!payload.name_zh || !payload.name_en || !payload.category || !payload.unit || Number.isNaN(payload.carbon_factor)) {
      setFormError(t('admin.activities.library.validationError'));
      return;
    }

    setFormError('');
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleToggleActive = (activity, next) => {
    updateMutation.mutate({ id: activity.id, data: { is_active: next }, mode: 'toggle' });
  };

  const handleDelete = (activity) => {
    setConfirmDelete({ open: true, activity });
  };

  const handleConfirmDelete = () => {
    if (confirmDelete.activity) {
      deleteMutation.mutate(confirmDelete.activity.id);
    }
  };

  const busy = createMutation.isLoading || updateMutation.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('admin.activities.library.title')}</h2>
          <p className="text-muted-foreground">
            {t('admin.activities.library.description')}
          </p>
        </div>
        <Button onClick={openCreate} className="w-full md:w-auto">
          <PlusCircle className="mr-2 h-4 w-4" />
          {t('admin.activities.library.create')}
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('admin.activities.library.filters.search')}
            </label>
            <Input
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder={t('admin.activities.library.searchPlaceholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('admin.activities.library.filters.category')}
            </label>
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">{t('common.all')}</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('admin.activities.library.filters.status')}
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="active">{t('admin.activities.library.status.active')}</option>
              <option value="inactive">{t('admin.activities.library.status.inactive')}</option>
              <option value="deleted">{t('admin.activities.library.status.deleted')}</option>
              <option value="all">{t('admin.activities.library.status.all')}</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.activities.library.table.name')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.activities.library.table.category')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.activities.library.table.unit')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.activities.library.table.carbon_factor')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.activities.library.table.status')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.activities.library.table.updated_at')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.activities.library.table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {query.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500">
                    {t('admin.activities.library.empty')}
                  </td>
                </tr>
              ) : (
                activities.map((activity) => {
                  const updatedAt = activity.updated_at ? format(new Date(activity.updated_at), 'yyyy-MM-dd HH:mm') : '—';
                  const statusLabel = activity.deleted_at
                    ? t('admin.activities.library.status.deleted')
                    : activity.is_active
                      ? t('admin.activities.library.status.active')
                      : t('admin.activities.library.status.inactive');

                  return (
                    <tr key={activity.id}>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-semibold text-gray-900">{activity.name_zh}</div>
                        <div className="text-gray-500 text-xs">{activity.name_en}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge variant="secondary">{activity.category || '—'}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{activity.unit}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{Number(activity.carbon_factor).toFixed(4)}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Switch
                            disabled={Boolean(activity.deleted_at)}
                            checked={Boolean(activity.is_active)}
                            onCheckedChange={(checked) => handleToggleActive(activity, checked)}
                          />
                          <span className="text-xs text-gray-600">{statusLabel}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{updatedAt}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!activity.deleted_at && (
                            <Button variant="outline" size="sm" onClick={() => openEdit(activity)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {activity.deleted_at ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => restoreMutation.mutate(activity.id)}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(activity)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.pages}
          onPageChange={(page) => handleFilterChange('page', page)}
          itemsPerPage={pagination.limit}
          totalItems={pagination.total}
        />
      </div>

      <Dialog open={isModalOpen} onOpenChange={(open) => !open && !busy && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? t('admin.activities.library.edit')
                : t('admin.activities.library.create')}
            </DialogTitle>
            <DialogDescription>
              {t('admin.activities.library.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.activities.library.fields.name_zh')}
                </label>
                <Input
                  value={formState.name_zh}
                  onChange={(e) => handleFormChange('name_zh', e.target.value)}
                  placeholder="例如：公交地铁通勤"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.activities.library.fields.name_en')}
                </label>
                <Input
                  value={formState.name_en}
                  onChange={(e) => handleFormChange('name_en', e.target.value)}
                  placeholder="e.g. Use public transport"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.activities.library.fields.category')}
                </label>
                <Input
                  value={formState.category}
                  onChange={(e) => handleFormChange('category', e.target.value)}
                  placeholder="transport"
                  list="activity-category-options"
                />
                <datalist id="activity-category-options">
                  {categories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.activities.library.fields.unit')}
                </label>
                <select
                  value={formState.unit}
                  onChange={(e) => handleFormChange('unit', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  {UNIT_OPTIONS.map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.activities.library.fields.carbon_factor')}
                </label>
                <Input
                  type="number"
                  step="0.0001"
                  value={formState.carbon_factor}
                  onChange={(e) => handleFormChange('carbon_factor', e.target.value)}
                  placeholder="0.1234"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.activities.library.fields.sort_order')}
                </label>
                <Input
                  type="number"
                  value={formState.sort_order}
                  onChange={(e) => handleFormChange('sort_order', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.activities.library.fields.description_zh')}
                </label>
                <Textarea
                  value={formState.description_zh}
                  onChange={(e) => handleFormChange('description_zh', e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.activities.library.fields.description_en')}
                </label>
                <Textarea
                  value={formState.description_en}
                  onChange={(e) => handleFormChange('description_en', e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.activities.library.fields.icon')}
                </label>
                <Input
                  value={formState.icon}
                  onChange={(e) => handleFormChange('icon', e.target.value)}
                  placeholder="optional"
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('admin.activities.library.fields.is_active')}
                  </label>
                  <Switch
                    checked={Boolean(formState.is_active)}
                    onCheckedChange={(checked) => handleFormChange('is_active', checked)}
                  />
                </div>
              </div>
            </div>

            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeModal} disabled={busy}>
              {t('admin.activities.library.actions.cancel')}
            </Button>
            <Button onClick={handleFormSubmit} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('admin.activities.library.actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete.open} onOpenChange={(open) => !open && setConfirmDelete({ open: false, activity: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.activities.library.actions.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.activities.library.confirmDelete')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              {deleteMutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
