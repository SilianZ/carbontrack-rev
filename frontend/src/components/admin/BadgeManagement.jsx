import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { adminAPI } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import {
  Loader2,
  RefreshCw,
  Edit,
  Sparkles,
  Trash2,
  Award,
  Upload,
  BarChart3,
  ShieldCheck,
  Users,
  Eye,
} from 'lucide-react';
import { uploadViaPresign } from '@/lib/r2Upload';
import R2Image from '@/components/common/R2Image';
import BadgeBulkAwardDialog from './badges/BadgeBulkAwardDialog';
import BadgeRuleBuilder from './badges/BadgeRuleBuilder';
import BadgeRecipientsDialog from './badges/BadgeRecipientsDialog';

const DEFAULT_FORM = {
  id: null,
  name_zh: '',
  name_en: '',
  description_zh: '',
  description_en: '',
  icon_path: '',
  icon_thumbnail_path: '',
  icon_url: '',
  icon_presigned_url: '',
  sort_order: 0,
  is_active: true,
  auto_grant_enabled: false,
  auto_grant_criteria: '',
  message_title_zh: '',
  message_title_en: '',
  message_body_zh: '',
  message_body_en: '',
};

const DEFAULT_BADGE_STATS = {
  total_records: 0,
  unique_users: 0,
  awarded_records: 0,
  revoked_records: 0,
  awarded_users: 0,
  last_awarded_at: null,
};


const DEFAULT_CRITERIA = { all: true, rules: [] };

const normalizeCriteria = (raw) => {
  if (!raw) {
    return DEFAULT_CRITERIA;
  }
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (Array.isArray(data)) {
    return { all: true, rules: data };
  }
  if (typeof data === 'object') {
    const rules = Array.isArray(data.rules) ? data.rules : Array.isArray(data.conditions) ? data.conditions : [];
    const flag = data.all ?? data.all_required ?? data.requireAll ?? true;
    return { all: Boolean(flag), rules: rules.map((rule) => ({ ...rule })) };
  }
  return null;
};

