import Silian_React, { useMemo as Silian_useMemo, useState as Silian_useState } from 'react';
import { useQuery as Silian_useQuery, useMutation as Silian_useMutation, useQueryClient as Silian_useQueryClient } from 'react-query';
import { adminAPI as Silian_adminAPI } from '../../lib/api';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { toast as Silian_toast } from 'react-hot-toast';
import { Button as Silian_Button } from '../ui/Button';
import { Input as Silian_Input } from '../ui/Input';
import { Loader2 as Silian_Loader2, PlusCircle as Silian_PlusCircle, Edit as Silian_Edit, Trash2 as Silian_Trash2 } from 'lucide-react';
import {
    Dialog as Silian_Dialog,
    DialogContent as Silian_DialogContent,
    DialogHeader as Silian_DialogHeader,
    DialogTitle as Silian_DialogTitle,
    DialogFooter as Silian_DialogFooter,
} from '../ui/dialog';
import { Label as Silian_Label } from '../ui/label';
import { Textarea as Silian_Textarea } from '../ui/textarea';
import { Checkbox as Silian_Checkbox } from '../ui/checkbox';
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

export function UserGroupManagement() {
    const { t: Silian_t } = Silian_useTranslation(['admin', 'common']);
    const Silian_queryClient = Silian_useQueryClient();
    const [Silian_editingGroup, Silian_setEditingGroup] = Silian_useState(null);
    const [Silian_isDialogOpen, Silian_setIsDialogOpen] = Silian_useState(false);
    const [Silian_deleteConfirm, Silian_setDeleteConfirm] = Silian_useState({ open: false, group: null });

    const { data: Silian_groups, isLoading: Silian_isLoading } = Silian_useQuery('userGroups', () =>
        Silian_adminAPI.getUserGroups().then(Silian_res => Silian_res.data.data)
    );

    const { data: Silian_groupMeta } = Silian_useQuery('userGroupMeta', () =>
        Silian_adminAPI.getUserGroupMeta().then(Silian_res => Silian_res.data.data)
    );

    const Silian_quotaKeys = Silian_useMemo(() => {
        const Silian_definitions = Silian_groupMeta?.quota_definitions;
        if (Array.isArray(Silian_definitions) && Silian_definitions.length > 0) {
            return Silian_definitions;
        }
        if (Array.isArray(Silian_groups) && Silian_groups.length > 0) {
            const Silian_template = Silian_groups.find(Silian_group => Silian_group?.quota_flat) || Silian_groups[0];
            return Object.keys(Silian_template?.quota_flat || {});
        }
        return [];
    }, [Silian_groupMeta, Silian_groups]);

    const Silian_quotaTemplate = Silian_useMemo(() => {
        if (Silian_quotaKeys.length === 0) {
            return {};
        }
        return Silian_quotaKeys.reduce((Silian_acc, Silian_key) => {
            Silian_acc[Silian_key] = null;
            return Silian_acc;
        }, {});
    }, [Silian_quotaKeys]);

    const Silian_supportRoutingFields = Silian_useMemo(() => {
        const Silian_fields = Silian_groupMeta?.support_routing_fields;
        if (Array.isArray(Silian_fields) && Silian_fields.length > 0) {
            return Silian_fields;
        }
        return [
            { key: 'first_response_minutes', type: 'number', default: 240, label_key: 'admin.groups.supportFirstResponseMinutes' },
            { key: 'resolution_minutes', type: 'number', default: 1440, label_key: 'admin.groups.supportResolutionMinutes' },
            { key: 'routing_weight', type: 'number', default: 1, step: 0.1, label_key: 'admin.groups.supportRoutingWeight' },
            { key: 'min_agent_level', type: 'number', default: 1, min: 1, max: 5, label_key: 'admin.groups.supportMinAgentLevel' },
            { key: 'overdue_boost', type: 'number', default: 1, step: 0.1, label_key: 'admin.groups.supportOverdueBoost' },
            { key: 'tier_label', type: 'text', default: 'standard', label_key: 'admin.groups.supportTierLabel' },
        ];
    }, [Silian_groupMeta]);

    const Silian_supportRoutingDefaults = Silian_useMemo(() => {
        const Silian_defaults = Silian_groupMeta?.support_routing_defaults;
        if (Silian_defaults && typeof Silian_defaults === 'object') {
            return Silian_defaults;
        }
        return Silian_supportRoutingFields.reduce((Silian_acc, Silian_field) => {
            Silian_acc[Silian_field.key] = Silian_field.default ?? '';
            return Silian_acc;
        }, {});
    }, [Silian_groupMeta, Silian_supportRoutingFields]);

    const Silian_buildSupportRoutingState = (Silian_source = {}, Silian_useDefaults = true) => (
        Silian_supportRoutingFields.reduce((Silian_acc, Silian_field) => {
            if (Silian_source?.[Silian_field.key] !== undefined && Silian_source?.[Silian_field.key] !== null && Silian_source?.[Silian_field.key] !== '') {
                Silian_acc[Silian_field.key] = Silian_source[Silian_field.key];
            } else {
                Silian_acc[Silian_field.key] = Silian_useDefaults ? (Silian_supportRoutingDefaults[Silian_field.key] ?? Silian_field.default ?? '') : '';
            }
            return Silian_acc;
        }, {})
    );

    const Silian_createmutation = Silian_useMutation(Silian_adminAPI.createUserGroup, {
        onSuccess: () => {
            Silian_queryClient.invalidateQueries('userGroups');
            Silian_setIsDialogOpen(false);
            Silian_toast.success(Silian_t('admin.groups.createSuccess'));
        }
    });

    const Silian_updateMutation = Silian_useMutation(({ id: Silian_id, data: Silian_data }) => Silian_adminAPI.updateUserGroup(Silian_id, Silian_data), {
        onSuccess: () => {
            Silian_queryClient.invalidateQueries('userGroups');
            Silian_setIsDialogOpen(false);
            Silian_toast.success(Silian_t('admin.groups.updateSuccess'));
        }
    });

    const Silian_deleteMutation = Silian_useMutation(Silian_adminAPI.deleteUserGroup, {
        onSuccess: () => {
            Silian_queryClient.invalidateQueries('userGroups');
            Silian_setDeleteConfirm({ open: false, group: null });
            Silian_toast.success(Silian_t('admin.groups.deleteSuccess'));
        }
    });

    const Silian_handleEdit = (Silian_group) => {
        Silian_setEditingGroup({
            ...Silian_group,
            quotaFlat: Silian_group.quota_flat || { ...Silian_quotaTemplate },
            supportRouting: Silian_buildSupportRoutingState(Silian_group.support_routing)
        });
        Silian_setIsDialogOpen(true);
    };

    const Silian_handleCreate = () => {
        Silian_setEditingGroup({
            name: '',
            code: '',
            is_default: false,
            notes: '',
            quotaFlat: { ...Silian_quotaTemplate },
            supportRouting: Silian_buildSupportRoutingState()
        });
        Silian_setIsDialogOpen(true);
    };

    const Silian_handleSubmit = (Silian_e) => {
        Silian_e.preventDefault();
        const Silian_payload = {
            name: Silian_editingGroup.name,
            code: Silian_editingGroup.code,
            is_default: Silian_editingGroup.is_default,
            notes: Silian_editingGroup.notes,
            quota_flat: Silian_editingGroup.quotaFlat || {},
            support_routing: Silian_editingGroup.supportRouting || {}
        };

        if (Silian_editingGroup.id) {
            Silian_updateMutation.mutate({ id: Silian_editingGroup.id, data: Silian_payload });
        } else {
            Silian_createmutation.mutate(Silian_payload);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{Silian_t('admin.groups.title')}</h2>
                    <p className="text-muted-foreground">{Silian_t('admin.groups.description')}</p>
                </div>
                <Silian_Button onClick={Silian_handleCreate}>
                    <Silian_PlusCircle className="mr-2 h-4 w-4" />
                    {Silian_t('admin.groups.create')}
                </Silian_Button>
            </div>

            {Silian_isLoading ? (
                <Silian_Loader2 className="h-8 w-8 animate-spin mx-auto" />
            ) : (
                <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    {Silian_t('admin.groups.name')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    {Silian_t('admin.groups.code')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    {Silian_t('admin.groups.isDefault')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    {Silian_t('admin.groups.actions')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-card">
                            {Silian_groups?.map((Silian_group) => (
                                <tr key={Silian_group.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                                        {Silian_group.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                        {Silian_group.code}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                        {Silian_group.is_default ? Silian_t('common.yes') : Silian_t('common.no')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                        <Silian_Button variant="ghost" size="sm" onClick={() => Silian_handleEdit(Silian_group)}>
                                            <Silian_Edit className="h-4 w-4" />
                                        </Silian_Button>
                                        <Silian_Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => Silian_setDeleteConfirm({ open: true, group: Silian_group })}
                                            className="text-red-600 hover:text-red-800"
                                        >
                                            <Silian_Trash2 className="h-4 w-4" />
                                        </Silian_Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Silian_Dialog open={Silian_isDialogOpen} onOpenChange={Silian_setIsDialogOpen}>
                <Silian_DialogContent className="max-w-lg">
                    <Silian_DialogHeader>
                        <Silian_DialogTitle>
                            {Silian_editingGroup?.id ? Silian_t('admin.groups.edit') : Silian_t('admin.groups.create')}
                        </Silian_DialogTitle>
                    </Silian_DialogHeader>
                    <form onSubmit={Silian_handleSubmit} className="space-y-4">
                        <div>
                            <Silian_Label>{Silian_t('admin.groups.name')}</Silian_Label>
                            <Silian_Input
                                value={Silian_editingGroup?.name || ''}
                                onChange={Silian_e => Silian_setEditingGroup({ ...Silian_editingGroup, name: Silian_e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <Silian_Label>{Silian_t('admin.groups.code')}</Silian_Label>
                            <Silian_Input
                                value={Silian_editingGroup?.code || ''}
                                onChange={Silian_e => Silian_setEditingGroup({ ...Silian_editingGroup, code: Silian_e.target.value })}
                                required
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Silian_Checkbox
                                checked={Silian_editingGroup?.is_default}
                                onCheckedChange={Silian_checked => Silian_setEditingGroup({ ...Silian_editingGroup, is_default: Silian_checked })}
                            />
                            <Silian_Label>{Silian_t('admin.groups.setAsDefault')}</Silian_Label>
                        </div>
                        <div className="space-y-3 border-t pt-3 border-b pb-3">
                            <Silian_Label className="text-base font-semibold">{Silian_t('admin.groups.quotaOverride')}</Silian_Label>
                            {Object.keys(Silian_editingGroup?.quotaFlat || {}).length > 0 ? (
                                Object.entries(Silian_editingGroup.quotaFlat || {}).map(([Silian_key, Silian_value]) => (
                                    <div key={Silian_key}>
                          <Silian_Label className="capitalize">{Silian_t(`admin.quotas.${Silian_key}`, Silian_key.replace('.', ' '))}</Silian_Label>
                                        <Silian_Input
                                            type="number"
                                            value={Silian_value ?? ''}
                                            onChange={Silian_e => Silian_setEditingGroup({
                                                ...Silian_editingGroup,
                                                quotaFlat: { ...Silian_editingGroup.quotaFlat, [Silian_key]: Silian_e.target.value }
                                            })}
                            placeholder={Silian_t('common.default')}
                                        />
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">{Silian_t('admin.groups.noQuotasAvailable')}</p>
                            )}
                        </div>
                        <div className="space-y-3 border-b pb-3">
                            <Silian_Label className="text-base font-semibold">{Silian_t('admin.groups.supportRoutingTitle')}</Silian_Label>
                            {Silian_supportRoutingFields.map((Silian_field) => (
                                <div key={Silian_field.key}>
                                    <Silian_Label>{Silian_t(Silian_field.label_key, Silian_field.key)}</Silian_Label>
                                    <Silian_Input
                                        type={Silian_field.type === 'number' ? 'number' : 'text'}
                                        min={Silian_field.min}
                                        max={Silian_field.max}
                                        step={Silian_field.step}
                                        value={Silian_editingGroup?.supportRouting?.[Silian_field.key] ?? Silian_supportRoutingDefaults[Silian_field.key] ?? ''}
                                        onChange={Silian_e => Silian_setEditingGroup({
                                            ...Silian_editingGroup,
                                            supportRouting: { ...Silian_editingGroup.supportRouting, [Silian_field.key]: Silian_e.target.value }
                                        })}
                                    />
                                </div>
                            ))}
                        </div>
                        <div>
                            <Silian_Label>{Silian_t('admin.groups.notes')}</Silian_Label>
                            <Silian_Textarea
                                value={Silian_editingGroup?.notes || ''}
                                onChange={Silian_e => Silian_setEditingGroup({ ...Silian_editingGroup, notes: Silian_e.target.value })}
                            />
                        </div>
                        <Silian_DialogFooter>
                            <Silian_Button type="submit" disabled={Silian_createmutation.isLoading || Silian_updateMutation.isLoading}>
                                {Silian_t('common.save')}
                            </Silian_Button>
                        </Silian_DialogFooter>
                    </form>
                </Silian_DialogContent>
            </Silian_Dialog>

            <Silian_AlertDialog open={Silian_deleteConfirm.open} onOpenChange={Silian_open => !Silian_open && Silian_setDeleteConfirm({ open: false, group: null })}>
                <Silian_AlertDialogContent>
                    <Silian_AlertDialogHeader>
                        <Silian_AlertDialogTitle>{Silian_t('admin.groups.confirmDelete')}</Silian_AlertDialogTitle>
                        <Silian_AlertDialogDescription>
                            {Silian_t('admin.groups.deleteWarning')}
                        </Silian_AlertDialogDescription>
                    </Silian_AlertDialogHeader>
                    <Silian_AlertDialogFooter>
                        <Silian_AlertDialogCancel>{Silian_t('common.cancel')}</Silian_AlertDialogCancel>
                        <Silian_AlertDialogAction onClick={() => Silian_deleteMutation.mutate(Silian_deleteConfirm.group.id)}>
                            {Silian_t('common.confirm')}
                        </Silian_AlertDialogAction>
                    </Silian_AlertDialogFooter>
                </Silian_AlertDialogContent>
            </Silian_AlertDialog>
        </div>
    );
}
