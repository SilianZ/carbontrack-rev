import Silian_React, { useMemo as Silian_useMemo, useState as Silian_useState } from 'react';
import { useQuery as Silian_useQuery, useMutation as Silian_useMutation, useQueryClient as Silian_useQueryClient } from 'react-query';
import { format as Silian_format } from 'date-fns';
import { PlusCircle as Silian_PlusCircle, Edit as Silian_Edit, Trash2 as Silian_Trash2, RotateCcw as Silian_RotateCcw, Loader2 as Silian_Loader2 } from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { adminAPI as Silian_adminAPI } from '../../lib/api';
import { Button as Silian_Button } from '../ui/Button';
import { Input as Silian_Input } from '../ui/Input';
import { Textarea as Silian_Textarea } from '../ui/textarea';
import { Switch as Silian_Switch } from '../ui/switch';
import { Badge as Silian_Badge } from '../ui/badge';
import { Dialog as Silian_Dialog, DialogContent as Silian_DialogContent, DialogDescription as Silian_DialogDescription, DialogFooter as Silian_DialogFooter, DialogHeader as Silian_DialogHeader, DialogTitle as Silian_DialogTitle } from '../ui/dialog';
import {
  AlertDialog as Silian_AlertDialog,
  AlertDialogAction as Silian_AlertDialogAction,
  AlertDialogCancel as Silian_AlertDialogCancel,
  AlertDialogContent as Silian_AlertDialogContent,
  AlertDialogDescription as Silian_AlertDialogDescription,
  AlertDialogFooter as Silian_AlertDialogFooter,
  AlertDialogHeader as Silian_AlertDialogHeader,
  AlertDialogTitle as Silian_AlertDialogTitle,
} from '../ui/alert-dialog';
import { Pagination as Silian_Pagination } from '../ui/Pagination';
import { toast as Silian_toast } from 'react-hot-toast';

