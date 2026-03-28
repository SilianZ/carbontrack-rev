import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowUpRight,
  Bot,
  ChevronRight,
  Clock3,
  Command,
  Cpu,
  ExternalLink,
  Filter,
  History,
  Loader2,
  Search,
  ShieldCheck,
  TerminalSquare,
  MessageSquare,
  Plus,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

import { adminAPI } from '../../lib/api';
import { userManager } from '../../lib/auth';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/Alert';

const COMMAND_MIN_LENGTH = 2;

function buildRouteWithQuery(route, query = {}) {
  if (!route) return null;

  const entries = Object.entries(query || {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (entries.length === 0) return route;

  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    params.set(key, String(value));
  }

  return `${route}?${params.toString()}`;
}

function hasRenderableMessages(conversation) {
  return Array.isArray(conversation?.messages) && conversation.messages.some((item) => item?.kind === 'message');
}

function buildFallbackConversation(conversation, conversationId, previousConversation, userMessage, assistantMessage) {
  if (hasRenderableMessages(conversation)) {
    return conversation;
  }

  const previousMessages = Array.isArray(previousConversation?.messages)
    ? previousConversation.messages.filter((item) => item?.kind === 'message')
    : [];
  const nextMessages = [...previousMessages];

  if (userMessage) {
    nextMessages.push({
      id: `local-user-${conversationId || 'new'}-${nextMessages.length}`,
      kind: 'message',
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
      meta: { data: { source: 'client_fallback' } },
    });
  }

  if (assistantMessage) {
    nextMessages.push({
      id: `local-assistant-${conversationId || 'new'}-${nextMessages.length}`,
      kind: 'message',
      role: 'assistant',
      content: assistantMessage,
      created_at: new Date().toISOString(),
      meta: { data: { source: 'client_fallback' } },
    });
  }

  if (nextMessages.length === 0) {
    return conversation;
  }

  return {
    ...(previousConversation || {}),
    ...(conversation || {}),
    conversation_id: conversation?.conversation_id || conversationId || previousConversation?.conversation_id || null,
    messages: nextMessages,
    summary: {
      ...(previousConversation?.summary || {}),
      ...(conversation?.summary || {}),
      message_count: nextMessages.length,
      last_activity_at: new Date().toISOString(),
    },
  };
}

function formatAbsoluteTime(value, locale = 'zh-CN') {
  if (!value) return '--';

  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function formatRelativeTime(value, locale = 'zh-CN', isZh = true) {
  if (!value) return isZh ? '刚刚' : 'just now';

  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return formatAbsoluteTime(value, locale);
  }

  const diffSeconds = Math.round((time - Date.now()) / 1000);
  const absSeconds = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (absSeconds < 60) return rtf.format(diffSeconds, 'second');
  if (absSeconds < 3600) return rtf.format(Math.round(diffSeconds / 60), 'minute');
  if (absSeconds < 86400) return rtf.format(Math.round(diffSeconds / 3600), 'hour');
  if (absSeconds < 2592000) return rtf.format(Math.round(diffSeconds / 86400), 'day');
  return rtf.format(Math.round(diffSeconds / 2592000), 'month');
}

function formatCompactNumber(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return '--';
  if (numeric >= 1000000) return `${(numeric / 1000000).toFixed(1)}M`;
  if (numeric >= 1000) return `${(numeric / 1000).toFixed(1)}k`;
  return String(Math.round(numeric));
}

function formatLatency(value, isZh) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return isZh ? '未记录' : 'Not recorded';
  }

  if (numeric >= 1000) {
    return `${(numeric / 1000).toFixed(2)}s`;
  }

  return `${Math.round(numeric)}ms`;
}

