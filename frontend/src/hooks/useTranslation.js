import { useTranslation as useI18nTranslation } from 'react-i18next';
import { getCurrentLanguage, formatNumber, formatDate, formatDateTime, formatRelativeTime } from '@/lib/i18n';

/**
 * 自定义翻译Hook，扩展了react-i18next的功能
 * 提供了额外的格式化函数和便捷方法
 */
export const useTranslation = (ns = 'common') => {
  const namespaces = Array.isArray(ns) ? ns : [ns];
  const activeNamespaces = Array.from(new Set(namespaces.filter(Boolean)));
  const { t, i18n, ready } = useI18nTranslation(activeNamespaces);
  
  // 获取当前语言
  const currentLanguage = getCurrentLanguage();

  const helperNamespaces = (primaryNamespace) => Array.from(
    new Set([primaryNamespace, ...activeNamespaces].filter(Boolean))
  );
  
  // 直接使用 react-i18next 提供的 t，避免每次渲染创建新函数导致依赖 [t] 的 useEffect 反复触发
  
  // 翻译并格式化数字
  const tNumber = (key, value, options = {}) => {
    const text = t(key, options);
    const formattedNumber = formatNumber(value, currentLanguage);
    return text.replace('{{value}}', formattedNumber);
  };
  
  // 翻译并格式化日期
  const tDate = (key, date, options = {}) => {
    const text = t(key, options);
    const formattedDate = formatDate(date, currentLanguage);
    return text.replace('{{date}}', formattedDate);
  };
  
  // 翻译并格式化日期时间
  const tDateTime = (key, datetime, options = {}) => {
    const text = t(key, options);
    const formattedDateTime = formatDateTime(datetime, currentLanguage);
    return text.replace('{{datetime}}', formattedDateTime);
  };
  
  // 翻译并格式化相对时间
  const tRelative = (key, datetime, options = {}) => {
    const text = t(key, options);
    const relativeTime = formatRelativeTime(datetime, currentLanguage);
    return text.replace('{{relative}}', relativeTime);
  };
  
  // 复数形式翻译
  const tPlural = (key, count, options = {}) => {
    return t(key, { count, ...options });
  };
  
  // 获取翻译键的存在性
  const exists = (key) => {
    return i18n.exists(key, { ns: activeNamespaces });
  };
  
  // 获取嵌套对象的所有翻译
  const getTranslations = (keyPrefix) => {
    const translations = {};
    const segments = keyPrefix.split('.').filter(Boolean);
    const subtree = activeNamespaces
      .map((namespace) => i18n.getResourceBundle(currentLanguage, namespace) || {})
      .map((resourceBundle) => segments.reduce((acc, segment) => (
        acc && typeof acc === 'object' ? acc[segment] : undefined
      ), resourceBundle))
      .find((node) => node !== undefined);

    const collectTranslations = (node, prefix = '') => {
      if (Array.isArray(node) || node == null) {
        return;
      }
      if (typeof node !== 'object') {
        translations[prefix] = t(prefix ? `${keyPrefix}.${prefix}` : keyPrefix);
        return;
      }

      Object.keys(node).forEach((childKey) => {
        const nextPrefix = prefix ? `${prefix}.${childKey}` : childKey;
        collectTranslations(node[childKey], nextPrefix);
      });
    };

    collectTranslations(subtree);

    return translations;
  };
  
  // 获取选项列表的翻译（常用于下拉框等）
  const getOptions = (keyPrefix) => {
    const translations = getTranslations(keyPrefix);
    return Object.entries(translations).map(([value, label]) => ({
      value,
      label
    }));
  };
  
  // 格式化错误消息
  const tError = (errorKey, fallback = 'errors.unknown') => {
    const key = `errors.${errorKey}`;
    const nsForErrors = helperNamespaces('errors');
    return i18n.exists(key, { ns: nsForErrors })
      ? i18n.t(key, { ns: nsForErrors })
      : i18n.t(fallback, { ns: nsForErrors });
  };
  
  // 格式化成功消息
  const tSuccess = (successKey, fallback = 'success.save') => {
    const key = `success.${successKey}`;
    const nsForSuccess = helperNamespaces('success');
    return i18n.exists(key, { ns: nsForSuccess })
      ? i18n.t(key, { ns: nsForSuccess })
      : i18n.t(fallback, { ns: nsForSuccess });
  };
  
  // 格式化验证消息
  const tValidation = (validationKey, options = {}) => {
    const key = `validation.${validationKey}`;
    return i18n.t(key, { ns: helperNamespaces('validation'), ...options });
  };
  
  // 获取单位翻译
  const tUnit = (unit) => {
    return i18n.t(`units.${unit}`, { ns: helperNamespaces('units'), defaultValue: unit });
  };
  
  // 获取状态翻译
  const tStatus = (status, context = 'activities') => {
    return t(`${context}.status.${status}`, { defaultValue: status });
  };
  
  // 获取类型翻译
  const tType = (type, context = 'messages') => {
    return t(`${context}.types.${type}`, { defaultValue: type });
  };
  
  // 获取优先级翻译
  const tPriority = (priority, context = 'messages') => {
    return t(`${context}.priority.${priority}`, { defaultValue: priority });
  };
  
  // 获取分类翻译
  const tCategory = (category, context = 'activities') => {
    return t(`${context}.categories.${category}`, { defaultValue: category });
  };
  
  // 格式化文件大小
  const tFileSize = (bytes) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, i)).toFixed(1);
    return `${size} ${sizes[i]}`;
  };
  
  // 格式化百分比
  const tPercentage = (value, decimals = 1) => {
    const percentage = (value * 100).toFixed(decimals);
    return `${percentage}%`;
  };
  
  // 条件翻译（根据条件返回不同的翻译）
  const tConditional = (condition, trueKey, falseKey, options = {}) => {
    return condition ? t(trueKey, options) : t(falseKey, options);
  };
  
  // 列表翻译（将数组转换为本地化的列表字符串）
  const tList = (items, separator = ', ', lastSeparator = null) => {
    if (!Array.isArray(items) || items.length === 0) return '';
    if (items.length === 1) return items[0];
    
    const finalSeparator = lastSeparator || (currentLanguage === 'zh' ? '和' : ' and ');
    const allButLast = items.slice(0, -1).join(separator);
    const last = items[items.length - 1];
    
    return `${allButLast}${finalSeparator}${last}`;
  };
  
  return {
    // 原始的react-i18next方法
    t,
    i18n,
    ready,
    
    // 扩展的方法
    tNumber,
    tDate,
    tDateTime,
    tRelative,
    tPlural,
    tError,
    tSuccess,
    tValidation,
    tUnit,
    tStatus,
    tType,
    tPriority,
    tCategory,
    tFileSize,
    tPercentage,
    tConditional,
    tList,
    
    // 工具方法
    exists,
    getTranslations,
    getOptions,
    
    // 当前语言信息
    currentLanguage,
    isReady: ready
  };
};

export default useTranslation;
