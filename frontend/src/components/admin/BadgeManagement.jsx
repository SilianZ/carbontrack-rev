import Silian_React, { useCallback as Silian_useCallback, useEffect as Silian_useEffect, useMemo as Silian_useMemo, useRef as Silian_useRef, useState as Silian_useState } from 'react';
import { useSearchParams as Silian_useSearchParams } from 'react-router-dom';
import { Card as Silian_Card, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle, CardContent as Silian_CardContent } from '@/components/ui/Card';
import { Button as Silian_Button } from '@/components/ui/Button';
import { Input as Silian_Input } from '@/components/ui/Input';
import { Textarea as Silian_Textarea } from '@/components/ui/textarea';
import { Switch as Silian_Switch } from '@/components/ui/switch';
import { Badge as Silian_Badge } from '@/components/ui/badge';
import { ToggleGroup as Silian_ToggleGroup, ToggleGroupItem as Silian_ToggleGroupItem } from '@/components/ui/toggle-group';
import { adminAPI as Silian_adminAPI } from '@/lib/api';
import { useTranslation as Silian_useTranslation } from '@/hooks/useTranslation';
import { toast as Silian_toast } from 'react-hot-toast';
import { format as Silian_format } from 'date-fns';
import {
  Loader2 as Silian_Loader2,
  RefreshCw as Silian_RefreshCw,
  Edit as Silian_Edit,
  Sparkles as Silian_Sparkles,
  Trash2 as Silian_Trash2,
  Award as Silian_Award,
  Upload as Silian_Upload,
  BarChart3 as Silian_BarChart3,
  ShieldCheck as Silian_ShieldCheck,
  Users as Silian_Users,
  Eye as Silian_Eye,
} from 'lucide-react';
import { uploadViaPresign as Silian_uploadViaPresign } from '@/lib/r2Upload';
import { resolveR2ImageSource as Silian_resolveR2ImageSource } from '@/lib/r2Image';
import Silian_R2Image from '@/components/common/R2Image';
import Silian_BadgeBulkAwardDialog from './badges/BadgeBulkAwardDialog';
import Silian_BadgeRuleBuilder from './badges/BadgeRuleBuilder';
import Silian_BadgeRecipientsDialog from './badges/BadgeRecipientsDialog';