export default function BadgeManagement() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [formValues, setFormValues] = useState(DEFAULT_FORM);
  const [criteriaMode, setCriteriaMode] = useState('builder');
  const [ruleBuilderValue, setRuleBuilderValue] = useState(DEFAULT_CRITERIA);
  const [bulkDialog, setBulkDialog] = useState({ open: false, badgeIds: [], mode: 'award', presetUsers: [] });
  const [recipientDialog, setRecipientDialog] = useState({ open: false, badge: null });
  const iconInputRef = useRef(null);

  const fetchBadges = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getBadges();
      if (response.data?.success) {
        setBadges(response.data.data || []);
      }
    } catch {
      toast.error(t('admin.badges.loadFailed', '加载徽章列表失败'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      resetForm();
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('create');
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const resetForm = () => {
    setFormValues(DEFAULT_FORM);
    setRuleBuilderValue(DEFAULT_CRITERIA);
    setCriteriaMode('builder');
    if (iconInputRef.current) {
      iconInputRef.current.value = '';
    }
  };

  const handleEdit = (badge) => {
    const normalizedCriteria = normalizeCriteria(badge?.auto_grant_criteria);
    setFormValues({
      ...DEFAULT_FORM,
      ...badge,
      auto_grant_criteria: normalizedCriteria
        ? JSON.stringify(normalizedCriteria, null, 2)
        : badge.auto_grant_criteria
          ? JSON.stringify(badge.auto_grant_criteria, null, 2)
          : '',
    });
    if (normalizedCriteria) {
      setRuleBuilderValue(normalizedCriteria);
      setCriteriaMode('builder');
    } else if (badge.auto_grant_criteria) {
      setCriteriaMode('json');
    } else {
      setRuleBuilderValue(DEFAULT_CRITERIA);
      setCriteriaMode('builder');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleToggle = (field) => (checked) => {
    setFormValues((prev) => ({ ...prev, [field]: checked }));
  };

  const handleCriteriaModeChange = (next) => {
    if (!next) return;
    if (next === 'builder') {
      const parsed = normalizeCriteria(formValues.auto_grant_criteria);
      if (parsed) {
        setRuleBuilderValue(parsed);
        setFormValues((prev) => ({ ...prev, auto_grant_criteria: JSON.stringify(parsed, null, 2) }));
        setCriteriaMode('builder');
      } else {
        toast.error(t('admin.badges.ruleBuilder.parseFailed', '当前 JSON 无法解析为可视化规则，请检查格式。'));
      }
    } else {
      setCriteriaMode(next);
    }
  };

  const handleRuleBuilderChange = (nextValue) => {
    setRuleBuilderValue(nextValue);
    setFormValues((prev) => ({ ...prev, auto_grant_criteria: JSON.stringify(nextValue, null, 2) }));
  };

  const handleIconFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('admin.badges.fileTooLarge', '文件大小不能超过5MB'));
      event.target.value = '';
      return;
    }
    setUploadingIcon(true);
    try {
      const result = await uploadViaPresign(file, {
        directory: 'badges',
        entityType: 'badge',
        entityId: formValues.id || undefined,
      });
      const info = result?.data || result;
      setFormValues((prev) => ({
        ...prev,
        icon_path: info.file_path || prev.icon_path,
        icon_thumbnail_path: info.thumbnail_path || prev.icon_thumbnail_path,
        icon_url: info.url || info.public_url || prev.icon_url,
        icon_presigned_url: info.presigned_url || prev.icon_presigned_url,
      }));
      toast.success(t('admin.badges.uploadSuccess', '徽章图标上传成功'));
    } catch (err) {
      toast.error(err?.message || t('admin.badges.uploadFailed', '徽章图标上传失败'));
    } finally {
      setUploadingIcon(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name_zh: formValues.name_zh,
      name_en: formValues.name_en,
      description_zh: formValues.description_zh,
      description_en: formValues.description_en,
      icon_path: formValues.icon_path,
      icon_thumbnail_path: formValues.icon_thumbnail_path,
      sort_order: Number(formValues.sort_order) || 0,
      is_active: Boolean(formValues.is_active),
      auto_grant_enabled: Boolean(formValues.auto_grant_enabled),
      message_title_zh: formValues.message_title_zh,
      message_title_en: formValues.message_title_en,
      message_body_zh: formValues.message_body_zh,
      message_body_en: formValues.message_body_en,
    };

    if (payload.auto_grant_enabled) {
      if (criteriaMode === 'builder') {
        payload.auto_grant_criteria = ruleBuilderValue;
      } else if (formValues.auto_grant_criteria) {
        try {
          payload.auto_grant_criteria = JSON.parse(formValues.auto_grant_criteria);
        } catch {
          toast.error(t('admin.badges.criteriaParseFailed', '自动授予规则 JSON 解析失败'));
          return;
        }
      } else {
        payload.auto_grant_criteria = null;
      }
    } else {
      payload.auto_grant_criteria = null;
    }

    try {
      setSaving(true);
      if (formValues.id) {
        await adminAPI.updateBadge(formValues.id, payload);
        toast.success(t('admin.badges.updateSuccess', '徽章已更新'));
      } else {
        await adminAPI.createBadge(payload);
        toast.success(t('admin.badges.createSuccess', '徽章已创建'));
      }
      resetForm();
      fetchBadges();
    } catch (err) {
      toast.error(err.response?.data?.message || t('admin.badges.saveFailed', '保存徽章失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDialogComplete = ({ failed }) => {
    if (!failed) {
      setBulkDialog((prev) => ({ ...prev, open: false }));
    }
    fetchBadges();
  };

  const handleAward = (badge) => {
    setBulkDialog({ open: true, badgeIds: badge ? [badge.id] : [], mode: 'award', presetUsers: [] });
  };

  const handleRevoke = (badge) => {
    setBulkDialog({ open: true, badgeIds: badge ? [badge.id] : [], mode: 'revoke', presetUsers: [] });
  };

  const handleViewRecipients = (badge) => {
    if (!badge) {
      return;
    }
    setRecipientDialog({ open: true, badge });
  };

  const handleRecipientDialogChange = (open) => {
    setRecipientDialog((prev) => ({ open, badge: open ? prev.badge : null }));
  };

  const handleTriggerAuto = async () => {
    try {
      setTriggering(true);
      const response = await adminAPI.triggerBadgeAuto();
      const summary = response.data?.data;
      const awarded = summary && typeof summary.awarded !== 'undefined' ? summary.awarded : 0;
      const users = summary && typeof summary.users !== 'undefined' ? summary.users : 0;
      const extra = summary ? ' (' + awarded + ' / ' + users + ')' : '';
      toast.success(t('admin.badges.autoTriggered', '已触发自动授予流程') + extra);
    } catch (err) {
      toast.error(err.response?.data?.message || t('admin.badges.autoTriggerFailed', '触发自动授予失败'));
    } finally {
      setTriggering(false);
      fetchBadges();
    }
  };

  const formattedBadges = useMemo(() => badges || [], [badges]);
  const activeBadges = useMemo(() => formattedBadges.filter((badge) => badge.is_active), [formattedBadges]);
  const autoBadges = useMemo(() => formattedBadges.filter((badge) => badge.auto_grant_enabled), [formattedBadges]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.badges.metrics.total', '徽章总数')}</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formattedBadges.length}</div>
            <p className="text-xs text-muted-foreground">
              {t('admin.badges.metrics.totalHint', '已创建的所有成就徽章数量')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.badges.metrics.active', '启用中')}</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeBadges.length}</div>
            <p className="text-xs text-muted-foreground">
              {t('admin.badges.metrics.activeHint', '当前对用户可见并可获得的徽章数量')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.badges.metrics.auto', '自动授予')}</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{autoBadges.length}</div>
            <p className="text-xs text-muted-foreground">
              {t('admin.badges.metrics.autoHint', '开启自动授予规则的徽章数量')}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle>{t('admin.badges.listTitle', '成就徽章列表')}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t('admin.badges.listHint', '支持快速授予/收回、刷新与自动规则触发。')}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <Button className="w-full sm:w-auto" variant="outline" onClick={fetchBadges} disabled={loading}>
              <RefreshCw className={'h-4 w-4 mr-2 ' + (loading ? 'animate-spin' : '')} />
              {t('common.refresh', '刷新')}
            </Button>
            <Button className="w-full sm:w-auto" variant="outline" onClick={handleTriggerAuto} disabled={triggering}>
              {triggering ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {t('admin.badges.triggerAuto', '触发自动授予')}
            </Button>
            <Button className="w-full sm:w-auto" variant="outline" onClick={() => handleAward(null)}>
              <Users className="h-4 w-4 mr-2" />
              {t('admin.badges.bulkAward', '批量授予')}
            </Button>
            <Button className="w-full sm:w-auto" onClick={resetForm} variant="secondary">
              {t('admin.badges.newBadge', '新建徽章')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              {t('common.loading', '加载中...')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.badges.table.icon', '图标')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.badges.table.name', '名称')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.badges.table.status', '状态')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.badges.table.stats', '授予情况')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.badges.table.auto', '自动授予')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.badges.table.sort', '排序')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.badges.table.updated', '更新时间')}
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">
                      {t('common.actions', '操作')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {formattedBadges.map((badge) => {
                    const ruleCount = Array.isArray(badge.auto_grant_criteria?.rules)
                      ? badge.auto_grant_criteria.rules.length
                      : Array.isArray(badge.auto_grant_criteria)
                        ? badge.auto_grant_criteria.length
                        : 0;
                    const stats = badge.stats || DEFAULT_BADGE_STATS;
                    return (
                      <tr key={badge.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="w-12 h-12 rounded-full bg-gray-100 border overflow-hidden flex items-center justify-center">
                            {badge.icon_path ? (
                              <R2Image
                                src={badge.icon_url || badge.icon_presigned_url}
                                filePath={!badge.icon_url && !badge.icon_presigned_url ? badge.icon_path : undefined}
                                alt={badge.name_zh || badge.name_en}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Award className="h-5 w-5 text-gray-400" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{badge.name_zh || badge.name_en}</div>
                          <div className="text-xs text-gray-500">{badge.name_en}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={badge.is_active ? 'success' : 'secondary'}>
                            {badge.is_active
                              ? t('admin.badges.active', '启用')
                              : t('admin.badges.inactive', '停用')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <div className="flex flex-col gap-1">
                            <span>{t('admin.badges.stats.summary', '{{awarded}} / {{total}}', { awarded: stats.awarded_records || 0, total: stats.total_records || 0 })}</span>
                            <span className="text-xs text-muted-foreground">
                              {t('admin.badges.stats.awardedUsers', '{{count}} 位用户获得', { count: stats.awarded_users || 0 })}
                            </span>
                            {stats.last_awarded_at ? (
                              <span className="text-[10px] text-muted-foreground">
                                {t('admin.badges.stats.lastAwarded', '最近：{{time}}', { time: format(new Date(stats.last_awarded_at), 'yyyy-MM-dd HH:mm') })}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <Badge variant={badge.auto_grant_enabled ? 'outline' : 'secondary'}>
                              {badge.auto_grant_enabled
                                ? t('admin.badges.autoEnabled', '已开启')
                                : t('admin.badges.autoDisabled', '未开启')}
                            </Badge>
                            {badge.auto_grant_enabled && ruleCount > 0 && (
                              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                {t('admin.badges.ruleBuilder.ruleCount', '{{count}} 条规则', { count: ruleCount })}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{badge.sort_order}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {badge.updated_at
                            ? format(new Date(badge.updated_at), 'yyyy-MM-dd HH:mm')
                            : '--'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button className="w-full sm:w-auto" variant="ghost" size="sm" onClick={() => handleEdit(badge)}>
                              <Edit className="h-4 w-4 mr-1" />
                              {t('common.edit', '编辑')}
                            </Button>
                            <Button className="w-full sm:w-auto" variant="ghost" size="sm" onClick={() => handleViewRecipients(badge)}>
                              <Eye className="h-4 w-4 mr-1" />
                              {t('admin.badges.viewRecipients', '获奖用户')}
                            </Button>
                            <Button className="w-full sm:w-auto" variant="ghost" size="sm" onClick={() => handleAward(badge)}>
                              <Sparkles className="h-4 w-4 mr-1" />
                              {t('admin.badges.award', '授予')}
                            </Button>
                            <Button className="w-full sm:w-auto" variant="ghost" size="sm" onClick={() => handleRevoke(badge)}>
                              <Trash2 className="h-4 w-4 mr-1" />
                              {t('admin.badges.revoke', '收回')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {formattedBadges.length === 0 && !loading && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500">
                        {t('admin.badges.empty', '还没有创建任何徽章')}
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
              ? t('admin.badges.editTitle', '编辑徽章')
              : t('admin.badges.createTitle', '创建新徽章')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    {t('admin.badges.fields.nameZh', '中文名称')}
                  </label>
                  <Input
                    name="name_zh"
                    value={formValues.name_zh}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    {t('admin.badges.fields.nameEn', '英文名称')}
                  </label>
                  <Input
                    name="name_en"
                    value={formValues.name_en}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    {t('admin.badges.fields.descZh', '中文描述')}
                  </label>
                  <Textarea
                    name="description_zh"
                    value={formValues.description_zh}
                    onChange={handleInputChange}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    {t('admin.badges.fields.descEn', '英文描述')}
                  </label>
                  <Textarea
                    name="description_en"
                    value={formValues.description_en}
                    onChange={handleInputChange}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      {t('admin.badges.fields.sort', '排序权重')}
                    </label>
                    <Input
                      type="number"
                      name="sort_order"
                      value={formValues.sort_order}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {t('admin.badges.fields.isActive', '是否启用')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('admin.badges.fields.isActiveHint', '停用后用户将无法再获得该徽章')}
                      </p>
                    </div>
                    <Switch checked={formValues.is_active} onCheckedChange={handleToggle('is_active')} />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    {t('admin.badges.fields.icon', '徽章图标')}
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg border bg-muted overflow-hidden flex items-center justify-center">
                      {formValues.icon_path ? (
                        <R2Image
                          src={formValues.icon_url || formValues.icon_presigned_url}
                          filePath={!formValues.icon_url && !formValues.icon_presigned_url ? formValues.icon_path : undefined}
                          alt={formValues.name_zh || formValues.name_en}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Award className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={uploadingIcon}
                        onClick={() => iconInputRef.current?.click()}
                        className="flex items-center gap-2"
                      >
                        {uploadingIcon ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        {t('admin.badges.fields.uploadIcon', '上传图标')}
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={iconInputRef}
                        onChange={handleIconFileChange}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('admin.badges.fields.iconHint', '建议使用 256x256 PNG / WebP，小于 5MB')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {t('admin.badges.fields.autoGrantTitle', '自动授予规则')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('admin.badges.fields.autoGrantHint', '开启后系统会按照规则定期评估并授予徽章')}
                      </p>
                    </div>
                    <Switch checked={formValues.auto_grant_enabled} onCheckedChange={handleToggle('auto_grant_enabled')} />
                  </div>

                  {formValues.auto_grant_enabled && (
                    <div className="space-y-4">
                      <ToggleGroup
                        type="single"
                        value={criteriaMode}
                        onValueChange={handleCriteriaModeChange}
                        variant="outline"
                      >
                        <ToggleGroupItem value="builder">
                          {t('admin.badges.ruleBuilder.toggle.visual', '图形化编辑')}
                        </ToggleGroupItem>
                        <ToggleGroupItem value="json">
                          {t('admin.badges.ruleBuilder.toggle.json', 'JSON 高级模式')}
                        </ToggleGroupItem>
                      </ToggleGroup>

                      {criteriaMode === 'builder' ? (
                        <BadgeRuleBuilder value={ruleBuilderValue} onChange={handleRuleBuilderChange} />
                      ) : (
                        <Textarea
                          className="font-mono"
                          rows={12}
                          value={formValues.auto_grant_criteria}
                          onChange={(e) => setFormValues((prev) => ({ ...prev, auto_grant_criteria: e.target.value }))}
                          placeholder={JSON.stringify(DEFAULT_CRITERIA, null, 2)}
                        />
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    {t('admin.badges.fields.messageTitleZh', '通知标题（中文）')}
                  </label>
                  <Input
                    name="message_title_zh"
                    value={formValues.message_title_zh}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    {t('admin.badges.fields.messageTitleEn', '通知标题（英文）')}
                  </label>
                  <Input
                    name="message_title_en"
                    value={formValues.message_title_en}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    {t('admin.badges.fields.messageBodyZh', '通知内容（中文）')}
                  </label>
                  <Textarea
                    name="message_body_zh"
                    value={formValues.message_body_zh}
                    onChange={handleInputChange}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    {t('admin.badges.fields.messageBodyEn', '通知内容（英文）')}
                  </label>
                  <Textarea
                    name="message_body_en"
                    value={formValues.message_body_en}
                    onChange={handleInputChange}
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button className="w-full sm:w-auto" type="button" variant="ghost" onClick={resetForm}>
                {t('common.reset', '重置')}
              </Button>
              <Button className="w-full sm:w-auto" type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {formValues.id ? t('common.saveChanges', '保存修改') : t('common.create', '创建')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <BadgeBulkAwardDialog
        open={bulkDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setBulkDialog({ open: false, badgeIds: [], mode: 'award', presetUsers: [] });
          } else {
            setBulkDialog((prev) => ({ ...prev, open: true }));
          }
        }}
        badges={formattedBadges}
        defaultSelectedBadgeIds={bulkDialog.badgeIds}
        presetUsers={bulkDialog.presetUsers}
        onCompleted={handleBulkDialogComplete}
        mode={bulkDialog.mode}
      />
      <BadgeRecipientsDialog
        open={recipientDialog.open}
        onOpenChange={handleRecipientDialogChange}
        badge={recipientDialog.badge}
      />
    </div>
  );
}
