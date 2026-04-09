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

const bundledCriticalNamespaces = ['home', 'nav'];

const pickBundledCriticalNamespaces = (resources, language) => {
  const resolvedResources = resources?.default ?? resources;

  return bundledCriticalNamespaces.reduce((accumulator, namespace) => {
    if (!(namespace in resolvedResources)) {
      throw new Error(`Missing bundled critical namespace "${namespace}" for language "${language}"`);
    }

    accumulator[namespace] = resolvedResources[namespace];
    return accumulator;
  }, {});
};

const bundledCriticalResourceLoaders = {
  zh: () => import('../locales-generated/zh/index.js').then((resources) => pickBundledCriticalNamespaces(resources, 'zh')),
  en: () => import('../locales-generated/en/index.js').then((resources) => pickBundledCriticalNamespaces(resources, 'en')),
};

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
    cache: 'force-cache'
  }
};

const normalizeSupportedLanguage = (lng) => {
  const shortLng = (lng || '').split('-')[0];
  return Object.prototype.hasOwnProperty.call(supportedLanguages, shortLng)
    ? shortLng
    : null;
};

const getLanguageFromQuerystring = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return normalizeSupportedLanguage(
    new URLSearchParams(window.location.search).get(detectionOptions.lookupQuerystring)
  );
};

const getLanguageFromLocalStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return normalizeSupportedLanguage(
      window.localStorage.getItem(detectionOptions.lookupLocalStorage)
    );
  } catch {
    return null;
  }
};

const getLanguageFromNavigator = () => {
  if (typeof navigator === 'undefined') {
    return null;
  }

  const candidates = [navigator.language, ...(navigator.languages || [])];
  return candidates
    .map((candidate) => normalizeSupportedLanguage(candidate))
    .find(Boolean) || null;
};

const getLanguageFromHtmlTag = () => {
  if (typeof document === 'undefined') {
    return null;
  }

  return normalizeSupportedLanguage(document.documentElement.lang);
};

const detectInitialLanguage = () => (
  getLanguageFromQuerystring()
  || getLanguageFromLocalStorage()
  || getLanguageFromNavigator()
  || getLanguageFromHtmlTag()
  || defaultLanguage
);

const addBundledResourceBundle = (lng, namespace, resourceBundle) => {
  if (!resourceBundle) {
    return;
  }

  if (i18n.hasResourceBundle(lng, namespace)) {
    return;
  }

  i18n.addResourceBundle(lng, namespace, resourceBundle, true, true);
};

const applyBundledResources = (lng, resources) => {
  const normalizedLanguage = normalizeSupportedLanguage(lng);
  if (!normalizedLanguage || !resources) {
    return;
  }

  Object.entries(resources).forEach(([namespace, resourceBundle]) => {
    addBundledResourceBundle(normalizedLanguage, namespace, resourceBundle);
  });
};

const loadBundledLanguageResources = async (lng) => {
  const normalizedLanguage = normalizeSupportedLanguage(lng);
  const loader = normalizedLanguage ? bundledCriticalResourceLoaders[normalizedLanguage] : null;
  if (!loader) {
    return null;
  }

  try {
    return await loader();
  } catch (error) {
    console.error('Failed to preload bundled i18n resources for language', normalizedLanguage, error);
    return null;
  }
};

const loadBundledResourceMap = async (languages) => {
  const normalizedLanguages = Array.from(new Set(
    languages
      .map((language) => normalizeSupportedLanguage(language))
      .filter(Boolean)
  ));

  const bundledEntries = await Promise.all(
    normalizedLanguages.map(async (language) => {
      const resources = await loadBundledLanguageResources(language);
      return [language, resources];
    })
  );

  return bundledEntries.reduce((accumulator, [language, resources]) => {
    if (resources) {
      accumulator[language] = resources;
    }
    return accumulator;
  }, {});
};

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next);

const normalizeDocumentLanguage = (lng) => {
  const shortLng = (lng || defaultLanguage).split('-')[0];
  if (shortLng === 'zh') {
    return 'zh-CN';
  }
  return shortLng || defaultLanguage;
};

const syncDocumentLanguage = (lng) => {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.lang = normalizeDocumentLanguage(lng);
};

i18n.on('languageChanged', syncDocumentLanguage);

let i18nInitializationPromise = null;

export const initializeI18n = async () => {
  if (i18n.isInitialized) {
    syncDocumentLanguage(i18n.resolvedLanguage || i18n.language || defaultLanguage);
    return i18n;
  }

  if (i18nInitializationPromise) {
    return i18nInitializationPromise;
  }

  const initializePromise = (async () => {
    const initialLanguage = detectInitialLanguage();
    const bundledResourceMap = await loadBundledResourceMap([
      initialLanguage,
      initialLanguage === defaultLanguage ? null : defaultLanguage,
    ]);

    await i18n.init({
      lng: initialLanguage,
      resources: bundledResourceMap,

      // 默认优先使用设备语言（由 detectInitialLanguage 预先计算）
      // 未命中支持语言时回退到 defaultLanguage

      // 回退语言
      fallbackLng: defaultLanguage,

      // 支持的语言白名单
      supportedLngs: Object.keys(supportedLanguages),

      // 允许首页只预载当前语言的关键 namespace，其余按需走后端加载
      partialBundledLanguages: true,

      // 统一按语言主标签加载，避免 zh-CN / en-US 额外请求不存在的目录
      load: 'languageOnly',
      nonExplicitSupportedLngs: true,

      // 非生产环境显示调试信息
      debug: import.meta.env.DEV,

      // 命名空间按组件按需加载，避免首页默认拉取非必要文案包
      ns: [],
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

        // 允许 t('home.xxx') 这类键在多 namespace 场景下回退查询
        nsMode: 'fallback',
        
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
        console.warn('Missing translation key', { lng, ns, key });
      } : undefined,
      
      // 解析缺失键
      parseMissingKeyHandler: (key) => {
        return key;
      }
    });

    Object.entries(bundledResourceMap).forEach(([language, resources]) => {
      applyBundledResources(language, resources);
    });
    syncDocumentLanguage(i18n.resolvedLanguage || i18n.language || initialLanguage);
    return i18n;
  })();

  i18nInitializationPromise = initializePromise.catch((error) => {
    i18nInitializationPromise = null;
    throw error;
  });

  return i18nInitializationPromise;
};

// 语言切换函数
export const changeLanguage = async (lng) => {
  const targetLanguage = normalizeSupportedLanguage(lng) || defaultLanguage;
  const bundledResourceMap = await loadBundledResourceMap([
    targetLanguage,
    targetLanguage === defaultLanguage ? null : defaultLanguage,
  ]);

  Object.entries(bundledResourceMap).forEach(([language, resources]) => {
    applyBundledResources(language, resources);
  });

  return i18n.changeLanguage(targetLanguage);
};

// 获取当前语言
export const getCurrentLanguage = () => {
  return normalizeSupportedLanguage(i18n.resolvedLanguage || i18n.language) || defaultLanguage;
};

// 获取当前语言信息
export const getCurrentLanguageInfo = () => {
  const currentLng = getCurrentLanguage();
  return supportedLanguages[currentLng] || supportedLanguages[defaultLanguage];
};

// 检查是否为支持的语言
export const isSupportedLanguage = (lng) => {
  return normalizeSupportedLanguage(lng) !== null;
};

// 获取浏览器首选语言
export const getBrowserLanguage = () => {
  return getLanguageFromNavigator() || defaultLanguage;
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

