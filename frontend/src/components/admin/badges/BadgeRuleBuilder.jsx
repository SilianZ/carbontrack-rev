import Silian_React, { useMemo as Silian_useMemo } from 'react';
import { Button as Silian_Button } from '@/components/ui/Button';
import { Input as Silian_Input } from '@/components/ui/Input';
import { Select as Silian_Select, SelectTrigger as Silian_SelectTrigger, SelectContent as Silian_SelectContent, SelectItem as Silian_SelectItem, SelectValue as Silian_SelectValue } from '@/components/ui/select';
import { Switch as Silian_Switch } from '@/components/ui/switch';
import { Badge as Silian_Badge } from '@/components/ui/badge';
import { useTranslation as Silian_useTranslation } from '@/hooks/useTranslation';
import { Plus as Silian_Plus, Trash2 as Silian_Trash2, Wand2 as Silian_Wand2 } from 'lucide-react';

const Silian_METRIC_OPTIONS = [
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

const Silian_OPERATOR_OPTIONS = [
  { value: '>=', labelI18n: 'admin.badges.ruleBuilder.operator.gte', fallback: '≥' },
  { value: '>', labelI18n: 'admin.badges.ruleBuilder.operator.gt', fallback: '>' },
  { value: '<=', labelI18n: 'admin.badges.ruleBuilder.operator.lte', fallback: '≤' },
  { value: '<', labelI18n: 'admin.badges.ruleBuilder.operator.lt', fallback: '<' },
  { value: '==', labelI18n: 'admin.badges.ruleBuilder.operator.eq', fallback: '=' },
  { value: '!=', labelI18n: 'admin.badges.ruleBuilder.operator.neq', fallback: '≠' },
];

const Silian_TEMPLATE_LIBRARY = [
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

const Silian_DEFAULT_RULE = {
  metric: 'total_carbon_saved',
  operator: '>=',
  value: 10,
  label: '',
  description: '',
};

const Silian_ensureRule = (Silian_rule = {}) => ({
  metric: Silian_rule.metric ?? 'total_carbon_saved',
  operator: Silian_rule.operator ?? '>=',
  value: Number.isFinite(Silian_rule.value) ? Silian_rule.value : Number(Silian_rule.value ?? 0) || 0,
  label: Silian_rule.label ?? '',
  description: Silian_rule.description ?? '',
});

export function BadgeRuleBuilder({ value: Silian_value, onChange: Silian_onChange }) {
  const { t: Silian_t } = Silian_useTranslation(['admin']);
  const Silian_safeValue = Silian_useMemo(() => {
    if (!Silian_value || typeof Silian_value !== 'object') {
      return { all: true, rules: [] };
    }
    const Silian_rules = Array.isArray(Silian_value.rules)
      ? Silian_value.rules.map(Silian_ensureRule)
      : Array.isArray(Silian_value)
        ? Silian_value.map(Silian_ensureRule)
        : [];
    const Silian_flag = Silian_value.all ?? Silian_value.all_required ?? Silian_value.requireAll ?? true;
    return { all: Boolean(Silian_flag), rules: Silian_rules };
  }, [Silian_value]);

  const Silian_updateValue = (Silian_next) => {
    Silian_onChange?.({
      all: Boolean(Silian_next.all ?? Silian_safeValue.all),
      rules: Array.isArray(Silian_next.rules) ? Silian_next.rules.map(Silian_ensureRule) : Silian_safeValue.rules,
    });
  };

  const Silian_handleToggleAll = (Silian_checked) => {
    Silian_updateValue({ ...Silian_safeValue, all: Silian_checked });
  };

  const Silian_handleRuleChange = (Silian_index, Silian_partial) => {
    const Silian_nextRules = Silian_safeValue.rules.map((Silian_rule, Silian_idx) => (Silian_idx === Silian_index ? Silian_ensureRule({ ...Silian_rule, ...Silian_partial }) : Silian_rule));
    Silian_updateValue({ ...Silian_safeValue, rules: Silian_nextRules });
  };

  const Silian_handleRemoveRule = (Silian_index) => {
    const Silian_nextRules = Silian_safeValue.rules.filter((Silian__, Silian_idx) => Silian_idx !== Silian_index);
    Silian_updateValue({ ...Silian_safeValue, rules: Silian_nextRules });
  };

  const Silian_handleAddRule = () => {
    Silian_updateValue({ ...Silian_safeValue, rules: [...Silian_safeValue.rules, Silian_DEFAULT_RULE] });
  };

  const Silian_applyTemplate = (Silian_template) => {
    Silian_updateValue(Silian_template.value);
  };

  const Silian_metricLookup = Silian_useMemo(() => {
    const Silian_map = new Map();
    Silian_METRIC_OPTIONS.forEach((Silian_option) => {
      Silian_map.set(Silian_option.value, Silian_option);
    });
    return Silian_map;
  }, []);

  return (
    <div className="space-y-4 rounded-lg border bg-muted/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold leading-none tracking-tight">
            {Silian_t('admin.badges.ruleBuilder.title')}
            <Silian_Badge variant="secondary" className="ml-2">
              {Silian_safeValue.all
                ? Silian_t('admin.badges.ruleBuilder.modeAll')
                : Silian_t('admin.badges.ruleBuilder.modeAny')}
            </Silian_Badge>
          </p>
          <p className="text-xs text-muted-foreground">
            {Silian_t('admin.badges.ruleBuilder.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {Silian_safeValue.all
              ? Silian_t('admin.badges.ruleBuilder.requireAllHint')
              : Silian_t('admin.badges.ruleBuilder.requireAnyHint')}
          </span>
          <Silian_Switch checked={Silian_safeValue.all} onCheckedChange={Silian_handleToggleAll} />
        </div>
      </div>

      <div className="space-y-3">
        {Silian_safeValue.rules.length === 0 && (
          <div className="rounded-md border border-dashed bg-background p-6 text-center text-sm text-muted-foreground">
            {Silian_t('admin.badges.ruleBuilder.empty')}
          </div>
        )}
        {Silian_safeValue.rules.map((Silian_rule, Silian_index) => {
          const Silian_metricOption = Silian_metricLookup.get(Silian_rule.metric);
          return (
            <div key={Silian_index} className="space-y-4 rounded-lg border bg-background p-4 shadow-sm">
              <div className="grid gap-3 md:grid-cols-12">
                <div className="md:col-span-5 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {Silian_t('admin.badges.ruleBuilder.fields.metric')}
                  </label>
                  <Silian_Select value={Silian_rule.metric} onValueChange={(Silian_val) => Silian_handleRuleChange(Silian_index, { metric: Silian_val })}>
                    <Silian_SelectTrigger className="w-full justify-between">
                      <Silian_SelectValue placeholder={Silian_t('admin.badges.ruleBuilder.selectMetric')} />
                    </Silian_SelectTrigger>
                    <Silian_SelectContent>
                      {Silian_METRIC_OPTIONS.map((Silian_option) => (
                        <Silian_SelectItem key={Silian_option.value} value={Silian_option.value}>
                          <div className="flex flex-col">
                            <span>{Silian_t(Silian_option.labelI18n, Silian_option.fallback)}</span>
                            <span className="text-xs text-muted-foreground">
                              {Silian_t(Silian_option.hintI18n, Silian_option.hintFallback)}
                            </span>
                          </div>
                        </Silian_SelectItem>
                      ))}
                    </Silian_SelectContent>
                  </Silian_Select>
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {Silian_t('admin.badges.ruleBuilder.fields.operator')}
                  </label>
                  <Silian_Select value={Silian_rule.operator} onValueChange={(Silian_val) => Silian_handleRuleChange(Silian_index, { operator: Silian_val })}>
                    <Silian_SelectTrigger className="w-full">
                      <Silian_SelectValue />
                    </Silian_SelectTrigger>
                    <Silian_SelectContent>
                      {Silian_OPERATOR_OPTIONS.map((Silian_option) => (
                        <Silian_SelectItem key={Silian_option.value} value={Silian_option.value}>
                          {Silian_t(Silian_option.labelI18n, Silian_option.fallback)}
                        </Silian_SelectItem>
                      ))}
                    </Silian_SelectContent>
                  </Silian_Select>
                </div>
                <div className="md:col-span-3 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {Silian_t('admin.badges.ruleBuilder.fields.value')}
                  </label>
                  <Silian_Input
                    type="number"
                    value={Silian_rule.value ?? ''}
                    onChange={(Silian_e) => Silian_handleRuleChange(Silian_index, { value: Number(Silian_e.target.value) })}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {Silian_metricOption ? Silian_t(Silian_metricOption.hintI18n, Silian_metricOption.hintFallback) : Silian_t('admin.badges.ruleBuilder.valueHint')}
                  </p>
                </div>
                <div className="md:col-span-2 flex items-end justify-end">
                  <Silian_Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => Silian_handleRemoveRule(Silian_index)}
                  >
                    <Silian_Trash2 className="h-4 w-4" />
                  </Silian_Button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {Silian_t('admin.badges.ruleBuilder.fields.label')}
                  </label>
                  <Silian_Input
                    value={Silian_rule.label ?? ''}
                    onChange={(Silian_e) => Silian_handleRuleChange(Silian_index, { label: Silian_e.target.value })}
                    placeholder={Silian_t('admin.badges.ruleBuilder.fields.labelPlaceholder')}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {Silian_t('admin.badges.ruleBuilder.fields.description')}
                  </label>
                  <Silian_Input
                    value={Silian_rule.description ?? ''}
                    onChange={(Silian_e) => Silian_handleRuleChange(Silian_index, { description: Silian_e.target.value })}
                    placeholder={Silian_t('admin.badges.ruleBuilder.fields.descriptionPlaceholder')}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Silian_Button type="button" variant="outline" onClick={Silian_handleAddRule}>
          <Silian_Plus className="mr-2 h-4 w-4" />
          {Silian_t('admin.badges.ruleBuilder.addRule')}
        </Silian_Button>
        {Silian_TEMPLATE_LIBRARY.map((Silian_template) => (
          <Silian_Button
            key={Silian_template.id}
            type="button"
            variant="ghost"
            onClick={() => Silian_applyTemplate(Silian_template)}
          >
            <Silian_Wand2 className="mr-2 h-4 w-4" />
            {Silian_t(Silian_template.labelI18n, Silian_template.fallback)}
          </Silian_Button>
        ))}
      </div>

      <div className="rounded-lg border bg-background p-3">
        <p className="text-xs font-medium text-muted-foreground">
          {Silian_t('admin.badges.ruleBuilder.preview')}
        </p>
        <pre className="mt-2 max-h-48 overflow-auto text-xs leading-5">{JSON.stringify(Silian_safeValue, null, 2)}</pre>
      </div>
    </div>
  );
}

export default BadgeRuleBuilder;
