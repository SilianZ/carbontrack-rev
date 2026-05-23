import Silian_axios from 'axios';
import { toast as Silian_toast } from 'react-hot-toast';

export const DEFAULT_API_BASE_URL = 'https://dev-api.carbontrackapp.com/api/v1';

function Silian_resolveApiBaseUrl() {
  const Silian_configuredBaseUrl = import.meta.env?.VITE_API_URL;
  if (typeof Silian_configuredBaseUrl === 'string' && Silian_configuredBaseUrl.trim()) {
    return Silian_configuredBaseUrl.trim();
  }
  return DEFAULT_API_BASE_URL;
}

// API base URL - 优先环境变量，未配置时回退到开发 API
export const API_BASE_URL = Silian_resolveApiBaseUrl();

function Silian_shouldPreserveAuthOnUnauthorized(Silian_requestUrl = '') {
  return Silian_requestUrl.includes('/files/') && Silian_requestUrl.includes('/presigned-url');
}

// 创建axios实例
const Silian_api = Silian_axios.create({
  baseURL: API_BASE_URL,
  // Extend timeout to 30s to avoid frontend XHR being canceled for long-running admin ops
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加认证token
Silian_api.interceptors.request.use(
  (Silian_config) => {
    const Silian_token = localStorage.getItem('auth_token');
    if (Silian_token) {
      Silian_config.headers.Authorization = `Bearer ${Silian_token}`;
    }

    return Silian_config;
  },
  (Silian_error) => {
    return Promise.reject(Silian_error);
  }
);

// 响应拦截器 - 处理错误和token过期
Silian_api.interceptors.response.use(
  (Silian_response) => {
    return Silian_response;
  },
  (Silian_error) => {
    const Silian_status = Silian_error.response?.status;
    const Silian_requestUrl = Silian_error.config?.url ?? '';

    if (Silian_status === 401) {
      const Silian_isLoginRequest = Silian_requestUrl.includes('/auth/login');
      const Silian_shouldPreserveAuth = Silian_shouldPreserveAuthOnUnauthorized(Silian_requestUrl);
      if (!Silian_isLoginRequest && !Silian_shouldPreserveAuth) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_info');
        if (window.location.pathname !== '/auth/login') {
          window.location.href = '/auth/login';
        }
      }
    }

    try {
      const Silian_rid = Silian_error.response?.data?.request_id || Silian_error.response?.headers['x-request-id'];
      if (Silian_rid) {
        Silian_error.request_id = Silian_rid;
        if (!Silian_error.__rid_notified && (Silian_status !== 401 || Silian_shouldPreserveAuthOnUnauthorized(Silian_requestUrl))) {
          Silian_error.__rid_notified = true;
          Silian_toast.error(`请求失败 (ReqID: ${Silian_rid})，请联系管理员并提供该编号。`);
        }
      }
    } catch { /* noop */ }

    return Promise.reject(Silian_error);
  }
);

// API方法封装
export const authAPI = {
  // 用户注册
  register: (Silian_data) => Silian_api.post('/auth/register', Silian_data),

  // 用户登录
  login: (Silian_data) => Silian_api.post('/auth/login', Silian_data),

  // 用户登出
  logout: () => Silian_api.post('/auth/logout'),

  // 发送验证码
  sendVerificationCode: (Silian_data) => Silian_api.post('/auth/send-verification-code', Silian_data),

  // 重置密码
  resetPassword: (Silian_data) => Silian_api.post('/auth/reset-password', Silian_data),

  // 验证邮箱
  verifyEmail: (Silian_data) => Silian_api.post('/auth/verify-email', Silian_data),
};

export const userAPI = {
  // 获取当前用户信息
  getCurrentUser: () => Silian_api.get('/users/me'),

  // 更新当前用户信息
  updateCurrentUser: (Silian_data) => Silian_api.put('/users/me', Silian_data),

  getNotificationPreferences: () => Silian_api.get('/users/me/notification-preferences'),
  updateNotificationPreferences: (Silian_data) => Silian_api.put('/users/me/notification-preferences', Silian_data),
  sendNotificationTestEmail: (Silian_category) => Silian_api.post('/users/me/notification-preferences/test-email', { category: Silian_category }),
  getSecurityActivity: (Silian_params = {}) => Silian_api.get('/users/me/security-activity', { params: Silian_params }),
};

export const carbonAPI = {
  // 获取碳减排活动列表
  getActivities: (Silian_params = {}) => Silian_api.get('/carbon-activities', { params: Silian_params }),

  // 获取单个活动详情
  getActivity: (Silian_id) => Silian_api.get(`/carbon-activities/${Silian_id}`),

  // 计算碳减排（不创建记录）
  // 允许兼容：
  //   calculate({ activity_id, data })
  //   calculate({ activity_id, amount })
  //   calculate(activity_id, numericValue)
  // 若传入仅为字符串或不规范对象，将尝试包装；无法识别时抛错以便前端更早发现。
  calculate: (Silian_payload, Silian_maybeValue) => {
    let Silian_body = {};
    // 形式1：两个参数 (id, value)
    if (typeof Silian_payload === 'string') {
      if (Silian_maybeValue === undefined || Silian_maybeValue === null || isNaN(parseFloat(Silian_maybeValue))) {
        throw new Error('calculate requires a numeric value when first arg is activity_id');
      }
      Silian_body = { activity_id: Silian_payload, amount: parseFloat(Silian_maybeValue) };
    } else if (Silian_payload && typeof Silian_payload === 'object') {
      // 形式2：对象
      const { activity_id: Silian_activity_id, data: Silian_data, amount: Silian_amount, value: Silian_value } = Silian_payload;
      const Silian_num = Silian_data ?? Silian_amount ?? Silian_value;
      if (!Silian_activity_id || Silian_num === undefined || Silian_num === null || isNaN(parseFloat(Silian_num))) {
        throw new Error('calculate payload must include activity_id and data/amount');
      }
      Silian_body = { activity_id: Silian_activity_id, amount: parseFloat(Silian_num) };
    } else {
      throw new Error('Invalid calculate arguments');
    }
    return Silian_api.post('/carbon-track/calculate', Silian_body);
  },

  // 记录碳减排活动
  recordActivity: (Silian_data) => Silian_api.post('/carbon-track/record', Silian_data),

  // 获取用户的碳减排交易记录
  getTransactions: (Silian_params = {}) => Silian_api.get('/carbon-track/transactions', { params: Silian_params }),

  // 获取单个交易记录
  getTransaction: (Silian_id) => Silian_api.get(`/carbon-track/transactions/${Silian_id}`),

  // 审核交易记录（管理员）
  reviewTransaction: (Silian_id, Silian_data) => Silian_api.put(`/carbon-track/transactions/${Silian_id}`, Silian_data),

  // 获取用户统计信息（需要在后端实现）
  getUserStats: () => Silian_api.get('/users/me/stats'),

  // 获取用户积分历史
  getPointsHistory: (Silian_params = {}) => Silian_api.get('/users/me/points-history', { params: Silian_params }),

  // 获取图表数据
  getChartData: () => Silian_api.get('/users/me/chart-data'),

  // 获取最近活动
  getRecentActivities: (Silian_params = {}) => Silian_api.get('/users/me/activities', { params: Silian_params }),

  // 获取用户打卡日历
  getCheckins: (Silian_params = {}) => Silian_api.get('/users/me/checkins', { params: Silian_params }),

  // 补打卡
  makeupCheckin: (Silian_data) => Silian_api.post('/users/me/checkins/makeup', Silian_data),

  // Smart Activity Suggestion
  suggestActivity: (Silian_query, Silian_meta = {}) => Silian_api.post('/ai/suggest-activity', { query: Silian_query, ...Silian_meta }),
};

export const productAPI = {
  // 获取产品列表
  getProducts: (Silian_params = {}) => Silian_api.get('/products', { params: Silian_params }),
  // 获取产品分类（用于后台过滤）
  getCategories: (Silian_params = {}) => Silian_api.get('/products/categories', { params: Silian_params }),
  // 搜索产品标签
  searchTags: (Silian_params = {}) => Silian_api.get('/products/tags', { params: Silian_params }),

  // 获取单个产品详情
  getProduct: (Silian_id) => Silian_api.get(`/products/${Silian_id}`),

  // 兑换产品
  exchangeProduct: (Silian_data) => Silian_api.post('/exchange', Silian_data),

  // 获取兑换交易记录
  getExchangeTransactions: (Silian_params = {}) => Silian_api.get('/exchange/transactions', { params: Silian_params }),

  // 获取单个兑换交易
  getExchangeTransaction: (Silian_id) => Silian_api.get(`/exchange/transactions/${Silian_id}`),
};

export const messageAPI = {
  // 获取消息列表
  getMessages: (Silian_params = {}) => Silian_api.get('/messages', { params: Silian_params }),

  // 获取单个消息
  getMessage: (Silian_id) => Silian_api.get(`/messages/${Silian_id}`),

  // 发送消息
  sendMessage: (Silian_data) => Silian_api.post('/messages', Silian_data),

  // 标记消息为已读
  markAsRead: (Silian_id) => Silian_api.put(`/messages/${Silian_id}/read`),

  // 删除消息
  deleteMessage: (Silian_id) => Silian_api.delete(`/messages/${Silian_id}`),

  // 获取未读消息数量
  getUnreadCount: () => Silian_api.get('/messages/unread-count'),

  // 批量标记所有消息为已读 (注意：这个接口在 openapi.json 中未定义，可能需要后端实现)
  markAllAsRead: () => Silian_api.put('/messages/mark-all-read'),
};

export const ticketAPI = {
  createTicket: (Silian_data) => Silian_api.post('/tickets', Silian_data),
  getTickets: (Silian_params = {}) => Silian_api.get('/tickets', { params: Silian_params }),
  getTicket: (Silian_ticketId) => Silian_api.get(`/tickets/${Silian_ticketId}`),
  replyTicket: (Silian_ticketId, Silian_data) => Silian_api.post(`/tickets/${Silian_ticketId}/messages`, Silian_data),
  submitFeedback: (Silian_ticketId, Silian_data) => Silian_api.post(`/tickets/${Silian_ticketId}/feedback`, Silian_data),
};

export const supportAPI = {
  getAssignees: () => Silian_api.get('/support/assignees'),
  getTickets: (Silian_params = {}) => Silian_api.get('/support/tickets', { params: Silian_params }),
  getTicket: (Silian_ticketId) => Silian_api.get(`/support/tickets/${Silian_ticketId}`),
  replyTicket: (Silian_ticketId, Silian_data) => Silian_api.post(`/support/tickets/${Silian_ticketId}/messages`, Silian_data),
  updateTicket: (Silian_ticketId, Silian_data) => Silian_api.patch(`/support/tickets/${Silian_ticketId}`, Silian_data),
  createTransferRequest: (Silian_ticketId, Silian_data) => Silian_api.post(`/support/tickets/${Silian_ticketId}/transfer-requests`, Silian_data),
  reviewTransferRequest: (Silian_requestId, Silian_data) => Silian_api.patch(`/support/transfer-requests/${Silian_requestId}`, Silian_data),
};

export const schoolAPI = {
  // 获取学校列表
  getSchools: (Silian_params = {}) => Silian_api.get('/schools', { params: Silian_params }),
  // 创建或获取学校（存在则返回，不存在则创建）
  createOrFetchSchool: (Silian_data) => Silian_api.post('/schools', Silian_data),
};

export const avatarAPI = {
  // 获取头像列表
  getAvatars: (Silian_params = {}) => Silian_api.get('/avatars', { params: Silian_params }),

  // 获取头像分类
  getCategories: () => Silian_api.get('/avatars/categories'),

  // 选择头像
  selectAvatar: (Silian_avatarId) => Silian_api.put('/users/me/avatar', { avatar_id: Silian_avatarId }),
};

export const badgeAPI = {
  // 获取平台成就徽章列表
  list: (Silian_params = {}) => Silian_api.get('/badges', { params: Silian_params }),

  // 获取当前用户的徽章
  myBadges: (Silian_params = {}) => Silian_api.get('/users/me/badges', { params: Silian_params }),

  // 手动触发自动授予流程
  triggerAuto: (Silian_data = {}) => Silian_api.post('/badges/auto-trigger', Silian_data),
};

export const profileAPI = {
  // 更新用户资料
  updateProfile: (Silian_data) => Silian_api.put('/users/me/profile', Silian_data),
};

const Silian_UUID_PATH_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function Silian_buildAdminUserPath(Silian_identifier, Silian_suffix = '') {
  if (typeof Silian_identifier === 'string' && Silian_UUID_PATH_PATTERN.test(Silian_identifier.trim())) {
    return `/admin/users/by-uuid/${Silian_identifier.trim().toLowerCase()}${Silian_suffix}`;
  }
  return `/admin/users/${Silian_identifier}${Silian_suffix}`;
}

export const adminAPI = {
  // 获取用户列表
  getUsers: (Silian_params = {}) => {
    const Silian_query = { ...Silian_params };
    if (typeof Silian_query.search === 'string') {
      const Silian_trimmed = Silian_query.search.trim();
      if (Silian_trimmed) {
        Silian_query.q = Silian_trimmed;
      }
      delete Silian_query.search;
    }
    if (typeof Silian_query.userUuid === 'string') {
      const Silian_trimmed = Silian_query.userUuid.trim();
      if (Silian_trimmed) {
        Silian_query.user_uuid = Silian_trimmed.toLowerCase();
      }
      delete Silian_query.userUuid;
    }
    return Silian_api.get('/admin/users', { params: Silian_query });
  },
  getPasskeys: (Silian_params = {}) => Silian_api.get('/admin/passkeys', { params: Silian_params }),
  getPasskeyStats: () => Silian_api.get('/admin/passkeys/stats'),
  getUserOverview: (Silian_identifier) => Silian_api.get(Silian_buildAdminUserPath(Silian_identifier, '/overview')),
  getUserSecurityActivity: (Silian_identifier, Silian_params = {}) => Silian_api.get(Silian_buildAdminUserPath(Silian_identifier, '/security-activity'), { params: Silian_params }),
  getUserBadges: (Silian_identifier, Silian_params = {}) => Silian_api.get(Silian_buildAdminUserPath(Silian_identifier, '/badges'), { params: Silian_params }),
  updateUser: (Silian_identifier, Silian_data) => Silian_api.put(Silian_buildAdminUserPath(Silian_identifier), Silian_data),
  deleteUser: (Silian_identifier) => Silian_api.delete(Silian_buildAdminUserPath(Silian_identifier)),

  // User Groups
  getUserGroups: () => Silian_api.get('/admin/users/groups'),
  getUserGroupMeta: () => Silian_api.get('/admin/users/groups/meta'),
  createUserGroup: (Silian_data) => Silian_api.post('/admin/users/groups', Silian_data),
  updateUserGroup: (Silian_id, Silian_data) => Silian_api.put(`/admin/users/groups/${Silian_id}`, Silian_data),
  deleteUserGroup: (Silian_id) => Silian_api.delete(`/admin/users/groups/${Silian_id}`),

  // 调整用户积分
  adjustUserPoints: (Silian_identifier, Silian_data) => Silian_api.post(Silian_buildAdminUserPath(Silian_identifier, '/points/adjust'), Silian_data),

  // 获取待审核交易
  getPendingTransactions: (Silian_params = {}) => Silian_api.get('/admin/transactions/pending', { params: Silian_params }),

  // 获取统计信息
  getStats: () => Silian_api.get('/admin/stats'),

  // 获取日志
  getLogs: (Silian_params = {}) => Silian_api.get('/admin/logs', { params: Silian_params }),
  // LLM 使用统计
  getLlmUsage: (Silian_params = {}) => Silian_api.get('/admin/llm-usage', { params: Silian_params }),
  getLlmUsageAnalytics: (Silian_params = {}) => Silian_api.get('/admin/llm-usage/analytics', { params: Silian_params }),
  getLlmLogDetail: (Silian_id) => Silian_api.get(`/admin/llm-usage/logs/${Silian_id}`),

  // AI指挥助手
  getAiWorkspace: () => Silian_api.get('/admin/ai/workspace'),
  chatWithAdminAi: (Silian_data) => Silian_api.post('/admin/ai/chat', Silian_data),
  getAiConversations: (Silian_params = {}) => Silian_api.get('/admin/ai/conversations', { params: Silian_params }),
  getAiConversation: (Silian_conversationId) => Silian_api.get(`/admin/ai/conversations/${Silian_conversationId}`),
  analyzeCommand: (Silian_data) => Silian_api.post('/admin/ai/intents', Silian_data),
  generateAnnouncementDraft: (Silian_data) => Silian_api.post('/admin/ai/announcement-drafts', Silian_data),
  getAiDiagnostics: (Silian_params = {}) => Silian_api.get('/admin/ai/diagnostics', { params: Silian_params }),

  // 碳减排活动管理
  // 兼容旧组件调用名称 getActivities / reviewActivity
  getActivities: (Silian_params = {}) => Silian_api.get('/admin/carbon-activities', { params: Silian_params }),
  getActivitiesForAdmin: (Silian_params = {}) => Silian_api.get('/admin/carbon-activities', { params: Silian_params }),
  // 活动记录（用户提交的碳减排记录，用于审核）多路由别名任选其一
  getActivityRecords: (Silian_params = {}) => Silian_api.get('/admin/activities', { params: Silian_params }),
  createActivity: (Silian_data) => Silian_api.post('/admin/carbon-activities', Silian_data),
  updateActivity: (Silian_id, Silian_data) => Silian_api.put(`/admin/carbon-activities/${Silian_id}`, Silian_data),
  deleteActivity: (Silian_id) => Silian_api.delete(`/admin/carbon-activities/${Silian_id}`),
  restoreActivity: (Silian_id) => Silian_api.post(`/admin/carbon-activities/${Silian_id}/restore`),
  // 后端实际审核路由: /admin/activities/{id}/review
  // 为兼容旧路径, 如需可在后端加 alias; 这里直接指向正确路由
  reviewActivity: (Silian_id, Silian_data) => Silian_api.put(`/admin/activities/${Silian_id}/review`, Silian_data),
  reviewActivitiesBulk: (Silian_data) => Silian_api.put('/admin/activities/review', Silian_data),
  getActivityStatistics: (Silian_id = null) => {
    const Silian_url = Silian_id ? `/admin/carbon-activities/${Silian_id}/statistics` : '/admin/carbon-activities/statistics';
    return Silian_api.get(Silian_url);
  },
  updateSortOrders: (Silian_data) => Silian_api.put('/admin/carbon-activities/sort-orders', Silian_data),

  // 学校管理
  createSchool: (Silian_data) => Silian_api.post('/admin/schools', Silian_data),
  updateSchool: (Silian_id, Silian_data) => Silian_api.put(`/admin/schools/${Silian_id}`, Silian_data),
  deleteSchool: (Silian_id) => Silian_api.delete(`/admin/schools/${Silian_id}`),

  // 产品管理（供后台 ProductManagement 使用）
  getProducts: (Silian_params = {}) => Silian_api.get('/admin/products', { params: Silian_params }),
  searchProductTags: (Silian_params = {}) => Silian_api.get('/admin/products/tags', { params: Silian_params }),
  createProduct: (Silian_data) => Silian_api.post('/admin/products', Silian_data),
  updateProduct: (Silian_id, Silian_data) => Silian_api.put(`/admin/products/${Silian_id}`, Silian_data),
  deleteProduct: (Silian_id) => Silian_api.delete(`/admin/products/${Silian_id}`),

  // 头像管理
  getAvatars: (Silian_params = {}) => Silian_api.get('/admin/avatars', { params: Silian_params }),
  createAvatar: (Silian_data) => Silian_api.post('/admin/avatars', Silian_data),
  updateAvatar: (Silian_id, Silian_data) => Silian_api.put(`/admin/avatars/${Silian_id}`, Silian_data),
  deleteAvatar: (Silian_id) => Silian_api.delete(`/admin/avatars/${Silian_id}`),
  restoreAvatar: (Silian_id) => Silian_api.post(`/admin/avatars/${Silian_id}/restore`),
  setDefaultAvatar: (Silian_id) => Silian_api.put(`/admin/avatars/${Silian_id}/set-default`),
  getAvatarUsageStats: () => Silian_api.get('/admin/avatars/usage-stats'),

  // 交易审核（使用统一的审核接口）
  reviewTransaction: (Silian_id, Silian_data) => Silian_api.put(`/carbon-track/transactions/${Silian_id}`, Silian_data),

  // 获取兑换记录（管理员）
  getExchanges: (Silian_params = {}) => Silian_api.get('/admin/exchanges', { params: Silian_params }),

  // 获取单个兑换记录（管理员）
  getExchange: (Silian_id) => Silian_api.get(`/admin/exchanges/${Silian_id}`),

  // 更新兑换状态（管理员）
  updateExchangeStatus: (Silian_id, Silian_data) => Silian_api.put(`/admin/exchanges/${Silian_id}/status`, Silian_data),

  // 审核兑换记录（管理员）
  reviewExchange: (Silian_id, Silian_data) => Silian_api.put(`/admin/exchanges/${Silian_id}`, Silian_data),

  // 成就徽章管理
  getBadges: (Silian_params = {}) => Silian_api.get('/admin/badges', { params: Silian_params }),
  getBadge: (Silian_id) => Silian_api.get(`/admin/badges/${Silian_id}`),
  createBadge: (Silian_data) => Silian_api.post('/admin/badges', Silian_data),
  updateBadge: (Silian_id, Silian_data) => Silian_api.put(`/admin/badges/${Silian_id}`, Silian_data),
  awardBadge: (Silian_id, Silian_data) => Silian_api.post(`/admin/badges/${Silian_id}/award`, Silian_data),
  revokeBadge: (Silian_id, Silian_data) => Silian_api.post(`/admin/badges/${Silian_id}/revoke`, Silian_data),
  triggerBadgeAuto: (Silian_data = {}) => Silian_api.post('/admin/badges/auto-trigger', Silian_data),
  getBadgeRecipients: (Silian_id, Silian_params = {}) => Silian_api.get(`/admin/badges/${Silian_id}/recipients`, { params: Silian_params }),

  broadcastMessage: (Silian_data) => Silian_api.post('/admin/messages/broadcast', Silian_data),
  getBroadcasts: (Silian_params = {}) => Silian_api.get('/admin/messages/broadcasts', { params: Silian_params }),
  searchBroadcastRecipients: (Silian_params = {}) => Silian_api.get('/admin/messages/broadcast/recipients', { params: Silian_params }),
  flushBroadcastQueue: (Silian_params = {}) => Silian_api.post('/admin/messages/broadcasts/flush', {}, { params: Silian_params }),

  // Support operations
  getSupportAssignees: () => Silian_api.get('/admin/support/assignees'),
  getSupportAssigneeDetail: (Silian_id) => Silian_api.get(`/admin/support/assignees/${Silian_id}`),
  updateSupportAssigneeRoutingProfile: (Silian_id, Silian_data) => Silian_api.put(`/admin/support/assignees/${Silian_id}/routing-profile`, Silian_data),
  getSupportRoutingSettings: () => Silian_api.get('/admin/support/routing-settings'),
  updateSupportRoutingSettings: (Silian_data) => Silian_api.put('/admin/support/routing-settings', Silian_data),
  getSupportTags: () => Silian_api.get('/admin/support/tags'),
  createSupportTag: (Silian_data) => Silian_api.post('/admin/support/tags', Silian_data),
  updateSupportTag: (Silian_id, Silian_data) => Silian_api.put(`/admin/support/tags/${Silian_id}`, Silian_data),
  getSupportRules: () => Silian_api.get('/admin/support/rules'),
  createSupportRule: (Silian_data) => Silian_api.post('/admin/support/rules', Silian_data),
  updateSupportRule: (Silian_id, Silian_data) => Silian_api.put(`/admin/support/rules/${Silian_id}`, Silian_data),
  getSupportTickets: (Silian_params = {}) => Silian_api.get('/admin/support/tickets', { params: Silian_params }),
  getSupportTicketDetail: (Silian_id) => Silian_api.get(`/admin/support/tickets/${Silian_id}`),
  updateSupportTicket: (Silian_id, Silian_data) => Silian_api.patch(`/admin/support/tickets/${Silian_id}`, Silian_data),
  getSupportReports: (Silian_params = {}) => Silian_api.get('/admin/support/reports', { params: Silian_params }),

  // Cron scheduler
  getCronTasks: () => Silian_api.get('/admin/cron/tasks'),
  updateCronTask: (Silian_taskKey, Silian_data) => Silian_api.put(`/admin/cron/tasks/${Silian_taskKey}`, Silian_data),
  getCronRuns: (Silian_params = {}) => Silian_api.get('/admin/cron/runs', { params: Silian_params }),
  runCronTask: (Silian_taskKey) => Silian_api.post(`/admin/cron/tasks/${Silian_taskKey}/run`),

};

// 工具函数
export const setAuthToken = (Silian_token) => {
  if (Silian_token) {
    localStorage.setItem('auth_token', Silian_token);
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
  getPublicSummary: (Silian_params = {}) => Silian_api.get('/stats/summary', { params: Silian_params }),
};

export default Silian_api;

