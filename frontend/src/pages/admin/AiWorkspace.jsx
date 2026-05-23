import Silian_React, { useCallback as Silian_useCallback, useEffect as Silian_useEffect, useMemo as Silian_useMemo, useRef as Silian_useRef, useState as Silian_useState } from 'react';
import { useMutation as Silian_useMutation, useQuery as Silian_useQuery, useQueryClient as Silian_useQueryClient } from 'react-query';
import { useNavigate as Silian_useNavigate, useSearchParams as Silian_useSearchParams } from 'react-router-dom';
import { AnimatePresence as Silian_AnimatePresence, motion as Silian_motion } from 'framer-motion';
import {
  Activity as Silian_Activity,
  ArrowUpRight as Silian_ArrowUpRight,
  Bot as Silian_Bot,
  ChevronRight as Silian_ChevronRight,
  Clock3 as Silian_Clock3,
  Command as Silian_Command,
  Cpu as Silian_Cpu,
  ExternalLink as Silian_ExternalLink,
  Filter as Silian_Filter,
  History as Silian_History,
  Loader2 as Silian_Loader2,
  Search as Silian_Search,
  ShieldCheck as Silian_ShieldCheck,
  TerminalSquare as Silian_TerminalSquare,
  MessageSquare as Silian_MessageSquare,
  Plus as Silian_Plus,
  ShieldAlert as Silian_ShieldAlert,
  Sparkles as Silian_Sparkles,
} from 'lucide-react';
import { toast as Silian_toast } from 'sonner';

import { adminAPI as Silian_adminAPI } from '../../lib/api';
import { userManager as Silian_userManager } from '../../lib/auth';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { cn as Silian_cn } from '../../lib/utils';
import { Button as Silian_Button } from '../../components/ui/Button';
import { Badge as Silian_Badge } from '../../components/ui/badge';
import { Textarea as Silian_Textarea } from '../../components/ui/textarea';
import { ScrollArea as Silian_ScrollArea } from '../../components/ui/scroll-area';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription, AlertTitle as Silian_AlertTitle } from '../../components/ui/Alert';

const Silian_COMMAND_MIN_LENGTH = 2;
const Silian_EMPTY_ARRAY = [];
const Silian_EMPTY_OBJECT = {};
const Silian_ROUTE_COPY = {
  dashboard: {
    zh: { label: '管理总览', description: '后台总览、关键指标与快捷处理入口。' },
    en: { label: 'Admin dashboard', description: 'Overview, key metrics, and quick admin tasks.' },
  },
  passkeys: {
    zh: { label: '通行密钥', description: '查看已注册通行密钥、备份状态与最近登录活动。' },
    en: { label: 'Passkeys', description: 'Inspect registered passkeys, backup posture, and recent sign-in activity.' },
  },
  users: {
    zh: { label: '用户管理', description: '管理用户、角色、积分与账号状态。' },
    en: { label: 'User management', description: 'Manage users, roles, points, and account state.' },
  },
  activities: {
    zh: { label: '活动审核', description: '审核碳减排活动提交并处理待审记录。' },
    en: { label: 'Activity review', description: 'Review carbon reduction submissions and pending records.' },
  },
  products: {
    zh: { label: '兑换商品', description: '管理兑换商品、库存与价格。' },
    en: { label: 'Reward store', description: 'Manage redemption products, inventory, and pricing.' },
  },
  badges: {
    zh: { label: '徽章管理', description: '创建、编辑并发放成就徽章。' },
    en: { label: 'Badge management', description: 'Create, edit, and award achievement badges.' },
  },
  avatars: {
    zh: { label: '头像管理', description: '管理头像资源与默认展示。' },
    en: { label: 'Avatar library', description: 'Manage avatar assets and default selections.' },
  },
  exchanges: {
    zh: { label: '积分兑换', description: '审核兑换请求并更新履约状态。' },
    en: { label: 'Exchange orders', description: 'Review redemption requests and update fulfilment status.' },
  },
  broadcast: {
    zh: { label: '公告广播', description: '编写并发送系统公告，支持 HTML 预览与内置 AI 草稿。' },
    en: { label: 'Broadcast center', description: 'Compose and send announcements with HTML previews and built-in AI drafts.' },
  },
  systemLogs: {
    zh: { label: '系统日志', description: '查看审计日志与请求追踪。' },
    en: { label: 'System logs', description: 'Inspect audit logs and request traces.' },
  },
  aiWorkspace: {
    zh: { label: 'AI 工作台', description: '回到 AI 指挥台，继续治理会话与确认动作。' },
    en: { label: 'AI workspace', description: 'Work inside the dedicated admin AI workspace.' },
  },
  supportOps: {
    zh: { label: '客服运营', description: '管理智能分单、客服等级与容量、评分规则、SLA 升级与转单通知。' },
    en: { label: 'Support operations', description: 'Manage smart routing, agent levels and capacity, scoring rules, SLA escalation, and assignment notifications.' },
  },
  supportPortal: {
    zh: { label: '客服工作台', description: '处理工单队列、查看路由摘要，并完成目标客服转单同意。' },
    en: { label: 'Support desk', description: 'Work the live ticket queue, inspect routing summaries, and accept transfer requests as the target assignee.' },
  },
  llmUsage: {
    zh: { label: 'LLM 使用额度', description: '查看模型调用、令牌消耗、会话与提示词审计。' },
    en: { label: 'LLM usage', description: 'Monitor quota usage, token consumption, sessions, and prompt audits.' },
  },
  diagnostics: {
    zh: { label: 'API 诊断', description: '查看 OpenAPI 目录、接口定义与请求响应结构。' },
    en: { label: 'API diagnostics', description: 'Inspect the OpenAPI catalog and request/response definitions.' },
  },
};

const Silian_QUICK_ACTION_COPY = {
  'open-ai-workspace': {
    zh: { label: '打开 AI 工作台', description: '直接回到 AI 指挥台并聚焦输入框。' },
    en: { label: 'Open AI workspace', description: 'Jump straight into the admin AI workspace.' },
  },
  'search-users': {
    zh: { label: '搜索用户', description: '打开用户管理并聚焦搜索框。' },
    en: { label: 'Search users', description: 'Focus the user search box for quick lookup.' },
  },
  'checkin-status': {
    zh: { label: '查看打卡状态', description: '进入用户管理，检查打卡连击和补签额度。' },
    en: { label: 'Check check-in status', description: 'Inspect check-in streaks and makeup quota in user management.' },
  },
  'create-badge': {
    zh: { label: '创建新徽章', description: '跳转到徽章管理并打开新建入口。' },
    en: { label: 'Create new badge', description: 'Open badge management and launch creation mode.' },
  },
  'review-activities': {
    zh: { label: '查看待审核活动', description: '直接进入活动审核页并筛到待审核记录。' },
    en: { label: 'Review pending activities', description: 'Open activity review filtered to pending records.' },
  },
  broadcast: {
    zh: { label: '发送公告', description: '进入公告广播并打开新建草稿。' },
    en: { label: 'Send broadcast', description: 'Open the broadcast composer with drafting tools.' },
  },
};

const Silian_ACTION_DESCRIPTION_COPY = {
  get_admin_stats: {
    zh: '读取后台总览指标与平台整体运行状态。',
    en: 'Read dashboard-level metrics and operating state.',
  },
  get_pending_carbon_records: {
    zh: '读取待审核碳记录，便于复核与排序。',
    en: 'Read pending carbon records for review and prioritization.',
  },
  get_llm_usage_analytics: {
    zh: '读取模型调用、令牌消耗与会话趋势。',
    en: 'Read LLM usage, token consumption, and session trends.',
  },
  get_activity_statistics: {
    zh: '读取活动统计、排名与减排表现。',
    en: 'Read activity statistics, rankings, and reduction performance.',
  },
  generate_admin_report: {
    zh: '生成简洁的后台管理简报，汇总关键指标、待处理事项与 AI 使用情况。',
    en: 'Build a concise admin brief with key metrics, backlog, and AI usage.',
  },
  approve_carbon_records: {
    zh: '按记录 ID 准备批量通过待审核碳记录。',
    en: 'Prepare a bulk approval for pending carbon records by record id.',
  },
  reject_carbon_records: {
    zh: '按记录 ID 准备批量驳回待审核碳记录。',
    en: 'Prepare a bulk rejection for pending carbon records by record id.',
  },
  search_users: {
    zh: '查询用户并返回匹配结果与基础信息。',
    en: 'Search users and return matched accounts with basic details.',
  },
  get_user_overview: {
    zh: '读取单个用户的概览、状态与关键指标。',
    en: 'Read a user overview, status, and key account metrics.',
  },
  adjust_user_points: {
    zh: '准备调整用户积分，执行前需要管理员确认。',
    en: 'Prepare a points adjustment that requires admin confirmation before execution.',
  },
  create_user: {
    zh: '准备创建新用户账号，执行前需要确认。',
    en: 'Prepare a new user creation flow that requires confirmation.',
  },
  update_user_status: {
    zh: '准备变更用户状态，执行前需要确认。',
    en: 'Prepare a user status change that requires confirmation.',
  },
};

const Silian_ACTION_SCOPE_COPY = {
  admin_report: { zh: { label: '管理简报' }, en: { label: 'Admin report' } },
  pending_carbon_records: { zh: { label: '待审核碳记录' }, en: { label: 'Pending carbon records' } },
  llm_usage_analytics: { zh: { label: 'AI 用量' }, en: { label: 'LLM usage analytics' } },
  admin_stats: { zh: { label: '后台总览' }, en: { label: 'Admin stats' } },
};

const Silian_ROUTE_KEY_BY_PATH = {
  '/admin/dashboard': 'dashboard',
  '/admin/passkeys': 'passkeys',
  '/admin/users': 'users',
  '/admin/activities': 'activities',
  '/admin/products': 'products',
  '/admin/badges': 'badges',
  '/admin/avatars': 'avatars',
  '/admin/exchanges': 'exchanges',
  '/admin/broadcast': 'broadcast',
  '/admin/support': 'supportOps',
  '/support/': 'supportPortal',
  '/admin/system-logs': 'systemLogs',
  '/admin/ai': 'aiWorkspace',
  '/admin/llm-usage': 'llmUsage',
  '/admin/diagnostics': 'diagnostics',
};

const Silian_MotionDiv = Silian_motion.div;

function Silian_buildRouteWithQuery(Silian_route, Silian_query = {}) {
  if (!Silian_route) return null;

  const Silian_entries = Object.entries(Silian_query || {}).filter(([, Silian_value]) => Silian_value !== undefined && Silian_value !== null && Silian_value !== '');
  if (Silian_entries.length === 0) return Silian_route;

  const Silian_params = new URLSearchParams();
  for (const [Silian_key, Silian_value] of Silian_entries) {
    Silian_params.set(Silian_key, String(Silian_value));
  }

  return `${Silian_route}?${Silian_params.toString()}`;
}

function Silian_hasRenderableMessages(Silian_conversation) {
  return Array.isArray(Silian_conversation?.messages) && Silian_conversation.messages.some((Silian_item) => Silian_item?.kind === 'message');
}

function Silian_buildFallbackConversation(Silian_conversation, Silian_conversationId, Silian_previousConversation, Silian_userMessage, Silian_assistantMessage) {
  if (Silian_hasRenderableMessages(Silian_conversation)) {
    return Silian_conversation;
  }

  const Silian_previousMessages = Array.isArray(Silian_previousConversation?.messages)
    ? Silian_previousConversation.messages.filter((Silian_item) => Silian_item?.kind === 'message')
    : [];
  const Silian_nextMessages = [...Silian_previousMessages];

  if (Silian_userMessage) {
    Silian_nextMessages.push({
      id: `local-user-${Silian_conversationId || 'new'}-${Silian_nextMessages.length}`,
      kind: 'message',
      role: 'user',
      content: Silian_userMessage,
      created_at: new Date().toISOString(),
      meta: { data: { source: 'client_fallback' } },
    });
  }

  if (Silian_assistantMessage) {
    Silian_nextMessages.push({
      id: `local-assistant-${Silian_conversationId || 'new'}-${Silian_nextMessages.length}`,
      kind: 'message',
      role: 'assistant',
      content: Silian_assistantMessage,
      created_at: new Date().toISOString(),
      meta: { data: { source: 'client_fallback' } },
    });
  }

  if (Silian_nextMessages.length === 0) {
    return Silian_conversation;
  }

  return {
    ...(Silian_previousConversation || {}),
    ...(Silian_conversation || {}),
    conversation_id: Silian_conversation?.conversation_id || Silian_conversationId || Silian_previousConversation?.conversation_id || null,
    messages: Silian_nextMessages,
    summary: {
      ...(Silian_previousConversation?.summary || {}),
      ...(Silian_conversation?.summary || {}),
      message_count: Silian_nextMessages.length,
      last_activity_at: new Date().toISOString(),
    },
  };
}

function Silian_formatAbsoluteTime(Silian_value, Silian_locale = 'zh-CN') {
  if (!Silian_value) return '--';

  try {
    return new Intl.DateTimeFormat(Silian_locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(Silian_value));
  } catch {
    return String(Silian_value);
  }
}

