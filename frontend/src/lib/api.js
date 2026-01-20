import axios from 'axios';
import { toast } from 'react-hot-toast';

// API base URL - 可以通过环境变量配置
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

// 创建axios实例
const api = axios.create({
  baseURL: API_BASE_URL,
  // Extend timeout to 30s to avoid frontend XHR being canceled for long-running admin ops
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加认证token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理错误和token过期
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url ?? '';

    if (status === 401) {
      const isLoginRequest = requestUrl.includes('/auth/login');
      if (!isLoginRequest) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_info');
        if (window.location.pathname !== '/auth/login') {
          window.location.href = '/auth/login';
        }
      }
    }

    try {
      const rid = error.response?.data?.request_id || error.response?.headers['x-request-id'];
      if (rid) {
        error.request_id = rid;
        if (!error.__rid_notified && status !== 401) {
          error.__rid_notified = true;
          toast.error(`请求失败 (ReqID: ${rid})，请联系管理员并提供该编号。`);
        }
      }
    } catch { /* noop */ }

    return Promise.reject(error);
  }
);

// API方法封装
export const authAPI = {
  // 用户注册
  register: (data) => api.post('/auth/register', data),

  // 用户登录
  login: (data) => api.post('/auth/login', data),

  // 用户登出
  logout: () => api.post('/auth/logout'),

  // 发送验证码
  sendVerificationCode: (data) => api.post('/auth/send-verification-code', data),

  // 重置密码
  resetPassword: (data) => api.post('/auth/reset-password', data),

  // 验证邮箱
  verifyEmail: (data) => api.post('/auth/verify-email', data),
};

export const userAPI = {
  // 获取当前用户信息
  getCurrentUser: () => api.get('/users/me'),

  // 更新当前用户信息
  updateCurrentUser: (data) => api.put('/users/me', data),

  getNotificationPreferences: () => api.get('/users/me/notification-preferences'),
  updateNotificationPreferences: (data) => api.put('/users/me/notification-preferences', data),
  sendNotificationTestEmail: (category) => api.post('/users/me/notification-preferences/test-email', { category }),

  // 获取用户信息
  getUser: (id) => api.get(`/users/${id}`),

  // 更新用户信息
  updateUser: (id, data) => api.put(`/users/${id}`, data),

  // 删除用户
  deleteUser: (id) => api.delete(`/users/${id}`),
};

export const carbonAPI = {
  // 获取碳减排活动列表
  getActivities: (params = {}) => api.get('/carbon-activities', { params }),

  // 获取单个活动详情
  getActivity: (id) => api.get(`/carbon-activities/${id}`),

  // 计算碳减排（不创建记录）
  // 允许兼容：
  //   calculate({ activity_id, data })
  //   calculate({ activity_id, amount })
  //   calculate(activity_id, numericValue)
  // 若传入仅为字符串或不规范对象，将尝试包装；无法识别时抛错以便前端更早发现。
  calculate: (payload, maybeValue) => {
    let body = {};
    // 形式1：两个参数 (id, value)
    if (typeof payload === 'string') {
      if (maybeValue === undefined || maybeValue === null || isNaN(parseFloat(maybeValue))) {
        throw new Error('calculate requires a numeric value when first arg is activity_id');
      }
      body = { activity_id: payload, amount: parseFloat(maybeValue) };
    } else if (payload && typeof payload === 'object') {
      // 形式2：对象
      const { activity_id, data, amount, value } = payload;
      const num = data ?? amount ?? value;
      if (!activity_id || num === undefined || num === null || isNaN(parseFloat(num))) {
        throw new Error('calculate payload must include activity_id and data/amount');
      }
      body = { activity_id, amount: parseFloat(num) };
    } else {
      throw new Error('Invalid calculate arguments');
    }
    return api.post('/carbon-track/calculate', body);
  },

  // 记录碳减排活动
  recordActivity: (data) => api.post('/carbon-track/record', data),

  // 获取用户的碳减排交易记录
  getTransactions: (params = {}) => api.get('/carbon-track/transactions', { params }),

  // 获取单个交易记录
  getTransaction: (id) => api.get(`/carbon-track/transactions/${id}`),

  // 审核交易记录（管理员）
  reviewTransaction: (id, data) => api.put(`/carbon-track/transactions/${id}`, data),

  // 获取用户统计信息（需要在后端实现）
  getUserStats: () => api.get('/users/me/stats'),

  // 获取用户积分历史
  getPointsHistory: (params = {}) => api.get('/users/me/points-history', { params }),

  // 获取图表数据
  getChartData: () => api.get('/users/me/chart-data'),

  // 获取最近活动
  getRecentActivities: (params = {}) => api.get('/users/me/activities', { params }),

  // Smart Activity Suggestion
  suggestActivity: (query, meta = {}) => api.post('/ai/suggest-activity', { query, ...meta }),
};

