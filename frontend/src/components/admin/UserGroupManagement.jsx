import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { adminAPI } from '../../lib/api';
import { useTranslation } from '../../hooks/useTranslation';
import { toast } from 'react-hot-toast';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Loader2, PlusCircle, Edit, Trash2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
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

export function UserGroupManagement() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [editingGroup, setEditingGroup] = useState(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState({ open: false, group: null });

    const { data: groups, isLoading } = useQuery('userGroups', () =>
        adminAPI.getUserGroups().then(res => res.data.data)
    );

    const { data: groupMeta } = useQuery('userGroupMeta', () =>
        adminAPI.getUserGroupMeta().then(res => res.data.data)
    );

    const quotaKeys = useMemo(() => {
        const definitions = groupMeta?.quota_definitions;
        if (Array.isArray(definitions) && definitions.length > 0) {
            return definitions;
        }
        if (Array.isArray(groups) && groups.length > 0) {
            const template = groups.find(group => group?.quota_flat) || groups[0];
            return Object.keys(template?.quota_flat || {});
        }
        return [];
    }, [groupMeta, groups]);

    const quotaTemplate = useMemo(() => {
        if (quotaKeys.length === 0) {
            return {};
        }
        return quotaKeys.reduce((acc, key) => {
            acc[key] = null;
            return acc;
        }, {});
    }, [quotaKeys]);

    const createmutation = useMutation(adminAPI.createUserGroup, {
        onSuccess: () => {
            queryClient.invalidateQueries('userGroups');
            setIsDialogOpen(false);
            toast.success(t('admin.groups.createSuccess'));
        }
    });

    const updateMutation = useMutation(({ id, data }) => adminAPI.updateUserGroup(id, data), {
        onSuccess: () => {
            queryClient.invalidateQueries('userGroups');
            setIsDialogOpen(false);
            toast.success(t('admin.groups.updateSuccess'));
        }
    });

    const deleteMutation = useMutation(adminAPI.deleteUserGroup, {
        onSuccess: () => {
            queryClient.invalidateQueries('userGroups');
            setDeleteConfirm({ open: false, group: null });
            toast.success(t('admin.groups.deleteSuccess'));
        }
    });

    const handleEdit = (group) => {
        setEditingGroup({
            ...group,
            quotaFlat: group.quota_flat || { ...quotaTemplate }
        });
        setIsDialogOpen(true);
    };

    const handleCreate = () => {
        setEditingGroup({
            name: '',
            code: '',
            is_default: false,
            notes: '',
            quotaFlat: { ...quotaTemplate }
        });
        setIsDialogOpen(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const payload = {
            name: editingGroup.name,
            code: editingGroup.code,
            is_default: editingGroup.is_default,
            notes: editingGroup.notes,
            quota_flat: editingGroup.quotaFlat || {}
        };

        if (editingGroup.id) {
            updateMutation.mutate({ id: editingGroup.id, data: payload });
        } else {
            createmutation.mutate(payload);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{t('admin.groups.title')}</h2>
                    <p className="text-muted-foreground">{t('admin.groups.description')}</p>
                </div>
                <Button onClick={handleCreate}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {t('admin.groups.create')}
                </Button>
            </div>

            {isLoading ? (
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            ) : (
                <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('admin.groups.name')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('admin.groups.code')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('admin.groups.isDefault')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('admin.groups.actions')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {groups?.map((group) => (
                                <tr key={group.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {group.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {group.code}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {group.is_default ? t('common.yes') : t('common.no')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                        <Button variant="ghost" size="sm" onClick={() => handleEdit(group)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setDeleteConfirm({ open: true, group })}
                                            className="text-red-600 hover:text-red-800"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {editingGroup?.id ? t('admin.groups.edit') : t('admin.groups.create')}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <Label>{t('admin.groups.name')}</Label>
                            <Input
                                value={editingGroup?.name || ''}
                                onChange={e => setEditingGroup({ ...editingGroup, name: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <Label>{t('admin.groups.code')}</Label>
                            <Input
                                value={editingGroup?.code || ''}
                                onChange={e => setEditingGroup({ ...editingGroup, code: e.target.value })}
                                required
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                checked={editingGroup?.is_default}
                                onCheckedChange={checked => setEditingGroup({ ...editingGroup, is_default: checked })}
                            />
                            <Label>{t('admin.groups.setAsDefault')}</Label>
                        </div>
                        <div className="space-y-3 border-t pt-3 border-b pb-3">
                            <Label className="text-base font-semibold">{t('admin.groups.quotaOverride')}</Label>
                            {Object.keys(editingGroup?.quotaFlat || {}).length > 0 ? (
                                Object.entries(editingGroup.quotaFlat || {}).map(([key, value]) => (
                                    <div key={key}>
                          <Label className="capitalize">{t(`admin.quotas.${key}`, key.replace('.', ' '))}</Label>
                                        <Input
                                            type="number"
                                            value={value ?? ''}
                                            onChange={e => setEditingGroup({
                                                ...editingGroup,
                                                quotaFlat: { ...editingGroup.quotaFlat, [key]: e.target.value }
                                            })}
                            placeholder={t('common.default')}
                                        />
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">{t('admin.groups.noQuotasAvailable')}</p>
                            )}
                        </div>
                        <div>
                            <Label>{t('admin.groups.notes')}</Label>
                            <Textarea
                                value={editingGroup?.notes || ''}
                                onChange={e => setEditingGroup({ ...editingGroup, notes: e.target.value })}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={createmutation.isLoading || updateMutation.isLoading}>
                                {t('common.save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleteConfirm.open} onOpenChange={open => !open && setDeleteConfirm({ open: false, group: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('admin.groups.confirmDelete')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('admin.groups.deleteWarning')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(deleteConfirm.group.id)}>
                            {t('common.confirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