function stringifyValue(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function prettifyActionName(value) {
  if (!value || typeof value !== 'string') return null;
  return value
    .replace(/^admin_ai_/, '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getLocalizedActionLabel(action, isZh) {
  const name = action?.name || action?.action_name;
  const label = action?.label;
  if (!isZh) return label || prettifyActionName(name) || 'Admin action';

  const map = {
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

  return map[name] || label || prettifyActionName(name) || '后台动作';
}

function summarizeObject(value, isZh) {
  if (!value || typeof value !== 'object') {
    return isZh ? '没有附带结构化数据。' : 'No structured data attached.';
  }

  const entries = Object.entries(value)
    .filter(([, item]) => item !== null && item !== '' && item !== false)
    .slice(0, 4)
    .map(([key, item]) => {
      if (Array.isArray(item)) {
        return `${key}: ${item.slice(0, 3).join(', ')}${item.length > 3 ? '…' : ''}`;
      }
      if (typeof item === 'object') {
        return `${key}: ${Object.keys(item).slice(0, 3).join(', ') || '{}'}`;
      }
      return `${key}: ${String(item)}`;
    });

  if (entries.length === 0) {
    return isZh ? '没有附带结构化数据。' : 'No structured data attached.';
  }

  return entries.join(' | ');
}

function buildEventCopy(item, isZh) {
  const metaData = item?.meta?.data || {};
  const actionName = metaData.action_name || metaData.tool_name || item?.proposal?.action_name || item?.action || null;
  const actionLabel = metaData.label || item?.proposal?.label || prettifyActionName(actionName) || (isZh ? '后台动作' : 'Admin action');
  const status = item?.status || '';

  if (item?.kind === 'tool') {
    return {
      title: isZh ? `调用工具：${actionLabel}` : `Tool call: ${actionLabel}`,
      description: metaData.summary || summarizeObject(metaData.request_payload || metaData.payload || metaData, isZh),
      tone: 'tool',
    };
  }

  if (item?.kind === 'action_proposed') {
    return {
      title: isZh ? `待确认：${actionLabel}` : `Pending: ${actionLabel}`,
      description: item?.proposal?.summary || metaData.summary || summarizeObject(item?.proposal?.payload || metaData.payload || metaData, isZh),
      tone: 'proposal',
    };
  }

  if (item?.kind === 'action_event') {
    if (status === 'failed') {
      return {
        title: isZh ? `执行失败：${actionLabel}` : `Failed: ${actionLabel}`,
        description: summarizeObject(metaData.new_data || metaData.result || metaData.request_payload || metaData.payload || metaData, isZh),
        tone: 'failed',
      };
    }

    if ((item?.action || '').endsWith('_rejected')) {
      return {
        title: isZh ? `已驳回：${actionLabel}` : `Rejected: ${actionLabel}`,
        description: summarizeObject(metaData.request_payload || metaData.payload || metaData, isZh),
        tone: 'muted',
      };
    }

    if ((item?.action || '').endsWith('_confirmed')) {
      return {
        title: isZh ? `已确认：${actionLabel}` : `Confirmed: ${actionLabel}`,
        description: summarizeObject(metaData.request_payload || metaData.payload || metaData, isZh),
        tone: 'success',
      };
    }

    if ((item?.action || '').endsWith('_executed')) {
      return {
        title: isZh ? `已执行：${actionLabel}` : `Executed: ${actionLabel}`,
        description: summarizeObject(metaData.new_data || metaData.result || metaData, isZh),
        tone: 'success',
      };
    }
  }

  return {
    title: actionLabel,
    description: item?.content || summarizeObject(metaData, isZh),
    tone: 'muted',
  };
}

function getConversationStatusLabel(status, isZh) {
  switch (status) {
    case 'waiting_confirmation':
      return isZh ? '待确认' : 'Awaiting confirmation';
    case 'completed':
      return isZh ? '已完成' : 'Completed';
    case 'active':
      return isZh ? '进行中' : 'Active';
    default:
      return isZh ? '会话' : 'Session';
  }
}

function Panel({ title, description, action, className, bodyClassName, children }) {
  return (
    <div className={cn(
      'overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl',
      className
    )}>
      {(title || description || action) ? (
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-4">
          <div className="min-w-0 flex-1">
            {title ? <div className="break-words text-sm font-semibold text-white">{title}</div> : null}
            {description ? <div className="mt-1 break-words text-xs leading-5 text-slate-400">{description}</div> : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </div>
  );
}

function StatusChip({ tone = 'neutral', children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium',
        tone === 'success' && 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
        tone === 'warning' && 'border-amber-400/20 bg-amber-400/10 text-amber-100',
        tone === 'neutral' && 'border-white/12 bg-white/[0.05] text-slate-200'
      )}
    >
      {children}
    </span>
  );
}

function MetricTile({ label, value, hint }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
      {hint ? <div className="mt-2 text-xs text-slate-400">{hint}</div> : null}
    </div>
  );
}

function ConversationRow({ item, active, locale, isZh, onSelect }) {
  const status = item?.status;
  const pendingCount = Number(item?.pending_action_count || 0);
  const messageCount = Number(item?.message_count || 0);
  const llmCalls = Number(item?.llm_calls || 0);

  return (
    <button
      type="button"
      onClick={() => onSelect(item.conversation_id)}
      className={cn(
        'w-full rounded-[22px] border px-4 py-4 text-left transition-all',
        active
          ? 'border-emerald-400/35 bg-emerald-400/[0.12] shadow-[0_18px_45px_rgba(16,185,129,0.14)]'
          : 'border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">
            {item.title || (isZh ? '未命名会话' : 'Untitled session')}
          </div>
          <div className="mt-1 line-clamp-2 break-all text-xs leading-5 text-slate-400">
            {item.last_message_preview || (isZh ? '尚无摘要。' : 'No summary yet.')}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-medium text-slate-300">
            {pendingCount > 0
              ? `${pendingCount} ${isZh ? '待确认' : 'pending'}`
              : `${messageCount} ${isZh ? '条' : 'msgs'}`}
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
            {getConversationStatusLabel(status, isZh)}
          </span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="h-3 w-3" />
          {formatRelativeTime(item.last_activity_at, locale, isZh)}
        </span>
        <span>{formatAbsoluteTime(item.last_activity_at, locale)}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
        <span className="rounded-full border border-white/8 bg-black/20 px-2 py-1">
          {llmCalls} LLM
        </span>
        <span className="rounded-full border border-white/8 bg-black/20 px-2 py-1">
          {formatCompactNumber(item?.total_tokens || 0)} tok
        </span>
        {item?.last_model ? (
          <span className="truncate rounded-full border border-white/8 bg-black/20 px-2 py-1">
            {item.last_model}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function QuickLaunchButton({ label, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4 text-left transition-all hover:border-white/16 hover:bg-white/[0.06]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-white">{label}</div>
          {description ? <div className="mt-1 text-xs leading-5 text-slate-400">{description}</div> : null}
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-200" />
      </div>
    </button>
  );
}

function PromptButton({ label, prompt, onUse }) {
  return (
    <button
      type="button"
      onClick={() => onUse(prompt)}
      className="group rounded-[22px] border border-white/8 bg-black/20 p-4 text-left transition-all hover:border-emerald-400/25 hover:bg-emerald-400/[0.08]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-white">{label}</div>
          <div className="mt-2 text-xs leading-5 text-slate-400">{prompt}</div>
        </div>
        <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-emerald-200" />
      </div>
    </button>
  );
}

function RiskBadge({ action, isZh }) {
  if (action?.requires_confirmation) {
    return <Badge className="border-0 bg-amber-400/15 text-amber-100">{isZh ? '需确认' : 'Confirm required'}</Badge>;
  }

  if (action?.risk_level === 'write') {
    return <Badge className="border-0 bg-rose-400/15 text-rose-100">{isZh ? '写入' : 'Write'}</Badge>;
  }

  if (action?.risk_level === 'read') {
    return <Badge className="border-0 bg-sky-400/15 text-sky-100">{isZh ? '读取' : 'Read'}</Badge>;
  }

  return <Badge className="border-0 bg-white/10 text-slate-200">{isZh ? '待定' : 'Pending'}</Badge>;
}

function PendingActionTile({ action, disabled, isZh, onConfirm, onReject }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">
            {action.label || action.action_name || `${isZh ? '提案' : 'Proposal'} #${action.proposal_id}`}
          </div>
          <div className="mt-2 text-xs leading-5 text-slate-400">
            {action.summary || (isZh ? '系统已生成一条待确认操作。' : 'A pending action is ready for review.')}
          </div>
        </div>
        <RiskBadge action={action} isZh={isZh} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={disabled}
          className="rounded-full bg-emerald-500 text-black hover:bg-emerald-400"
          onClick={() => onConfirm(action.proposal_id)}
        >
          {isZh ? '确认执行' : 'Confirm'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          className="rounded-full border-white/15 bg-transparent text-white hover:bg-white/8"
          onClick={() => onReject(action.proposal_id)}
        >
          {isZh ? '驳回' : 'Reject'}
        </Button>
      </div>
    </div>
  );
}

function CapabilityTile({ action, isZh }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-white/[0.02] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-white">{getLocalizedActionLabel(action, isZh)}</div>
          <div className="mt-1 text-xs leading-5 text-slate-400">{action.description}</div>
        </div>
        <RiskBadge action={action} isZh={isZh} />
      </div>
      {Array.isArray(action.requirements) && action.requirements.length > 0 ? (
        <div className="mt-3 text-[11px] leading-5 text-slate-500">
          {isZh ? '所需字段' : 'Required fields'}: {action.requirements.join(', ')}
        </div>
      ) : null}
    </div>
  );
}

function FilterPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs transition-all',
        active
          ? 'border-emerald-400/30 bg-emerald-400/[0.14] text-emerald-100'
          : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/16 hover:bg-white/[0.05]'
      )}
    >
      {children}
    </button>
  );
}

function JsonPreview({ value, className }) {
  const text = stringifyValue(value);
  if (!text) return null;

  return (
    <pre className={cn('overflow-x-auto whitespace-pre-wrap break-all rounded-[18px] border border-white/8 bg-[#050816] px-3 py-3 text-[11px] leading-5 text-slate-300', className)}>
      {text}
    </pre>
  );
}

function ResultSnapshot({ title, value, isZh }) {
  if (value == null || value === '') return null;

  return (
    <div className="rounded-[20px] border border-white/8 bg-black/20 p-4">
      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{title}</div>
      {typeof value === 'object'
        ? <JsonPreview value={value} className="mt-3" />
        : <div className="mt-3 text-xs leading-6 text-slate-300">{String(value) || (isZh ? '无结果。' : 'No result.')}</div>}
    </div>
  );
}

function EventTimelineRow({ item, locale, isZh, disabled, onConfirmProposal, onRejectProposal }) {
  const event = buildEventCopy(item, isZh);
  const proposal = item?.proposal;
  const metaData = item?.meta?.data || {};
  const payload = proposal?.payload || metaData.request_payload || metaData.payload || null;
  const result = metaData.new_data || metaData.result || null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[24px] border border-white/8 bg-black/20 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-full border',
              event.tone === 'success' && 'border-emerald-400/20 bg-emerald-400/[0.12] text-emerald-200',
              event.tone === 'proposal' && 'border-amber-400/20 bg-amber-400/[0.12] text-amber-100',
              event.tone === 'failed' && 'border-rose-400/20 bg-rose-400/[0.12] text-rose-100',
              event.tone === 'tool' && 'border-sky-400/20 bg-sky-400/[0.12] text-sky-100',
              event.tone === 'muted' && 'border-white/10 bg-white/[0.04] text-slate-300'
            )}>
              {item?.kind === 'tool'
                ? <TerminalSquare className="h-4 w-4" />
                : item?.kind === 'action_proposed'
                  ? <ShieldAlert className="h-4 w-4" />
                  : <ShieldCheck className="h-4 w-4" />}
            </span>
            <div className="text-sm font-medium text-white">{event.title}</div>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
              {item?.kind || (isZh ? '事件' : 'Event')}
            </span>
          </div>
          <div className="mt-2 text-xs leading-6 text-slate-400">{event.description}</div>
        </div>
        <div className="shrink-0 text-[11px] text-slate-500">{formatAbsoluteTime(item?.created_at, locale)}</div>
      </div>

      {payload ? <JsonPreview value={payload} className="mt-4" /> : null}
      {result ? <JsonPreview value={result} className="mt-3" /> : null}

      {proposal?.proposal_id && proposal?.status === 'pending' ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={disabled}
            className="rounded-full bg-emerald-500 text-black hover:bg-emerald-400"
            onClick={() => onConfirmProposal(proposal.proposal_id)}
          >
            {isZh ? '确认执行' : 'Confirm'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            className="rounded-full border-white/15 bg-transparent text-white hover:bg-white/8"
            onClick={() => onRejectProposal(proposal.proposal_id)}
          >
            {isZh ? '驳回' : 'Reject'}
          </Button>
        </div>
      ) : null}
    </motion.div>
  );
}

function LlmCallCard({ item, locale, isZh }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <Cpu className="h-4 w-4 text-sky-200" />
            {isZh ? `模型回合 #${item.turn_no || '--'}` : `Model turn #${item.turn_no || '--'}`}
          </div>
          <div className="mt-1 text-xs leading-5 text-slate-400">{item.model || '--'}</div>
        </div>
        <span className={cn(
          'rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]',
          item.status === 'success'
            ? 'border-emerald-400/20 bg-emerald-400/[0.12] text-emerald-100'
            : 'border-rose-400/20 bg-rose-400/[0.12] text-rose-100'
        )}>
          {item.status || 'unknown'}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[18px] border border-white/6 bg-black/20 px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{isZh ? 'Tokens' : 'Tokens'}</div>
          <div className="mt-2 text-lg font-semibold text-white">{formatCompactNumber(item.total_tokens)}</div>
        </div>
        <div className="rounded-[18px] border border-white/6 bg-black/20 px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{isZh ? '延迟' : 'Latency'}</div>
          <div className="mt-2 text-lg font-semibold text-white">{formatLatency(item.latency_ms, isZh)}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-500">
        <span>{formatAbsoluteTime(item.created_at, locale)}</span>
        <span className="truncate font-mono">{item.request_id || '--'}</span>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  locale,
  isZh,
  disabled,
  onNavigateSuggestion,
  onConfirmProposal,
  onRejectProposal,
}) {
  const isUser = message?.role === 'user';
  const suggestion = message?.meta?.data?.suggestion;
  const proposal = message?.proposal || message?.meta?.data?.proposal;
  const result = message?.meta?.data?.result;
  const actionName = message?.meta?.data?.meta?.action_name || null;
  const missing = Array.isArray(message?.meta?.data?.meta?.missing) ? message.meta.data.meta.missing : [];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex flex-col gap-3', isUser ? 'items-end' : 'items-start')}
    >
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-500">
        <span className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-full border',
          isUser ? 'border-white/10 bg-white/[0.05] text-white' : 'border-emerald-400/18 bg-emerald-400/[0.12] text-emerald-200'
        )}>
          {isUser ? <MessageSquare className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </span>
        <span>{isUser ? (isZh ? '管理员' : 'Admin') : 'CarbonTrack AI'}</span>
        {message?.created_at ? <span className="normal-case tracking-normal">{formatAbsoluteTime(message.created_at, locale)}</span> : null}
      </div>

      <div className={cn(
        'max-w-[min(100%,48rem)] break-words rounded-[26px] border px-5 py-4 text-sm leading-7 shadow-[0_12px_30px_rgba(0,0,0,0.22)]',
        isUser
          ? 'rounded-tr-lg border-white/12 bg-white/[0.08] text-white'
          : 'rounded-tl-lg border-emerald-400/14 bg-emerald-400/[0.08] text-slate-100'
      )}>
        {message?.content || (isZh ? 'AI 未返回文本。' : 'No assistant text returned.')}
      </div>

      {!isUser && (actionName || result || missing.length > 0) ? (
        <div className="grid w-full max-w-[min(100%,48rem)] gap-3">
          {actionName ? (
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/[0.12] px-3 py-1.5 text-xs text-sky-100">
              <Activity className="h-3.5 w-3.5" />
              {prettifyActionName(actionName) || actionName}
            </div>
          ) : null}
          {missing.length > 0 ? (
            <div className="rounded-[20px] border border-amber-400/18 bg-amber-400/[0.10] px-4 py-3 text-xs leading-6 text-amber-50">
              {isZh ? '缺少字段：' : 'Missing fields: '}
              {missing.map((item) => item.field).join(', ')}
            </div>
          ) : null}
          {result ? <ResultSnapshot title={isZh ? '结果快照' : 'Result snapshot'} value={result} isZh={isZh} /> : null}
        </div>
      ) : null}

      {suggestion?.route ? (
        <button
          type="button"
          onClick={() => onNavigateSuggestion(suggestion)}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200 transition-all hover:border-white/16 hover:bg-white/[0.08]"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {suggestion.label || (isZh ? '打开建议页面' : 'Open suggestion')}
        </button>
      ) : null}

      {proposal?.proposal_id && proposal?.status === 'pending' ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={disabled}
            className="rounded-full bg-emerald-500 text-black hover:bg-emerald-400"
            onClick={() => onConfirmProposal(proposal.proposal_id)}
          >
            {isZh ? '确认执行' : 'Confirm'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            className="rounded-full border-white/15 bg-transparent text-white hover:bg-white/8"
            onClick={() => onRejectProposal(proposal.proposal_id)}
          >
            {isZh ? '驳回' : 'Reject'}
          </Button>
        </div>
      ) : null}
    </motion.div>
  );
}