export const productAPI = {
  // 获取产品列表
  getProducts: (params = {}) => api.get('/products', { params }),
  // 获取产品分类（用于后台过滤）
  getCategories: (params = {}) => api.get('/products/categories', { params }),
  // 搜索产品标签
  searchTags: (params = {}) => api.get('/products/tags', { params }),

  // 获取单个产品详情
  getProduct: (id) => api.get(`/products/${id}`),

  // 兑换产品
  exchangeProduct: (data) => api.post('/exchange', data),

  // 获取兑换交易记录
  getExchangeTransactions: (params = {}) => api.get('/exchange/transactions', { params }),

  // 获取单个兑换交易
  getExchangeTransaction: (id) => api.get(`/exchange/transactions/${id}`),
};

export const messageAPI = {
  // 获取消息列表
  getMessages: (params = {}) => api.get('/messages', { params }),

  // 获取单个消息
  getMessage: (id) => api.get(`/messages/${id}`),

  // 发送消息
  sendMessage: (data) => api.post('/messages', data),

  // 标记消息为已读
  markAsRead: (id) => api.put(`/messages/${id}/read`),

  // 删除消息
  deleteMessage: (id) => api.delete(`/messages/${id}`),

  // 获取未读消息数量
  getUnreadCount: () => api.get('/messages/unread-count'),

  // 批量标记所有消息为已读 (注意：这个接口在 openapi.json 中未定义，可能需要后端实现)
  markAllAsRead: () => api.put('/messages/mark-all-read'),
};

export const schoolAPI = {
  // 获取学校列表
  getSchools: (params = {}) => api.get('/schools', { params }),
  // 创建或获取学校（存在则返回，不存在则创建）
  createOrFetchSchool: (data) => api.post('/schools', data),
};

export const avatarAPI = {
  // 获取头像列表
  getAvatars: (params = {}) => api.get('/avatars', { params }),

  // 获取头像分类
  getCategories: () => api.get('/avatars/categories'),

  // 选择头像
  selectAvatar: (avatarId) => api.put('/users/me/avatar', { avatar_id: avatarId }),
};

export const badgeAPI = {
  // 获取平台成就徽章列表
  list: (params = {}) => api.get('/badges', { params }),

  // 获取当前用户的徽章
  myBadges: (params = {}) => api.get('/users/me/badges', { params }),

  // 手动触发自动授予流程
  triggerAuto: (data = {}) => api.post('/badges/auto-trigger', data),
};

export const profileAPI = {
  // 更新用户资料
  updateProfile: (data) => api.put('/users/me/profile', data),
};

