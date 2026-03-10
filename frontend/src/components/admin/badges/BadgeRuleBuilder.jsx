import React, { useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/useTranslation';
import { Plus, Trash2, Wand2 } from 'lucide-react';

const METRIC_OPTIONS = [
  {
    value: 'total_carbon_saved',
    labelI18n: 'admin.badges.ruleBuilder.metric.carbonSaved',
    fallback: '累计碳减排量 (kg)',
    hintI18n: 'admin.badges.ruleBuilder.metric.carbonSavedHint',
    hintFallback: '用户通过审核的活动累计节省的碳排放量',
  },
  {
    value: 'total_points_earned',
    labelI18n: 'admin.badges.ruleBuilder.metric.pointsEarned',
    fallback: '累计获得积分',
    hintI18n: 'admin.badges.ruleBuilder.metric.pointsEarnedHint',
    hintFallback: '所有通过审核的活动奖励积分总和',
  },
  {
    value: 'total_points_balance',
    labelI18n: 'admin.badges.ruleBuilder.metric.pointsBalance',
    fallback: '当前积分余额',
    hintI18n: 'admin.badges.ruleBuilder.metric.pointsBalanceHint',
    hintFallback: '用户当前账户剩余积分',
  },
  {
    value: 'total_approved_records',
    labelI18n: 'admin.badges.ruleBuilder.metric.approvedRecords',
    fallback: '审核通过的记录数',
    hintI18n: 'admin.badges.ruleBuilder.metric.approvedRecordsHint',
    hintFallback: '成功通过审核的碳减排活动数量',
  },
  {
    value: 'total_records',
    labelI18n: 'admin.badges.ruleBuilder.metric.totalRecords',
    fallback: '提交的记录总数',
    hintI18n: 'admin.badges.ruleBuilder.metric.totalRecordsHint',
    hintFallback: '无论状态如何的活动提交总量',
  },
  {
    value: 'days_since_registration',
    labelI18n: 'admin.badges.ruleBuilder.metric.daysSinceRegistration',
    fallback: '注册天数',
    hintI18n: 'admin.badges.ruleBuilder.metric.daysSinceRegistrationHint',
    hintFallback: '用户注册至今的天数',
  },
];

const OPERATOR_OPTIONS = [
  { value: '>=', labelI18n: 'admin.badges.ruleBuilder.operator.gte', fallback: '≥' },
  { value: '>', labelI18n: 'admin.badges.ruleBuilder.operator.gt', fallback: '>' },
  { value: '<=', labelI18n: 'admin.badges.ruleBuilder.operator.lte', fallback: '≤' },
  { value: '<', labelI18n: 'admin.badges.ruleBuilder.operator.lt', fallback: '<' },
  { value: '==', labelI18n: 'admin.badges.ruleBuilder.operator.eq', fallback: '=' },
  { value: '!=', labelI18n: 'admin.badges.ruleBuilder.operator.neq', fallback: '≠' },
];

const TEMPLATE_LIBRARY = [
  {
    id: 'carbon-champion',
    labelI18n: 'admin.badges.ruleBuilder.templates.carbonChampion',
    fallback: '碳减排先锋',
    descriptionI18n: 'admin.badges.ruleBuilder.templates.carbonChampionDesc',
    descriptionFallback: '累计碳减排 ≥ 100 kg 且审核通过记录 ≥ 10 条',
    value: {
      all: true,
      rules: [
        { metric: 'total_carbon_saved', operator: '>=', value: 100, label: 'Carbon Saved', description: '累计碳减排 ≥ 100 kg' },
        { metric: 'total_approved_records', operator: '>=', value: 10, label: 'Approved Records', description: '审核通过记录 ≥ 10 条' },
      ],
    },
  },
  {
    id: 'points-master',
    labelI18n: 'admin.badges.ruleBuilder.templates.pointsMaster',
    fallback: '积分达人',
    descriptionI18n: 'admin.badges.ruleBuilder.templates.pointsMasterDesc',
    descriptionFallback: '累计获取积分 ≥ 5000 或积分余额 ≥ 2000',
    value: {
      all: false,
      rules: [
        { metric: 'total_points_earned', operator: '>=', value: 5000, label: 'Earned Points', description: '累计积分 ≥ 5000' },
        { metric: 'total_points_balance', operator: '>=', value: 2000, label: 'Points Balance', description: '积分余额 ≥ 2000' },
      ],
    },
  },
  {
    id: 'veteran-member',
    labelI18n: 'admin.badges.ruleBuilder.templates.veteran',
    fallback: '资深会员',
    descriptionI18n: 'admin.badges.ruleBuilder.templates.veteranDesc',
    descriptionFallback: '注册超过 365 天并累计提交 50 条记录',
    value: {
      all: true,
      rules: [
        { metric: 'days_since_registration', operator: '>=', value: 365, label: 'Membership Days', description: '注册天数 ≥ 365' },
        { metric: 'total_records', operator: '>=', value: 50, label: 'Total Submissions', description: '提交记录 ≥ 50 条' },
      ],
    },
  },
];

const DEFAULT_RULE = {
  metric: 'total_carbon_saved',
  operator: '>=',
  value: 10,
  label: '',
  description: '',
};

const ensureRule = (rule = {}) => ({
  metric: rule.metric ?? 'total_carbon_saved',
  operator: rule.operator ?? '>=',
  value: Number.isFinite(rule.value) ? rule.value : Number(rule.value ?? 0) || 0,
  label: rule.label ?? '',
  description: rule.description ?? '',
});

export function BadgeRuleBuilder({ value, onChange }) {
  const { t } = useTranslation();
  const safeValue = useMemo(() => {
    if (!value || typeof value !== 'object') {
      return { all: true, rules: [] };
    }
    const rules = Array.isArray(value.rules)
      ? value.rules.map(ensureRule)
      : Array.isArray(value)
        ? value.map(ensureRule)
        : [];
    const flag = value.all ?? value.all_required ?? value.requireAll ?? true;
    return { all: Boolean(flag), rules };
  }, [value]);

  const updateValue = (next) => {
    onChange?.({
      all: Boolean(next.all ?? safeValue.all),
      rules: Array.isArray(next.rules) ? next.rules.map(ensureRule) : safeValue.rules,
    });
  };

  const handleToggleAll = (checked) => {
    updateValue({ ...safeValue, all: checked });
  };

  const handleRuleChange = (index, partial) => {
    const nextRules = safeValue.rules.map((rule, idx) => (idx === index ? ensureRule({ ...rule, ...partial }) : rule));
    updateValue({ ...safeValue, rules: nextRules });
  };

  const handleRemoveRule = (index) => {
    const nextRules = safeValue.rules.filter((_, idx) => idx !== index);
    updateValue({ ...safeValue, rules: nextRules });
  };

  const handleAddRule = () => {
    updateValue({ ...safeValue, rules: [...safeValue.rules, DEFAULT_RULE] });
  };

  const applyTemplate = (template) => {
    updateValue(template.value);
  };

  const metricLookup = useMemo(() => {
    const map = new Map();
    METRIC_OPTIONS.forEach((option) => {
      map.set(option.value, option);
    });
    return map;
  }, []);

  return (
    <div className="space-y-4 rounded-lg border bg-muted/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold leading-none tracking-tight">
            {t('admin.badges.ruleBuilder.title')} 
            <Badge variant="secondary" className="ml-2">
              {safeValue.all
                ? t('admin.badges.ruleBuilder.modeAll')
                : t('admin.badges.ruleBuilder.modeAny')}
            </Badge>
          </p>
          <p className="text-xs text-muted-foreground">
            {t('admin.badges.ruleBuilder.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {safeValue.all
              ? t('admin.badges.ruleBuilder.requireAllHint')
              : t('admin.badges.ruleBuilder.requireAnyHint')}
          </span>
          <Switch checked={safeValue.all} onCheckedChange={handleToggleAll} />
        </div>
      </div>

      <div className="space-y-3">
        {safeValue.rules.length === 0 && (
          <div className="rounded-md border border-dashed bg-background p-6 text-center text-sm text-muted-foreground">
            {t('admin.badges.ruleBuilder.empty')}
          </div>
        )}
        {safeValue.rules.map((rule, index) => {
          const metricOption = metricLookup.get(rule.metric);
          return (
            <div key={index} className="space-y-4 rounded-lg border bg-background p-4 shadow-sm">
              <div className="grid gap-3 md:grid-cols-12">
                <div className="md:col-span-5 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t('admin.badges.ruleBuilder.fields.metric')}
                  </label>
                  <Select value={rule.metric} onValueChange={(val) => handleRuleChange(index, { metric: val })}>
                    <SelectTrigger className="w-full justify-between">
                      <SelectValue placeholder={t('admin.badges.ruleBuilder.selectMetric')} />
                    </SelectTrigger>
                    <SelectContent>
                      {METRIC_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex flex-col">
                            <span>{t(option.labelI18n, option.fallback)}</span>
                            <span className="text-xs text-muted-foreground">
                              {t(option.hintI18n, option.hintFallback)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t('admin.badges.ruleBuilder.fields.operator')}
                  </label>
                  <Select value={rule.operator} onValueChange={(val) => handleRuleChange(index, { operator: val })}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATOR_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(option.labelI18n, option.fallback)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-3 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t('admin.badges.ruleBuilder.fields.value')}
                  </label>
                  <Input
                    type="number"
                    value={rule.value ?? ''}
                    onChange={(e) => handleRuleChange(index, { value: Number(e.target.value) })}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {metricOption ? t(metricOption.hintI18n, metricOption.hintFallback) : t('admin.badges.ruleBuilder.valueHint')}
                  </p>
                </div>
                <div className="md:col-span-2 flex items-end justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveRule(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t('admin.badges.ruleBuilder.fields.label')}
                  </label>
                  <Input
                    value={rule.label ?? ''}
                    onChange={(e) => handleRuleChange(index, { label: e.target.value })}
                    placeholder={t('admin.badges.ruleBuilder.fields.labelPlaceholder')}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t('admin.badges.ruleBuilder.fields.description')}
                  </label>
                  <Input
                    value={rule.description ?? ''}
                    onChange={(e) => handleRuleChange(index, { description: e.target.value })}
                    placeholder={t('admin.badges.ruleBuilder.fields.descriptionPlaceholder')}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={handleAddRule}>
          <Plus className="mr-2 h-4 w-4" />
          {t('admin.badges.ruleBuilder.addRule')}
        </Button>
        {TEMPLATE_LIBRARY.map((template) => (
          <Button
            key={template.id}
            type="button"
            variant="ghost"
            onClick={() => applyTemplate(template)}
          >
            <Wand2 className="mr-2 h-4 w-4" />
            {t(template.labelI18n, template.fallback)}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border bg-background p-3">
        <p className="text-xs font-medium text-muted-foreground">
          {t('admin.badges.ruleBuilder.preview')}
        </p>
        <pre className="mt-2 max-h-48 overflow-auto text-xs leading-5">{JSON.stringify(safeValue, null, 2)}</pre>
      </div>
    </div>
  );
}

export default BadgeRuleBuilder;
