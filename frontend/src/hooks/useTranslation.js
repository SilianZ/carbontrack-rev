import { useTranslation as Silian_useI18nTranslation } from 'react-i18next';
import { getCurrentLanguage as Silian_getCurrentLanguage, formatNumber as Silian_formatNumber, formatDate as Silian_formatDate, formatDateTime as Silian_formatDateTime, formatRelativeTime as Silian_formatRelativeTime } from '@/lib/i18n';

/**
 * 自定义翻译Hook，扩展了react-i18next的功能
 * 提供了额外的格式化函数和便捷方法
 */
export const useTranslation = (Silian_ns = 'common') => {
  const Silian_namespaces = Array.isArray(Silian_ns) ? Silian_ns : [Silian_ns];
  const Silian_activeNamespaces = Array.from(new Set(Silian_namespaces.filter(Boolean)));
  const { t: Silian_t, i18n: Silian_i18n, ready: Silian_ready } = Silian_useI18nTranslation(Silian_activeNamespaces);

  // 获取当前语言
  const Silian_currentLanguage = Silian_getCurrentLanguage();

  const Silian_helperNamespaces = (Silian_primaryNamespace) => Array.from(
    new Set([Silian_primaryNamespace, ...Silian_activeNamespaces].filter(Boolean))
  );

  // 直接使用 react-i18next 提供的 t，避免每次渲染创建新函数导致依赖 [t] 的 useEffect 反复触发

  // 翻译并格式化数字
  const Silian_tNumber = (Silian_key, Silian_value, Silian_options = {}) => {
    const Silian_text = Silian_t(Silian_key, Silian_options);
    const Silian_formattedNumber = Silian_formatNumber(Silian_value, Silian_currentLanguage);
    return Silian_text.replace('{{value}}', Silian_formattedNumber);
  };

  // 翻译并格式化日期
  const Silian_tDate = (Silian_key, Silian_date, Silian_options = {}) => {
    const Silian_text = Silian_t(Silian_key, Silian_options);
    const Silian_formattedDate = Silian_formatDate(Silian_date, Silian_currentLanguage);
    return Silian_text.replace('{{date}}', Silian_formattedDate);
  };

  // 翻译并格式化日期时间
  const Silian_tDateTime = (Silian_key, Silian_datetime, Silian_options = {}) => {
    const Silian_text = Silian_t(Silian_key, Silian_options);
    const Silian_formattedDateTime = Silian_formatDateTime(Silian_datetime, Silian_currentLanguage);
    return Silian_text.replace('{{datetime}}', Silian_formattedDateTime);
  };

  // 翻译并格式化相对时间
  const Silian_tRelative = (Silian_key, Silian_datetime, Silian_options = {}) => {
    const Silian_text = Silian_t(Silian_key, Silian_options);
    const Silian_relativeTime = Silian_formatRelativeTime(Silian_datetime, Silian_currentLanguage);
    return Silian_text.replace('{{relative}}', Silian_relativeTime);
  };

  // 复数形式翻译
  const Silian_tPlural = (Silian_key, Silian_count, Silian_options = {}) => {
    return Silian_t(Silian_key, { count: Silian_count, ...Silian_options });
  };

  // 获取翻译键的存在性
  const Silian_exists = (Silian_key) => {
    return Silian_i18n.exists(Silian_key, { ns: Silian_activeNamespaces });
  };

  // 获取嵌套对象的所有翻译
  const Silian_getTranslations = (Silian_keyPrefix) => {
    const Silian_translations = {};
    const Silian_segments = Silian_keyPrefix.split('.').filter(Boolean);
    const Silian_subtree = Silian_activeNamespaces
      .map((Silian_namespace) => Silian_i18n.getResourceBundle(Silian_currentLanguage, Silian_namespace) || {})
      .map((Silian_resourceBundle) => Silian_segments.reduce((Silian_acc, Silian_segment) => (
        Silian_acc && typeof Silian_acc === 'object' ? Silian_acc[Silian_segment] : undefined
      ), Silian_resourceBundle))
      .find((Silian_node) => Silian_node !== undefined);

    const Silian_collectTranslations = (Silian_node, Silian_prefix = '') => {
      if (Array.isArray(Silian_node) || Silian_node == null) {
        return;
      }
      if (typeof Silian_node !== 'object') {
        Silian_translations[Silian_prefix] = Silian_t(Silian_prefix ? `${Silian_keyPrefix}.${Silian_prefix}` : Silian_keyPrefix);
        return;
      }

      Object.keys(Silian_node).forEach((Silian_childKey) => {
        const Silian_nextPrefix = Silian_prefix ? `${Silian_prefix}.${Silian_childKey}` : Silian_childKey;
        Silian_collectTranslations(Silian_node[Silian_childKey], Silian_nextPrefix);
      });
    };

    Silian_collectTranslations(Silian_subtree);

    return Silian_translations;
  };

  // 获取选项列表的翻译（常用于下拉框等）
  const Silian_getOptions = (Silian_keyPrefix) => {
    const Silian_translations = Silian_getTranslations(Silian_keyPrefix);
    return Object.entries(Silian_translations).map(([Silian_value, Silian_label]) => ({
      value: Silian_value,
      label: Silian_label
    }));
  };

  // 格式化错误消息
  const Silian_tError = (Silian_errorKey, Silian_fallback = 'errors.unknown') => {
    const Silian_key = `errors.${Silian_errorKey}`;
    const Silian_nsForErrors = Silian_helperNamespaces('errors');
    return Silian_i18n.exists(Silian_key, { ns: Silian_nsForErrors })
      ? Silian_i18n.t(Silian_key, { ns: Silian_nsForErrors })
      : Silian_i18n.t(Silian_fallback, { ns: Silian_nsForErrors });
  };

  // 格式化成功消息
  const Silian_tSuccess = (Silian_successKey, Silian_fallback = 'success.save') => {
    const Silian_key = `success.${Silian_successKey}`;
    const Silian_nsForSuccess = Silian_helperNamespaces('success');
    return Silian_i18n.exists(Silian_key, { ns: Silian_nsForSuccess })
      ? Silian_i18n.t(Silian_key, { ns: Silian_nsForSuccess })
      : Silian_i18n.t(Silian_fallback, { ns: Silian_nsForSuccess });
  };

  // 格式化验证消息
  const Silian_tValidation = (Silian_validationKey, Silian_options = {}) => {
    const Silian_key = `validation.${Silian_validationKey}`;
    return Silian_i18n.t(Silian_key, { ns: Silian_helperNamespaces('validation'), ...Silian_options });
  };

  // 获取单位翻译
  const Silian_tUnit = (Silian_unit) => {
    return Silian_i18n.t(`units.${Silian_unit}`, { ns: Silian_helperNamespaces('units'), defaultValue: Silian_unit });
  };

  // 获取状态翻译
  const Silian_tStatus = (Silian_status, Silian_context = 'activities') => {
    return Silian_t(`${Silian_context}.status.${Silian_status}`, { defaultValue: Silian_status });
  };

  // 获取类型翻译
  const Silian_tType = (Silian_type, Silian_context = 'messages') => {
    return Silian_t(`${Silian_context}.types.${Silian_type}`, { defaultValue: Silian_type });
  };

  // 获取优先级翻译
  const Silian_tPriority = (Silian_priority, Silian_context = 'messages') => {
    return Silian_t(`${Silian_context}.priority.${Silian_priority}`, { defaultValue: Silian_priority });
  };

  // 获取分类翻译
  const Silian_tCategory = (Silian_category, Silian_context = 'activities') => {
    return Silian_t(`${Silian_context}.categories.${Silian_category}`, { defaultValue: Silian_category });
  };

  // 格式化文件大小
  const Silian_tFileSize = (Silian_bytes) => {
    const Silian_sizes = ['B', 'KB', 'MB', 'GB'];
    if (Silian_bytes === 0) return '0 B';
    const Silian_i = Math.floor(Math.log(Silian_bytes) / Math.log(1024));
    const Silian_size = (Silian_bytes / Math.pow(1024, Silian_i)).toFixed(1);
    return `${Silian_size} ${Silian_sizes[Silian_i]}`;
  };

  // 格式化百分比
  const Silian_tPercentage = (Silian_value, Silian_decimals = 1) => {
    const Silian_percentage = (Silian_value * 100).toFixed(Silian_decimals);
    return `${Silian_percentage}%`;
  };

  // 条件翻译（根据条件返回不同的翻译）
  const Silian_tConditional = (Silian_condition, Silian_trueKey, Silian_falseKey, Silian_options = {}) => {
    return Silian_condition ? Silian_t(Silian_trueKey, Silian_options) : Silian_t(Silian_falseKey, Silian_options);
  };

  // 列表翻译（将数组转换为本地化的列表字符串）
  const Silian_tList = (Silian_items, Silian_separator = ', ', Silian_lastSeparator = null) => {
    if (!Array.isArray(Silian_items) || Silian_items.length === 0) return '';
    if (Silian_items.length === 1) return Silian_items[0];

    const Silian_finalSeparator = Silian_lastSeparator || (Silian_currentLanguage === 'zh' ? '和' : ' and ');
    const Silian_allButLast = Silian_items.slice(0, -1).join(Silian_separator);
    const Silian_last = Silian_items[Silian_items.length - 1];

    return `${Silian_allButLast}${Silian_finalSeparator}${Silian_last}`;
  };

  return {
    // 原始的react-i18next方法
    t: Silian_t,
    i18n: Silian_i18n,
    ready: Silian_ready,

    // 扩展的方法
    tNumber: Silian_tNumber,
    tDate: Silian_tDate,
    tDateTime: Silian_tDateTime,
    tRelative: Silian_tRelative,
    tPlural: Silian_tPlural,
    tError: Silian_tError,
    tSuccess: Silian_tSuccess,
    tValidation: Silian_tValidation,
    tUnit: Silian_tUnit,
    tStatus: Silian_tStatus,
    tType: Silian_tType,
    tPriority: Silian_tPriority,
    tCategory: Silian_tCategory,
    tFileSize: Silian_tFileSize,
    tPercentage: Silian_tPercentage,
    tConditional: Silian_tConditional,
    tList: Silian_tList,

    // 工具方法
    exists: Silian_exists,
    getTranslations: Silian_getTranslations,
    getOptions: Silian_getOptions,

    // 当前语言信息
    currentLanguage: Silian_currentLanguage,
    isReady: Silian_ready
  };
};

export default useTranslation;