export const adminAPI = {
  // 获取用户列表
  getUsers: (params = {}) => {
    const query = { ...params };
    if (typeof query.search === 'string') {
      const trimmed = query.search.trim();
      if (trimmed) {
        query.q = trimmed;
      }
      delete query.search;
    }
    if (typeof query.role === 'string' && query.is_admin === undefined) {
      if (query.role === 'admin') {
        query.is_admin = 1;
      } else if (query.role === 'user') {
        query.is_admin = 0;
      }
      delete query.role;
    }
    return api.get('/admin/users', { params: query });
  },
  getUserOverview: (id) => api.get(`/admin/users/${id}/overview`),
  getUserBadges: (id, params = {}) => api.get(`/admin/users/${id}/badges`, { params }),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),

  // User Groups
  getUserGroups: () => api.get('/admin/users/groups'),
  createUserGroup: (data) => api.post('/admin/users/groups', data),
  updateUserGroup: (id, data) => api.put(`/admin/users/groups/${id}`, data),
  deleteUserGroup: (id) => api.delete(`/admin/users/groups/${id}`),

  // 调整用户积分
  adjustUserPoints: (id, data) => api.post('/admin/users/' + id + '/points/adjust', data),

  // 获取待审核交易
  getPendingTransactions: (params = {}) => api.get('/admin/transactions/pending', { params }),

  // 获取统计信息
  getStats: () => api.get('/admin/stats'),

  // 获取日志
  getLogs: (params = {}) => api.get('/admin/logs', { params }),
  // LLM 使用统计
  getLlmUsage: (params = {}) => api.get('/admin/llm-usage', { params }),
  getLlmUsageAnalytics: (params = {}) => api.get('/admin/llm-usage/analytics', { params }),
  getLlmLogDetail: (id) => api.get(`/admin/llm-usage/logs/${id}`),

  // AI指挥助手
  analyzeCommand: (data) => api.post('/admin/ai/intents', data),
  getAiDiagnostics: (params = {}) => api.get('/admin/ai/diagnostics', { params }),

  // 碳减排活动管理
  // 兼容旧组件调用名称 getActivities / reviewActivity
  getActivities: (params = {}) => api.get('/admin/carbon-activities', { params }),
  getActivitiesForAdmin: (params = {}) => api.get('/admin/carbon-activities', { params }),
  // 活动记录（用户提交的碳减排记录，用于审核）多路由别名任选其一
  getActivityRecords: (params = {}) => api.get('/admin/activities', { params }),
  createActivity: (data) => api.post('/admin/carbon-activities', data),
  updateActivity: (id, data) => api.put(`/admin/carbon-activities/${id}`, data),
  deleteActivity: (id) => api.delete(`/admin/carbon-activities/${id}`),
  restoreActivity: (id) => api.post(`/admin/carbon-activities/${id}/restore`),
  // 后端实际审核路由: /admin/activities/{id}/review
  // 为兼容旧路径, 如需可在后端加 alias; 这里直接指向正确路由
  reviewActivity: (id, data) => api.put(`/admin/activities/${id}/review`, data),
  reviewActivitiesBulk: (data) => api.put('/admin/activities/review', data),
  getActivityStatistics: (id = null) => {
    const url = id ? `/admin/carbon-activities/${id}/statistics` : '/admin/carbon-activities/statistics';
    return api.get(url);
  },
  updateSortOrders: (data) => api.put('/admin/carbon-activities/sort-orders', data),

  // 学校管理
  createSchool: (data) => api.post('/admin/schools', data),
  updateSchool: (id, data) => api.put(`/admin/schools/${id}`, data),
  deleteSchool: (id) => api.delete(`/admin/schools/${id}`),

  // 产品管理（供后台 ProductManagement 使用）
  getProducts: (params = {}) => api.get('/admin/products', { params }),
  searchProductTags: (params = {}) => api.get('/admin/products/tags', { params }),
  createProduct: (data) => api.post('/admin/products', data),
  updateProduct: (id, data) => api.put(`/admin/products/${id}`, data),
  deleteProduct: (id) => api.delete(`/admin/products/${id}`),

  // 头像管理
  getAvatars: (params = {}) => api.get('/admin/avatars', { params }),
  createAvatar: (data) => api.post('/admin/avatars', data),
  updateAvatar: (id, data) => api.put(`/admin/avatars/${id}`, data),
  deleteAvatar: (id) => api.delete(`/admin/avatars/${id}`),
  restoreAvatar: (id) => api.post(`/admin/avatars/${id}/restore`),
  setDefaultAvatar: (id) => api.put(`/admin/avatars/${id}/set-default`),
  getAvatarUsageStats: () => api.get('/admin/avatars/usage-stats'),

  // 交易审核（使用统一的审核接口）
  reviewTransaction: (id, data) => api.put(`/carbon-track/transactions/${id}`, data),

  // 获取兑换记录（管理员）
  getExchanges: (params = {}) => api.get('/admin/exchanges', { params }),

  // 获取单个兑换记录（管理员）
  getExchange: (id) => api.get(`/admin/exchanges/${id}`),

  // 更新兑换状态（管理员）
  updateExchangeStatus: (id, data) => api.put(`/admin/exchanges/${id}/status`, data),

  // 审核兑换记录（管理员）
  reviewExchange: (id, data) => api.put(`/admin/exchanges/${id}`, data),

  // 成就徽章管理
  getBadges: (params = {}) => api.get('/admin/badges', { params }),
  getBadge: (id) => api.get(`/admin/badges/${id}`),
  createBadge: (data) => api.post('/admin/badges', data),
  updateBadge: (id, data) => api.put(`/admin/badges/${id}`, data),
  awardBadge: (id, data) => api.post(`/admin/badges/${id}/award`, data),
  revokeBadge: (id, data) => api.post(`/admin/badges/${id}/revoke`, data),
  triggerBadgeAuto: (data = {}) => api.post('/admin/badges/auto-trigger', data),
  getBadgeRecipients: (id, params = {}) => api.get(`/admin/badges/${id}/recipients`, { params }),

  broadcastMessage: (data) => api.post('/admin/messages/broadcast', data),
  getBroadcasts: (params = {}) => api.get('/admin/messages/broadcasts', { params }),
  searchBroadcastRecipients: (params = {}) => api.get('/admin/messages/broadcast/recipients', { params }),
  flushBroadcastQueue: (params = {}) => api.post('/admin/messages/broadcasts/flush', {}, { params }),

};

// 工具函数
export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
};

export const getAuthToken = () => {
  return localStorage.getItem('auth_token');
};

export const isAuthenticated = () => {
  return !!getAuthToken();
};

export const statsAPI = {
  getPublicSummary: (params = {}) => api.get('/stats/summary', { params }),
};

export default api;