const Silian_DEFAULT_FORM = {
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

const Silian_UNIT_OPTIONS = ['times', 'km', 'kg', 'hours', 'kWh', 'liters', 'days', 'minutes', 'sheets'];

export default function ActivityLibrary() {
  const { t: Silian_t } = Silian_useTranslation(['activities', 'admin', 'common', 'pagination']);
  const Silian_queryClient = Silian_useQueryClient();
  const [Silian_filters, Silian_setFilters] = Silian_useState({ search: '', category: '', status: 'active', page: 1, limit: 10 });
  const [Silian_formState, Silian_setFormState] = Silian_useState(Silian_DEFAULT_FORM);
  const [Silian_editingId, Silian_setEditingId] = Silian_useState(null);
  const [Silian_formError, Silian_setFormError] = Silian_useState('');
  const [Silian_isModalOpen, Silian_setIsModalOpen] = Silian_useState(false);
  const [Silian_confirmDelete, Silian_setConfirmDelete] = Silian_useState({ open: false, activity: null });

  const Silian_queryKey = ['adminActivitiesLibrary', Silian_filters];
  const Silian_query = Silian_useQuery(Silian_queryKey, async () => {
    const Silian_includeInactive = Silian_filters.status === 'inactive' || Silian_filters.status === 'all';
    const Silian_includeDeleted = Silian_filters.status === 'deleted';
    const Silian_statusParam = Silian_filters.status && Silian_filters.status !== 'all' ? Silian_filters.status : undefined;

    const Silian_params = {
      page: Silian_filters.page,
      limit: Silian_filters.limit,
      search: Silian_filters.search || undefined,
      category: Silian_filters.category || undefined,
      include_inactive: Silian_includeInactive ? 'true' : undefined,
      include_deleted: Silian_includeDeleted ? 'true' : undefined,
      status: Silian_statusParam,
    };

    const Silian_response = await Silian_adminAPI.getActivities(Silian_params);
    return Silian_response.data;
  }, { keepPreviousData: true });

  const Silian_activities = Silian_query.data?.data?.activities ?? [];
  const Silian_pagination = Silian_query.data?.data?.pagination ?? { page: Silian_filters.page, limit: Silian_filters.limit, total: Silian_activities.length, pages: 1 };
  const Silian_categories = Silian_useMemo(() => Silian_query.data?.data?.categories ?? [], [Silian_query.data]);

  const Silian_closeModal = () => {
    Silian_setIsModalOpen(false);
    Silian_setFormError('');
    Silian_setFormState(Silian_DEFAULT_FORM);
    Silian_setEditingId(null);
  };

  const Silian_openCreate = () => {
    Silian_setEditingId(null);
    Silian_setFormState({ ...Silian_DEFAULT_FORM });
    Silian_setFormError('');
    Silian_setIsModalOpen(true);
  };

  const Silian_openEdit = (Silian_activity) => {
    Silian_setEditingId(Silian_activity.id);
    Silian_setFormState({
      id: Silian_activity.id,
      name_zh: Silian_activity.name_zh || '',
      name_en: Silian_activity.name_en || '',
      category: Silian_activity.category || '',
      unit: Silian_activity.unit || 'times',
      carbon_factor: Silian_activity.carbon_factor ?? '',
      description_zh: Silian_activity.description_zh || '',
      description_en: Silian_activity.description_en || '',
      icon: Silian_activity.icon || '',
      sort_order: Silian_activity.sort_order ?? 0,
      is_active: Boolean(Silian_activity.is_active),
    });
    Silian_setFormError('');
    Silian_setIsModalOpen(true);
  };

  const Silian_createMutation = Silian_useMutation((Silian_payload) => Silian_adminAPI.createActivity(Silian_payload), {
    onSuccess: () => {
      Silian_toast.success(Silian_t('admin.activities.library.saveSuccess'));
      Silian_queryClient.invalidateQueries('adminActivitiesLibrary');
      Silian_closeModal();
    },
    onError: () => Silian_toast.error(Silian_t('common.error')),
  });

  const Silian_updateMutation = Silian_useMutation((Silian_payload) => Silian_adminAPI.updateActivity(Silian_payload.id, Silian_payload.data), {
    onSuccess: (Silian__, Silian_variables) => {
      Silian_queryClient.invalidateQueries('adminActivitiesLibrary');
      if (Silian_variables?.mode === 'toggle') {
        Silian_toast.success(Silian_t('admin.activities.library.toggleActiveSuccess'));
      } else {
        Silian_toast.success(Silian_t('admin.activities.library.saveSuccess'));
        Silian_closeModal();
      }
    },
    onError: () => Silian_toast.error(Silian_t('common.error')),
  });

  const Silian_deleteMutation = Silian_useMutation((Silian_id) => Silian_adminAPI.deleteActivity(Silian_id), {
    onSuccess: () => {
      Silian_toast.success(Silian_t('admin.activities.library.deleteSuccess'));
      Silian_queryClient.invalidateQueries('adminActivitiesLibrary');
      Silian_setConfirmDelete({ open: false, activity: null });
    },
    onError: () => Silian_toast.error(Silian_t('common.error')),
  });

  const Silian_restoreMutation = Silian_useMutation((Silian_id) => Silian_adminAPI.restoreActivity(Silian_id), {
    onSuccess: () => {
      Silian_toast.success(Silian_t('admin.activities.library.restoreSuccess'));
      Silian_queryClient.invalidateQueries('adminActivitiesLibrary');
    },
    onError: () => Silian_toast.error(Silian_t('common.error')),
  });

  const Silian_handleFilterChange = (Silian_key, Silian_value) => {
    Silian_setFilters((Silian_prev) => ({ ...Silian_prev, [Silian_key]: Silian_value, page: Silian_key === 'page' ? Silian_value : 1 }));
  };

  const Silian_handleFormChange = (Silian_field, Silian_value) => {
    Silian_setFormState((Silian_prev) => ({ ...Silian_prev, [Silian_field]: Silian_value }));
  };

  const Silian_handleFormSubmit = () => {
    const Silian_payload = {
      name_zh: Silian_formState.name_zh.trim(),
      name_en: Silian_formState.name_en.trim(),
      category: Silian_formState.category.trim(),
      unit: Silian_formState.unit.trim() || 'times',
      carbon_factor: parseFloat(Silian_formState.carbon_factor),
      description_zh: Silian_formState.description_zh.trim() || null,
      description_en: Silian_formState.description_en.trim() || null,
      icon: Silian_formState.icon.trim() || null,
      sort_order: Number.isFinite(Number(Silian_formState.sort_order)) ? Number(Silian_formState.sort_order) : 0,
      is_active: Boolean(Silian_formState.is_active),
    };

    if (!Silian_payload.name_zh || !Silian_payload.name_en || !Silian_payload.category || !Silian_payload.unit || Number.isNaN(Silian_payload.carbon_factor)) {
      Silian_setFormError(Silian_t('admin.activities.library.validationError'));
      return;
    }

    Silian_setFormError('');
    if (Silian_editingId) {
      Silian_updateMutation.mutate({ id: Silian_editingId, data: Silian_payload });
    } else {
      Silian_createMutation.mutate(Silian_payload);
    }
  };

  const Silian_handleToggleActive = (Silian_activity, Silian_next) => {
    Silian_updateMutation.mutate({ id: Silian_activity.id, data: { is_active: Silian_next }, mode: 'toggle' });
  };

  const Silian_handleDelete = (Silian_activity) => {
    Silian_setConfirmDelete({ open: true, activity: Silian_activity });
  };

  const Silian_handleConfirmDelete = () => {
    if (Silian_confirmDelete.activity) {
      Silian_deleteMutation.mutate(Silian_confirmDelete.activity.id);
    }
  };

  const Silian_busy = Silian_createMutation.isLoading || Silian_updateMutation.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{Silian_t('admin.activities.library.title')}</h2>
          <p className="text-muted-foreground">
            {Silian_t('admin.activities.library.description')}
          </p>
        </div>
        <Silian_Button onClick={Silian_openCreate} className="w-full md:w-auto">
          <Silian_PlusCircle className="mr-2 h-4 w-4" />
          {Silian_t('admin.activities.library.create')}
        </Silian_Button>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-foreground">
              {Silian_t('admin.activities.library.filters.search')}
            </label>
            <Silian_Input
              value={Silian_filters.search}
              onChange={(Silian_e) => Silian_handleFilterChange('search', Silian_e.target.value)}
              placeholder={Silian_t('admin.activities.library.searchPlaceholder')}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              {Silian_t('admin.activities.library.filters.category')}
            </label>
            <select
              value={Silian_filters.category}
              onChange={(Silian_e) => Silian_handleFilterChange('category', Silian_e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-transparent"
            >
              <option value="">{Silian_t('common.all')}</option>
              {Silian_categories.map((Silian_cat) => (
                <option key={Silian_cat} value={Silian_cat}>{Silian_cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              {Silian_t('admin.activities.library.filters.status')}
            </label>
            <select
              value={Silian_filters.status}
              onChange={(Silian_e) => Silian_handleFilterChange('status', Silian_e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-transparent"
            >
              <option value="active">{Silian_t('admin.activities.library.status.active')}</option>
              <option value="inactive">{Silian_t('admin.activities.library.status.inactive')}</option>
              <option value="deleted">{Silian_t('admin.activities.library.status.deleted')}</option>
              <option value="all">{Silian_t('admin.activities.library.status.all')}</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {Silian_t('admin.activities.library.table.name')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {Silian_t('admin.activities.library.table.category')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {Silian_t('admin.activities.library.table.unit')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {Silian_t('admin.activities.library.table.carbon_factor')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {Silian_t('admin.activities.library.table.status')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {Silian_t('admin.activities.library.table.updated_at')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {Silian_t('admin.activities.library.table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {Silian_query.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    <Silian_Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : Silian_activities.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {Silian_t('admin.activities.library.empty')}
                  </td>
                </tr>
              ) : (
                Silian_activities.map((Silian_activity) => {
                  const Silian_updatedAt = Silian_activity.updated_at ? Silian_format(new Date(Silian_activity.updated_at), 'yyyy-MM-dd HH:mm') : '—';
                  const Silian_statusLabel = Silian_activity.deleted_at
                    ? Silian_t('admin.activities.library.status.deleted')
                    : Silian_activity.is_active
                      ? Silian_t('admin.activities.library.status.active')
                      : Silian_t('admin.activities.library.status.inactive');

                  return (
                    <tr key={Silian_activity.id}>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-semibold text-foreground">{Silian_activity.name_zh}</div>
                        <div className="text-xs text-muted-foreground">{Silian_activity.name_en}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Silian_Badge variant="secondary">{Silian_activity.category || '—'}</Silian_Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground/80">{Silian_activity.unit}</td>
                      <td className="px-4 py-3 text-sm text-foreground/80">{Number(Silian_activity.carbon_factor).toFixed(4)}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Silian_Switch
                            disabled={Boolean(Silian_activity.deleted_at)}
                            checked={Boolean(Silian_activity.is_active)}
                            onCheckedChange={(Silian_checked) => Silian_handleToggleActive(Silian_activity, Silian_checked)}
                          />
                          <span className="text-xs text-muted-foreground">{Silian_statusLabel}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground/80">{Silian_updatedAt}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!Silian_activity.deleted_at && (
                            <Silian_Button variant="outline" size="sm" onClick={() => Silian_openEdit(Silian_activity)}>
                              <Silian_Edit className="h-4 w-4" />
                            </Silian_Button>
                          )}
                          {Silian_activity.deleted_at ? (
                            <Silian_Button
                              variant="outline"
                              size="sm"
                              onClick={() => Silian_restoreMutation.mutate(Silian_activity.id)}
                            >
                              <Silian_RotateCcw className="h-4 w-4" />
                            </Silian_Button>
                          ) : (
                            <Silian_Button
                              variant="outline"
                              size="sm"
                              onClick={() => Silian_handleDelete(Silian_activity)}
                            >
                              <Silian_Trash2 className="h-4 w-4" />
                            </Silian_Button>
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

        <Silian_Pagination
          currentPage={Silian_pagination.page}
          totalPages={Silian_pagination.pages}
          onPageChange={(Silian_page) => Silian_handleFilterChange('page', Silian_page)}
          itemsPerPage={Silian_pagination.limit}
          totalItems={Silian_pagination.total}
        />
      </div>

      <Silian_Dialog open={Silian_isModalOpen} onOpenChange={(Silian_open) => !Silian_open && !Silian_busy && Silian_closeModal()}>
        <Silian_DialogContent>
          <Silian_DialogHeader>
            <Silian_DialogTitle>
              {Silian_editingId
                ? Silian_t('admin.activities.library.edit')
                : Silian_t('admin.activities.library.create')}
            </Silian_DialogTitle>
            <Silian_DialogDescription>
              {Silian_t('admin.activities.library.description')}
            </Silian_DialogDescription>
          </Silian_DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {Silian_t('admin.activities.library.fields.name_zh')}
                </label>
                <Silian_Input
                  value={Silian_formState.name_zh}
                  onChange={(Silian_e) => Silian_handleFormChange('name_zh', Silian_e.target.value)}
                  placeholder="例如：公交地铁通勤"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {Silian_t('admin.activities.library.fields.name_en')}
                </label>
                <Silian_Input
                  value={Silian_formState.name_en}
                  onChange={(Silian_e) => Silian_handleFormChange('name_en', Silian_e.target.value)}
                  placeholder="e.g. Use public transport"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {Silian_t('admin.activities.library.fields.category')}
                </label>
                <Silian_Input
                  value={Silian_formState.category}
                  onChange={(Silian_e) => Silian_handleFormChange('category', Silian_e.target.value)}
                  placeholder="transport"
                  list="activity-category-options"
                />
                <datalist id="activity-category-options">
                  {Silian_categories.map((Silian_cat) => (
                    <option key={Silian_cat} value={Silian_cat} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {Silian_t('admin.activities.library.fields.unit')}
                </label>
                <select
                  value={Silian_formState.unit}
                  onChange={(Silian_e) => Silian_handleFormChange('unit', Silian_e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-transparent"
                >
                  {Silian_UNIT_OPTIONS.map((Silian_unit) => (
                    <option key={Silian_unit} value={Silian_unit}>{Silian_unit}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {Silian_t('admin.activities.library.fields.carbon_factor')}
                </label>
                <Silian_Input
                  type="number"
                  step="0.0001"
                  value={Silian_formState.carbon_factor}
                  onChange={(Silian_e) => Silian_handleFormChange('carbon_factor', Silian_e.target.value)}
                  placeholder="0.1234"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {Silian_t('admin.activities.library.fields.sort_order')}
                </label>
                <Silian_Input
                  type="number"
                  value={Silian_formState.sort_order}
                  onChange={(Silian_e) => Silian_handleFormChange('sort_order', Silian_e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {Silian_t('admin.activities.library.fields.description_zh')}
                </label>
                <Silian_Textarea
                  value={Silian_formState.description_zh}
                  onChange={(Silian_e) => Silian_handleFormChange('description_zh', Silian_e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {Silian_t('admin.activities.library.fields.description_en')}
                </label>
                <Silian_Textarea
                  value={Silian_formState.description_en}
                  onChange={(Silian_e) => Silian_handleFormChange('description_en', Silian_e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {Silian_t('admin.activities.library.fields.icon')}
                </label>
                <Silian_Input
                  value={Silian_formState.icon}
                  onChange={(Silian_e) => Silian_handleFormChange('icon', Silian_e.target.value)}
                  placeholder="optional"
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {Silian_t('admin.activities.library.fields.is_active')}
                  </label>
                  <Silian_Switch
                    checked={Boolean(Silian_formState.is_active)}
                    onCheckedChange={(Silian_checked) => Silian_handleFormChange('is_active', Silian_checked)}
                  />
                </div>
              </div>
            </div>

            {Silian_formError && (
              <p className="text-sm text-red-600">{Silian_formError}</p>
            )}
          </div>

          <Silian_DialogFooter>
            <Silian_Button variant="outline" onClick={Silian_closeModal} disabled={Silian_busy}>
              {Silian_t('admin.activities.library.actions.cancel')}
            </Silian_Button>
            <Silian_Button onClick={Silian_handleFormSubmit} disabled={Silian_busy}>
              {Silian_busy && <Silian_Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {Silian_t('admin.activities.library.actions.save')}
            </Silian_Button>
          </Silian_DialogFooter>
        </Silian_DialogContent>
      </Silian_Dialog>

      <Silian_AlertDialog open={Silian_confirmDelete.open} onOpenChange={(Silian_open) => !Silian_open && Silian_setConfirmDelete({ open: false, activity: null })}>
        <Silian_AlertDialogContent>
          <Silian_AlertDialogHeader>
            <Silian_AlertDialogTitle>{Silian_t('admin.activities.library.actions.delete')}</Silian_AlertDialogTitle>
            <Silian_AlertDialogDescription>
              {Silian_t('admin.activities.library.confirmDelete')}
            </Silian_AlertDialogDescription>
          </Silian_AlertDialogHeader>
          <Silian_AlertDialogFooter>
            <Silian_AlertDialogCancel>{Silian_t('common.cancel')}</Silian_AlertDialogCancel>
            <Silian_AlertDialogAction onClick={Silian_handleConfirmDelete}>
              {Silian_deleteMutation.isLoading && <Silian_Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {Silian_t('common.confirm')}
            </Silian_AlertDialogAction>
          </Silian_AlertDialogFooter>
        </Silian_AlertDialogContent>
      </Silian_AlertDialog>
    </div>
  );
}
