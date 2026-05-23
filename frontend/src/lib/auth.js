const Silian_DEV_AUTH_TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'on']);

let Silian_apiPromise;

const Silian_getApi = async () => {
  if (!Silian_apiPromise) {
    Silian_apiPromise = import('./api').then((Silian_module) => Silian_module.default);
  }

  return Silian_apiPromise;
};

const Silian_isDevTruthy = (Silian_value) => Silian_DEV_AUTH_TRUTHY_VALUES.has(String(Silian_value || '').toLowerCase());

const Silian_decodeBase64Utf8 = (Silian_rawBase64) => {
  const Silian_normalized = String(Silian_rawBase64 || '').trim().replaceAll('-', '+').replaceAll('_', '/');
  const Silian_paddingLength = Silian_normalized.length % 4;
  const Silian_padded = Silian_paddingLength ? Silian_normalized + '='.repeat(4 - Silian_paddingLength) : Silian_normalized;
  const Silian_binary = atob(Silian_padded);
  const Silian_bytes = Uint8Array.from(Silian_binary, (Silian_char) => Silian_char.codePointAt(0) ?? 0);

  if (globalThis.TextDecoder) {
    return new globalThis.TextDecoder('utf-8').decode(Silian_bytes);
  }

  return Silian_binary;
};

const Silian_hasMinimalDevUserInfoFields = (Silian_userInfo) => (
  Silian_userInfo
  && typeof Silian_userInfo === 'object'
  && !Array.isArray(Silian_userInfo)
  && Silian_userInfo.id != null
);

export const hasSupportPortalAccess = (Silian_user) => Boolean(
  Silian_user?.is_admin
  || Silian_user?.is_support
  || Silian_user?.role === 'support'
  || Silian_user?.role === 'admin'
);

const Silian_parseDevUserInfoFromEnv = () => {
  const Silian_rawJson = String(import.meta.env?.VITE_DEV_AUTH_USER_INFO_JSON || '').trim();
  if (Silian_rawJson) {
    try {
      const Silian_parsed = JSON.parse(Silian_rawJson);
      if (Silian_parsed && typeof Silian_parsed === 'object' && !Array.isArray(Silian_parsed)) {
        return Silian_parsed;
      }
    } catch (Silian_error) {
      console.warn('Failed to parse VITE_DEV_AUTH_USER_INFO_JSON:', Silian_error);
    }
  }

  const Silian_rawBase64 = String(import.meta.env?.VITE_DEV_AUTH_USER_INFO_BASE64 || '').trim();
  if (Silian_rawBase64) {
    try {
      const Silian_decodedJson = Silian_decodeBase64Utf8(Silian_rawBase64);
      const Silian_parsed = JSON.parse(Silian_decodedJson);
      if (Silian_parsed && typeof Silian_parsed === 'object' && !Array.isArray(Silian_parsed)) {
        return Silian_parsed;
      }
    } catch (Silian_error) {
      console.warn('Failed to parse VITE_DEV_AUTH_USER_INFO_BASE64:', Silian_error);
    }
  }

  return null;
};

