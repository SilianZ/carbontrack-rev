import Silian_i18n from 'i18next';
import { initReactI18next as Silian_initReactI18next } from 'react-i18next';
import Silian_LanguageDetector from 'i18next-browser-languagedetector';
import Silian_Backend from 'i18next-http-backend';

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

const Silian_bundledCriticalNamespaces = ['home', 'nav'];

const Silian_pickBundledCriticalNamespaces = (Silian_resources, Silian_language) => {
  const Silian_resolvedResources = Silian_resources?.default ?? Silian_resources;

  return Silian_bundledCriticalNamespaces.reduce((Silian_accumulator, Silian_namespace) => {
    if (!(Silian_namespace in Silian_resolvedResources)) {
      throw new Error(`Missing bundled critical namespace "${Silian_namespace}" for language "${Silian_language}"`);
    }

    Silian_accumulator[Silian_namespace] = Silian_resolvedResources[Silian_namespace];
    return Silian_accumulator;
  }, {});
};

const Silian_bundledCriticalResourceLoaders = {
  zh: () => import('../locales-generated/zh/index.js').then((Silian_resources) => Silian_pickBundledCriticalNamespaces(Silian_resources, 'zh')),
  en: () => import('../locales-generated/en/index.js').then((Silian_resources) => Silian_pickBundledCriticalNamespaces(Silian_resources, 'en')),
};

// 语言检测配置
const Silian_detectionOptions = {
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
const Silian_backendOptions = {
  // 语言包文件路径
  loadPath: '/locales/{{lng}}/{{ns}}.json',

  // 允许跨域
  crossDomain: false,

  // 请求超时时间
  requestOptions: {
    cache: 'force-cache'
  }
};

const Silian_normalizeSupportedLanguage = (Silian_lng) => {
  const Silian_shortLng = (Silian_lng || '').split('-')[0];
  return Object.prototype.hasOwnProperty.call(supportedLanguages, Silian_shortLng)
    ? Silian_shortLng
    : null;
};

const Silian_getLanguageFromQuerystring = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return Silian_normalizeSupportedLanguage(
    new URLSearchParams(window.location.search).get(Silian_detectionOptions.lookupQuerystring)
  );
};

const Silian_getLanguageFromLocalStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return Silian_normalizeSupportedLanguage(
      window.localStorage.getItem(Silian_detectionOptions.lookupLocalStorage)
    );
  } catch {
    return null;
  }
};

const Silian_getLanguageFromNavigator = () => {
  if (typeof navigator === 'undefined') {
    return null;
  }

  const Silian_candidates = [navigator.language, ...(navigator.languages || [])];
  return Silian_candidates
    .map((Silian_candidate) => Silian_normalizeSupportedLanguage(Silian_candidate))
    .find(Boolean) || null;
};

const Silian_getLanguageFromHtmlTag = () => {
  if (typeof document === 'undefined') {
    return null;
  }

  return Silian_normalizeSupportedLanguage(document.documentElement.lang);
};

const Silian_detectInitialLanguage = () => (
  Silian_getLanguageFromQuerystring()
  || Silian_getLanguageFromLocalStorage()
  || Silian_getLanguageFromNavigator()
  || Silian_getLanguageFromHtmlTag()
  || defaultLanguage
);

const Silian_addBundledResourceBundle = (Silian_lng, Silian_namespace, Silian_resourceBundle) => {
  if (!Silian_resourceBundle) {
    return;
  }

  if (Silian_i18n.hasResourceBundle(Silian_lng, Silian_namespace)) {
    return;
  }

  Silian_i18n.addResourceBundle(Silian_lng, Silian_namespace, Silian_resourceBundle, true, true);
};

const Silian_applyBundledResources = (Silian_lng, Silian_resources) => {
  const Silian_normalizedLanguage = Silian_normalizeSupportedLanguage(Silian_lng);
  if (!Silian_normalizedLanguage || !Silian_resources) {
    return;
  }

  Object.entries(Silian_resources).forEach(([Silian_namespace, Silian_resourceBundle]) => {
    Silian_addBundledResourceBundle(Silian_normalizedLanguage, Silian_namespace, Silian_resourceBundle);
  });
};