const Silian_DEFAULT_FORM = {
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

const Silian_DEFAULT_BADGE_STATS = {
  total_records: 0,
  unique_users: 0,
  awarded_records: 0,
  revoked_records: 0,
  awarded_users: 0,
  last_awarded_at: null,
};


const Silian_DEFAULT_CRITERIA = { all: true, rules: [] };

const Silian_normalizeCriteria = (Silian_raw) => {
  if (!Silian_raw) {
    return Silian_DEFAULT_CRITERIA;
  }
  let Silian_data = Silian_raw;
  if (typeof Silian_raw === 'string') {
    try {
      Silian_data = JSON.parse(Silian_raw);
    } catch {
      return null;
    }
  }
  if (Array.isArray(Silian_data)) {
    return { all: true, rules: Silian_data };
  }
  if (typeof Silian_data === 'object') {
    const Silian_rules = Array.isArray(Silian_data.rules) ? Silian_data.rules : Array.isArray(Silian_data.conditions) ? Silian_data.conditions : [];
    const Silian_flag = Silian_data.all ?? Silian_data.all_required ?? Silian_data.requireAll ?? true;
    return { all: Boolean(Silian_flag), rules: Silian_rules.map((Silian_rule) => ({ ...Silian_rule })) };
  }
  return null;
};

const Silian_resolveBadgeImage = (Silian_badge = {}) => Silian_resolveR2ImageSource({
  urlCandidates: [Silian_badge.icon_url, Silian_badge.icon_presigned_url],
  pathCandidates: [Silian_badge.icon_path, Silian_badge.icon_thumbnail_path],
});

export default function BadgeManagement() {
  const { t: Silian_t } = Silian_useTranslation(['admin', 'common']);
  const [Silian_searchParams, Silian_setSearchParams] = Silian_useSearchParams();
  const [Silian_badges, Silian_setBadges] = Silian_useState([]);
  const [Silian_loading, Silian_setLoading] = Silian_useState(true);
  const [Silian_saving, Silian_setSaving] = Silian_useState(false);
  const [Silian_triggering, Silian_setTriggering] = Silian_useState(false);
  const [Silian_uploadingIcon, Silian_setUploadingIcon] = Silian_useState(false);
  const [Silian_formValues, Silian_setFormValues] = Silian_useState(Silian_DEFAULT_FORM);
  const [Silian_criteriaMode, Silian_setCriteriaMode] = Silian_useState('builder');
  const [Silian_ruleBuilderValue, Silian_setRuleBuilderValue] = Silian_useState(Silian_DEFAULT_CRITERIA);
  const [Silian_bulkDialog, Silian_setBulkDialog] = Silian_useState({ open: false, badgeIds: [], mode: 'award', presetUsers: [] });
  const [Silian_recipientDialog, Silian_setRecipientDialog] = Silian_useState({ open: false, badge: null });
  const Silian_iconInputRef = Silian_useRef(null);

  const Silian_fetchBadges = Silian_useCallback(async () => {
    try {
      Silian_setLoading(true);
      const Silian_response = await Silian_adminAPI.getBadges();
      if (Silian_response.data?.success) {
        Silian_setBadges(Silian_response.data.data || []);
      }
    } catch {
      Silian_toast.error(Silian_t('admin.badges.loadFailed'));
    } finally {
      Silian_setLoading(false);
    }
  }, [Silian_t]);

  Silian_useEffect(() => {
    Silian_fetchBadges();
  }, [Silian_fetchBadges]);

  Silian_useEffect(() => {
    if (Silian_searchParams.get('create') === '1') {
      Silian_resetForm();
      Silian_setSearchParams((Silian_prev) => {
        const Silian_next = new URLSearchParams(Silian_prev);
        Silian_next.delete('create');
        return Silian_next;
      }, { replace: true });
    }
  }, [Silian_searchParams, Silian_setSearchParams]);

  const Silian_resetForm = () => {
    Silian_setFormValues(Silian_DEFAULT_FORM);
    Silian_setRuleBuilderValue(Silian_DEFAULT_CRITERIA);
    Silian_setCriteriaMode('builder');
    if (Silian_iconInputRef.current) {
      Silian_iconInputRef.current.value = '';
    }
  };

  const Silian_handleEdit = (Silian_badge) => {
    const Silian_normalizedCriteria = Silian_normalizeCriteria(Silian_badge?.auto_grant_criteria);
    Silian_setFormValues({
      ...Silian_DEFAULT_FORM,
      ...Silian_badge,
      auto_grant_criteria: Silian_normalizedCriteria
        ? JSON.stringify(Silian_normalizedCriteria, null, 2)
        : Silian_badge.auto_grant_criteria
          ? JSON.stringify(Silian_badge.auto_grant_criteria, null, 2)
          : '',
    });
    if (Silian_normalizedCriteria) {
      Silian_setRuleBuilderValue(Silian_normalizedCriteria);
      Silian_setCriteriaMode('builder');
    } else if (Silian_badge.auto_grant_criteria) {
      Silian_setCriteriaMode('json');
    } else {
      Silian_setRuleBuilderValue(Silian_DEFAULT_CRITERIA);
      Silian_setCriteriaMode('builder');
    }
  };

  const Silian_handleInputChange = (Silian_e) => {
    const { name: Silian_name, value: Silian_value } = Silian_e.target;
    Silian_setFormValues((Silian_prev) => ({ ...Silian_prev, [Silian_name]: Silian_value }));
  };

  const Silian_handleToggle = (Silian_field) => (Silian_checked) => {
    Silian_setFormValues((Silian_prev) => ({ ...Silian_prev, [Silian_field]: Silian_checked }));
  };

  const Silian_handleCriteriaModeChange = (Silian_next) => {
    if (!Silian_next) return;
    if (Silian_next === 'builder') {
      const Silian_parsed = Silian_normalizeCriteria(Silian_formValues.auto_grant_criteria);
      if (Silian_parsed) {
        Silian_setRuleBuilderValue(Silian_parsed);
        Silian_setFormValues((Silian_prev) => ({ ...Silian_prev, auto_grant_criteria: JSON.stringify(Silian_parsed, null, 2) }));
        Silian_setCriteriaMode('builder');
      } else {
        Silian_toast.error(Silian_t('admin.badges.ruleBuilder.parseFailed'));
      }
    } else {
      Silian_setCriteriaMode(Silian_next);
    }
  };

  const Silian_handleRuleBuilderChange = (Silian_nextValue) => {
    Silian_setRuleBuilderValue(Silian_nextValue);
    Silian_setFormValues((Silian_prev) => ({ ...Silian_prev, auto_grant_criteria: JSON.stringify(Silian_nextValue, null, 2) }));
  };

  const Silian_handleIconFileChange = async (Silian_event) => {
    const Silian_file = Silian_event.target.files?.[0];
    if (!Silian_file) return;
    if (Silian_file.size > 5 * 1024 * 1024) {
      Silian_toast.error(Silian_t('admin.badges.fileTooLarge'));
      Silian_event.target.value = '';
      return;
    }
    Silian_setUploadingIcon(true);
    try {
      const Silian_result = await Silian_uploadViaPresign(Silian_file, {
        directory: 'badges',
        entityType: 'badge',
        entityId: Silian_formValues.id || undefined,
      });
      const Silian_info = Silian_result?.data || Silian_result;
      Silian_setFormValues((Silian_prev) => ({
        ...Silian_prev,
        icon_path: Silian_info.file_path || Silian_prev.icon_path,
        icon_thumbnail_path: Silian_info.thumbnail_path || Silian_prev.icon_thumbnail_path,
        icon_url: Silian_info.url || Silian_info.public_url || Silian_prev.icon_url,
        icon_presigned_url: Silian_info.presigned_url || Silian_prev.icon_presigned_url,
      }));
      Silian_toast.success(Silian_t('admin.badges.uploadSuccess'));
    } catch (Silian_err) {
      Silian_toast.error(Silian_err?.message || Silian_t('admin.badges.uploadFailed'));
    } finally {
      Silian_setUploadingIcon(false);
      if (Silian_event.target) {
        Silian_event.target.value = '';
      }
    }
  };

  const Silian_handleSubmit = async (Silian_e) => {
    Silian_e.preventDefault();
    const Silian_payload = {
      name_zh: Silian_formValues.name_zh,
      name_en: Silian_formValues.name_en,
      description_zh: Silian_formValues.description_zh,
      description_en: Silian_formValues.description_en,
      icon_path: Silian_formValues.icon_path,
      icon_thumbnail_path: Silian_formValues.icon_thumbnail_path,
      sort_order: Number(Silian_formValues.sort_order) || 0,
      is_active: Boolean(Silian_formValues.is_active),
      auto_grant_enabled: Boolean(Silian_formValues.auto_grant_enabled),
      message_title_zh: Silian_formValues.message_title_zh,
      message_title_en: Silian_formValues.message_title_en,
      message_body_zh: Silian_formValues.message_body_zh,
      message_body_en: Silian_formValues.message_body_en,
    };

    if (Silian_payload.auto_grant_enabled) {
      if (Silian_criteriaMode === 'builder') {
        Silian_payload.auto_grant_criteria = Silian_ruleBuilderValue;
      } else if (Silian_formValues.auto_grant_criteria) {
        try {
          Silian_payload.auto_grant_criteria = JSON.parse(Silian_formValues.auto_grant_criteria);
        } catch {
          Silian_toast.error(Silian_t('admin.badges.criteriaParseFailed'));
          return;
        }
      } else {
        Silian_payload.auto_grant_criteria = null;
      }
    } else {
      Silian_payload.auto_grant_criteria = null;
    }

    try {
      Silian_setSaving(true);
      if (Silian_formValues.id) {
        await Silian_adminAPI.updateBadge(Silian_formValues.id, Silian_payload);
        Silian_toast.success(Silian_t('admin.badges.updateSuccess'));
      } else {
        await Silian_adminAPI.createBadge(Silian_payload);
        Silian_toast.success(Silian_t('admin.badges.createSuccess'));
      }
      Silian_resetForm();
      Silian_fetchBadges();
    } catch (Silian_err) {
      Silian_toast.error(Silian_err.response?.data?.message || Silian_t('admin.badges.saveFailed'));
    } finally {
      Silian_setSaving(false);
    }
  };

  const Silian_handleBulkDialogComplete = ({ failed: Silian_failed }) => {
    if (!Silian_failed) {
      Silian_setBulkDialog((Silian_prev) => ({ ...Silian_prev, open: false }));
    }
    Silian_fetchBadges();
  };

  const Silian_handleAward = (Silian_badge) => {
    Silian_setBulkDialog({ open: true, badgeIds: Silian_badge ? [Silian_badge.id] : [], mode: 'award', presetUsers: [] });
  };

  const Silian_handleRevoke = (Silian_badge) => {
    Silian_setBulkDialog({ open: true, badgeIds: Silian_badge ? [Silian_badge.id] : [], mode: 'revoke', presetUsers: [] });
  };

  const Silian_handleViewRecipients = (Silian_badge) => {
    if (!Silian_badge) {
      return;
    }
    Silian_setRecipientDialog({ open: true, badge: Silian_badge });
  };

  const Silian_handleRecipientDialogChange = (Silian_open) => {
    Silian_setRecipientDialog((Silian_prev) => ({ open: Silian_open, badge: Silian_open ? Silian_prev.badge : null }));
  };

  const Silian_handleTriggerAuto = async () => {
    try {
      Silian_setTriggering(true);
      const Silian_response = await Silian_adminAPI.triggerBadgeAuto();
      const Silian_summary = Silian_response.data?.data;
      const Silian_awarded = Silian_summary && typeof Silian_summary.awarded !== 'undefined' ? Silian_summary.awarded : 0;
      const Silian_users = Silian_summary && typeof Silian_summary.users !== 'undefined' ? Silian_summary.users : 0;
      const Silian_extra = Silian_summary ? ' (' + Silian_awarded + ' / ' + Silian_users + ')' : '';
      Silian_toast.success(Silian_t('admin.badges.autoTriggered') + Silian_extra);
    } catch (Silian_err) {
      Silian_toast.error(Silian_err.response?.data?.message || Silian_t('admin.badges.autoTriggerFailed'));
    } finally {
      Silian_setTriggering(false);
      Silian_fetchBadges();
    }
  };

  const Silian_formattedBadges = Silian_useMemo(() => Silian_badges || [], [Silian_badges]);
  const Silian_activeBadges = Silian_useMemo(() => Silian_formattedBadges.filter((Silian_badge) => Silian_badge.is_active), [Silian_formattedBadges]);
  const Silian_autoBadges = Silian_useMemo(() => Silian_formattedBadges.filter((Silian_badge) => Silian_badge.auto_grant_enabled), [Silian_formattedBadges]);
  const Silian_previewImage = Silian_resolveBadgeImage(Silian_formValues);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Silian_Card>
          <Silian_CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Silian_CardTitle className="text-sm font-medium">{Silian_t('admin.badges.metrics.total')}</Silian_CardTitle>
            <Silian_Award className="h-4 w-4 text-muted-foreground" />
          </Silian_CardHeader>
          <Silian_CardContent>
            <div className="text-2xl font-bold">{Silian_formattedBadges.length}</div>
            <p className="text-xs text-muted-foreground">
              {Silian_t('admin.badges.metrics.totalHint')}
            </p>
          </Silian_CardContent>
        </Silian_Card>
        <Silian_Card>
          <Silian_CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Silian_CardTitle className="text-sm font-medium">{Silian_t('admin.badges.metrics.active')}</Silian_CardTitle>
            <Silian_ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </Silian_CardHeader>
          <Silian_CardContent>
            <div className="text-2xl font-bold">{Silian_activeBadges.length}</div>
            <p className="text-xs text-muted-foreground">
              {Silian_t('admin.badges.metrics.activeHint')}
            </p>
          </Silian_CardContent>
        </Silian_Card>
        <Silian_Card>
          <Silian_CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Silian_CardTitle className="text-sm font-medium">{Silian_t('admin.badges.metrics.auto')}</Silian_CardTitle>
            <Silian_BarChart3 className="h-4 w-4 text-muted-foreground" />
          </Silian_CardHeader>
          <Silian_CardContent>
            <div className="text-2xl font-bold">{Silian_autoBadges.length}</div>
            <p className="text-xs text-muted-foreground">
              {Silian_t('admin.badges.metrics.autoHint')}
            </p>
          </Silian_CardContent>
        </Silian_Card>
      </div>

      <Silian_Card>
        <Silian_CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-1">
            <Silian_CardTitle>{Silian_t('admin.badges.listTitle')}</Silian_CardTitle>
            <p className="text-sm text-muted-foreground">
              {Silian_t('admin.badges.listHint')}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <Silian_Button className="w-full sm:w-auto" variant="outline" onClick={Silian_fetchBadges} disabled={Silian_loading}>
              <Silian_RefreshCw className={'h-4 w-4 mr-2 ' + (Silian_loading ? 'animate-spin' : '')} />
              {Silian_t('common.refresh')}
            </Silian_Button>
            <Silian_Button className="w-full sm:w-auto" variant="outline" onClick={Silian_handleTriggerAuto} disabled={Silian_triggering}>
              {Silian_triggering ? (
                <Silian_Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Silian_Sparkles className="h-4 w-4 mr-2" />
              )}
              {Silian_t('admin.badges.triggerAuto')}
            </Silian_Button>
            <Silian_Button className="w-full sm:w-auto" variant="outline" onClick={() => Silian_handleAward(null)}>
              <Silian_Users className="h-4 w-4 mr-2" />
              {Silian_t('admin.badges.bulkAward')}
            </Silian_Button>
            <Silian_Button className="w-full sm:w-auto" onClick={Silian_resetForm} variant="secondary">
              {Silian_t('admin.badges.newBadge')}
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
                      {Silian_t('admin.badges.table.icon')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium uppercase tracking-wider text-muted-foreground">
                      {Silian_t('admin.badges.table.name')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium uppercase tracking-wider text-muted-foreground">
                      {Silian_t('admin.badges.table.status')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium uppercase tracking-wider text-muted-foreground">
                      {Silian_t('admin.badges.table.stats')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium uppercase tracking-wider text-muted-foreground">
                      {Silian_t('admin.badges.table.auto')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium uppercase tracking-wider text-muted-foreground">
                      {Silian_t('admin.badges.table.sort')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium uppercase tracking-wider text-muted-foreground">
                      {Silian_t('admin.badges.table.updated')}
                    </th>
                    <th className="px-4 py-3 text-right font-medium uppercase tracking-wider text-muted-foreground">
                      {Silian_t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {Silian_formattedBadges.map((Silian_badge) => {
                    const Silian_ruleCount = Array.isArray(Silian_badge.auto_grant_criteria?.rules)
                      ? Silian_badge.auto_grant_criteria.rules.length
                      : Array.isArray(Silian_badge.auto_grant_criteria)
                        ? Silian_badge.auto_grant_criteria.length
                        : 0;
                    const Silian_stats = Silian_badge.stats || Silian_DEFAULT_BADGE_STATS;
                    const Silian_badgeImage = Silian_resolveBadgeImage(Silian_badge);
                    return (
                      <tr key={Silian_badge.id} className="transition-colors hover:bg-muted/40">
                        <td className="px-4 py-3">
                          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border bg-muted">
                            {Silian_badgeImage.src || Silian_badgeImage.filePath ? (
                              <Silian_R2Image
                                src={Silian_badgeImage.src || undefined}
                                filePath={Silian_badgeImage.filePath || undefined}
                                alt={Silian_badge.name_zh || Silian_badge.name_en}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Silian_Award className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{Silian_badge.name_zh || Silian_badge.name_en}</div>
                          <div className="text-xs text-muted-foreground">{Silian_badge.name_en}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Silian_Badge variant={Silian_badge.is_active ? 'success' : 'secondary'}>
                            {Silian_badge.is_active
                              ? Silian_t('admin.badges.active')
                              : Silian_t('admin.badges.inactive')}
                          </Silian_Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground/80">
                          <div className="flex flex-col gap-1">
                            <span>{Silian_t('admin.badges.stats.summary',  { awarded: Silian_stats.awarded_records || 0, total: Silian_stats.total_records || 0 })}</span>
                            <span className="text-xs text-muted-foreground">
                              {Silian_t('admin.badges.stats.awardedUsers',  { count: Silian_stats.awarded_users || 0 })}
                            </span>
                            {Silian_stats.last_awarded_at ? (
                              <span className="text-[10px] text-muted-foreground">
                                {Silian_t('admin.badges.stats.lastAwarded',  { time: Silian_format(new Date(Silian_stats.last_awarded_at), 'yyyy-MM-dd HH:mm') })}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <Silian_Badge variant={Silian_badge.auto_grant_enabled ? 'outline' : 'secondary'}>
                              {Silian_badge.auto_grant_enabled
                                ? Silian_t('admin.badges.autoEnabled')
                                : Silian_t('admin.badges.autoDisabled')}
                            </Silian_Badge>
                            {Silian_badge.auto_grant_enabled && Silian_ruleCount > 0 && (
                              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                {Silian_t('admin.badges.ruleBuilder.ruleCount',  { count: Silian_ruleCount })}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground/80">{Silian_badge.sort_order}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {Silian_badge.updated_at
                            ? Silian_format(new Date(Silian_badge.updated_at), 'yyyy-MM-dd HH:mm')
                            : '--'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Silian_Button className="w-full sm:w-auto" variant="ghost" size="sm" onClick={() => Silian_handleEdit(Silian_badge)}>
                              <Silian_Edit className="h-4 w-4 mr-1" />
                              {Silian_t('common.edit')}
                            </Silian_Button>
                            <Silian_Button className="w-full sm:w-auto" variant="ghost" size="sm" onClick={() => Silian_handleViewRecipients(Silian_badge)}>
                              <Silian_Eye className="h-4 w-4 mr-1" />
                              {Silian_t('admin.badges.viewRecipients')}
                            </Silian_Button>
                            <Silian_Button className="w-full sm:w-auto" variant="ghost" size="sm" onClick={() => Silian_handleAward(Silian_badge)}>
                              <Silian_Sparkles className="h-4 w-4 mr-1" />
                              {Silian_t('admin.badges.award')}
                            </Silian_Button>
                            <Silian_Button className="w-full sm:w-auto" variant="ghost" size="sm" onClick={() => Silian_handleRevoke(Silian_badge)}>
                              <Silian_Trash2 className="h-4 w-4 mr-1" />
                              {Silian_t('admin.badges.revoke')}
                            </Silian_Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {Silian_formattedBadges.length === 0 && !Silian_loading && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-sm text-muted-foreground">
                        {Silian_t('admin.badges.empty')}
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
              ? Silian_t('admin.badges.editTitle')
              : Silian_t('admin.badges.createTitle')}
          </Silian_CardTitle>
        </Silian_CardHeader>
        <Silian_CardContent>
          <form onSubmit={Silian_handleSubmit} className="grid grid-cols-1 gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {Silian_t('admin.badges.fields.nameZh')}
                  </label>
                  <Silian_Input
                    name="name_zh"
                    value={Silian_formValues.name_zh}
                    onChange={Silian_handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {Silian_t('admin.badges.fields.nameEn')}
                  </label>
                  <Silian_Input
                    name="name_en"
                    value={Silian_formValues.name_en}
                    onChange={Silian_handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {Silian_t('admin.badges.fields.descZh')}
                  </label>
                  <Silian_Textarea
                    name="description_zh"
                    value={Silian_formValues.description_zh}
                    onChange={Silian_handleInputChange}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {Silian_t('admin.badges.fields.descEn')}
                  </label>
                  <Silian_Textarea
                    name="description_en"
                    value={Silian_formValues.description_en}
                    onChange={Silian_handleInputChange}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      {Silian_t('admin.badges.fields.sort')}
                    </label>
                    <Silian_Input
                      type="number"
                      name="sort_order"
                      value={Silian_formValues.sort_order}
                      onChange={Silian_handleInputChange}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {Silian_t('admin.badges.fields.isActive')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {Silian_t('admin.badges.fields.isActiveHint')}
                      </p>
                    </div>
                    <Silian_Switch checked={Silian_formValues.is_active} onCheckedChange={Silian_handleToggle('is_active')} />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {Silian_t('admin.badges.fields.icon')}
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg border bg-muted overflow-hidden flex items-center justify-center">
                      {Silian_previewImage.src || Silian_previewImage.filePath ? (
                        <Silian_R2Image
                          src={Silian_previewImage.src || undefined}
                          filePath={Silian_previewImage.filePath || undefined}
                          alt={Silian_formValues.name_zh || Silian_formValues.name_en}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Silian_Award className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Silian_Button
                        type="button"
                        variant="outline"
                        disabled={Silian_uploadingIcon}
                        onClick={() => Silian_iconInputRef.current?.click()}
                        className="flex items-center gap-2"
                      >
                        {Silian_uploadingIcon ? (
                          <Silian_Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Silian_Upload className="h-4 w-4" />
                        )}
                        {Silian_t('admin.badges.fields.uploadIcon')}
                      </Silian_Button>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={Silian_iconInputRef}
                        onChange={Silian_handleIconFileChange}
                      />
                      <p className="text-xs text-muted-foreground">
                        {Silian_t('admin.badges.fields.iconHint')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {Silian_t('admin.badges.fields.autoGrantTitle')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {Silian_t('admin.badges.fields.autoGrantHint')}
                      </p>
                    </div>
                    <Silian_Switch checked={Silian_formValues.auto_grant_enabled} onCheckedChange={Silian_handleToggle('auto_grant_enabled')} />
                  </div>

                  {Silian_formValues.auto_grant_enabled && (
                    <div className="space-y-4">
                      <Silian_ToggleGroup
                        type="single"
                        value={Silian_criteriaMode}
                        onValueChange={Silian_handleCriteriaModeChange}
                        variant="outline"
                      >
                        <Silian_ToggleGroupItem value="builder">
                          {Silian_t('admin.badges.ruleBuilder.toggle.visual')}
                        </Silian_ToggleGroupItem>
                        <Silian_ToggleGroupItem value="json">
                          {Silian_t('admin.badges.ruleBuilder.toggle.json')}
                        </Silian_ToggleGroupItem>
                      </Silian_ToggleGroup>

                      {Silian_criteriaMode === 'builder' ? (
                        <Silian_BadgeRuleBuilder value={Silian_ruleBuilderValue} onChange={Silian_handleRuleBuilderChange} />
                      ) : (
                        <Silian_Textarea
                          className="font-mono"
                          rows={12}
                          value={Silian_formValues.auto_grant_criteria}
                          onChange={(Silian_e) => Silian_setFormValues((Silian_prev) => ({ ...Silian_prev, auto_grant_criteria: Silian_e.target.value }))}
                          placeholder={JSON.stringify(Silian_DEFAULT_CRITERIA, null, 2)}
                        />
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {Silian_t('admin.badges.fields.messageTitleZh')}
                  </label>
                  <Silian_Input
                    name="message_title_zh"
                    value={Silian_formValues.message_title_zh}
                    onChange={Silian_handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {Silian_t('admin.badges.fields.messageTitleEn')}
                  </label>
                  <Silian_Input
                    name="message_title_en"
                    value={Silian_formValues.message_title_en}
                    onChange={Silian_handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {Silian_t('admin.badges.fields.messageBodyZh')}
                  </label>
                  <Silian_Textarea
                    name="message_body_zh"
                    value={Silian_formValues.message_body_zh}
                    onChange={Silian_handleInputChange}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {Silian_t('admin.badges.fields.messageBodyEn')}
                  </label>
                  <Silian_Textarea
                    name="message_body_en"
                    value={Silian_formValues.message_body_en}
                    onChange={Silian_handleInputChange}
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <Silian_Button className="w-full sm:w-auto" type="button" variant="ghost" onClick={Silian_resetForm}>
                {Silian_t('common.reset')}
              </Silian_Button>
              <Silian_Button className="w-full sm:w-auto" type="submit" disabled={Silian_saving}>
                {Silian_saving && <Silian_Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {Silian_formValues.id ? Silian_t('common.saveChanges') : Silian_t('common.create')}
              </Silian_Button>
            </div>
          </form>
        </Silian_CardContent>
      </Silian_Card>

      <Silian_BadgeBulkAwardDialog
        open={Silian_bulkDialog.open}
        onOpenChange={(Silian_open) => {
          if (!Silian_open) {
            Silian_setBulkDialog({ open: false, badgeIds: [], mode: 'award', presetUsers: [] });
          } else {
            Silian_setBulkDialog((Silian_prev) => ({ ...Silian_prev, open: true }));
          }
        }}
        badges={Silian_formattedBadges}
        defaultSelectedBadgeIds={Silian_bulkDialog.badgeIds}
        presetUsers={Silian_bulkDialog.presetUsers}
        onCompleted={Silian_handleBulkDialogComplete}
        mode={Silian_bulkDialog.mode}
      />
      <Silian_BadgeRecipientsDialog
        open={Silian_recipientDialog.open}
        onOpenChange={Silian_handleRecipientDialogChange}
        badge={Silian_recipientDialog.badge}
      />
    </div>
  );
}