function Silian_formatRelativeTime(Silian_value, Silian_locale = 'zh-CN', Silian_isZh = true) {
  if (!Silian_value) return Silian_isZh ? '刚刚' : 'just now';

  const Silian_time = new Date(Silian_value).getTime();
  if (Number.isNaN(Silian_time)) {
    return Silian_formatAbsoluteTime(Silian_value, Silian_locale);
  }

  const Silian_diffSeconds = Math.round((Silian_time - Date.now()) / 1000);
  const Silian_absSeconds = Math.abs(Silian_diffSeconds);
  const Silian_rtf = new Intl.RelativeTimeFormat(Silian_locale, { numeric: 'auto' });

  if (Silian_absSeconds < 60) return Silian_rtf.format(Silian_diffSeconds, 'second');
  if (Silian_absSeconds < 3600) return Silian_rtf.format(Math.round(Silian_diffSeconds / 60), 'minute');
  if (Silian_absSeconds < 86400) return Silian_rtf.format(Math.round(Silian_diffSeconds / 3600), 'hour');
  if (Silian_absSeconds < 2592000) return Silian_rtf.format(Math.round(Silian_diffSeconds / 86400), 'day');
  return Silian_rtf.format(Math.round(Silian_diffSeconds / 2592000), 'month');
}

function Silian_formatCompactNumber(Silian_value) {
  const Silian_numeric = Number(Silian_value || 0);
  if (!Number.isFinite(Silian_numeric)) return '--';
  if (Silian_numeric >= 1000000) return `${(Silian_numeric / 1000000).toFixed(1)}M`;
  if (Silian_numeric >= 1000) return `${(Silian_numeric / 1000).toFixed(1)}k`;
  return String(Math.round(Silian_numeric));
}

function Silian_formatLatency(Silian_value, Silian_isZh) {
  const Silian_numeric = Number(Silian_value || 0);
  if (!Number.isFinite(Silian_numeric) || Silian_numeric <= 0) {
    return Silian_isZh ? '未记录' : 'Not recorded';
  }

  if (Silian_numeric >= 1000) {
    return `${(Silian_numeric / 1000).toFixed(2)}s`;
  }

  return `${Math.round(Silian_numeric)}ms`;
}

function Silian_stringifyValue(Silian_value) {
  if (Silian_value == null) return '';
  if (typeof Silian_value === 'string') return Silian_value;

  try {
    return JSON.stringify(Silian_value, null, 2);
  } catch {
    return String(Silian_value);
  }
}

