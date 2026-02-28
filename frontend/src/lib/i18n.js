import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

// 支持的语言列表
export const supportedLanguages = {
  zh: {
    name: '中文',
    nativeName: '中文',
    flag: '🇨🇳'
  },
  en: {
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸'
  }
};

// 默认语言
export const defaultLanguage = 'zh';

// 语言检测配置
const detectionOptions = {
  // 检测顺序：URL参数 -> localStorage -> 浏览器语言 -> 默认语言
  order: ['querystring', 'localStorage', 'navigator', 'htmlTag'],
  
  // 查找的键名
  lookupQuerystring: 'lng',
  lookupLocalStorage: 'i18nextLng',
  
  // 缓存用户语言选择
  caches: ['localStorage'],
  
  // 排除某些域名的检测
  excludeCacheFor: ['cimode'],
  
  // 检测到的语言如果不在支持列表中，使用默认语言
  checkWhitelist: true
};

// 后端加载配置
const backendOptions = {
  // 语言包文件路径
  loadPath: '/locales/{{lng}}/{{ns}}.json',
  
  // 允许跨域
  crossDomain: false,
  
  // 请求超时时间
  requestOptions: {
    cache: 'default'
  }
};

// i18n 初始化配置
i18n
  // 使用后端加载器
  .use(Backend)
  // 使用语言检测器
  .use(LanguageDetector)
  // 使用 react-i18next
  .use(initReactI18next)
  // 初始化配置
  .init({
    // 默认优先使用设备语言（由 LanguageDetector 按 detection.order 自动检测）
    // 未命中支持语言时回退到 defaultLanguage
    
    // 回退语言
    fallbackLng: defaultLanguage,
    
    // 支持的语言白名单
    supportedLngs: Object.keys(supportedLanguages),
    
    // 非生产环境显示调试信息
    debug: import.meta.env.DEV,
    
    // 命名空间
    ns: ['common'],
    defaultNS: 'common',
    
    // 语言检测配置
    detection: detectionOptions,
    
    // 后端加载配置
    backend: backendOptions,
    
    // 插值配置
    interpolation: {
      // React 已经默认转义了，不需要额外转义
      escapeValue: false,
      
      // 格式化函数
      format: function(value, format, lng) {
        if (format === 'uppercase') return value.toUpperCase();
        if (format === 'lowercase') return value.toLowerCase();
        if (format === 'capitalize') return value.charAt(0).toUpperCase() + value.slice(1);
        
        // 数字格式化
        if (format === 'number') {
          return new Intl.NumberFormat(lng).format(value);
        }
        
        // 日期格式化
        if (format === 'date') {
          return new Intl.DateTimeFormat(lng).format(new Date(value));
        }
        
        if (format === 'datetime') {
          return new Intl.DateTimeFormat(lng, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }).format(new Date(value));
        }
        
        // 相对时间格式化
        if (format === 'relative') {
          const rtf = new Intl.RelativeTimeFormat(lng, { numeric: 'auto' });
          const diff = (new Date(value) - new Date()) / 1000;
          
          if (Math.abs(diff) < 60) return rtf.format(Math.round(diff), 'second');
          if (Math.abs(diff) < 3600) return rtf.format(Math.round(diff / 60), 'minute');
          if (Math.abs(diff) < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
          return rtf.format(Math.round(diff / 86400), 'day');
        }
        
        return value;
      }
    },
    
    // React 配置
    react: {
      // 使用 Suspense 进行异步加载
      useSuspense: true,
      
      // 绑定 i18n 实例到组件
      bindI18n: 'languageChanged',
      
      // 绑定 i18n store 到组件
      bindI18nStore: '',
      
      // 转换缺失的键
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'em', 'span']
    },
    
    // 缺失键处理
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: import.meta.env.DEV ? (lng, ns, key) => {
      console.warn(`Missing translation key: ${ns}:${key} for language: ${lng}`);
    } : undefined,
    
    // 解析缺失键
    parseMissingKeyHandler: (key) => {
      return key;
    }
  });

// 语言切换函数
export const changeLanguage = (lng) => {
  return i18n.changeLanguage(lng);
};

// 获取当前语言
export const getCurrentLanguage = () => {
  return i18n.language || defaultLanguage;
};

// 获取当前语言信息
export const getCurrentLanguageInfo = () => {
  const currentLng = getCurrentLanguage();
  return supportedLanguages[currentLng] || supportedLanguages[defaultLanguage];
};

// 检查是否为支持的语言
export const isSupportedLanguage = (lng) => {
  return Object.keys(supportedLanguages).includes(lng);
};

// 获取浏览器首选语言
export const getBrowserLanguage = () => {
  const browserLng = navigator.language || navigator.languages[0];
  const shortLng = browserLng.split('-')[0];
  return isSupportedLanguage(shortLng) ? shortLng : defaultLanguage;
};

// 格式化数字
export const formatNumber = (value, lng = getCurrentLanguage()) => {
  return new Intl.NumberFormat(lng).format(value);
};

// 格式化日期
export const formatDate = (value, lng = getCurrentLanguage(), options = {}) => {
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };
  return new Intl.DateTimeFormat(lng, { ...defaultOptions, ...options }).format(new Date(value));
};

// 格式化日期时间
export const formatDateTime = (value, lng = getCurrentLanguage()) => {
  return new Intl.DateTimeFormat(lng, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
};

// 格式化相对时间
export const formatRelativeTime = (value, lng = getCurrentLanguage()) => {
  const rtf = new Intl.RelativeTimeFormat(lng, { numeric: 'auto' });
  const diff = (new Date(value) - new Date()) / 1000;
  
  if (Math.abs(diff) < 60) return rtf.format(Math.round(diff), 'second');
  if (Math.abs(diff) < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (Math.abs(diff) < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (Math.abs(diff) < 2592000) return rtf.format(Math.round(diff / 86400), 'day');
  if (Math.abs(diff) < 31536000) return rtf.format(Math.round(diff / 2592000), 'month');
  return rtf.format(Math.round(diff / 31536000), 'year');
};

// 导出 i18n 实例
export default i18n;