const Silian_loadBundledLanguageResources = async (Silian_lng) => {
  const Silian_normalizedLanguage = Silian_normalizeSupportedLanguage(Silian_lng);
  const Silian_loader = Silian_normalizedLanguage ? Silian_bundledCriticalResourceLoaders[Silian_normalizedLanguage] : null;
  if (!Silian_loader) {
    return null;
  }

  try {
    return await Silian_loader();
  } catch (Silian_error) {
    console.error('Failed to preload bundled i18n resources for language', Silian_normalizedLanguage, Silian_error);
    return null;
  }
};

const Silian_loadBundledResourceMap = async (Silian_languages) => {
  const Silian_normalizedLanguages = Array.from(new Set(
    Silian_languages
      .map((Silian_language) => Silian_normalizeSupportedLanguage(Silian_language))
      .filter(Boolean)
  ));

  const Silian_bundledEntries = await Promise.all(
    Silian_normalizedLanguages.map(async (Silian_language) => {
      const Silian_resources = await Silian_loadBundledLanguageResources(Silian_language);
      return [Silian_language, Silian_resources];
    })
  );

  return Silian_bundledEntries.reduce((Silian_accumulator, [Silian_language, Silian_resources]) => {
    if (Silian_resources) {
      Silian_accumulator[Silian_language] = Silian_resources;
    }
    return Silian_accumulator;
  }, {});
};

Silian_i18n['use'](Silian_Backend)['use'](Silian_LanguageDetector)['use'](Silian_initReactI18next);

const Silian_normalizeDocumentLanguage = (Silian_lng) => {
  const Silian_shortLng = (Silian_lng || defaultLanguage).split('-')[0];
  if (Silian_shortLng === 'zh') {
    return 'zh-CN';
  }
  return Silian_shortLng || defaultLanguage;
};

const Silian_syncDocumentLanguage = (Silian_lng) => {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.lang = Silian_normalizeDocumentLanguage(Silian_lng);
};

Silian_i18n.on('languageChanged', Silian_syncDocumentLanguage);

let Silian_i18nInitializationPromise = null;