function Silian_prettifyActionName(Silian_value) {
  if (!Silian_value || typeof Silian_value !== 'string') return null;
  return Silian_value
    .replace(/^admin_ai_/, '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (Silian_char) => Silian_char.toUpperCase());
}

function Silian_pickLocalizedCopy(Silian_entry, Silian_isZh, Silian_field) {
  if (!Silian_entry) return null;
  return Silian_isZh ? Silian_entry?.zh?.[Silian_field] : Silian_entry?.en?.[Silian_field];
}

function Silian_getLocalizedActionLabel(Silian_action, Silian_isZh) {
  const Silian_name = Silian_action?.name || Silian_action?.action_name;
  const Silian_label = Silian_action?.label;
  if (!Silian_isZh) return Silian_label || Silian_prettifyActionName(Silian_name) || 'Admin action';

  const Silian_map = {
    get_admin_stats: '查看后台总览',
    get_pending_carbon_records: '查看待审核碳记录',
    get_llm_usage_analytics: '查看 AI 用量',
    get_activity_statistics: '查看活动统计',
    generate_admin_report: '生成管理简报',
    approve_carbon_records: '准备批量通过碳记录',
    reject_carbon_records: '准备批量驳回碳记录',
    search_users: '搜索用户',
    get_user_overview: '查看用户概览',
    adjust_user_points: '准备调整用户积分',
    create_user: '准备创建用户',
    update_user_status: '准备变更用户状态',
    award_badge_to_user: '准备发放徽章',
    revoke_badge_from_user: '准备撤销徽章',
    update_exchange_status: '准备更新兑换单状态',
    update_product_status: '准备更新商品状态',
    adjust_product_inventory: '准备调整商品库存',
  };

  return Silian_map[Silian_name] || Silian_label || Silian_prettifyActionName(Silian_name) || '后台动作';
}

function Silian_getLocalizedActionDescription(Silian_action, Silian_isZh) {
  const Silian_name = Silian_action?.name || Silian_action?.action_name;
  const Silian_localized = Silian_isZh ? Silian_ACTION_DESCRIPTION_COPY[Silian_name]?.zh : Silian_ACTION_DESCRIPTION_COPY[Silian_name]?.en;
  return Silian_localized || Silian_action?.description || (Silian_isZh ? '暂无说明。' : 'No description.');
}

function Silian_getLocalizedQuickActionCopy(Silian_action, Silian_isZh) {
  const Silian_localized = Silian_QUICK_ACTION_COPY[Silian_action?.id] || Silian_ROUTE_COPY[Silian_action?.routeId];
  return {
    label: Silian_pickLocalizedCopy(Silian_localized, Silian_isZh, 'label') || Silian_action?.label || (Silian_isZh ? '快捷入口' : 'Shortcut'),
    description: Silian_pickLocalizedCopy(Silian_localized, Silian_isZh, 'description') || Silian_action?.description || (Silian_isZh ? '直接跳转到对应后台页面。' : 'Jump to the related admin page.'),
  };
}

function Silian_getLocalizedNavigationCopy(Silian_target, Silian_isZh) {
  const Silian_localized = Silian_ROUTE_COPY[Silian_target?.id];
  return {
    label: Silian_pickLocalizedCopy(Silian_localized, Silian_isZh, 'label') || Silian_target?.label || (Silian_isZh ? '后台页面' : 'Admin page'),
    description: Silian_pickLocalizedCopy(Silian_localized, Silian_isZh, 'description') || Silian_target?.description || (Silian_isZh ? '打开对应后台模块。' : 'Open the related admin module.'),
  };
}

function Silian_getLocalizedRouteLabel(Silian_route, Silian_isZh, Silian_fallbackLabel = null) {
  const Silian_routeKey = Silian_ROUTE_KEY_BY_PATH[Silian_route];
  const Silian_localized = Silian_routeKey ? Silian_ROUTE_COPY[Silian_routeKey] : null;
  return Silian_pickLocalizedCopy(Silian_localized, Silian_isZh, 'label') || Silian_fallbackLabel || (Silian_isZh ? '打开建议页面' : 'Open suggestion');
}

function Silian_getLocalizedScopeLabel(Silian_scope, Silian_isZh) {
  return Silian_pickLocalizedCopy(Silian_ACTION_SCOPE_COPY[Silian_scope], Silian_isZh, 'label') || Silian_scope || (Silian_isZh ? '结果' : 'Result');
}

function Silian_getLocalizedConfirmationPolicy(Silian_policy, Silian_isZh) {
  if (Silian_policy === 'write_requires_confirmation') {
    return Silian_isZh ? '写入前需确认' : 'Write requires confirmation';
  }
  return Silian_policy || (Silian_isZh ? '依据系统策略' : 'Policy driven');
}

function Silian_getLocalizedCallStatus(Silian_status, Silian_isZh) {
  switch (Silian_status) {
    case 'success':
      return Silian_isZh ? '成功' : 'Success';
    case 'failed':
      return Silian_isZh ? '失败' : 'Failed';
    case 'running':
      return Silian_isZh ? '执行中' : 'Running';
    default:
      return Silian_isZh ? '未知' : 'Unknown';
  }
}

function Silian_getLocalizedEventKind(Silian_kind, Silian_isZh) {
  switch (Silian_kind) {
    case 'tool':
      return Silian_isZh ? '工具' : 'Tool';
    case 'action_proposed':
      return Silian_isZh ? '提案' : 'Proposal';
    case 'action_event':
      return Silian_isZh ? '事件' : 'Event';
    case 'message':
      return Silian_isZh ? '消息' : 'Message';
    default:
      return Silian_isZh ? '事件' : 'Event';
  }
}

function Silian_summarizeObject(Silian_value, Silian_isZh) {
  if (!Silian_value || typeof Silian_value !== 'object') {
    return Silian_isZh ? '没有附带结构化数据。' : 'No structured data attached.';
  }

  const Silian_entries = Object.entries(Silian_value)
    .filter(([, Silian_item]) => Silian_item !== null && Silian_item !== '' && Silian_item !== false)
    .slice(0, 4)
    .map(([Silian_key, Silian_item]) => {
      if (Array.isArray(Silian_item)) {
        return `${Silian_key}: ${Silian_item.slice(0, 3).join(', ')}${Silian_item.length > 3 ? '…' : ''}`;
      }
      if (typeof Silian_item === 'object') {
        return `${Silian_key}: ${Object.keys(Silian_item).slice(0, 3).join(', ') || '{}'}`;
      }
      return `${Silian_key}: ${String(Silian_item)}`;
    });

  if (Silian_entries.length === 0) {
    return Silian_isZh ? '没有附带结构化数据。' : 'No structured data attached.';
  }

  return Silian_entries.join(' | ');
}

function Silian_buildEventCopy(Silian_item, Silian_isZh) {
  const Silian_metaData = Silian_item?.meta?.data || {};
  const Silian_actionName = Silian_metaData.action_name || Silian_metaData.tool_name || Silian_item?.proposal?.action_name || Silian_item?.action || null;
  const Silian_actionLabel = Silian_getLocalizedActionLabel({
    name: Silian_actionName,
    label: Silian_metaData.label || Silian_item?.proposal?.label,
  }, Silian_isZh);
  const Silian_status = Silian_item?.status || '';

  if (Silian_item?.kind === 'tool') {
    return {
      title: Silian_isZh ? `调用工具：${Silian_actionLabel}` : `Tool call: ${Silian_actionLabel}`,
      description: Silian_metaData.summary || Silian_summarizeObject(Silian_metaData.request_payload || Silian_metaData.payload || Silian_metaData, Silian_isZh),
      tone: 'tool',
    };
  }

  if (Silian_item?.kind === 'action_proposed') {
    return {
      title: Silian_isZh ? `待确认：${Silian_actionLabel}` : `Pending: ${Silian_actionLabel}`,
      description: Silian_item?.proposal?.summary || Silian_metaData.summary || Silian_summarizeObject(Silian_item?.proposal?.payload || Silian_metaData.payload || Silian_metaData, Silian_isZh),
      tone: 'proposal',
    };
  }

  if (Silian_item?.kind === 'action_event') {
    if (Silian_status === 'failed') {
      return {
        title: Silian_isZh ? `执行失败：${Silian_actionLabel}` : `Failed: ${Silian_actionLabel}`,
        description: Silian_summarizeObject(Silian_metaData.new_data || Silian_metaData.result || Silian_metaData.request_payload || Silian_metaData.payload || Silian_metaData, Silian_isZh),
        tone: 'failed',
      };
    }

    if ((Silian_item?.action || '').endsWith('_rejected')) {
      return {
        title: Silian_isZh ? `已驳回：${Silian_actionLabel}` : `Rejected: ${Silian_actionLabel}`,
        description: Silian_summarizeObject(Silian_metaData.request_payload || Silian_metaData.payload || Silian_metaData, Silian_isZh),
        tone: 'muted',
      };
    }

    if ((Silian_item?.action || '').endsWith('_confirmed')) {
      return {
        title: Silian_isZh ? `已确认：${Silian_actionLabel}` : `Confirmed: ${Silian_actionLabel}`,
        description: Silian_summarizeObject(Silian_metaData.request_payload || Silian_metaData.payload || Silian_metaData, Silian_isZh),
        tone: 'success',
      };
    }

    if ((Silian_item?.action || '').endsWith('_executed')) {
      return {
        title: Silian_isZh ? `已执行：${Silian_actionLabel}` : `Executed: ${Silian_actionLabel}`,
        description: Silian_summarizeObject(Silian_metaData.new_data || Silian_metaData.result || Silian_metaData, Silian_isZh),
        tone: 'success',
      };
    }
  }

  return {
    title: Silian_actionLabel,
    description: Silian_item?.content || Silian_summarizeObject(Silian_metaData, Silian_isZh),
    tone: 'muted',
  };
}

function Silian_getConversationStatusLabel(Silian_status, Silian_isZh) {
  switch (Silian_status) {
    case 'waiting_confirmation':
      return Silian_isZh ? '待确认' : 'Awaiting confirmation';
    case 'completed':
      return Silian_isZh ? '已完成' : 'Completed';
    case 'active':
      return Silian_isZh ? '进行中' : 'Active';
    default:
      return Silian_isZh ? '会话' : 'Session';
  }
}

const Silian_PANEL_SHELL_CLASS = 'overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/88 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03] dark:shadow-[0_24px_70px_rgba(0,0,0,0.28)]';
const Silian_PANEL_DIVIDER_CLASS = 'border-slate-200/70 dark:border-white/8';
const Silian_SURFACE_MUTED_CLASS = 'rounded-[22px] border border-slate-200/80 bg-slate-50/90 dark:border-white/10 dark:bg-black/20';
const Silian_SURFACE_SOFT_CLASS = 'rounded-[22px] border border-slate-200/80 bg-white/78 dark:border-white/8 dark:bg-white/[0.02]';
const Silian_TEXT_PRIMARY_CLASS = 'text-slate-950 dark:text-white';
const Silian_TEXT_SECONDARY_CLASS = 'text-slate-600 dark:text-slate-400';
const Silian_TEXT_TERTIARY_CLASS = 'text-slate-500 dark:text-slate-500';
const Silian_OUTLINE_BUTTON_CLASS = 'rounded-full border border-slate-300/80 bg-white/70 text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:bg-white/8';
const Silian_INPUT_SHELL_CLASS = 'border border-slate-200/80 bg-white/75 text-slate-900 outline-none placeholder:text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500';
const Silian_PAGE_SCROLLBAR_CLASS = '[&_[data-slot=scroll-area-scrollbar]]:p-0.5 [&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:w-3 [&_[data-slot=scroll-area-scrollbar][data-orientation=horizontal]]:h-3 [&_[data-slot=scroll-area-thumb]]:rounded-full [&_[data-slot=scroll-area-thumb]]:bg-slate-300/75 dark:[&_[data-slot=scroll-area-thumb]]:bg-white/16 hover:[&_[data-slot=scroll-area-thumb]]:bg-slate-400/90 dark:hover:[&_[data-slot=scroll-area-thumb]]:bg-white/24';
const Silian_INLINE_SCROLLBAR_CLASS = '[scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.75)_transparent] dark:[scrollbar-color:rgba(255,255,255,0.16)_transparent] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/80 dark:[&::-webkit-scrollbar-thumb]:bg-white/16 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/90 dark:hover:[&::-webkit-scrollbar-thumb]:bg-white/24';

function Silian_Panel({
  title: Silian_title,
  description: Silian_description,
  action: Silian_action,
  className: Silian_className,
  bodyClassName: Silian_bodyClassName,
  headerClassName: Silian_headerClassName,
  titleClassName: Silian_titleClassName,
  stackAction: Silian_stackAction = false,
  children: Silian_children,
}) {
  return (
    <div className={Silian_cn(
      Silian_PANEL_SHELL_CLASS,
      Silian_className
    )}>
      {(Silian_title || Silian_description || Silian_action) ? (
        <div className={Silian_cn(
          `px-5 py-4 ${Silian_PANEL_DIVIDER_CLASS}`,
          Silian_stackAction ? 'space-y-3' : 'flex flex-col gap-3',
          Silian_headerClassName
        )}>
          <div className="min-w-0 flex-1">
            {Silian_title ? <div className={Silian_cn(`break-words text-sm font-semibold ${Silian_TEXT_PRIMARY_CLASS}`, Silian_titleClassName)}>{Silian_title}</div> : null}
            {Silian_description ? <div className={Silian_cn(`mt-1 break-words text-xs leading-5 ${Silian_TEXT_SECONDARY_CLASS}`)}>{Silian_description}</div> : null}
          </div>
          {Silian_action ? (
            <div className={Silian_cn('min-w-0', Silian_stackAction ? 'w-full' : 'flex flex-wrap items-center gap-2')}>
              {Silian_action}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={Silian_cn('p-5', Silian_bodyClassName)}>{Silian_children}</div>
    </div>
  );
}

function Silian_StatusChip({ tone: Silian_tone = 'neutral', children: Silian_children }) {
  return (
    <span
      className={Silian_cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium',
        Silian_tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200',
        Silian_tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100',
        Silian_tone === 'neutral' && 'border-slate-200 bg-white/85 text-slate-700 dark:border-white/12 dark:bg-white/[0.05] dark:text-slate-200'
      )}
    >
      {Silian_children}
    </span>
  );
}

function Silian_MetricTile({ label: Silian_label, value: Silian_value, hint: Silian_hint }) {
  return (
    <div className={Silian_cn(Silian_SURFACE_MUTED_CLASS, 'px-4 py-4')}>
      <div className={Silian_cn(`text-[11px] uppercase tracking-[0.22em] ${Silian_TEXT_TERTIARY_CLASS}`)}>{Silian_label}</div>
      <div className={Silian_cn(`mt-3 text-2xl font-semibold ${Silian_TEXT_PRIMARY_CLASS}`)}>{Silian_value}</div>
      {Silian_hint ? <div className={Silian_cn(`mt-2 break-words text-xs leading-5 ${Silian_TEXT_SECONDARY_CLASS}`)}>{Silian_hint}</div> : null}
    </div>
  );
}

function Silian_ConversationRow({ item: Silian_item, active: Silian_active, locale: Silian_locale, isZh: Silian_isZh, onSelect: Silian_onSelect }) {
  const Silian_status = Silian_item?.status;
  const Silian_pendingCount = Number(Silian_item?.pending_action_count || 0);
  const Silian_messageCount = Number(Silian_item?.message_count || 0);
  const Silian_llmCalls = Number(Silian_item?.llm_calls || 0);

  return (
    <button
      type="button"
      onClick={() => Silian_onSelect(Silian_item.conversation_id)}
      className={Silian_cn(
        'w-full rounded-[22px] border px-4 py-4 text-left transition-all',
        Silian_active
          ? 'border-emerald-300 bg-emerald-50/90 shadow-[0_18px_45px_rgba(16,185,129,0.12)] dark:border-emerald-400/35 dark:bg-emerald-400/[0.12] dark:shadow-[0_18px_45px_rgba(16,185,129,0.14)]'
          : 'border-slate-200/80 bg-white/78 hover:border-slate-300 hover:bg-white dark:border-white/8 dark:bg-white/[0.02] dark:hover:border-white/15 dark:hover:bg-white/[0.04]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={Silian_cn(`line-clamp-2 break-words pr-2 text-sm font-semibold ${Silian_TEXT_PRIMARY_CLASS}`)}>
            {Silian_item.title || (Silian_isZh ? '未命名会话' : 'Untitled session')}
          </div>
          <div className={Silian_cn(`mt-1 line-clamp-2 break-all text-xs leading-5 ${Silian_TEXT_SECONDARY_CLASS}`)}>
            {Silian_item.last_message_preview || (Silian_isZh ? '尚无摘要。' : 'No summary yet.')}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-700 dark:border-white/10 dark:bg-black/20 dark:text-slate-300">
            {Silian_pendingCount > 0
              ? `${Silian_pendingCount} ${Silian_isZh ? '待确认' : 'pending'}`
              : `${Silian_messageCount} ${Silian_isZh ? '条' : 'msgs'}`}
          </span>
          <span className={Silian_cn(`text-[10px] uppercase tracking-[0.2em] ${Silian_TEXT_TERTIARY_CLASS}`)}>
            {Silian_getConversationStatusLabel(Silian_status, Silian_isZh)}
          </span>
        </div>
      </div>
      <div className={Silian_cn(`mt-3 flex items-center justify-between gap-3 text-[11px] ${Silian_TEXT_TERTIARY_CLASS}`)}>
        <span className="inline-flex items-center gap-1.5">
          <Silian_Clock3 className="h-3 w-3" />
          {Silian_formatRelativeTime(Silian_item.last_activity_at, Silian_locale, Silian_isZh)}
        </span>
        <span>{Silian_formatAbsoluteTime(Silian_item.last_activity_at, Silian_locale)}</span>
      </div>
      <div className={Silian_cn(`mt-3 flex flex-wrap items-center gap-2 text-[10px] ${Silian_TEXT_SECONDARY_CLASS}`)}>
        <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 dark:border-white/8 dark:bg-black/20">
          {Silian_llmCalls} LLM
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 dark:border-white/8 dark:bg-black/20">
          {Silian_formatCompactNumber(Silian_item?.total_tokens || 0)} tok
        </span>
        {Silian_item?.last_model ? (
          <span className="truncate rounded-full border border-slate-200 bg-slate-100 px-2 py-1 dark:border-white/8 dark:bg-black/20">
            {Silian_item.last_model}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function Silian_QuickLaunchButton({ label: Silian_label, description: Silian_description, onClick: Silian_onClick }) {
  return (
    <button
      type="button"
      onClick={Silian_onClick}
      className="group w-full rounded-[22px] border border-slate-200/80 bg-white/80 px-4 py-4 text-left transition-all hover:border-slate-300 hover:bg-white dark:border-white/8 dark:bg-white/[0.03] dark:hover:border-white/16 dark:hover:bg-white/[0.06]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={Silian_cn(`break-words text-sm font-medium ${Silian_TEXT_PRIMARY_CLASS}`)}>{Silian_label}</div>
          {Silian_description ? <div className={Silian_cn(`mt-1 break-words text-xs leading-5 ${Silian_TEXT_SECONDARY_CLASS}`)}>{Silian_description}</div> : null}
        </div>
        <Silian_ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-700 dark:text-slate-500 dark:group-hover:text-slate-200" />
      </div>
    </button>
  );
}

function Silian_PromptButton({ label: Silian_label, prompt: Silian_prompt, onUse: Silian_onUse }) {
  return (
    <button
      type="button"
      onClick={() => Silian_onUse(Silian_prompt)}
      className="group rounded-[22px] border border-slate-200/80 bg-slate-50/90 p-4 text-left transition-all hover:border-emerald-300 hover:bg-emerald-50 dark:border-white/8 dark:bg-black/20 dark:hover:border-emerald-400/25 dark:hover:bg-emerald-400/[0.08]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={Silian_cn(`text-sm font-medium ${Silian_TEXT_PRIMARY_CLASS}`)}>{Silian_label}</div>
          <div className={Silian_cn(`mt-2 text-xs leading-5 ${Silian_TEXT_SECONDARY_CLASS}`)}>{Silian_prompt}</div>
        </div>
        <Silian_ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-emerald-600 dark:text-slate-500 dark:group-hover:text-emerald-200" />
      </div>
    </button>
  );
}

function Silian_RiskBadge({ action: Silian_action, isZh: Silian_isZh }) {
  if (Silian_action?.requires_confirmation) {
    return <Silian_Badge className="border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/15 dark:text-amber-100">{Silian_isZh ? '需确认' : 'Confirm required'}</Silian_Badge>;
  }

  if (Silian_action?.risk_level === 'write') {
    return <Silian_Badge className="border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/15 dark:text-rose-100">{Silian_isZh ? '写入' : 'Write'}</Silian_Badge>;
  }

  if (Silian_action?.risk_level === 'read') {
    return <Silian_Badge className="border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/15 dark:text-sky-100">{Silian_isZh ? '读取' : 'Read'}</Silian_Badge>;
  }

  return <Silian_Badge className="border border-slate-200 bg-white/85 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">{Silian_isZh ? '待定' : 'Pending'}</Silian_Badge>;
}

function Silian_PendingActionTile({ action: Silian_action, disabled: Silian_disabled, isZh: Silian_isZh, onConfirm: Silian_onConfirm, onReject: Silian_onReject }) {
  const Silian_actionLabel = Silian_getLocalizedActionLabel(Silian_action, Silian_isZh);
  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-black/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={Silian_cn(`text-sm font-semibold ${Silian_TEXT_PRIMARY_CLASS}`)}>
            {Silian_actionLabel || Silian_action.action_name || `${Silian_isZh ? '提案' : 'Proposal'} #${Silian_action.proposal_id}`}
          </div>
          <div className={Silian_cn(`mt-2 text-xs leading-5 ${Silian_TEXT_SECONDARY_CLASS}`)}>
            {Silian_action.summary || (Silian_isZh ? '系统已生成一条待确认操作。' : 'A pending action is ready for review.')}
          </div>
        </div>
        <Silian_RiskBadge action={Silian_action} isZh={Silian_isZh} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Silian_Button
          size="sm"
          disabled={Silian_disabled}
          className="rounded-full bg-emerald-500 text-black hover:bg-emerald-400"
          onClick={() => Silian_onConfirm(Silian_action.proposal_id)}
        >
          {Silian_isZh ? '确认执行' : 'Confirm'}
        </Silian_Button>
        <Silian_Button
          size="sm"
          variant="outline"
          disabled={Silian_disabled}
          className={Silian_OUTLINE_BUTTON_CLASS}
          onClick={() => Silian_onReject(Silian_action.proposal_id)}
        >
          {Silian_isZh ? '驳回' : 'Reject'}
        </Silian_Button>
      </div>
    </div>
  );
}

function Silian_CapabilityTile({ action: Silian_action, isZh: Silian_isZh }) {
  return (
    <div className={Silian_cn(Silian_SURFACE_SOFT_CLASS, 'px-4 py-4')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={Silian_cn(`text-sm font-medium ${Silian_TEXT_PRIMARY_CLASS}`)}>{Silian_getLocalizedActionLabel(Silian_action, Silian_isZh)}</div>
          <div className={Silian_cn(`mt-1 break-words text-xs leading-5 ${Silian_TEXT_SECONDARY_CLASS}`)}>{Silian_getLocalizedActionDescription(Silian_action, Silian_isZh)}</div>
        </div>
        <Silian_RiskBadge action={Silian_action} isZh={Silian_isZh} />
      </div>
      {Array.isArray(Silian_action.requirements) && Silian_action.requirements.length > 0 ? (
        <div className={Silian_cn(`mt-3 text-[11px] leading-5 ${Silian_TEXT_TERTIARY_CLASS}`)}>
          {Silian_isZh ? '所需字段' : 'Required fields'}: {Silian_action.requirements.join(', ')}
        </div>
      ) : null}
    </div>
  );
}

function Silian_FilterPill({ active: Silian_active, onClick: Silian_onClick, children: Silian_children }) {
  return (
    <button
      type="button"
      onClick={Silian_onClick}
      className={Silian_cn(
        'rounded-full border px-3 py-1.5 text-xs transition-all',
        Silian_active
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/[0.14] dark:text-emerald-100'
          : 'border-slate-200/80 bg-white/75 text-slate-600 hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-white/16 dark:hover:bg-white/[0.05]'
      )}
    >
      {Silian_children}
    </button>
  );
}

function Silian_WorkspaceSectionButton({ active: Silian_active, icon: Silian_icon, label: Silian_label, count: Silian_count, onClick: Silian_onClick }) {
  const Silian_iconNode = Silian_icon ? Silian_React.createElement(Silian_icon, { className: 'h-4 w-4' }) : null;

  return (
    <button
      type="button"
      onClick={Silian_onClick}
      className={Silian_cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-all',
        Silian_active
          ? 'border-slate-900 bg-slate-900 text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)] dark:border-emerald-400/25 dark:bg-emerald-400/15 dark:text-emerald-50 dark:shadow-[0_10px_24px_rgba(16,185,129,0.12)]'
          : 'border-slate-200/80 bg-white/78 text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-white/18 dark:hover:text-white'
      )}
    >
      {Silian_iconNode}
      <span>{Silian_label}</span>
      {Silian_count !== undefined ? (
        <span className={Silian_cn(
          'rounded-full px-2 py-0.5 text-[11px]',
          Silian_active
            ? 'bg-white/15 text-white dark:bg-black/20 dark:text-emerald-50'
            : 'bg-slate-100 text-slate-500 dark:bg-white/8 dark:text-slate-400'
        )}>
          {Silian_count}
        </span>
      ) : null}
    </button>
  );
}

function Silian_JsonPreview({ value: Silian_value, className: Silian_className }) {
  const Silian_text = Silian_stringifyValue(Silian_value);
  if (!Silian_text) return null;

  return (
    <pre className={Silian_cn(`max-h-[20rem] overflow-auto whitespace-pre-wrap break-all rounded-[18px] border border-white/8 bg-[#050816] px-3 py-3 text-[11px] leading-5 text-slate-300 ${Silian_INLINE_SCROLLBAR_CLASS}`, Silian_className)}>
      {Silian_text}
    </pre>
  );
}

function Silian_ResultSnapshot({ title: Silian_title, value: Silian_value, isZh: Silian_isZh }) {
  const Silian_hasValue = Silian_value != null && Silian_value !== '';
  const [Silian_open, Silian_setOpen] = Silian_useState(false);
  const Silian_summary = Silian_useMemo(() => {
    if (!Silian_hasValue) {
      return Silian_isZh ? '无结果' : 'No result';
    }

    if (Array.isArray(Silian_value)) {
      return Silian_isZh ? `数组 · ${Silian_value.length} 项` : `Array · ${Silian_value.length} items`;
    }

    if (typeof Silian_value === 'object') {
      const Silian_size = Object.keys(Silian_value).length;
      return Silian_isZh ? `对象 · ${Silian_size} 个字段` : `Object · ${Silian_size} fields`;
    }

    const Silian_text = String(Silian_value);
    if (!Silian_text) {
      return Silian_isZh ? '无结果' : 'No result';
    }

    const Silian_compact = Silian_text.replace(/\s+/g, ' ').trim();
    return Silian_compact.length > 56 ? `${Silian_compact.slice(0, 56)}...` : Silian_compact;
  }, [Silian_hasValue, Silian_isZh, Silian_value]);

  if (!Silian_hasValue) return null;

  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/90 p-4 dark:border-white/8 dark:bg-black/20">
      <button
        type="button"
        onClick={() => Silian_setOpen((Silian_current) => !Silian_current)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <div className={Silian_cn(`text-[11px] uppercase tracking-[0.2em] ${Silian_TEXT_TERTIARY_CLASS}`)}>{Silian_title}</div>
          <div className={Silian_cn(`mt-2 truncate text-xs leading-5 ${Silian_TEXT_SECONDARY_CLASS}`)}>{Silian_summary}</div>
        </div>
        <span className={Silian_cn(
          `inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${Silian_TEXT_SECONDARY_CLASS}`,
          'border-slate-200 bg-white/80 dark:border-white/10 dark:bg-white/[0.04]'
        )}>
          <Silian_ChevronRight className={Silian_cn('h-3.5 w-3.5 transition-transform', Silian_open && 'rotate-90')} />
          {Silian_open ? (Silian_isZh ? '收起' : 'Collapse') : (Silian_isZh ? '展开' : 'Expand')}
        </span>
      </button>
      {Silian_open ? (
        typeof Silian_value === 'object'
          ? <Silian_JsonPreview value={Silian_value} className="mt-3" />
          : <div className={Silian_cn(`mt-3 text-xs leading-6 ${Silian_TEXT_SECONDARY_CLASS}`)}>{String(Silian_value) || (Silian_isZh ? '无结果。' : 'No result.')}</div>
      ) : null}
    </div>
  );
}

function Silian_EventTimelineRow({ item: Silian_item, locale: Silian_locale, isZh: Silian_isZh, disabled: Silian_disabled, onConfirmProposal: Silian_onConfirmProposal, onRejectProposal: Silian_onRejectProposal }) {
  const Silian_event = Silian_buildEventCopy(Silian_item, Silian_isZh);
  const Silian_proposal = Silian_item?.proposal;
  const Silian_metaData = Silian_item?.meta?.data || {};
  const Silian_payload = Silian_proposal?.payload || Silian_metaData.request_payload || Silian_metaData.payload || null;
  const Silian_result = Silian_metaData.new_data || Silian_metaData.result || null;

  return (
    <Silian_MotionDiv
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-5 dark:border-white/8 dark:bg-black/20"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex items-start gap-3">
          <span className={Silian_cn(
            'mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border',
            Silian_event.tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/[0.12] dark:text-emerald-200',
            Silian_event.tone === 'proposal' && 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/[0.12] dark:text-amber-100',
            Silian_event.tone === 'failed' && 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/[0.12] dark:text-rose-100',
            Silian_event.tone === 'tool' && 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/[0.12] dark:text-sky-100',
            Silian_event.tone === 'muted' && 'border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300'
          )}>
            {Silian_item?.kind === 'tool'
              ? <Silian_TerminalSquare className="h-4 w-4" />
              : Silian_item?.kind === 'action_proposed'
                ? <Silian_ShieldAlert className="h-4 w-4" />
                : <Silian_ShieldCheck className="h-4 w-4" />}
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className={Silian_cn(`text-sm font-medium ${Silian_TEXT_PRIMARY_CLASS}`)}>{Silian_event.title}</div>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
                {Silian_getLocalizedEventKind(Silian_item?.kind, Silian_isZh)}
              </span>
            </div>
            <div className={Silian_cn(`mt-2 text-xs leading-6 ${Silian_TEXT_SECONDARY_CLASS}`)}>{Silian_event.description}</div>
          </div>
        </div>
        <div className={Silian_cn(`shrink-0 pt-1 text-[11px] ${Silian_TEXT_TERTIARY_CLASS}`)}>{Silian_formatAbsoluteTime(Silian_item?.created_at, Silian_locale)}</div>
      </div>

      {Silian_payload ? <Silian_JsonPreview value={Silian_payload} className="mt-4" /> : null}
      {Silian_result ? <Silian_JsonPreview value={Silian_result} className="mt-3" /> : null}

      {Silian_proposal?.proposal_id && Silian_proposal?.status === 'pending' ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Silian_Button
            size="sm"
            disabled={Silian_disabled}
            className="rounded-full bg-emerald-500 text-black hover:bg-emerald-400"
            onClick={() => Silian_onConfirmProposal(Silian_proposal.proposal_id)}
          >
            {Silian_isZh ? '确认执行' : 'Confirm'}
          </Silian_Button>
          <Silian_Button
            size="sm"
            variant="outline"
            disabled={Silian_disabled}
            className={Silian_OUTLINE_BUTTON_CLASS}
            onClick={() => Silian_onRejectProposal(Silian_proposal.proposal_id)}
          >
            {Silian_isZh ? '驳回' : 'Reject'}
          </Silian_Button>
        </div>
      ) : null}
    </Silian_MotionDiv>
  );
}

function Silian_LlmCallCard({ item: Silian_item, locale: Silian_locale, isZh: Silian_isZh }) {
  return (
    <div className="rounded-[22px] border border-slate-200/80 bg-white/80 p-4 dark:border-white/8 dark:bg-white/[0.02]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={Silian_cn(`flex items-center gap-2 text-sm font-medium ${Silian_TEXT_PRIMARY_CLASS}`)}>
            <Silian_Cpu className="h-4 w-4 text-sky-600 dark:text-sky-200" />
            {Silian_isZh ? `模型回合 #${Silian_item.turn_no || '--'}` : `Model turn #${Silian_item.turn_no || '--'}`}
          </div>
          <div className={Silian_cn(`mt-1 text-xs leading-5 ${Silian_TEXT_SECONDARY_CLASS}`)}>{Silian_item.model || '--'}</div>
        </div>
        <span className={Silian_cn(
          'rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]',
          Silian_item.status === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/[0.12] dark:text-emerald-100'
            : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/[0.12] dark:text-rose-100'
        )}>
          {Silian_getLocalizedCallStatus(Silian_item.status, Silian_isZh)}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[18px] border border-slate-200/80 bg-slate-50/90 px-3 py-3 dark:border-white/6 dark:bg-black/20">
          <div className={Silian_cn(`text-[10px] uppercase tracking-[0.18em] ${Silian_TEXT_TERTIARY_CLASS}`)}>{Silian_isZh ? '令牌' : 'Tokens'}</div>
          <div className={Silian_cn(`mt-2 text-lg font-semibold ${Silian_TEXT_PRIMARY_CLASS}`)}>{Silian_formatCompactNumber(Silian_item.total_tokens)}</div>
        </div>
        <div className="rounded-[18px] border border-slate-200/80 bg-slate-50/90 px-3 py-3 dark:border-white/6 dark:bg-black/20">
          <div className={Silian_cn(`text-[10px] uppercase tracking-[0.18em] ${Silian_TEXT_TERTIARY_CLASS}`)}>{Silian_isZh ? '延迟' : 'Latency'}</div>
          <div className={Silian_cn(`mt-2 text-lg font-semibold ${Silian_TEXT_PRIMARY_CLASS}`)}>{Silian_formatLatency(Silian_item.latency_ms, Silian_isZh)}</div>
        </div>
      </div>
      <div className={Silian_cn(`mt-3 flex items-center justify-between gap-3 text-[11px] ${Silian_TEXT_TERTIARY_CLASS}`)}>
        <span>{Silian_formatAbsoluteTime(Silian_item.created_at, Silian_locale)}</span>
        <span className="truncate font-mono">{Silian_item.request_id || '--'}</span>
      </div>
    </div>
  );
}

function Silian_MessageBubble({
  message: Silian_message,
  locale: Silian_locale,
  isZh: Silian_isZh,
  disabled: Silian_disabled,
  onNavigateSuggestion: Silian_onNavigateSuggestion,
  onConfirmProposal: Silian_onConfirmProposal,
  onRejectProposal: Silian_onRejectProposal,
}) {
  const Silian_isUser = Silian_message?.role === 'user';
  const Silian_suggestion = Silian_message?.meta?.data?.suggestion;
  const Silian_proposal = Silian_message?.proposal || Silian_message?.meta?.data?.proposal;
  const Silian_result = Silian_message?.meta?.data?.result;
  const Silian_actionName = Silian_message?.meta?.data?.meta?.action_name || null;
  const Silian_missing = Array.isArray(Silian_message?.meta?.data?.meta?.missing) ? Silian_message.meta.data.meta.missing : [];
  const Silian_messageWidthClass = 'w-full max-w-[min(100%,36rem)]';

  return (
    <Silian_MotionDiv
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={Silian_cn('flex flex-col gap-3', Silian_isUser ? 'items-end' : 'items-start')}
    >
      <div className={Silian_cn(Silian_messageWidthClass, 'space-y-3')}>
        <div className={Silian_cn(
          `flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] ${Silian_TEXT_TERTIARY_CLASS}`,
          Silian_isUser ? 'justify-end' : 'justify-start'
        )}>
          <span className={Silian_cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-full border',
            Silian_isUser
              ? 'order-2 border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-white/[0.05] dark:text-white'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/18 dark:bg-emerald-400/[0.12] dark:text-emerald-200'
          )}>
            {Silian_isUser ? <Silian_MessageSquare className="h-4 w-4" /> : <Silian_Bot className="h-4 w-4" />}
          </span>
          <span className={Silian_isUser ? 'order-1' : ''}>{Silian_isUser ? (Silian_isZh ? '管理员' : 'Admin') : 'CarbonTrack AI'}</span>
          {Silian_message?.created_at ? <span className={Silian_cn('normal-case tracking-normal', Silian_isUser ? 'order-1' : '')}>{Silian_formatAbsoluteTime(Silian_message.created_at, Silian_locale)}</span> : null}
        </div>

        <div className={Silian_cn(
          'break-words rounded-[24px] border px-5 py-4 text-sm leading-7 shadow-[0_12px_30px_rgba(0,0,0,0.18)]',
          Silian_isUser
            ? 'rounded-tr-lg border-slate-200 bg-white text-slate-900 dark:border-white/12 dark:bg-white/[0.08] dark:text-white'
            : 'rounded-tl-lg border-emerald-200 bg-emerald-50/85 text-slate-800 dark:border-emerald-400/14 dark:bg-emerald-400/[0.08] dark:text-slate-100'
        )}>
          {Silian_message?.content || (Silian_isZh ? 'AI 未返回文本。' : 'No assistant text returned.')}
        </div>

        {!Silian_isUser && (Silian_actionName || Silian_result || Silian_missing.length > 0) ? (
          <div className="grid gap-3">
            {Silian_actionName ? (
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/[0.12] dark:text-sky-100">
                <Silian_Activity className="h-3.5 w-3.5" />
                {Silian_getLocalizedActionLabel({ name: Silian_actionName }, Silian_isZh)}
              </div>
            ) : null}
            {Silian_missing.length > 0 ? (
              <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-700 dark:border-amber-400/18 dark:bg-amber-400/[0.10] dark:text-amber-50">
                {Silian_isZh ? '缺少字段：' : 'Missing fields: '}
                {Silian_missing.map((Silian_item) => Silian_item.field).join(', ')}
              </div>
            ) : null}
            {Silian_result ? <Silian_ResultSnapshot title={Silian_isZh ? '结果快照' : 'Result snapshot'} value={Silian_result} isZh={Silian_isZh} /> : null}
          </div>
        ) : null}

        {Silian_suggestion?.route ? (
          <button
            type="button"
            onClick={() => Silian_onNavigateSuggestion(Silian_suggestion)}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-white/16 dark:hover:bg-white/[0.08]"
          >
            <Silian_ExternalLink className="h-3.5 w-3.5" />
            {Silian_getLocalizedRouteLabel(Silian_suggestion.route, Silian_isZh, Silian_suggestion.label)}
          </button>
        ) : null}

        {Silian_proposal?.proposal_id && Silian_proposal?.status === 'pending' ? (
          <div className="flex flex-wrap gap-2">
            <Silian_Button
              size="sm"
              disabled={Silian_disabled}
              className="rounded-full bg-emerald-500 text-black hover:bg-emerald-400"
              onClick={() => Silian_onConfirmProposal(Silian_proposal.proposal_id)}
            >
              {Silian_isZh ? '确认执行' : 'Confirm'}
            </Silian_Button>
            <Silian_Button
              size="sm"
              variant="outline"
              disabled={Silian_disabled}
              className={Silian_OUTLINE_BUTTON_CLASS}
              onClick={() => Silian_onRejectProposal(Silian_proposal.proposal_id)}
            >
              {Silian_isZh ? '驳回' : 'Reject'}
            </Silian_Button>
          </div>
        ) : null}
      </div>
    </Silian_MotionDiv>
  );
}

function Silian_EmptyConversationState({ isZh: Silian_isZh, starterPrompts: Silian_starterPrompts, onUsePrompt: Silian_onUsePrompt, onNavigateAudit: Silian_onNavigateAudit }) {
  return (
    <div className="flex h-full items-center justify-center p-6 md:p-8">
      <div className="w-full max-w-4xl">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/18 dark:bg-emerald-400/[0.12] dark:text-emerald-200">
            <Silian_Command className="h-9 w-9" />
          </div>
          <h3 className={Silian_cn(`mt-6 text-3xl font-semibold tracking-tight ${Silian_TEXT_PRIMARY_CLASS}`)}>
            {Silian_isZh ? '从一个明确任务开始' : 'Start from a clear task'}
          </h3>
          <p className={Silian_cn(`mt-3 text-sm leading-7 ${Silian_TEXT_SECONDARY_CLASS}`)}>
            {Silian_isZh
              ? '这不是宣传页，也不是摘要墙。直接输入目标、对象与范围，让工作台生成查询、建议或待确认动作。'
              : 'This surface is for action. State the target, subject, and scope, then let the workspace draft queries, suggestions, or confirmation-ready proposals.'}
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {Silian_starterPrompts.slice(0, 4).map((Silian_item) => (
            <Silian_PromptButton key={Silian_item.id} label={Silian_item.label} prompt={Silian_item.prompt} onUse={Silian_onUsePrompt} />
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={Silian_onNavigateAudit}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-white/16 dark:hover:bg-white/[0.08]"
          >
            <Silian_History className="h-4 w-4" />
            {Silian_isZh ? '查看会话审计' : 'Open session audit'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminAiWorkspacePage() {
  const Silian_navigate = Silian_useNavigate();
  const Silian_queryClient = Silian_useQueryClient();
  const Silian_composerRef = Silian_useRef(null);
  const [Silian_searchParams] = Silian_useSearchParams();
  const { currentLanguage: Silian_currentLanguage } = Silian_useTranslation();

  const Silian_currentAdminId = Silian_useMemo(() => {
    const Silian_user = Silian_userManager.getUser();
    return Silian_user?.id ?? null;
  }, []);

  const Silian_locale = Silian_currentLanguage || 'zh-CN';
  const Silian_isZh = Silian_locale.toLowerCase().startsWith('zh');

  const [Silian_selectedConversationId, Silian_setSelectedConversationId] = Silian_useState(null);
  const [Silian_draft, Silian_setDraft] = Silian_useState('');
  const [Silian_isCreatingConversation, Silian_setIsCreatingConversation] = Silian_useState(false);
  const [Silian_conversationSearch, Silian_setConversationSearch] = Silian_useState('');
  const [Silian_conversationFilter, Silian_setConversationFilter] = Silian_useState('all');
  const [Silian_inspectorOpen, Silian_setInspectorOpen] = Silian_useState(false);
  const [Silian_workspaceSection, Silian_setWorkspaceSection] = Silian_useState('actions');

  const Silian_aiContext = Silian_useMemo(() => ({
    activeRoute: '/admin/ai',
    locale: Silian_locale,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
  }), [Silian_locale]);

  const Silian_workspaceQuery = Silian_useQuery(
    ['adminAiWorkspace'],
    async () => {
      const Silian_response = await Silian_adminAPI.getAiWorkspace();
      return Silian_response.data?.data || Silian_response.data;
    }
  );

  const Silian_conversationsQuery = Silian_useQuery(
    ['adminAiConversations', Silian_currentAdminId],
    async () => {
      const Silian_response = await Silian_adminAPI.getAiConversations({
        limit: 24,
        admin_id: Silian_currentAdminId || undefined,
      });
      return Silian_response.data?.data || [];
    },
    { keepPreviousData: true }
  );

  const Silian_conversationItems = Silian_useMemo(() => {
    if (Array.isArray(Silian_conversationsQuery.data) && Silian_conversationsQuery.data.length > 0) {
      return Silian_conversationsQuery.data;
    }

    return Array.isArray(Silian_workspaceQuery.data?.recent_conversations) ? Silian_workspaceQuery.data.recent_conversations : [];
  }, [Silian_conversationsQuery.data, Silian_workspaceQuery.data?.recent_conversations]);

  const Silian_filteredConversationItems = Silian_useMemo(() => {
    const Silian_keyword = Silian_conversationSearch.trim().toLowerCase();

    return Silian_conversationItems.filter((Silian_item) => {
      if (Silian_conversationFilter === 'pending' && Number(Silian_item?.pending_action_count || 0) <= 0) {
        return false;
      }

      if (Silian_conversationFilter === 'active' && Number(Silian_item?.pending_action_count || 0) > 0) {
        return false;
      }

      if (!Silian_keyword) {
        return true;
      }

      const Silian_haystack = [
        Silian_item?.title,
        Silian_item?.last_message_preview,
        Silian_item?.conversation_id,
        Silian_item?.last_model,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return Silian_haystack.includes(Silian_keyword);
    });
  }, [Silian_conversationFilter, Silian_conversationItems, Silian_conversationSearch]);

  Silian_useEffect(() => {
    if (!Silian_selectedConversationId && !Silian_isCreatingConversation && Silian_filteredConversationItems.length > 0) {
      Silian_setSelectedConversationId(Silian_filteredConversationItems[0].conversation_id);
    }
  }, [Silian_filteredConversationItems, Silian_isCreatingConversation, Silian_selectedConversationId]);

  Silian_useEffect(() => {
    if (Silian_isCreatingConversation || !Silian_selectedConversationId) {
      return;
    }

    const Silian_stillVisible = Silian_filteredConversationItems.some((Silian_item) => Silian_item.conversation_id === Silian_selectedConversationId);
    if (!Silian_stillVisible && Silian_filteredConversationItems.length > 0) {
      Silian_setSelectedConversationId(Silian_filteredConversationItems[0].conversation_id);
    }
  }, [Silian_filteredConversationItems, Silian_isCreatingConversation, Silian_selectedConversationId]);

  Silian_useEffect(() => {
    if (Silian_searchParams.get('focus') === 'composer') {
      requestAnimationFrame(() => Silian_composerRef.current?.focus());
    }
  }, [Silian_searchParams]);

  const Silian_conversationDetailQuery = Silian_useQuery(
    ['adminAiConversation', Silian_selectedConversationId],
    async () => {
      const Silian_response = await Silian_adminAPI.getAiConversation(Silian_selectedConversationId);
      return Silian_response.data?.data || Silian_response.data;
    },
    {
      enabled: Boolean(Silian_selectedConversationId),
    }
  );

  const Silian_activeConversation = Silian_isCreatingConversation ? null : (Silian_conversationDetailQuery.data || null);
  const Silian_activeConversationId = Silian_activeConversation?.conversation_id == null ? null : String(Silian_activeConversation.conversation_id);
  const Silian_normalizedSelectedConversationId = Silian_selectedConversationId == null ? null : String(Silian_selectedConversationId);

  const Silian_conversationTimeline = Silian_useMemo(
    () => (Array.isArray(Silian_activeConversation?.messages) ? Silian_activeConversation.messages : []),
    [Silian_activeConversation]
  );
  const Silian_visibleMessages = Silian_useMemo(
    () => Silian_conversationTimeline.filter((Silian_item) => Silian_item?.kind === 'message'),
    [Silian_conversationTimeline]
  );
  const Silian_pendingActions = Silian_useMemo(
    () => (Array.isArray(Silian_activeConversation?.pending_actions) ? Silian_activeConversation.pending_actions : []),
    [Silian_activeConversation]
  );
  const Silian_llmCalls = Silian_useMemo(
    () => (Array.isArray(Silian_activeConversation?.llm_calls) ? Silian_activeConversation.llm_calls : []),
    [Silian_activeConversation]
  );

  const Silian_invalidateWorkspace = Silian_useCallback(() => {
    Silian_queryClient.invalidateQueries(['adminAiWorkspace']);
    Silian_queryClient.invalidateQueries(['adminAiConversations', Silian_currentAdminId]);
  }, [Silian_currentAdminId, Silian_queryClient]);

  const Silian_hasStaleConversationDetail = Boolean(Silian_normalizedSelectedConversationId)
    && Silian_activeConversationId !== Silian_normalizedSelectedConversationId;

  const Silian_sendMutation = Silian_useMutation(
    async ({ message: Silian_message, conversationId: Silian_conversationId }) => Silian_adminAPI.chatWithAdminAi({
      conversation_id: Silian_conversationId || undefined,
      message: Silian_message,
      context: Silian_aiContext,
      source: 'admin:/admin/ai',
    }),
    {
      onSuccess: (Silian_response, Silian_variables) => {
        const Silian_payload = Silian_response.data || {};
        const Silian_nextConversation = Silian_buildFallbackConversation(
          Silian_payload.conversation || null,
          Silian_payload.conversation_id || Silian_variables.conversationId || null,
          Silian_activeConversation,
          Silian_variables.message,
          Silian_payload.message || null
        );
        const Silian_nextConversationId = Silian_payload.conversation_id || Silian_nextConversation?.conversation_id || null;

        if (Silian_nextConversationId) {
          Silian_queryClient.setQueryData(['adminAiConversation', Silian_nextConversationId], Silian_nextConversation);
          Silian_setSelectedConversationId(Silian_nextConversationId);
        }

        Silian_setIsCreatingConversation(false);
        Silian_setDraft('');
        Silian_invalidateWorkspace();
      },
      onError: (Silian_error) => {
        Silian_toast.error(Silian_error?.response?.data?.error || (Silian_isZh ? 'AI 请求失败，请稍后重试。' : 'AI request failed. Please try again.'));
      },
    }
  );

  const Silian_decisionMutation = Silian_useMutation(
    async ({ proposalId: Silian_proposalId, outcome: Silian_outcome, conversationId: Silian_conversationId }) => Silian_adminAPI.chatWithAdminAi({
      conversation_id: Silian_conversationId,
      context: Silian_aiContext,
      decision: {
        proposal_id: Silian_proposalId,
        outcome: Silian_outcome,
      },
      source: 'admin:/admin/ai',
    }),
    {
      onSuccess: (Silian_response, Silian_variables) => {
        const Silian_payload = Silian_response.data || {};
        const Silian_previousConversation = Silian_variables?.conversationId
          ? Silian_queryClient.getQueryData(['adminAiConversation', Silian_variables.conversationId])
          : null;
        const Silian_nextConversation = Silian_buildFallbackConversation(
          Silian_payload.conversation || null,
          Silian_payload.conversation_id || Silian_variables?.conversationId || null,
          Silian_previousConversation,
          null,
          Silian_payload.message || null
        );
        const Silian_nextConversationId = Silian_payload.conversation_id || Silian_variables?.conversationId || null;

        if (Silian_nextConversationId) {
          Silian_queryClient.setQueryData(['adminAiConversation', Silian_nextConversationId], Silian_nextConversation);
        }

        Silian_invalidateWorkspace();
      },
      onError: (Silian_error) => {
        Silian_toast.error(Silian_error?.response?.data?.error || (Silian_isZh ? '操作决策失败。' : 'Decision failed.'));
      },
    }
  );

  const Silian_workspaceData = Silian_workspaceQuery.data;
  const Silian_assistant = Silian_workspaceData?.assistant || Silian_EMPTY_OBJECT;
  const Silian_starterPrompts = Silian_useMemo(
    () => (Array.isArray(Silian_workspaceData?.starter_prompts) ? Silian_workspaceData.starter_prompts : Silian_EMPTY_ARRAY),
    [Silian_workspaceData?.starter_prompts]
  );
  const Silian_quickActions = Silian_useMemo(
    () => (Array.isArray(Silian_workspaceData?.quick_actions) ? Silian_workspaceData.quick_actions : Silian_EMPTY_ARRAY),
    [Silian_workspaceData?.quick_actions]
  );
  const Silian_navigationTargets = Silian_useMemo(
    () => (Array.isArray(Silian_workspaceData?.navigation_targets) ? Silian_workspaceData.navigation_targets : Silian_EMPTY_ARRAY),
    [Silian_workspaceData?.navigation_targets]
  );
  const Silian_managementActions = Silian_useMemo(
    () => (Array.isArray(Silian_workspaceData?.management_actions) ? Silian_workspaceData.management_actions : Silian_EMPTY_ARRAY),
    [Silian_workspaceData?.management_actions]
  );

  const Silian_currentSummary = Silian_activeConversation?.summary || Silian_conversationItems.find((Silian_item) => Silian_item.conversation_id === Silian_selectedConversationId) || {};
  const Silian_selectedConversationTitle = Silian_currentSummary.title || (Silian_isCreatingConversation ? (Silian_isZh ? '新会话' : 'New session') : (Silian_isZh ? '控制通道' : 'Control channel'));
  const Silian_currentConversationIdLabel = Silian_activeConversationId || Silian_normalizedSelectedConversationId || null;
  const Silian_lastActivityLabel = Silian_formatAbsoluteTime(Silian_currentSummary.last_activity_at, Silian_locale);
  const Silian_canSend = Silian_draft.trim().length >= Silian_COMMAND_MIN_LENGTH && !Silian_sendMutation.isLoading && Silian_assistant.chat_enabled !== false;
  const Silian_canCreateConversation = !Silian_sendMutation.isLoading && !Silian_decisionMutation.isLoading;
  const Silian_disableProposalActions = Silian_decisionMutation.isLoading || Silian_hasStaleConversationDetail;

  const Silian_capabilitySummary = Silian_useMemo(() => ({
    readCount: Silian_managementActions.filter((Silian_item) => Silian_item.risk_level === 'read').length,
    writeCount: Silian_managementActions.filter((Silian_item) => Silian_item.risk_level === 'write').length,
    confirmationCount: Silian_managementActions.filter((Silian_item) => Silian_item.requires_confirmation).length,
  }), [Silian_managementActions]);

  const Silian_spotlightRoutes = Silian_useMemo(() => Silian_quickActions.slice(0, 4), [Silian_quickActions]);
  const Silian_sideRoutes = Silian_useMemo(() => Silian_navigationTargets.filter((Silian_item) => Silian_item.route !== '/admin/ai').slice(0, 6), [Silian_navigationTargets]);
  const Silian_capabilityPreview = Silian_useMemo(() => Silian_managementActions.slice(0, 6), [Silian_managementActions]);
  const Silian_localizedSpotlightRoutes = Silian_useMemo(
    () => Silian_spotlightRoutes.map((Silian_action) => ({ ...Silian_action, ...Silian_getLocalizedQuickActionCopy(Silian_action, Silian_isZh) })),
    [Silian_isZh, Silian_spotlightRoutes]
  );
  const Silian_localizedSideRoutes = Silian_useMemo(
    () => Silian_sideRoutes.map((Silian_target) => ({ ...Silian_target, ...Silian_getLocalizedNavigationCopy(Silian_target, Silian_isZh) })),
    [Silian_isZh, Silian_sideRoutes]
  );
  const Silian_taskTemplates = Silian_useMemo(
    () => Silian_managementActions
      .slice(0, 8)
      .map((Silian_action) => ({
        ...Silian_action,
        localizedLabel: Silian_getLocalizedActionLabel(Silian_action, Silian_isZh),
        prompt: Silian_action.risk_level === 'write'
          ? `${Silian_isZh ? '请帮我准备一个待确认操作：' : 'Prepare a confirmation-ready operation for '} ${Silian_getLocalizedActionLabel(Silian_action, Silian_isZh)}${Silian_action.requirements?.length ? `；${Silian_isZh ? '如缺字段请直接追问：' : 'ask follow-up for: '}${Silian_action.requirements.join(', ')}` : ''}`
          : `${Silian_isZh ? '请帮我执行查询：' : 'Run this query: '} ${Silian_getLocalizedActionLabel(Silian_action, Silian_isZh)}${Silian_action.requirements?.length ? `；${Silian_isZh ? '如缺字段请直接追问：' : 'ask follow-up for: '}${Silian_action.requirements.join(', ')}` : ''}`,
      })),
    [Silian_isZh, Silian_managementActions]
  );
  const Silian_latestAssistantResult = Silian_useMemo(() => {
    const Silian_assistantMessages = [...Silian_visibleMessages].reverse();
    return Silian_assistantMessages.find((Silian_item) => Silian_item?.meta?.data?.result)?.meta?.data?.result || null;
  }, [Silian_visibleMessages]);
  const Silian_resultFollowUps = Silian_useMemo(() => {
    if (!Silian_latestAssistantResult || typeof Silian_latestAssistantResult !== 'object') {
      return [];
    }

    if (Silian_latestAssistantResult.scope === 'pending_carbon_records' && Array.isArray(Silian_latestAssistantResult.items) && Silian_latestAssistantResult.items.length > 0) {
      const Silian_ids = Silian_latestAssistantResult.items.slice(0, 5).map((Silian_item) => Silian_item.id).filter(Boolean);
      if (Silian_ids.length === 0) return [];

      return [
        {
          id: 'approve-pending-result',
          label: Silian_isZh ? '基于结果准备批量通过' : 'Prepare approval from result',
          description: Silian_isZh ? '把当前结果里的前 5 条待审记录直接组装成待确认通过动作。' : 'Turn the first five pending records into a confirmation-ready approval action.',
          prompt: `请准备一个待确认操作：批量通过这些碳记录，record_ids=${Silian_ids.join(', ')}。如果需要 review_note，请先问我。`,
        },
        {
          id: 'reject-pending-result',
          label: Silian_isZh ? '基于结果准备批量驳回' : 'Prepare rejection from result',
          description: Silian_isZh ? '把当前结果里的前 5 条待审记录直接组装成待确认驳回动作。' : 'Turn the first five pending records into a confirmation-ready rejection action.',
          prompt: `请准备一个待确认操作：批量驳回这些碳记录，record_ids=${Silian_ids.join(', ')}。如果需要 review_note，请先问我。`,
        },
      ];
    }

    return [];
  }, [Silian_isZh, Silian_latestAssistantResult]);
  const Silian_inspectorSummary = Silian_useMemo(() => {
    const Silian_messageCount = Silian_currentSummary.message_count || 0;
    const Silian_llmCount = Silian_currentSummary.llm_calls || 0;
    const Silian_pendingLabel = Silian_pendingActions.length > 0
      ? `${Silian_pendingActions.length}${Silian_isZh ? ' 个待确认动作' : ' pending actions'}`
      : (Silian_isZh ? '无挂起动作' : 'No pending action');
    const Silian_latestScope = Silian_latestAssistantResult?.scope
      ? `${Silian_isZh ? '最近结果' : 'Latest result'}: ${Silian_getLocalizedScopeLabel(Silian_latestAssistantResult.scope, Silian_isZh)}`
      : null;

    return {
      title: Silian_isZh
        ? `${Silian_messageCount} 条消息，${Silian_llmCount} 次模型调用`
        : `${Silian_messageCount} messages, ${Silian_llmCount} model turns`,
      detail: Silian_latestScope ? `${Silian_pendingLabel} · ${Silian_latestScope}` : Silian_pendingLabel,
    };
  }, [Silian_currentSummary.llm_calls, Silian_currentSummary.message_count, Silian_isZh, Silian_latestAssistantResult?.scope, Silian_pendingActions.length]);
  const Silian_secondarySections = Silian_useMemo(() => ([
    {
      id: 'actions',
      label: Silian_isZh ? '执行面板' : 'Action deck',
      icon: Silian_ShieldCheck,
      count: Silian_pendingActions.length + Silian_resultFollowUps.length,
      description: Silian_isZh ? '处理待确认动作与基于结果的下一步。' : 'Handle confirmations and next-step suggestions.',
    },
    {
      id: 'shortcuts',
      label: Silian_isZh ? '快捷入口' : 'Shortcuts',
      icon: Silian_Sparkles,
      count: Silian_localizedSpotlightRoutes.length + Silian_localizedSideRoutes.length,
      description: Silian_isZh ? '直接跳到高频后台页或人工处理入口。' : 'Jump to common admin surfaces and manual follow-ups.',
    },
    {
      id: 'inspector',
      label: Silian_isZh ? '会话检查' : 'Inspector',
      icon: Silian_Cpu,
      count: Silian_llmCalls.length,
      description: Silian_isZh ? '查看模型回合、结果快照与会话强度。' : 'Inspect model turns, snapshots, and session density.',
    },
    {
      id: 'capabilities',
      label: Silian_isZh ? '工具目录' : 'Capabilities',
      icon: Silian_Command,
      count: Silian_capabilityPreview.length + Math.min(Silian_taskTemplates.length, 5),
      description: Silian_isZh ? '查看能力边界与更稳的任务模板。' : 'Review guardrails and reliable task templates.',
    },
  ]), [Silian_capabilityPreview.length, Silian_isZh, Silian_llmCalls.length, Silian_localizedSideRoutes.length, Silian_localizedSpotlightRoutes.length, Silian_pendingActions.length, Silian_resultFollowUps.length, Silian_taskTemplates.length]);
  const Silian_currentSection = Silian_secondarySections.find((Silian_item) => Silian_item.id === Silian_workspaceSection) || Silian_secondarySections[0];

  const Silian_handleSelectConversation = Silian_useCallback((Silian_conversationId) => {
    Silian_setIsCreatingConversation(false);
    Silian_setSelectedConversationId(Silian_conversationId);
  }, []);

  const Silian_handleUsePrompt = Silian_useCallback((Silian_prompt) => {
    Silian_setDraft(Silian_prompt);
    requestAnimationFrame(() => Silian_composerRef.current?.focus());
  }, []);

  const Silian_handleStartConversation = Silian_useCallback(() => {
    Silian_setIsCreatingConversation(true);
    Silian_setSelectedConversationId(null);
    Silian_queryClient.removeQueries(['adminAiConversation']);
    requestAnimationFrame(() => Silian_composerRef.current?.focus());
  }, [Silian_queryClient]);

  const Silian_handleSend = Silian_useCallback(() => {
    const Silian_message = Silian_draft.trim();
    if (Silian_message.length < Silian_COMMAND_MIN_LENGTH || Silian_sendMutation.isLoading || Silian_assistant.chat_enabled === false) {
      return;
    }

    Silian_sendMutation.mutate({
      message: Silian_message,
      conversationId: Silian_isCreatingConversation ? null : Silian_selectedConversationId,
    });
  }, [Silian_assistant.chat_enabled, Silian_draft, Silian_isCreatingConversation, Silian_selectedConversationId, Silian_sendMutation]);

  const Silian_handleComposerKeyDown = Silian_useCallback((Silian_event) => {
    if ((Silian_event.metaKey || Silian_event.ctrlKey) && Silian_event.key === 'Enter') {
      Silian_event.preventDefault();
      Silian_handleSend();
    }
  }, [Silian_handleSend]);

  const Silian_handleNavigateSuggestion = Silian_useCallback((Silian_suggestion) => {
    const Silian_fullRoute = Silian_buildRouteWithQuery(Silian_suggestion?.route, Silian_suggestion?.query || {});
    if (!Silian_fullRoute) {
      Silian_toast.error(Silian_isZh ? '缺少可跳转的目标页面。' : 'Missing destination route.');
      return;
    }

    Silian_navigate(Silian_fullRoute);
  }, [Silian_isZh, Silian_navigate]);

  const Silian_handleRunQuickAction = Silian_useCallback((Silian_action) => {
    const Silian_fullRoute = Silian_buildRouteWithQuery(Silian_action?.route, Silian_action?.query || {});
    if (!Silian_fullRoute) {
      Silian_toast.error(Silian_isZh ? '缺少可跳转的目标页面。' : 'Missing destination route.');
      return;
    }

    Silian_navigate(Silian_fullRoute);
  }, [Silian_isZh, Silian_navigate]);

  const Silian_handleNavigateAudit = Silian_useCallback(() => {
    Silian_navigate('/admin/llm-usage');
  }, [Silian_navigate]);

  const Silian_busyLabel = Silian_sendMutation.isLoading
    ? (Silian_isZh ? '正在请求模型...' : 'Sending to model...')
    : Silian_decisionMutation.isLoading
      ? (Silian_isZh ? '正在写回决策...' : 'Applying decision...')
      : Silian_conversationDetailQuery.isFetching && !Silian_isCreatingConversation
        ? (Silian_isZh ? '同步会话中...' : 'Syncing session...')
        : null;

  return (
    <div className="min-w-0 overflow-x-clip pb-4">
      <div className="relative w-full min-w-0 overflow-hidden rounded-[36px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.96))] text-slate-950 shadow-[0_30px_80px_rgba(15,23,42,0.12)] dark:border-slate-900 dark:bg-[#060816] dark:text-white dark:shadow-[0_30px_90px_rgba(2,6,23,0.48)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.1),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(241,245,249,0.92))] dark:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_22%),linear-gradient(180deg,rgba(12,16,36,0.96),rgba(5,8,22,1))]" />
        <div className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-25 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:32px_32px]" />

        <div className="relative">
          <div className={`border-b px-6 py-6 md:px-8 ${Silian_PANEL_DIVIDER_CLASS}`}>
            <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1.25fr)_repeat(4,minmax(0,1fr))]">
              <div className="min-w-0 space-y-4 lg:col-span-2 2xl:col-span-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Silian_StatusChip tone="success">
                    <Silian_Bot className="h-3.5 w-3.5" />
                    {Silian_isZh ? '管理 AI' : 'Admin AI'}
                  </Silian_StatusChip>
                  <Silian_StatusChip tone={Silian_assistant.chat_enabled ? 'success' : 'warning'}>
                    {Silian_assistant.chat_enabled ? (Silian_isZh ? '对话已就绪' : 'Chat ready') : (Silian_isZh ? '对话不可用' : 'Chat unavailable')}
                  </Silian_StatusChip>
                  <Silian_StatusChip tone={Silian_assistant.intent_enabled ? 'success' : 'warning'}>
                    {Silian_assistant.intent_enabled ? (Silian_isZh ? '意图解析在线' : 'Intent online') : (Silian_isZh ? '意图解析关闭' : 'Intent offline')}
                  </Silian_StatusChip>
                </div>

                <div>
                  <div className={Silian_cn(`text-[11px] uppercase tracking-[0.32em] ${Silian_TEXT_TERTIARY_CLASS}`)}>
                    {Silian_isZh ? '治理工作面' : 'Operations surface'}
                  </div>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                    {Silian_isZh ? '管理 AI 指挥台' : 'Admin AI cockpit'}
                  </h2>
                </div>
              </div>

              <Silian_MetricTile
                label={Silian_isZh ? '读取能力' : 'Read ops'}
                value={Silian_capabilitySummary.readCount}
                hint={Silian_isZh ? '无副作用查询' : 'Side-effect free queries'}
              />
              <Silian_MetricTile
                label={Silian_isZh ? '写入能力' : 'Write ops'}
                value={Silian_capabilitySummary.writeCount}
                hint={Silian_isZh ? '可能改动系统状态' : 'May change system state'}
              />
              <Silian_MetricTile
                label={Silian_isZh ? '确认动作' : 'Confirmations'}
                value={Silian_capabilitySummary.confirmationCount}
                hint={Silian_getLocalizedConfirmationPolicy(Silian_assistant.default_confirmation_policy, Silian_isZh)}
              />
              <Silian_MetricTile
                label={Silian_isZh ? '历史窗口' : 'History window'}
                value={Silian_assistant.max_history_messages || '--'}
                hint={Silian_assistant.max_auto_read_steps
                  ? `${Silian_assistant.max_auto_read_steps} ${Silian_isZh ? '次自动读取' : 'auto reads'}`
                  : (Silian_isZh ? '按配置回放' : 'Config controlled')}
              />
            </div>
          </div>

          {Silian_assistant.chat_enabled === false ? (
            <div className="px-6 pt-6 md:px-8">
              <Silian_Alert className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-50">
                <Silian_ShieldAlert className="h-4 w-4" />
                <Silian_AlertTitle>{Silian_isZh ? 'AI 暂不可用' : 'AI unavailable'}</Silian_AlertTitle>
                <Silian_AlertDescription>
                  {Silian_isZh
                    ? '服务器尚未配置可用的模型密钥。你仍可查看历史会话和能力目录，但无法发送新请求。'
                    : 'The server does not currently expose a live model key. You can still inspect history and capability metadata, but cannot send new prompts.'}
                </Silian_AlertDescription>
              </Silian_Alert>
            </div>
          ) : null}

          <div className="grid gap-5 px-6 py-6 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:px-8">
            <div className="min-w-0 space-y-5">
              <Silian_Panel
                title={Silian_isZh ? '会话队列' : 'Session queue'}
                description={Silian_isZh ? '切换上下文或直接开新线程。' : 'Switch context or open a fresh thread.'}
                action={(
                  <Silian_Button
                    size="sm"
                    disabled={!Silian_canCreateConversation}
                    onClick={Silian_handleStartConversation}
                    className="rounded-full bg-white text-slate-950 hover:bg-slate-100"
                  >
                    <Silian_Plus className="mr-1 h-3.5 w-3.5" />
                    {Silian_isZh ? '新会话' : 'New'}
                  </Silian_Button>
                )}
                bodyClassName="p-0"
              >
                <div className={`border-b px-4 py-4 ${Silian_PANEL_DIVIDER_CLASS}`}>
                  <div className="relative">
                    <Silian_Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      value={Silian_conversationSearch}
                      onChange={(Silian_event) => Silian_setConversationSearch(Silian_event.target.value)}
                      placeholder={Silian_isZh ? '搜索标题、摘要、模型或会话 ID' : 'Search title, preview, model, or session id'}
                      className={Silian_cn(Silian_INPUT_SHELL_CLASS, 'h-11 w-full rounded-[18px] pl-10 pr-4 text-sm')}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Silian_Filter className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    <Silian_FilterPill active={Silian_conversationFilter === 'all'} onClick={() => Silian_setConversationFilter('all')}>
                      {Silian_isZh ? '全部' : 'All'}
                    </Silian_FilterPill>
                    <Silian_FilterPill active={Silian_conversationFilter === 'pending'} onClick={() => Silian_setConversationFilter('pending')}>
                      {Silian_isZh ? '待确认' : 'Pending'}
                    </Silian_FilterPill>
                    <Silian_FilterPill active={Silian_conversationFilter === 'active'} onClick={() => Silian_setConversationFilter('active')}>
                      {Silian_isZh ? '进行中' : 'Active'}
                    </Silian_FilterPill>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Silian_MetricTile label={Silian_isZh ? '会话' : 'Sessions'} value={Silian_conversationItems.length} />
                    <Silian_MetricTile label="LLM" value={Silian_conversationItems.reduce((Silian_sum, Silian_item) => Silian_sum + Number(Silian_item?.llm_calls || 0), 0)} />
                    <Silian_MetricTile label={Silian_isZh ? '待确认' : 'Pending'} value={Silian_conversationItems.reduce((Silian_sum, Silian_item) => Silian_sum + Number(Silian_item?.pending_action_count || 0), 0)} />
                  </div>
                </div>
                <Silian_ScrollArea className={Silian_cn('h-[28rem]', Silian_PAGE_SCROLLBAR_CLASS)}>
                  <div className="space-y-3 p-4">
                    {Silian_isCreatingConversation ? (
                      <div className="rounded-[22px] border border-emerald-300 bg-emerald-50 px-4 py-4 dark:border-emerald-400/25 dark:bg-emerald-400/[0.12]">
                        <div className={Silian_cn(`text-sm font-semibold ${Silian_TEXT_PRIMARY_CLASS}`)}>{Silian_isZh ? '当前为新会话草稿' : 'Drafting a new session'}</div>
                        <div className={Silian_cn(`mt-1 text-xs leading-5 ${Silian_TEXT_SECONDARY_CLASS}`)}>
                          {Silian_isZh ? '输入第一条命令后会自动建立线程。' : 'The first prompt will create the thread automatically.'}
                        </div>
                      </div>
                    ) : null}

                    {Silian_filteredConversationItems.map((Silian_item) => (
                      <Silian_ConversationRow
                        key={Silian_item.conversation_id}
                        item={Silian_item}
                        active={!Silian_isCreatingConversation && Silian_selectedConversationId === Silian_item.conversation_id}
                        locale={Silian_locale}
                        isZh={Silian_isZh}
                        onSelect={Silian_handleSelectConversation}
                      />
                    ))}

                    {Silian_filteredConversationItems.length === 0 && !Silian_conversationsQuery.isLoading && !Silian_workspaceQuery.isLoading ? (
                      <div className="rounded-[22px] border border-dashed border-slate-300/80 px-4 py-8 text-center text-sm leading-6 text-slate-500 dark:border-white/10 dark:text-slate-400">
                        {Silian_conversationItems.length === 0
                          ? (Silian_isZh ? '还没有会话记录。直接开一个新的。' : 'No sessions yet. Start a new one.')
                          : (Silian_isZh ? '没有符合当前筛选条件的会话。' : 'No sessions match the current filters.')}
                      </div>
                    ) : null}
                  </div>
                </Silian_ScrollArea>
              </Silian_Panel>
            </div>

            <div className="min-w-0 space-y-5">
              <Silian_Panel
                title={Silian_selectedConversationTitle}
                description={Silian_isCreatingConversation
                  ? (Silian_isZh ? '新线程将在你发送第一条消息时建立。' : 'A new thread will be created when you send the first prompt.')
                  : (Silian_currentConversationIdLabel
                    ? (Silian_isZh ? `会话 ID：${Silian_currentConversationIdLabel}` : `Session ID: ${Silian_currentConversationIdLabel}`)
                    : (Silian_isZh ? '会话 ID：--' : 'Session ID: --'))}
                titleClassName="text-[1.9rem] leading-[1.14] md:text-[2.35rem]"
                action={(
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {Silian_currentSummary.message_count ? (
                      <Silian_StatusChip>
                        <Silian_MessageSquare className="h-3.5 w-3.5" />
                        {Silian_currentSummary.message_count} {Silian_isZh ? '条消息' : 'messages'}
                      </Silian_StatusChip>
                    ) : null}
                    {Silian_currentSummary.llm_calls ? (
                      <Silian_StatusChip>
                        <Silian_Cpu className="h-3.5 w-3.5" />
                        {Silian_currentSummary.llm_calls} LLM
                      </Silian_StatusChip>
                    ) : null}
                    {Silian_currentSummary.total_tokens ? (
                      <Silian_StatusChip>
                        {Silian_formatCompactNumber(Silian_currentSummary.total_tokens)} {Silian_isZh ? '令牌' : 'tok'}
                      </Silian_StatusChip>
                    ) : null}
                    {Silian_currentSummary.last_activity_at ? (
                      <Silian_StatusChip>
                        <Silian_Clock3 className="h-3.5 w-3.5" />
                        {Silian_lastActivityLabel}
                      </Silian_StatusChip>
                    ) : null}
                    <Silian_Button
                      size="sm"
                      variant="outline"
                      className={Silian_OUTLINE_BUTTON_CLASS}
                      onClick={Silian_handleNavigateAudit}
                    >
                      {Silian_isZh ? '审计' : 'Audit'}
                    </Silian_Button>
                  </div>
                )}
                stackAction
                bodyClassName="p-0"
                className="overflow-hidden"
              >
                <div className="relative flex min-h-[44rem] flex-col">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.06),transparent_34%)] dark:bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.08),transparent_30%)]" />

                  <div className="min-h-0 flex-1">
                    {Silian_conversationDetailQuery.isLoading && !Silian_isCreatingConversation ? (
                      <div className="flex h-full items-center justify-center">
                        <Silian_Loader2 className="h-5 w-5 animate-spin text-slate-400 dark:text-slate-500" />
                      </div>
                    ) : Silian_conversationTimeline.length === 0 ? (
                      <Silian_EmptyConversationState
                        isZh={Silian_isZh}
                        starterPrompts={Silian_starterPrompts}
                        onUsePrompt={Silian_handleUsePrompt}
                        onNavigateAudit={Silian_handleNavigateAudit}
                      />
                    ) : (
                      <Silian_ScrollArea className={Silian_cn('h-[34rem]', Silian_PAGE_SCROLLBAR_CLASS)}>
                        <div className="space-y-6 p-5 md:p-6">
                          <Silian_AnimatePresence initial={false}>
                            {Silian_conversationTimeline.map((Silian_item) => (
                              Silian_item?.kind === 'message' ? (
                                <Silian_MessageBubble
                                  key={Silian_item.id}
                                  message={Silian_item}
                                  locale={Silian_locale}
                                  isZh={Silian_isZh}
                                  disabled={Silian_disableProposalActions}
                                  onNavigateSuggestion={Silian_handleNavigateSuggestion}
                                  onConfirmProposal={(Silian_proposalId) => Silian_normalizedSelectedConversationId && Silian_decisionMutation.mutate({
                                    proposalId: Silian_proposalId,
                                    outcome: 'confirm',
                                    conversationId: Silian_normalizedSelectedConversationId,
                                  })}
                                  onRejectProposal={(Silian_proposalId) => Silian_normalizedSelectedConversationId && Silian_decisionMutation.mutate({
                                    proposalId: Silian_proposalId,
                                    outcome: 'reject',
                                    conversationId: Silian_normalizedSelectedConversationId,
                                  })}
                                />
                              ) : (
                                <Silian_EventTimelineRow
                                  key={Silian_item.id}
                                  item={Silian_item}
                                  locale={Silian_locale}
                                  isZh={Silian_isZh}
                                  disabled={Silian_disableProposalActions}
                                  onConfirmProposal={(Silian_proposalId) => Silian_normalizedSelectedConversationId && Silian_decisionMutation.mutate({
                                    proposalId: Silian_proposalId,
                                    outcome: 'confirm',
                                    conversationId: Silian_normalizedSelectedConversationId,
                                  })}
                                  onRejectProposal={(Silian_proposalId) => Silian_normalizedSelectedConversationId && Silian_decisionMutation.mutate({
                                    proposalId: Silian_proposalId,
                                    outcome: 'reject',
                                    conversationId: Silian_normalizedSelectedConversationId,
                                  })}
                                />
                              )
                            ))}
                          </Silian_AnimatePresence>
                        </div>
                      </Silian_ScrollArea>
                    )}
                  </div>

                  <div className={`border-t bg-slate-50/80 px-5 py-5 dark:bg-black/20 ${Silian_PANEL_DIVIDER_CLASS}`}>
                    <div className={Silian_cn(`mb-3 flex flex-wrap items-center justify-between gap-3 text-xs ${Silian_TEXT_SECONDARY_CLASS}`)}>
                      <span>
                        {Silian_isZh
                          ? '写清目标、对象、时间范围；Ctrl/Cmd + Enter 发送。'
                          : 'State the objective, subject, and time scope; press Ctrl/Cmd + Enter to send.'}
                      </span>
                      {Silian_busyLabel ? (
                        <span className={Silian_cn(`inline-flex items-center gap-2 ${Silian_TEXT_SECONDARY_CLASS}`)}>
                          <Silian_Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {Silian_busyLabel}
                        </span>
                      ) : null}
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
                      <Silian_Textarea
                        ref={Silian_composerRef}
                        value={Silian_draft}
                        onChange={(Silian_event) => Silian_setDraft(Silian_event.target.value)}
                        onKeyDown={Silian_handleComposerKeyDown}
                        placeholder={Silian_assistant.chat_enabled === false
                          ? (Silian_isZh ? '模型未启用，暂不可发送。' : 'Model access is disabled.')
                          : (Silian_isZh ? '例如：汇总最近 7 天待处理事项，并按优先级给出建议。' : 'Example: Summarize unresolved items from the last 7 days and rank the next actions.')}
                        disabled={Silian_assistant.chat_enabled === false}
                        className={Silian_cn(Silian_INPUT_SHELL_CLASS, 'min-h-[146px] rounded-[28px] px-5 py-4 text-sm')}
                      />
                      <Silian_Button
                        className="h-auto rounded-[28px] bg-emerald-500 text-base text-black hover:bg-emerald-400"
                        disabled={!Silian_canSend}
                        onClick={Silian_handleSend}
                      >
                        {Silian_sendMutation.isLoading ? <Silian_Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Silian_Sparkles className="mr-2 h-4 w-4" />}
                        {Silian_isZh ? '发送任务' : 'Send task'}
                      </Silian_Button>
                    </div>
                  </div>
                </div>
              </Silian_Panel>

              <div className={Silian_cn(Silian_PANEL_SHELL_CLASS, 'p-4 md:p-5')}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div className="min-w-0">
                      <div className={Silian_cn(`text-sm font-semibold ${Silian_TEXT_PRIMARY_CLASS}`)}>
                        {Silian_isZh ? '二级工作区' : 'Secondary workspace'}
                      </div>
                      <div className={Silian_cn(`mt-1 text-xs leading-5 ${Silian_TEXT_SECONDARY_CLASS}`)}>
                        {Silian_currentSection?.description || (Silian_isZh ? '把补充信息收进切换面板，主会话只保留真正的工作流。' : 'Keep supporting controls behind a switcher so the main workspace stays readable.')}
                      </div>
                    </div>
                    <div className={Silian_cn(`text-xs ${Silian_TEXT_TERTIARY_CLASS}`)}>
                      {Silian_isZh ? '不再把检查器、工具和导航摊成第三列。' : 'Inspector, tools, and routes no longer fight as a third column.'}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {Silian_secondarySections.map((Silian_section) => (
                      <Silian_WorkspaceSectionButton
                        key={Silian_section.id}
                        active={Silian_workspaceSection === Silian_section.id}
                        icon={Silian_section.icon}
                        label={Silian_section.label}
                        count={Silian_section.count}
                        onClick={() => Silian_setWorkspaceSection(Silian_section.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <Silian_AnimatePresence mode="wait" initial={false}>
                <Silian_MotionDiv
                  key={Silian_workspaceSection}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-5"
                >
                  {Silian_workspaceSection === 'actions' ? (
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                      <Silian_Panel
                        title={Silian_isZh ? '待确认动作' : 'Pending actions'}
                        description={Silian_isZh ? '所有写入类提案都先落在这里。' : 'Write proposals surface here before execution.'}
                      >
                        <div className="space-y-3">
                          {Silian_pendingActions.length > 0 ? Silian_pendingActions.map((Silian_action) => (
                            <Silian_PendingActionTile
                              key={Silian_action.proposal_id}
                              action={Silian_action}
                              disabled={Silian_disableProposalActions}
                              isZh={Silian_isZh}
                              onConfirm={(Silian_proposalId) => Silian_normalizedSelectedConversationId && Silian_decisionMutation.mutate({
                                proposalId: Silian_proposalId,
                                outcome: 'confirm',
                                conversationId: Silian_normalizedSelectedConversationId,
                              })}
                              onReject={(Silian_proposalId) => Silian_normalizedSelectedConversationId && Silian_decisionMutation.mutate({
                                proposalId: Silian_proposalId,
                                outcome: 'reject',
                                conversationId: Silian_normalizedSelectedConversationId,
                              })}
                            />
                          )) : (
                            <div className="rounded-[22px] border border-dashed border-slate-300/80 px-4 py-6 text-sm leading-6 text-slate-500 dark:border-white/10 dark:text-slate-400">
                              {Silian_isZh ? '当前会话没有挂起动作。' : 'No pending actions in this session.'}
                            </div>
                          )}
                        </div>
                      </Silian_Panel>

                      <Silian_Panel
                        title={Silian_isZh ? '下一步衔接' : 'Next-step handoff'}
                        description={Silian_isZh ? '把刚查出的结果直接改写成下一步动作，避免重新描述上下文。' : 'Turn the current read result into the next action without restating context.'}
                      >
                        <div className="space-y-3">
                          {Silian_resultFollowUps.length > 0 ? Silian_resultFollowUps.map((Silian_item) => (
                            <Silian_QuickLaunchButton
                              key={Silian_item.id}
                              label={Silian_item.label}
                              description={Silian_item.description}
                              onClick={() => Silian_handleUsePrompt(Silian_item.prompt)}
                            />
                          )) : (
                            <div className="rounded-[22px] border border-dashed border-slate-300/80 px-4 py-6 text-sm leading-6 text-slate-500 dark:border-white/10 dark:text-slate-400">
                              {Silian_isZh ? '当前结果还没有可直接续接的动作建议。' : 'The current result does not expose follow-up actions yet.'}
                            </div>
                          )}
                        </div>
                      </Silian_Panel>
                    </div>
                  ) : null}

                  {Silian_workspaceSection === 'shortcuts' ? (
                    <div className="grid gap-5 xl:grid-cols-2">
                      <Silian_Panel
                        title={Silian_isZh ? '快速切入' : 'Launchpad'}
                        description={Silian_isZh ? '直接跳到高频任务页，不必先问 AI。' : 'Jump to common admin surfaces without going through chat first.'}
                      >
                        <div className="space-y-3">
                          {Silian_localizedSpotlightRoutes.length > 0 ? Silian_localizedSpotlightRoutes.map((Silian_action) => (
                            <Silian_QuickLaunchButton
                              key={Silian_action.id}
                              label={Silian_action.label}
                              description={Silian_action.description}
                              onClick={() => Silian_handleRunQuickAction(Silian_action)}
                            />
                          )) : (
                            <div className="rounded-[22px] border border-dashed border-slate-300/80 px-4 py-6 text-sm leading-6 text-slate-500 dark:border-white/10 dark:text-slate-400">
                              {Silian_isZh ? '当前没有可展示的快捷入口。' : 'No quick actions available.'}
                            </div>
                          )}
                        </div>
                      </Silian_Panel>

                      <Silian_Panel
                        title={Silian_isZh ? '导航跳板' : 'Route bridge'}
                        description={Silian_isZh ? '直接跳转到其他后台页进行人工处理。' : 'Jump into another admin surface for manual follow-up.'}
                      >
                        <div className="space-y-3">
                          {Silian_localizedSideRoutes.map((Silian_target) => (
                            <Silian_QuickLaunchButton
                              key={Silian_target.id}
                              label={Silian_target.label}
                              description={Silian_target.description}
                              onClick={() => Silian_navigate(Silian_target.route)}
                            />
                          ))}
                        </div>
                      </Silian_Panel>
                    </div>
                  ) : null}

                  {Silian_workspaceSection === 'inspector' ? (
                    <Silian_Panel
                      title={Silian_isZh ? '当前会话检查器' : 'Current session inspector'}
                      description={Silian_isZh ? '模型回合、结果快照和操作密度都在这里。' : 'Model turns, result snapshots, and execution density live here.'}
                      action={(
                        <Silian_Button
                          size="sm"
                          variant="outline"
                          className={Silian_OUTLINE_BUTTON_CLASS}
                          onClick={() => Silian_setInspectorOpen((Silian_value) => !Silian_value)}
                        >
                          {Silian_inspectorOpen ? (Silian_isZh ? '收起' : 'Collapse') : (Silian_isZh ? '展开' : 'Expand')}
                        </Silian_Button>
                      )}
                    >
                      {Silian_inspectorOpen ? (
                        <>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <Silian_MetricTile
                              label={Silian_isZh ? '消息' : 'Messages'}
                              value={Silian_currentSummary.message_count || 0}
                              hint={Silian_getConversationStatusLabel(Silian_currentSummary.status, Silian_isZh)}
                            />
                            <Silian_MetricTile
                              label="LLM"
                              value={Silian_currentSummary.llm_calls || 0}
                              hint={Silian_currentSummary.last_model || (Silian_isZh ? '暂无模型信息' : 'No model info')}
                            />
                            <Silian_MetricTile
                              label={Silian_isZh ? '令牌' : 'Tokens'}
                              value={Silian_formatCompactNumber(Silian_currentSummary.total_tokens || 0)}
                              hint={Silian_pendingActions.length > 0
                                ? `${Silian_pendingActions.length} ${Silian_isZh ? '个待确认动作' : 'pending actions'}`
                                : (Silian_isZh ? '无挂起动作' : 'No pending action')}
                            />
                          </div>

                          {Silian_latestAssistantResult ? (
                            <div className="mt-4">
                              <Silian_ResultSnapshot title={Silian_isZh ? '最新结果快照' : 'Latest result snapshot'} value={Silian_latestAssistantResult} isZh={Silian_isZh} />
                            </div>
                          ) : null}

                          <div className="mt-4 space-y-3">
                            {(Silian_llmCalls.length > 0 ? Silian_llmCalls.slice(-3).reverse() : []).map((Silian_item) => (
                              <Silian_LlmCallCard key={Silian_item.id} item={Silian_item} locale={Silian_locale} isZh={Silian_isZh} />
                            ))}
                            {Silian_llmCalls.length === 0 ? (
                              <div className="rounded-[22px] border border-dashed border-slate-300/80 px-4 py-6 text-sm leading-6 text-slate-500 dark:border-white/10 dark:text-slate-400">
                                {Silian_isZh ? '这条会话还没有模型回合。' : 'No model turns recorded for this session yet.'}
                              </div>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <div className="rounded-[22px] border border-dashed border-slate-300/80 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-black/20">
                          <div className={Silian_cn(`text-sm font-medium ${Silian_TEXT_PRIMARY_CLASS}`)}>{Silian_inspectorSummary.title}</div>
                          <div className={Silian_cn(`mt-2 text-xs leading-6 ${Silian_TEXT_SECONDARY_CLASS}`)}>{Silian_inspectorSummary.detail}</div>
                        </div>
                      )}
                    </Silian_Panel>
                  ) : null}

                  {Silian_workspaceSection === 'capabilities' ? (
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                      <Silian_Panel
                        title={Silian_isZh ? '能力边界' : 'Capability guardrails'}
                        description={Silian_isZh ? '当前工作台理解并可调用的管理动作。' : 'Management actions currently exposed to the workspace.'}
                      >
                        <div className="space-y-3">
                          {Silian_capabilityPreview.length > 0 ? Silian_capabilityPreview.map((Silian_action) => (
                            <Silian_CapabilityTile key={Silian_action.name} action={Silian_action} isZh={Silian_isZh} />
                          )) : (
                            <div className="rounded-[22px] border border-dashed border-slate-300/80 px-4 py-6 text-sm leading-6 text-slate-500 dark:border-white/10 dark:text-slate-400">
                              {Silian_isZh ? '没有可显示的能力目录。' : 'No capability catalog available.'}
                            </div>
                          )}
                        </div>
                      </Silian_Panel>

                      <Silian_Panel
                        title={Silian_isZh ? '任务模板' : 'Task templates'}
                        description={Silian_isZh ? '把常见管理动作改写成更容易触发工具调用的指令。' : 'Reuse operational prompts that are more likely to trigger the right tool path.'}
                      >
                        <div className="space-y-3">
                          {Silian_taskTemplates.slice(0, 5).map((Silian_item) => (
                            <Silian_PromptButton key={Silian_item.name} label={Silian_item.localizedLabel || Silian_item.label} prompt={Silian_item.prompt} onUse={Silian_handleUsePrompt} />
                          ))}
                        </div>
                      </Silian_Panel>
                    </div>
                  ) : null}
                </Silian_MotionDiv>
              </Silian_AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