function EmptyConversationState({ isZh, starterPrompts, onUsePrompt, onNavigateAudit }) {
  return (
    <div className="flex h-full items-center justify-center p-6 md:p-8">
      <div className="w-full max-w-4xl">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] border border-emerald-400/18 bg-emerald-400/[0.12] text-emerald-200">
            <Command className="h-9 w-9" />
          </div>
          <h3 className="mt-6 text-3xl font-semibold tracking-tight text-white">
            {isZh ? '从一个明确任务开始' : 'Start from a clear task'}
          </h3>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            {isZh
              ? '这不是宣传页，也不是摘要墙。直接输入目标、对象与范围，让工作台生成查询、建议或待确认动作。'
              : 'This surface is for action. State the target, subject, and scope, then let the workspace draft queries, suggestions, or confirmation-ready proposals.'}
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {starterPrompts.slice(0, 4).map((item) => (
            <PromptButton key={item.id} label={item.label} prompt={item.prompt} onUse={onUsePrompt} />
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onNavigateAudit}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200 transition-all hover:border-white/16 hover:bg-white/[0.08]"
          >
            <History className="h-4 w-4" />
            {isZh ? '查看会话审计' : 'Open session audit'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminAiWorkspacePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const composerRef = useRef(null);
  const [searchParams] = useSearchParams();

  const currentAdminId = useMemo(() => {
    const user = userManager.getUser();
    return user?.id ?? null;
  }, []);

  const locale = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'zh-CN';
  const isZh = locale.toLowerCase().startsWith('zh');

  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [draft, setDraft] = useState('');
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [conversationSearch, setConversationSearch] = useState('');
  const [conversationFilter, setConversationFilter] = useState('all');

  const aiContext = useMemo(() => ({
    activeRoute: '/admin/ai',
    locale,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
  }), [locale]);

  const workspaceQuery = useQuery(
    ['adminAiWorkspace'],
    async () => {
      const response = await adminAPI.getAiWorkspace();
      return response.data?.data || response.data;
    }
  );

  const conversationsQuery = useQuery(
    ['adminAiConversations', currentAdminId],
    async () => {
      const response = await adminAPI.getAiConversations({
        limit: 24,
        admin_id: currentAdminId || undefined,
      });
      return response.data?.data || [];
    },
    { keepPreviousData: true }
  );

  const conversationItems = useMemo(() => {
    if (Array.isArray(conversationsQuery.data) && conversationsQuery.data.length > 0) {
      return conversationsQuery.data;
    }

    return Array.isArray(workspaceQuery.data?.recent_conversations) ? workspaceQuery.data.recent_conversations : [];
  }, [conversationsQuery.data, workspaceQuery.data?.recent_conversations]);

  const filteredConversationItems = useMemo(() => {
    const keyword = conversationSearch.trim().toLowerCase();

    return conversationItems.filter((item) => {
      if (conversationFilter === 'pending' && Number(item?.pending_action_count || 0) <= 0) {
        return false;
      }

      if (conversationFilter === 'active' && Number(item?.pending_action_count || 0) > 0) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const haystack = [
        item?.title,
        item?.last_message_preview,
        item?.conversation_id,
        item?.last_model,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [conversationFilter, conversationItems, conversationSearch]);

  useEffect(() => {
    if (!selectedConversationId && !isCreatingConversation && filteredConversationItems.length > 0) {
      setSelectedConversationId(filteredConversationItems[0].conversation_id);
    }
  }, [filteredConversationItems, isCreatingConversation, selectedConversationId]);

  useEffect(() => {
    if (isCreatingConversation || !selectedConversationId) {
      return;
    }

    const stillVisible = filteredConversationItems.some((item) => item.conversation_id === selectedConversationId);
    if (!stillVisible && filteredConversationItems.length > 0) {
      setSelectedConversationId(filteredConversationItems[0].conversation_id);
    }
  }, [filteredConversationItems, isCreatingConversation, selectedConversationId]);

  useEffect(() => {
    if (searchParams.get('focus') === 'composer') {
      requestAnimationFrame(() => composerRef.current?.focus());
    }
  }, [searchParams]);

  const conversationDetailQuery = useQuery(
    ['adminAiConversation', selectedConversationId],
    async () => {
      const response = await adminAPI.getAiConversation(selectedConversationId);
      return response.data?.data || response.data;
    },
    {
      enabled: Boolean(selectedConversationId),
    }
  );

  const activeConversation = isCreatingConversation ? null : (conversationDetailQuery.data || null);
  const activeConversationId = activeConversation?.conversation_id == null ? null : String(activeConversation.conversation_id);
  const normalizedSelectedConversationId = selectedConversationId == null ? null : String(selectedConversationId);

  const conversationTimeline = useMemo(
    () => (Array.isArray(activeConversation?.messages) ? activeConversation.messages : []),
    [activeConversation]
  );
  const visibleMessages = useMemo(
    () => conversationTimeline.filter((item) => item?.kind === 'message'),
    [conversationTimeline]
  );
  const pendingActions = useMemo(
    () => (Array.isArray(activeConversation?.pending_actions) ? activeConversation.pending_actions : []),
    [activeConversation]
  );
  const llmCalls = useMemo(
    () => (Array.isArray(activeConversation?.llm_calls) ? activeConversation.llm_calls : []),
    [activeConversation]
  );

  const invalidateWorkspace = useCallback(() => {
    queryClient.invalidateQueries(['adminAiWorkspace']);
    queryClient.invalidateQueries(['adminAiConversations', currentAdminId]);
  }, [currentAdminId, queryClient]);

  const hasStaleConversationDetail = Boolean(normalizedSelectedConversationId)
    && activeConversationId !== normalizedSelectedConversationId;

  const sendMutation = useMutation(
    async ({ message, conversationId }) => adminAPI.chatWithAdminAi({
      conversation_id: conversationId || undefined,
      message,
      context: aiContext,
      source: 'admin:/admin/ai',
    }),
    {
      onSuccess: (response, variables) => {
        const payload = response.data || {};
        const nextConversation = buildFallbackConversation(
          payload.conversation || null,
          payload.conversation_id || variables.conversationId || null,
          activeConversation,
          variables.message,
          payload.message || null
        );
        const nextConversationId = payload.conversation_id || nextConversation?.conversation_id || null;

        if (nextConversationId) {
          queryClient.setQueryData(['adminAiConversation', nextConversationId], nextConversation);
          setSelectedConversationId(nextConversationId);
        }

        setIsCreatingConversation(false);
        setDraft('');
        invalidateWorkspace();
      },
      onError: (error) => {
        toast.error(error?.response?.data?.error || (isZh ? 'AI 请求失败，请稍后重试。' : 'AI request failed. Please try again.'));
      },
    }
  );

  const decisionMutation = useMutation(
    async ({ proposalId, outcome, conversationId }) => adminAPI.chatWithAdminAi({
      conversation_id: conversationId,
      context: aiContext,
      decision: {
        proposal_id: proposalId,
        outcome,
      },
      source: 'admin:/admin/ai',
    }),
    {
      onSuccess: (response, variables) => {
        const payload = response.data || {};
        const previousConversation = variables?.conversationId
          ? queryClient.getQueryData(['adminAiConversation', variables.conversationId])
          : null;
        const nextConversation = buildFallbackConversation(
          payload.conversation || null,
          payload.conversation_id || variables?.conversationId || null,
          previousConversation,
          null,
          payload.message || null
        );
        const nextConversationId = payload.conversation_id || variables?.conversationId || null;

        if (nextConversationId) {
          queryClient.setQueryData(['adminAiConversation', nextConversationId], nextConversation);
        }

        invalidateWorkspace();
      },
      onError: (error) => {
        toast.error(error?.response?.data?.error || (isZh ? '操作决策失败。' : 'Decision failed.'));
      },
    }
  );

  const assistant = workspaceQuery.data?.assistant || {};
  const starterPrompts = Array.isArray(workspaceQuery.data?.starter_prompts) ? workspaceQuery.data.starter_prompts : [];
  const quickActions = Array.isArray(workspaceQuery.data?.quick_actions) ? workspaceQuery.data.quick_actions : [];
  const navigationTargets = Array.isArray(workspaceQuery.data?.navigation_targets) ? workspaceQuery.data.navigation_targets : [];
  const managementActions = Array.isArray(workspaceQuery.data?.management_actions) ? workspaceQuery.data.management_actions : [];

  const currentSummary = activeConversation?.summary || conversationItems.find((item) => item.conversation_id === selectedConversationId) || {};
  const selectedConversationTitle = currentSummary.title || (isCreatingConversation ? (isZh ? '新会话' : 'New session') : (isZh ? '控制通道' : 'Control channel'));
  const lastActivityLabel = formatAbsoluteTime(currentSummary.last_activity_at, locale);
  const canSend = draft.trim().length >= COMMAND_MIN_LENGTH && !sendMutation.isLoading && assistant.chat_enabled !== false;
  const canCreateConversation = !sendMutation.isLoading && !decisionMutation.isLoading;
  const disableProposalActions = decisionMutation.isLoading || hasStaleConversationDetail;

  const capabilitySummary = useMemo(() => ({
    readCount: managementActions.filter((item) => item.risk_level === 'read').length,
    writeCount: managementActions.filter((item) => item.risk_level === 'write').length,
    confirmationCount: managementActions.filter((item) => item.requires_confirmation).length,
  }), [managementActions]);

  const spotlightRoutes = useMemo(() => quickActions.slice(0, 4), [quickActions]);
  const sideRoutes = useMemo(() => navigationTargets.filter((item) => item.route !== '/admin/ai').slice(0, 6), [navigationTargets]);
  const capabilityPreview = useMemo(() => managementActions.slice(0, 6), [managementActions]);
  const composerPresets = useMemo(() => starterPrompts.slice(0, 3), [starterPrompts]);
  const taskTemplates = useMemo(
    () => managementActions
      .slice(0, 8)
      .map((action) => ({
        ...action,
        localizedLabel: getLocalizedActionLabel(action, isZh),
        prompt: action.risk_level === 'write'
          ? `${isZh ? '请帮我准备一个待确认操作：' : 'Prepare a confirmation-ready operation for '} ${getLocalizedActionLabel(action, isZh)}${action.requirements?.length ? `；${isZh ? '如缺字段请直接追问：' : 'ask follow-up for: '}${action.requirements.join(', ')}` : ''}`
          : `${isZh ? '请帮我执行查询：' : 'Run this query: '} ${getLocalizedActionLabel(action, isZh)}${action.requirements?.length ? `；${isZh ? '如缺字段请直接追问：' : 'ask follow-up for: '}${action.requirements.join(', ')}` : ''}`,
      })),
    [isZh, managementActions]
  );
  const latestAssistantResult = useMemo(() => {
    const assistantMessages = [...visibleMessages].reverse();
    return assistantMessages.find((item) => item?.meta?.data?.result)?.meta?.data?.result || null;
  }, [visibleMessages]);
  const resultFollowUps = useMemo(() => {
    if (!latestAssistantResult || typeof latestAssistantResult !== 'object') {
      return [];
    }

    if (latestAssistantResult.scope === 'pending_carbon_records' && Array.isArray(latestAssistantResult.items) && latestAssistantResult.items.length > 0) {
      const ids = latestAssistantResult.items.slice(0, 5).map((item) => item.id).filter(Boolean);
      if (ids.length === 0) return [];

      return [
        {
          id: 'approve-pending-result',
          label: isZh ? '基于结果准备批量通过' : 'Prepare approval from result',
          description: isZh ? '把当前结果里的前 5 条待审记录直接组装成待确认通过动作。' : 'Turn the first five pending records into a confirmation-ready approval action.',
          prompt: `请准备一个待确认操作：批量通过这些碳记录，record_ids=${ids.join(', ')}。如果需要 review_note，请先问我。`,
        },
        {
          id: 'reject-pending-result',
          label: isZh ? '基于结果准备批量驳回' : 'Prepare rejection from result',
          description: isZh ? '把当前结果里的前 5 条待审记录直接组装成待确认驳回动作。' : 'Turn the first five pending records into a confirmation-ready rejection action.',
          prompt: `请准备一个待确认操作：批量驳回这些碳记录，record_ids=${ids.join(', ')}。如果需要 review_note，请先问我。`,
        },
      ];
    }

    return [];
  }, [isZh, latestAssistantResult]);

  const handleSelectConversation = useCallback((conversationId) => {
    setIsCreatingConversation(false);
    setSelectedConversationId(conversationId);
  }, []);

  const handleUsePrompt = useCallback((prompt) => {
    setDraft(prompt);
    requestAnimationFrame(() => composerRef.current?.focus());
  }, []);

  const handleStartConversation = useCallback(() => {
    setIsCreatingConversation(true);
    setSelectedConversationId(null);
    queryClient.removeQueries(['adminAiConversation']);
    requestAnimationFrame(() => composerRef.current?.focus());
  }, [queryClient]);

  const handleSend = useCallback(() => {
    const message = draft.trim();
    if (message.length < COMMAND_MIN_LENGTH || sendMutation.isLoading || assistant.chat_enabled === false) {
      return;
    }

    sendMutation.mutate({
      message,
      conversationId: isCreatingConversation ? null : selectedConversationId,
    });
  }, [assistant.chat_enabled, draft, isCreatingConversation, selectedConversationId, sendMutation]);

  const handleComposerKeyDown = useCallback((event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleNavigateSuggestion = useCallback((suggestion) => {
    const fullRoute = buildRouteWithQuery(suggestion?.route, suggestion?.query || {});
    if (!fullRoute) {
      toast.error(isZh ? '缺少可跳转的目标页面。' : 'Missing destination route.');
      return;
    }

    navigate(fullRoute);
  }, [isZh, navigate]);

  const handleRunQuickAction = useCallback((action) => {
    const fullRoute = buildRouteWithQuery(action?.route, action?.query || {});
    if (!fullRoute) {
      toast.error(isZh ? '缺少可跳转的目标页面。' : 'Missing destination route.');
      return;
    }

    navigate(fullRoute);
  }, [isZh, navigate]);

  const handleNavigateAudit = useCallback(() => {
    navigate('/admin/llm-usage');
  }, [navigate]);

  const busyLabel = sendMutation.isLoading
    ? (isZh ? '正在请求模型...' : 'Sending to model...')
    : decisionMutation.isLoading
      ? (isZh ? '正在写回决策...' : 'Applying decision...')
      : conversationDetailQuery.isFetching && !isCreatingConversation
        ? (isZh ? '同步会话中...' : 'Syncing session...')
        : null;

  return (
    <div className="min-w-0 overflow-x-clip pb-4">
      <div className="relative w-full min-w-0 overflow-hidden rounded-[36px] border border-slate-900 bg-[#060816] text-white shadow-[0_30px_90px_rgba(2,6,23,0.48)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_22%),linear-gradient(180deg,rgba(12,16,36,0.96),rgba(5,8,22,1))]" />
        <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:32px_32px]" />

        <div className="relative">
          <div className="border-b border-white/8 px-6 py-6 md:px-8">
            <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1.25fr)_repeat(4,minmax(0,1fr))]">
              <div className="min-w-0 space-y-4 lg:col-span-2 2xl:col-span-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip tone="success">
                    <Bot className="h-3.5 w-3.5" />
                    {isZh ? 'Admin AI' : 'Admin AI'}
                  </StatusChip>
                  <StatusChip tone={assistant.chat_enabled ? 'success' : 'warning'}>
                    {assistant.chat_enabled ? (isZh ? '对话已就绪' : 'Chat ready') : (isZh ? '对话不可用' : 'Chat unavailable')}
                  </StatusChip>
                  <StatusChip tone={assistant.intent_enabled ? 'success' : 'warning'}>
                    {assistant.intent_enabled ? (isZh ? '意图解析在线' : 'Intent online') : (isZh ? '意图解析关闭' : 'Intent offline')}
                  </StatusChip>
                </div>

                <div>
                  <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500">
                    {isZh ? '治理工作面' : 'Operations surface'}
                  </div>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                    {isZh ? '管理 AI 指挥台' : 'Admin AI cockpit'}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
                    {isZh
                      ? '把会话、快捷入口、待确认动作和审计上下文收进同一个操作面。页面不再替你“讲故事”，只帮你处理事情。'
                      : 'Sessions, shortcuts, pending proposals, and audit context now live on one operating surface. No filler dashboard narrative, just working state.'}
                  </p>
                </div>
              </div>

              <MetricTile
                label={isZh ? '读取能力' : 'Read ops'}
                value={capabilitySummary.readCount}
                hint={isZh ? '无副作用查询' : 'Side-effect free queries'}
              />
              <MetricTile
                label={isZh ? '写入能力' : 'Write ops'}
                value={capabilitySummary.writeCount}
                hint={isZh ? '可能改动系统状态' : 'May change system state'}
              />
              <MetricTile
                label={isZh ? '确认动作' : 'Confirmations'}
                value={capabilitySummary.confirmationCount}
                hint={assistant.default_confirmation_policy || (isZh ? '依据系统策略' : 'Policy driven')}
              />
              <MetricTile
                label={isZh ? '历史窗口' : 'History window'}
                value={assistant.max_history_messages || '--'}
                hint={assistant.max_auto_read_steps
                  ? `${assistant.max_auto_read_steps} ${isZh ? '次自动读取' : 'auto reads'}`
                  : (isZh ? '按配置回放' : 'Config controlled')}
              />
            </div>
          </div>

          {assistant.chat_enabled === false ? (
            <div className="px-6 pt-6 md:px-8">
              <Alert className="border-amber-400/20 bg-amber-400/10 text-amber-50">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>{isZh ? 'AI 暂不可用' : 'AI unavailable'}</AlertTitle>
                <AlertDescription>
                  {isZh
                    ? '服务器尚未配置可用的模型密钥。你仍可查看历史会话和能力目录，但无法发送新请求。'
                    : 'The server does not currently expose a live model key. You can still inspect history and capability metadata, but cannot send new prompts.'}
                </AlertDescription>
              </Alert>
            </div>
          ) : null}

          <div className="grid gap-5 px-6 py-6 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,320px)] md:px-8">
            <div className="min-w-0 space-y-5">
              <Panel
                title={isZh ? '会话队列' : 'Session queue'}
                description={isZh ? '切换上下文或直接开新线程。' : 'Switch context or open a fresh thread.'}
                action={(
                  <Button
                    size="sm"
                    disabled={!canCreateConversation}
                    onClick={handleStartConversation}
                    className="rounded-full bg-white text-slate-950 hover:bg-slate-100"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {isZh ? '新会话' : 'New'}
                  </Button>
                )}
                bodyClassName="p-0"
              >
                <div className="border-b border-white/8 px-4 py-4">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      value={conversationSearch}
                      onChange={(event) => setConversationSearch(event.target.value)}
                      placeholder={isZh ? '搜索标题、摘要、模型或会话 ID' : 'Search title, preview, model, or session id'}
                      className="h-11 w-full rounded-[18px] border border-white/10 bg-white/[0.04] pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-500"
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-slate-500" />
                    <FilterPill active={conversationFilter === 'all'} onClick={() => setConversationFilter('all')}>
                      {isZh ? '全部' : 'All'}
                    </FilterPill>
                    <FilterPill active={conversationFilter === 'pending'} onClick={() => setConversationFilter('pending')}>
                      {isZh ? '待确认' : 'Pending'}
                    </FilterPill>
                    <FilterPill active={conversationFilter === 'active'} onClick={() => setConversationFilter('active')}>
                      {isZh ? '进行中' : 'Active'}
                    </FilterPill>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <MetricTile label={isZh ? '会话' : 'Sessions'} value={conversationItems.length} />
                    <MetricTile label="LLM" value={conversationItems.reduce((sum, item) => sum + Number(item?.llm_calls || 0), 0)} />
                    <MetricTile label={isZh ? '待确认' : 'Pending'} value={conversationItems.reduce((sum, item) => sum + Number(item?.pending_action_count || 0), 0)} />
                  </div>
                </div>
                <ScrollArea className="h-[28rem]">
                  <div className="space-y-3 p-4">
                    {isCreatingConversation ? (
                      <div className="rounded-[22px] border border-emerald-400/25 bg-emerald-400/[0.12] px-4 py-4">
                        <div className="text-sm font-semibold text-white">{isZh ? '当前为新会话草稿' : 'Drafting a new session'}</div>
                        <div className="mt-1 text-xs leading-5 text-slate-300">
                          {isZh ? '输入第一条命令后会自动建立线程。' : 'The first prompt will create the thread automatically.'}
                        </div>
                      </div>
                    ) : null}

                    {filteredConversationItems.map((item) => (
                      <ConversationRow
                        key={item.conversation_id}
                        item={item}
                        active={!isCreatingConversation && selectedConversationId === item.conversation_id}
                        locale={locale}
                        isZh={isZh}
                        onSelect={handleSelectConversation}
                      />
                    ))}

                    {filteredConversationItems.length === 0 && !conversationsQuery.isLoading && !workspaceQuery.isLoading ? (
                      <div className="rounded-[22px] border border-dashed border-white/10 px-4 py-8 text-center text-sm leading-6 text-slate-400">
                        {conversationItems.length === 0
                          ? (isZh ? '还没有会话记录。直接开一个新的。' : 'No sessions yet. Start a new one.')
                          : (isZh ? '没有符合当前筛选条件的会话。' : 'No sessions match the current filters.')}
                      </div>
                    ) : null}
                  </div>
                </ScrollArea>
              </Panel>

              <Panel
                title={isZh ? '快速切入' : 'Launchpad'}
                description={isZh ? '直接跳到高频任务页，不必先问 AI。' : 'Jump to common admin surfaces without going through chat first.'}
              >
                <div className="space-y-3">
                  {spotlightRoutes.length > 0 ? spotlightRoutes.map((action) => (
                    <QuickLaunchButton
                      key={action.id}
                      label={action.label}
                      description={action.description}
                      onClick={() => handleRunQuickAction(action)}
                    />
                  )) : (
                    <div className="rounded-[22px] border border-dashed border-white/10 px-4 py-6 text-sm leading-6 text-slate-400">
                      {isZh ? '当前没有可展示的快捷入口。' : 'No quick actions available.'}
                    </div>
                  )}
                </div>
              </Panel>
            </div>

            <div className="min-w-0 space-y-5">
              <Panel
                title={selectedConversationTitle}
                description={isCreatingConversation
                  ? (isZh ? '新线程将在你发送第一条消息时建立。' : 'A new thread will be created when you send the first prompt.')
                  : (isZh ? '当前主工作通道。上下文切换与确认动作都以此会话为准。' : 'Primary work channel. Suggestions and confirmations apply to this session.')}
                action={(
                  <div className="flex flex-wrap items-center gap-2">
                    {currentSummary.message_count ? (
                      <StatusChip>
                        <MessageSquare className="h-3.5 w-3.5" />
                        {currentSummary.message_count} {isZh ? '条消息' : 'messages'}
                      </StatusChip>
                    ) : null}
                    {currentSummary.llm_calls ? (
                      <StatusChip>
                        <Cpu className="h-3.5 w-3.5" />
                        {currentSummary.llm_calls} LLM
                      </StatusChip>
                    ) : null}
                    {currentSummary.total_tokens ? (
                      <StatusChip>
                        {formatCompactNumber(currentSummary.total_tokens)} tok
                      </StatusChip>
                    ) : null}
                    {currentSummary.last_activity_at ? (
                      <StatusChip>
                        <Clock3 className="h-3.5 w-3.5" />
                        {lastActivityLabel}
                      </StatusChip>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full border-white/15 bg-transparent text-white hover:bg-white/8"
                      onClick={handleNavigateAudit}
                    >
                      {isZh ? '审计' : 'Audit'}
                    </Button>
                  </div>
                )}
                bodyClassName="p-0"
                className="overflow-hidden"
              >
                <div className="relative flex min-h-[48rem] flex-col">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.08),transparent_30%)]" />

                  <div className="border-b border-white/8 px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {composerPresets.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleUsePrompt(item.prompt)}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200 transition-all hover:border-emerald-400/25 hover:bg-emerald-400/[0.08]"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="min-h-0 flex-1">
                    {conversationDetailQuery.isLoading && !isCreatingConversation ? (
                      <div className="flex h-full items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                      </div>
                    ) : conversationTimeline.length === 0 ? (
                      <EmptyConversationState
                        isZh={isZh}
                        starterPrompts={starterPrompts}
                        onUsePrompt={handleUsePrompt}
                        onNavigateAudit={handleNavigateAudit}
                      />
                    ) : (
                      <ScrollArea className="h-[38rem]">
                        <div className="space-y-8 p-5 md:p-6">
                          <AnimatePresence initial={false}>
                            {conversationTimeline.map((item) => (
                              item?.kind === 'message' ? (
                                <MessageBubble
                                  key={item.id}
                                  message={item}
                                  locale={locale}
                                  isZh={isZh}
                                  disabled={disableProposalActions}
                                  onNavigateSuggestion={handleNavigateSuggestion}
                                  onConfirmProposal={(proposalId) => normalizedSelectedConversationId && decisionMutation.mutate({
                                    proposalId,
                                    outcome: 'confirm',
                                    conversationId: normalizedSelectedConversationId,
                                  })}
                                  onRejectProposal={(proposalId) => normalizedSelectedConversationId && decisionMutation.mutate({
                                    proposalId,
                                    outcome: 'reject',
                                    conversationId: normalizedSelectedConversationId,
                                  })}
                                />
                              ) : (
                                <EventTimelineRow
                                  key={item.id}
                                  item={item}
                                  locale={locale}
                                  isZh={isZh}
                                  disabled={disableProposalActions}
                                  onConfirmProposal={(proposalId) => normalizedSelectedConversationId && decisionMutation.mutate({
                                    proposalId,
                                    outcome: 'confirm',
                                    conversationId: normalizedSelectedConversationId,
                                  })}
                                  onRejectProposal={(proposalId) => normalizedSelectedConversationId && decisionMutation.mutate({
                                    proposalId,
                                    outcome: 'reject',
                                    conversationId: normalizedSelectedConversationId,
                                  })}
                                />
                              )
                            ))}
                          </AnimatePresence>
                        </div>
                      </ScrollArea>
                    )}
                  </div>

                  <div className="border-t border-white/8 bg-black/20 px-5 py-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                      <span>
                        {isZh
                          ? '写清目标、对象、时间范围；Ctrl/Cmd + Enter 发送。'
                          : 'State the objective, subject, and time scope; press Ctrl/Cmd + Enter to send.'}
                      </span>
                      {busyLabel ? (
                        <span className="inline-flex items-center gap-2 text-slate-300">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {busyLabel}
                        </span>
                      ) : null}
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
                      <Textarea
                        ref={composerRef}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={handleComposerKeyDown}
                        placeholder={assistant.chat_enabled === false
                          ? (isZh ? '模型未启用，暂不可发送。' : 'Model access is disabled.')
                          : (isZh ? '例如：汇总最近 7 天待处理事项，并按优先级给出建议。' : 'Example: Summarize unresolved items from the last 7 days and rank the next actions.')}
                        disabled={assistant.chat_enabled === false}
                        className="min-h-[146px] rounded-[28px] border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-white placeholder:text-slate-500"
                      />
                      <Button
                        className="h-auto rounded-[28px] bg-emerald-500 text-base text-black hover:bg-emerald-400"
                        disabled={!canSend}
                        onClick={handleSend}
                      >
                        {sendMutation.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        {isZh ? '发送任务' : 'Send task'}
                      </Button>
                    </div>
                  </div>
                </div>
              </Panel>
            </div>

            <div className="min-w-0 space-y-5 xl:col-span-2 2xl:col-span-1">
              <Panel
                title={isZh ? '待确认动作' : 'Pending actions'}
                description={isZh ? '所有写入类提案都先落在这里。' : 'Write proposals surface here before execution.'}
              >
                <div className="space-y-3">
                  {pendingActions.length > 0 ? pendingActions.map((action) => (
                    <PendingActionTile
                      key={action.proposal_id}
                      action={action}
                      disabled={disableProposalActions}
                      isZh={isZh}
                      onConfirm={(proposalId) => normalizedSelectedConversationId && decisionMutation.mutate({
                        proposalId,
                        outcome: 'confirm',
                        conversationId: normalizedSelectedConversationId,
                      })}
                      onReject={(proposalId) => normalizedSelectedConversationId && decisionMutation.mutate({
                        proposalId,
                        outcome: 'reject',
                        conversationId: normalizedSelectedConversationId,
                      })}
                    />
                  )) : (
                    <div className="rounded-[22px] border border-dashed border-white/10 px-4 py-6 text-sm leading-6 text-slate-400">
                      {isZh ? '当前会话没有挂起动作。' : 'No pending actions in this session.'}
                    </div>
                  )}
                </div>
              </Panel>

              <Panel
                title={isZh ? '当前会话检查器' : 'Current session inspector'}
                description={isZh ? '模型回合、结果快照和操作密度都在这里。' : 'Model turns, result snapshots, and execution density live here.'}
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricTile
                    label={isZh ? '消息' : 'Messages'}
                    value={currentSummary.message_count || 0}
                    hint={currentSummary.status || (isZh ? '会话状态' : 'Session status')}
                  />
                  <MetricTile
                    label="LLM"
                    value={currentSummary.llm_calls || 0}
                    hint={currentSummary.last_model || (isZh ? '暂无模型信息' : 'No model info')}
                  />
                  <MetricTile
                    label="Tokens"
                    value={formatCompactNumber(currentSummary.total_tokens || 0)}
                    hint={pendingActions.length > 0
                      ? `${pendingActions.length} ${isZh ? '个待确认动作' : 'pending actions'}`
                      : (isZh ? '无挂起动作' : 'No pending action')}
                  />
                </div>

                {latestAssistantResult ? (
                  <div className="mt-4">
                    <ResultSnapshot title={isZh ? '最新结果快照' : 'Latest result snapshot'} value={latestAssistantResult} isZh={isZh} />
                  </div>
                ) : null}

                <div className="mt-4 space-y-3">
                  {(llmCalls.length > 0 ? llmCalls.slice(-3).reverse() : []).map((item) => (
                    <LlmCallCard key={item.id} item={item} locale={locale} isZh={isZh} />
                  ))}
                  {llmCalls.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-white/10 px-4 py-6 text-sm leading-6 text-slate-400">
                      {isZh ? '这条会话还没有模型回合。' : 'No model turns recorded for this session yet.'}
                    </div>
                  ) : null}
                </div>
              </Panel>

              <Panel
                title={isZh ? '能力边界' : 'Capability guardrails'}
                description={isZh ? '当前工作台理解并可调用的管理动作。' : 'Management actions currently exposed to the workspace.'}
              >
                <div className="space-y-3">
                  {capabilityPreview.length > 0 ? capabilityPreview.map((action) => (
                    <CapabilityTile key={action.name} action={action} isZh={isZh} />
                  )) : (
                    <div className="rounded-[22px] border border-dashed border-white/10 px-4 py-6 text-sm leading-6 text-slate-400">
                      {isZh ? '没有可显示的能力目录。' : 'No capability catalog available.'}
                    </div>
                  )}
                </div>
              </Panel>

              <Panel
                title={isZh ? '任务模板' : 'Task templates'}
                description={isZh ? '把常见管理动作改写成更容易触发工具调用的 prompt。' : 'Reuse operational prompts that are more likely to trigger the right tool path.'}
              >
                <div className="space-y-3">
                  {taskTemplates.slice(0, 5).map((item) => (
                    <PromptButton key={item.name} label={item.localizedLabel || item.label} prompt={item.prompt} onUse={handleUsePrompt} />
                  ))}
                </div>
              </Panel>

              {resultFollowUps.length > 0 ? (
                <Panel
                  title={isZh ? '基于当前结果继续办事' : 'Continue from current result'}
                  description={isZh ? '把刚查出来的结果直接转成下一步待确认动作。' : 'Turn the current read result into the next confirmation-ready step.'}
                >
                  <div className="space-y-3">
                    {resultFollowUps.map((item) => (
                      <QuickLaunchButton
                        key={item.id}
                        label={item.label}
                        description={item.description}
                        onClick={() => handleUsePrompt(item.prompt)}
                      />
                    ))}
                  </div>
                </Panel>
              ) : null}

              <Panel
                title={isZh ? '导航跳板' : 'Route bridge'}
                description={isZh ? '直接跳转到其他后台页进行人工处理。' : 'Jump into another admin surface for manual follow-up.'}
              >
                <div className="space-y-3">
                  {sideRoutes.map((target) => (
                    <QuickLaunchButton
                      key={target.id}
                      label={target.label}
                      description={target.description}
                      onClick={() => navigate(target.route)}
                    />
                  ))}
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