export const initializeI18n = async () => {
  if (Silian_i18n.isInitialized) {
    Silian_syncDocumentLanguage(Silian_i18n.resolvedLanguage || Silian_i18n.language || defaultLanguage);
    return Silian_i18n;
  }

  if (Silian_i18nInitializationPromise) {
    return Silian_i18nInitializationPromise;
  }

  const Silian_initializePromise = (async () => {
    const Silian_initialLanguage = Silian_detectInitialLanguage();
    const Silian_bundledResourceMap = await Silian_loadBundledResourceMap([
      Silian_initialLanguage,
      Silian_initialLanguage === defaultLanguage ? null : defaultLanguage,
    ]);

    await Silian_i18n.init({
      lng: Silian_initialLanguage,
      resources: Silian_bundledResourceMap,

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
      detection: Silian_detectionOptions,

      // 后端加载配置
      backend: Silian_backendOptions,

      // 插值配置
      interpolation: {
        // React 已经默认转义了，不需要额外转义
        escapeValue: false,

        // 格式化函数
        format: function(Silian_value, Silian_format, Silian_lng) {
          if (Silian_format === 'uppercase') return Silian_value.toUpperCase();
          if (Silian_format === 'lowercase') return Silian_value.toLowerCase();
          if (Silian_format === 'capitalize') return Silian_value.charAt(0).toUpperCase() + Silian_value.slice(1);

          // 数字格式化
          if (Silian_format === 'number') {
            return new Intl.NumberFormat(Silian_lng).format(Silian_value);
          }

          // 日期格式化
          if (Silian_format === 'date') {
            return new Intl.DateTimeFormat(Silian_lng).format(new Date(Silian_value));
          }

          if (Silian_format === 'datetime') {
            return new Intl.DateTimeFormat(Silian_lng, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }).format(new Date(Silian_value));
          }

          // 相对时间格式化
          if (Silian_format === 'relative') {
            const Silian_rtf = new Intl.RelativeTimeFormat(Silian_lng, { numeric: 'auto' });
            const Silian_diff = (new Date(Silian_value) - new Date()) / 1000;

            if (Math.abs(Silian_diff) < 60) return Silian_rtf.format(Math.round(Silian_diff), 'second');
            if (Math.abs(Silian_diff) < 3600) return Silian_rtf.format(Math.round(Silian_diff / 60), 'minute');
            if (Math.abs(Silian_diff) < 86400) return Silian_rtf.format(Math.round(Silian_diff / 3600), 'hour');
            return Silian_rtf.format(Math.round(Silian_diff / 86400), 'day');
          }

          return Silian_value;
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
      missingKeyHandler: import.meta.env.DEV ? (Silian_lng, Silian_ns, Silian_key) => {
        console.warn('Missing translation key', { lng: Silian_lng, ns: Silian_ns, key: Silian_key });
      } : undefined,

      // 解析缺失键
      parseMissingKeyHandler: (Silian_key) => {
        return Silian_key;
      }
    });

    Object.entries(Silian_bundledResourceMap).forEach(([Silian_language, Silian_resources]) => {
      Silian_applyBundledResources(Silian_language, Silian_resources);
    });
    Silian_syncDocumentLanguage(Silian_i18n.resolvedLanguage || Silian_i18n.language || Silian_initialLanguage);
    return Silian_i18n;
  })();

  Silian_i18nInitializationPromise = Silian_initializePromise.catch((Silian_error) => {
    Silian_i18nInitializationPromise = null;
    throw Silian_error;
  });

  return Silian_i18nInitializationPromise;
};

// 语言切换函数
export const changeLanguage = async (Silian_lng) => {
  const Silian_targetLanguage = Silian_normalizeSupportedLanguage(Silian_lng) || defaultLanguage;
  const Silian_bundledResourceMap = await Silian_loadBundledResourceMap([
    Silian_targetLanguage,
    Silian_targetLanguage === defaultLanguage ? null : defaultLanguage,
  ]);

  Object.entries(Silian_bundledResourceMap).forEach(([Silian_language, Silian_resources]) => {
    Silian_applyBundledResources(Silian_language, Silian_resources);
  });

  return Silian_i18n.changeLanguage(Silian_targetLanguage);
};

// 获取当前语言
export const getCurrentLanguage = () => {
  return Silian_normalizeSupportedLanguage(Silian_i18n.resolvedLanguage || Silian_i18n.language) || defaultLanguage;
};

// 获取当前语言信息
export const getCurrentLanguageInfo = () => {
  const Silian_currentLng = getCurrentLanguage();
  return supportedLanguages[Silian_currentLng] || supportedLanguages[defaultLanguage];
};

// 检查是否为支持的语言
export const isSupportedLanguage = (Silian_lng) => {
  return Silian_normalizeSupportedLanguage(Silian_lng) !== null;
};

// 获取浏览器首选语言
export const getBrowserLanguage = () => {
  return Silian_getLanguageFromNavigator() || defaultLanguage;
};

// 格式化数字
export const formatNumber = (Silian_value, Silian_lng = getCurrentLanguage()) => {
  return new Intl.NumberFormat(Silian_lng).format(Silian_value);
};

// 格式化日期
export const formatDate = (Silian_value, Silian_lng = getCurrentLanguage(), Silian_options = {}) => {
  const Silian_defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };
  return new Intl.DateTimeFormat(Silian_lng, { ...Silian_defaultOptions, ...Silian_options }).format(new Date(Silian_value));
};

// 格式化日期时间
export const formatDateTime = (Silian_value, Silian_lng = getCurrentLanguage()) => {
  return new Intl.DateTimeFormat(Silian_lng, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(Silian_value));
};

// 格式化相对时间
export const formatRelativeTime = (Silian_value, Silian_lng = getCurrentLanguage()) => {
  const Silian_rtf = new Intl.RelativeTimeFormat(Silian_lng, { numeric: 'auto' });
  const Silian_diff = (new Date(Silian_value) - new Date()) / 1000;

  if (Math.abs(Silian_diff) < 60) return Silian_rtf.format(Math.round(Silian_diff), 'second');
  if (Math.abs(Silian_diff) < 3600) return Silian_rtf.format(Math.round(Silian_diff / 60), 'minute');
  if (Math.abs(Silian_diff) < 86400) return Silian_rtf.format(Math.round(Silian_diff / 3600), 'hour');
  if (Math.abs(Silian_diff) < 2592000) return Silian_rtf.format(Math.round(Silian_diff / 86400), 'day');
  if (Math.abs(Silian_diff) < 31536000) return Silian_rtf.format(Math.round(Silian_diff / 2592000), 'month');
  return Silian_rtf.format(Math.round(Silian_diff / 31536000), 'year');
};

// 导出 i18n 实例
export default Silian_i18n;