// Token管理
export const tokenManager = {
  getToken() {
    return localStorage.getItem('auth_token');
  },

  setToken(Silian_token) {
    localStorage.setItem('auth_token', Silian_token);
  },

  removeToken() {
    localStorage.removeItem('auth_token');
  },

  isTokenValid() {
    const Silian_token = this.getToken();
    if (!Silian_token) return false;

    try {
      const Silian_payload = JSON.parse(atob(Silian_token.split('.')[1]));
      return Silian_payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }
};

// 用户管理
export const userManager = {
  getUser() {
    const Silian_userStr = localStorage.getItem('user_info');
    return Silian_userStr ? JSON.parse(Silian_userStr) : null;
  },

  setUser(Silian_user) {
    if (!Silian_user) {
      this.removeUser();
      return;
    }

    const Silian_existing = this.getUser();
    const Silian_existingId = Silian_existing?.id;
    const Silian_nextUserId = Silian_user?.id;
    const Silian_isSameUser = Silian_existingId != null && Silian_nextUserId != null && String(Silian_existingId) === String(Silian_nextUserId);

    // UUID should only come from the backend database/identity layer.
    // If the new data contains a UUID, use it.
    // If not, but it is the same user, preserve the existing one.
    // Never generate a fake UUID on the client side.
    const Silian_uuid = Silian_user.uuid || (Silian_isSameUser ? Silian_existing.uuid : null);

    const Silian_mergedUser = Silian_isSameUser ? {
      ...Silian_existing,
      ...Silian_user
    } : {
      ...Silian_user
    };

    if (Silian_uuid && Silian_uuid !== 'null') {
      Silian_mergedUser.uuid = Silian_uuid;
    } else {
      delete Silian_mergedUser.uuid;
    }

    localStorage.setItem('user_info', JSON.stringify(Silian_mergedUser));
  },

  removeUser() {
    localStorage.removeItem('user_info');
  },

  isAdmin() {
    const Silian_user = this.getUser();
    return Silian_user?.is_admin || false;
  },

  isSupport() {
    return hasSupportPortalAccess(this.getUser());
  }
};

export const getDefaultAuthenticatedRoute = (Silian_user = userManager.getUser()) => (
  hasSupportPortalAccess(Silian_user) ? '/support/' : '/dashboard'
);

export const bootstrapDevAuthFromEnv = () => {
  if (!import.meta.env.DEV || !Silian_isDevTruthy(import.meta.env?.VITE_ENABLE_DEV_AUTH_FROM_ENV)) {
    return false;
  }

  if (globalThis.localStorage === undefined) {
    return false;
  }

  const Silian_envToken = String(import.meta.env?.VITE_DEV_AUTH_TOKEN || '').trim();
  const Silian_envUserInfo = Silian_parseDevUserInfoFromEnv();

  if (!Silian_envToken || !Silian_hasMinimalDevUserInfoFields(Silian_envUserInfo)) {
    if (Silian_envToken || Silian_envUserInfo) {
      console.warn(
        '[bootstrapDevAuthFromEnv] Invalid dev auth env payload; requires VITE_DEV_AUTH_TOKEN and user_info with at least "id". Injection skipped.'
      );
    }
    return false;
  }

  const Silian_forceSync = Silian_isDevTruthy(import.meta.env?.VITE_DEV_AUTH_FORCE_SYNC);
  const Silian_existingToken = tokenManager.getToken();
  const Silian_existingUser = userManager.getUser();

  if (!Silian_forceSync && Silian_existingToken && Silian_existingUser) {
    return false;
  }

  tokenManager.setToken(Silian_envToken);
  userManager.setUser(Silian_envUserInfo);

  return true;
};

// 认证API (注意：这些方法也在 api.js 中的 authAPI 对象中定义了，建议统一使用)
export const authAPI = {
  async login(Silian_credentials) {
    const Silian_api = await Silian_getApi();
    const Silian_response = await Silian_api.post('/auth/login', Silian_credentials);

    if (Silian_response.data.success) {
      const { token: Silian_token, user: Silian_user } = Silian_response.data.data;
      tokenManager.setToken(Silian_token);
      userManager.setUser(Silian_user);
    }

    return Silian_response.data;
  },

  async loginWithPasskey(Silian_data) {
    const Silian_api = await Silian_getApi();
    const Silian_response = await Silian_api.post('/auth/passkey/login/verify', Silian_data);

    if (Silian_response.data.success) {
      const { token: Silian_token, user: Silian_user } = Silian_response.data.data;
      tokenManager.setToken(Silian_token);
      userManager.setUser(Silian_user);
    }

    return Silian_response.data;
  },

  async register(Silian_userData) {
    const Silian_api = await Silian_getApi();
    const Silian_response = await Silian_api.post('/auth/register', Silian_userData);

    if (Silian_response.data.success && Silian_response.data.data) {
      const { token: Silian_token, user: Silian_user } = Silian_response.data.data;
      if (Silian_token) {
        tokenManager.setToken(Silian_token);
      }
      if (Silian_user) {
        userManager.setUser(Silian_user);
      }
    }

    return Silian_response.data;
  },

  async logout() {
    try {
      const Silian_api = await Silian_getApi();
      await Silian_api.post('/auth/logout');
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      tokenManager.removeToken();
      userManager.removeUser();
    }
  },

  async getCurrentUser() {
    try {
      const Silian_api = await Silian_getApi();
      const Silian_response = await Silian_api.get('/users/me');
      if (Silian_response.data.success) {
        userManager.setUser(Silian_response.data.data);
        return Silian_response.data.data;
      }
    } catch (error) {
      console.error('Get current user failed:', error);
      this.logout();
    }
    return null;
  },

  async forgotPassword(Silian_payload) {
    const Silian_api = await Silian_getApi();
    const Silian_body = typeof Silian_payload === 'string' ? { email: Silian_payload } : Silian_payload;
    const Silian_response = await Silian_api.post('/auth/forgot-password', Silian_body);
    return Silian_response.data;
  },

  async resetPassword(Silian_token, Silian_password, Silian_confirmPassword) {
    const Silian_api = await Silian_getApi();
    const Silian_response = await Silian_api.post('/auth/reset-password', {
      token: Silian_token,
      password: Silian_password,
      confirm_password: Silian_confirmPassword
    });
    return Silian_response.data;
  },

  async changePassword(Silian_currentPassword, Silian_newPassword, Silian_confirmPassword) {
    const Silian_api = await Silian_getApi();
    const Silian_response = await Silian_api.post('/auth/change-password', {
      current_password: Silian_currentPassword,
      new_password: Silian_newPassword,
      confirm_password: Silian_confirmPassword
    });
    return Silian_response.data;
  },

  async sendVerificationCode(Silian_payload) {
    const Silian_api = await Silian_getApi();
    const Silian_body = typeof Silian_payload === 'string' ? { email: Silian_payload } : Silian_payload;
    const Silian_response = await Silian_api.post('/auth/send-verification-code', Silian_body);
    return Silian_response.data;
  },

  async verifyEmail(Silian_data) {
    const Silian_api = await Silian_getApi();
    const Silian_response = await Silian_api.post('/auth/verify-email', Silian_data);
    if (Silian_response.data?.success && Silian_response.data?.data) {
      const { token: Silian_token, user: Silian_user } = Silian_response.data.data;
      if (Silian_token) {
        tokenManager.setToken(Silian_token);
      }
      if (Silian_user) {
        userManager.setUser(Silian_user);
      }
    }
    return Silian_response.data;
  }
};

// 认证状态检查
export const checkAuthStatus = () => {
  const Silian_token = tokenManager.getToken();
  const Silian_user = userManager.getUser();

  // 需要 token 有效 且 本地有用户信息 才视为已登录
  if (!Silian_token || !tokenManager.isTokenValid()) {
    tokenManager.removeToken();
    userManager.removeUser();
    return { isAuthenticated: false, user: null };
  }
  if (!Silian_user) {
    return { isAuthenticated: false, user: null };
  }

  return { isAuthenticated: true, user: Silian_user };
};

// 登录重定向
export const redirectToLogin = (Silian_returnUrl = null) => {
  const Silian_url = Silian_returnUrl ? `/auth/login?return=${encodeURIComponent(Silian_returnUrl)}` : '/auth/login';
  window.location.href = Silian_url;
};

// 获取返回URL
export const getReturnUrl = () => {
  const Silian_params = new URLSearchParams(window.location.search);
  return Silian_params.get('return') || getDefaultAuthenticatedRoute();
};

// 权限检查
export const hasPermission = (Silian_permission) => {
  const Silian_user = userManager.getUser();
  if (!Silian_user) return false;

  // 管理员拥有所有权限
  if (Silian_user.is_admin) return true;

  // 基础权限检查
  const Silian_permissions = {
    'view_own_data': true,
    'edit_own_profile': true,
    'submit_carbon_record': true,
    'exchange_products': true,
    'view_messages': true
  };

  return Silian_permissions[Silian_permission] || false;
};

export const isSupportUser = () => userManager.isSupport();

// 表单验证规则
export const validationRules = {
  username: {
    required: '用户名不能为空',
    minLength: { value: 3, message: '用户名至少3个字符' },
    maxLength: { value: 20, message: '用户名最多20个字符' },
    pattern: {
      value: /^[a-zA-Z0-9_]+$/,
      message: '用户名只能包含字母、数字和下划线'
    }
  },

  email: {
    required: '邮箱不能为空',
    pattern: {
      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: '请输入有效的邮箱地址'
    }
  },

  password: {
    required: '密码不能为空',
    minLength: { value: 8, message: '密码至少8个字符' }
    // 已移除强制大小写+数字组合要求
  }
};

// 动态获取验证规则（向后兼容旧调用）
export const getValidationRules = () => {
  return {
    ...validationRules,
    // 登录时用户名或邮箱字段
    usernameOrEmail: {
      required: '用户名或邮箱不能为空',
      validate: (Silian_value) => {
        if (!Silian_value) return '用户名或邮箱不能为空';
        const Silian_isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(Silian_value);
        const Silian_isUsername = /^[a-zA-Z0-9_]{3,20}$/.test(Silian_value);
        if (!Silian_isEmail && !Silian_isUsername) return '请输入有效的用户名或邮箱';
        return true;
      }
    }
  };
};

// 错误处理
export const handleAuthError = (Silian_error) => {
  if (Silian_error.response?.status === 401) {
    tokenManager.removeToken();
    userManager.removeUser();
    redirectToLogin(window.location.pathname);
    return;
  }

  const Silian_message = Silian_error.response?.data?.message || Silian_error.message || '操作失败';
  throw new Error(Silian_message);
};

// 自动刷新token
export const setupTokenRefresh = () => {
  const Silian_refreshInterval = 30 * 60 * 1000; // 30分钟

  setInterval(async () => {
    const Silian_token = tokenManager.getToken();
    if (!Silian_token || !tokenManager.isTokenValid()) {
      return;
    }

    try {
      // 检查token是否即将过期（剩余时间少于10分钟）
      const Silian_payload = JSON.parse(atob(Silian_token.split('.')[1]));
      const Silian_remainingTime = Silian_payload.exp * 1000 - Date.now();

      if (Silian_remainingTime < 10 * 60 * 1000) {
        const Silian_user = await authAPI.getCurrentUser();
        if (!Silian_user) {
          authAPI.logout();
        }
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      authAPI.logout();
    }
  }, Silian_refreshInterval);
};

// 初始化认证
export const initAuth = async () => {
  const Silian_api = await Silian_getApi();

  Silian_api.interceptors.request.use((Silian_config) => {
    const Silian_token = tokenManager.getToken();
    if (Silian_token) {
      Silian_config.headers.Authorization = `Bearer ${Silian_token}`;
    }
    return Silian_config;
  });

  Silian_api.interceptors.response.use(
    (Silian_response) => Silian_response,
    (Silian_error) => {
      if (Silian_error.response?.status === 401) {
        authAPI.logout();
        redirectToLogin();
      }
      return Promise.reject(Silian_error);
    }
  );

  setupTokenRefresh();
};

export default {
  tokenManager,
  userManager,
  authAPI,
  checkAuthStatus,
  redirectToLogin,
  getDefaultAuthenticatedRoute,
  getReturnUrl,
  hasPermission,
  isSupportUser,
  validationRules,
  getValidationRules,
  handleAuthError,
  initAuth
};

