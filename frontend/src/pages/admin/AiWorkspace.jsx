import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock3,
  ExternalLink,
  History,
  Loader2,
  MessageSquare,
  Plus,
  ShieldAlert,
  Sparkles,
  Waypoints,
} from 'lucide-react';
import { toast } from 'sonner';

import { adminAPI } from '../../lib/api';
import { userManager } from '../../lib/auth';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
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

function formatConversationTime(value, locale = 'zh-CN') {
  if (!value) return null;

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

function StatusPill({ children, tone = 'neutral' }) {
  const toneClass = tone === 'success'
    ? 'border-emerald-200/80 bg-emerald-50/90 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200'
    : tone === 'warning'
      ? 'border-amber-200/80 bg-amber-50/90 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200'
      : 'border-slate-200/80 bg-white/85 text-slate-600 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300';

  return (
    <span className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium', toneClass)}>
      {children}
    </span>
  );
}

function WorkspaceMetricCard({ label, value }) {
  return (
    <div className="rounded-[26px] border border-white/70 bg-white/80 p-4 shadow-[0_20px_40px_rgba(15,23,42,0.06)] backdrop-blur dark:border-white/10 dark:bg-slate-950/60 dark:shadow-none">
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</div>
    </div>
  );
}

function RiskBadge({ action, t }) {
  if (action?.requires_confirmation) {
    return (
      <Badge className="rounded-full border-0 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
        {t('admin.aiWorkspace.riskConfirm')}
      </Badge>
    );
  }

  const level = action?.risk_level;
  const toneClass = level === 'read'
    ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200'
    : level === 'write'
      ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200'
      : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300';

  return (
    <Badge variant="outline" className={cn('rounded-full', toneClass)}>
      {level === 'read'
        ? t('admin.aiWorkspace.riskRead')
        : level === 'write'
          ? t('admin.aiWorkspace.riskWrite')
          : t('admin.aiWorkspace.riskPending', { defaultValue: level || 'pending' })}
    </Badge>
  );
}

function ConversationListItem({ item, active, locale, onSelect, t }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.conversation_id)}
      className={cn(
        'w-full rounded-[24px] border px-4 py-4 text-left transition-all',
        active
          ? 'border-emerald-300/90 bg-emerald-50/80 shadow-[0_18px_38px_rgba(16,185,129,0.12)] dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:shadow-none'
          : 'border-slate-200/80 bg-white/80 hover:border-emerald-200 hover:bg-emerald-50/50 dark:border-white/10 dark:bg-slate-950/50 dark:hover:border-emerald-500/20 dark:hover:bg-emerald-500/6'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">
            {item.title || t('admin.command.untitledConversation')}
          </div>
          <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {item.last_message_preview || t('admin.command.noConversationSummary')}
          </div>
        </div>
        <Badge variant="outline" className="rounded-full bg-background/90">
          {item.message_count || 0}
        </Badge>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <Clock3 className="h-3 w-3" />
        <span>{formatConversationTime(item.last_activity_at, locale) || '--'}</span>
      </div>
    </button>
  );
}

function ShortcutButton({ action, onRun }) {
  return (
    <button
      type="button"
      onClick={() => onRun(action)}
      className="group flex w-full items-start justify-between gap-3 rounded-[24px] border border-slate-200/80 bg-white/80 px-4 py-4 text-left transition-all hover:border-emerald-200 hover:bg-emerald-50/55 dark:border-white/10 dark:bg-slate-950/50 dark:hover:border-emerald-500/20 dark:hover:bg-emerald-500/6"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-foreground">{action.label}</div>
        <div className="mt-1 text-xs leading-5 text-muted-foreground">{action.description}</div>
      </div>
      <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function PromptCard({ item, onUse, compact = false }) {
  return (
    <button
      type="button"
      onClick={() => onUse(item.prompt)}
      className={cn(
        'group w-full rounded-[24px] border border-slate-200/80 bg-white/85 text-left transition-all hover:border-emerald-200 hover:bg-emerald-50/55 dark:border-white/10 dark:bg-slate-950/55 dark:hover:border-emerald-500/20 dark:hover:bg-emerald-500/6',
        compact ? 'px-4 py-4' : 'px-5 py-5'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">{item.label}</div>
          <div className="mt-2 text-sm leading-6 text-muted-foreground">{item.prompt}</div>
        </div>
        <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
    </button>
  );
}

function PendingActionCard({ action, disabled, onConfirm, onReject, t }) {
  return (
    <div className="rounded-[26px] border border-slate-200/80 bg-white/85 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-slate-950/55 dark:shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">
            {action.label || action.action_name || `Proposal #${action.proposal_id}`}
          </div>
          <div className="mt-2 text-sm leading-6 text-muted-foreground">
            {action.summary || t('admin.aiWorkspace.pendingFallback')}
          </div>
        </div>
        <RiskBadge action={action} t={t} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" className="rounded-full" disabled={disabled} onClick={() => onConfirm(action.proposal_id)}>
          {t('admin.command.confirmAction')}
        </Button>
        <Button size="sm" variant="outline" className="rounded-full" disabled={disabled} onClick={() => onReject(action.proposal_id)}>
          {t('admin.command.rejectAction')}
        </Button>
      </div>
    </div>
  );
}

function CapabilityRow({ action, t }) {
  return (
    <div className="rounded-[22px] border border-slate-200/80 bg-white/80 px-4 py-4 dark:border-white/10 dark:bg-slate-950/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">{action.label}</div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">{action.description}</div>
        </div>
        <RiskBadge action={action} t={t} />
      </div>

      {Array.isArray(action.requirements) && action.requirements.length > 0 ? (
        <div className="mt-3 text-[11px] leading-5 text-muted-foreground">
          {t('admin.aiWorkspace.requiredFields', { fields: action.requirements.join(', ') })}
        </div>
      ) : null}
    </div>
  );
}

function ConversationMessageBubble({
  message,
  disabled,
  t,
  onNavigateSuggestion,
  onConfirmProposal,
  onRejectProposal,
}) {
  const isUser = message?.role === 'user';
  const suggestion = message?.meta?.data?.suggestion;
  const proposal = message?.proposal || message?.meta?.data?.proposal;

  return (
    <div className={cn('flex flex-col gap-3', isUser ? 'items-end' : 'items-start')}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
        <span className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-full border',
          isUser
            ? 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
        )}>
          {isUser ? <MessageSquare className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </span>
        <span>{isUser ? t('admin.command.userLabel') : t('admin.command.aiLabel')}</span>
      </div>

      <div className={cn(
        'max-w-[min(100%,52rem)] rounded-[28px] border px-5 py-4 text-sm leading-7 shadow-[0_12px_28px_rgba(15,23,42,0.05)]',
        isUser
          ? 'rounded-tr-lg border-slate-950 bg-slate-950 text-white dark:border-slate-700'
          : 'rounded-tl-lg border-slate-200/90 bg-white/90 text-foreground dark:border-white/10 dark:bg-slate-950/70'
      )}>
        {message?.content || t('admin.command.aiEmptyMessage')}
      </div>

      {suggestion?.route ? (
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => onNavigateSuggestion(suggestion)}>
          <ArrowUpRight className="mr-1 h-3.5 w-3.5" />
          {suggestion.label || t('admin.command.openSuggestion')}
        </Button>
      ) : null}

      {proposal?.proposal_id && proposal?.status === 'pending' ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="rounded-full" disabled={disabled} onClick={() => onConfirmProposal(proposal.proposal_id)}>
            {t('admin.command.confirmAction')}
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" disabled={disabled} onClick={() => onRejectProposal(proposal.proposal_id)}>
            {t('admin.command.rejectAction')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function EmptyConversationState({ prompts, onUsePrompt, t }) {
  return (
    <div className="flex h-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-4xl">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-[0_18px_36px_rgba(16,185,129,0.12)] dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200 dark:shadow-none">
            <Bot className="h-8 w-8" />
          </div>
          <h3 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
            {t('admin.aiWorkspace.emptyTitle')}
          </h3>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {t('admin.aiWorkspace.emptyDescription')}
          </p>
        </div>

        {prompts.length > 0 ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {prompts.map((item) => (
              <PromptCard key={item.id} item={item} onUse={onUsePrompt} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminAiWorkspacePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const composerRef = useRef(null);

  const currentAdminId = useMemo(() => {
    const user = userManager.getUser();
    return user?.id ?? null;
  }, []);

  const locale = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'zh-CN';
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [draft, setDraft] = useState('');
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);

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

  useEffect(() => {
    if (!selectedConversationId && !isCreatingConversation && conversationItems.length > 0) {
      setSelectedConversationId(conversationItems[0].conversation_id);
    }
  }, [conversationItems, isCreatingConversation, selectedConversationId]);

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
  const visibleMessages = useMemo(
    () => (Array.isArray(activeConversation?.messages) ? activeConversation.messages.filter((item) => item?.kind === 'message') : []),
    [activeConversation]
  );
  const pendingActions = useMemo(
    () => (Array.isArray(activeConversation?.pending_actions) ? activeConversation.pending_actions : []),
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
        toast.error(error?.response?.data?.error || t('admin.command.aiErrorGeneric'));
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
        toast.error(error?.response?.data?.error || t('admin.command.decisionFailed'));
      },
    }
  );

  const assistant = workspaceQuery.data?.assistant || {};
  const starterPrompts = Array.isArray(workspaceQuery.data?.starter_prompts) ? workspaceQuery.data.starter_prompts : [];
  const quickActions = Array.isArray(workspaceQuery.data?.quick_actions) ? workspaceQuery.data.quick_actions : [];
  const navigationTargets = Array.isArray(workspaceQuery.data?.navigation_targets) ? workspaceQuery.data.navigation_targets : [];
  const managementActions = Array.isArray(workspaceQuery.data?.management_actions) ? workspaceQuery.data.management_actions : [];

  const currentSummary = activeConversation?.summary || conversationItems.find((item) => item.conversation_id === selectedConversationId) || {};
  const selectedConversationTitle = currentSummary.title || (isCreatingConversation ? t('admin.command.newConversation') : t('admin.command.aiConversation'));
  const lastActivityLabel = formatConversationTime(currentSummary.last_activity_at, locale);
  const canSend = draft.trim().length >= COMMAND_MIN_LENGTH && !sendMutation.isLoading && assistant.chat_enabled !== false;
  const canCreateConversation = !sendMutation.isLoading && !decisionMutation.isLoading;

  const capabilitySummary = useMemo(() => ({
    readCount: managementActions.filter((item) => item.risk_level === 'read').length,
    writeCount: managementActions.filter((item) => item.risk_level === 'write').length,
    confirmationCount: managementActions.filter((item) => item.requires_confirmation).length,
  }), [managementActions]);
  const disableProposalActions = decisionMutation.isLoading || hasStaleConversationDetail;

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
      toast.error(t('admin.command.aiMissingRoute'));
      return;
    }

    navigate(fullRoute);
  }, [navigate, t]);

  const handleRunQuickAction = useCallback((action) => {
    const fullRoute = buildRouteWithQuery(action?.route, action?.query || {});
    if (!fullRoute) {
      toast.error(t('admin.command.aiMissingRoute'));
      return;
    }

    navigate(fullRoute);
  }, [navigate, t]);

  return (
    <div className="space-y-6 pb-4">
      <section className="relative overflow-hidden rounded-[34px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),rgba(236,253,245,0.92)_45%,rgba(248,250,252,0.95)_100%)] p-6 shadow-[0_28px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),rgba(15,23,42,0.96)_42%,rgba(2,6,23,0.98)_100%)] dark:shadow-none md:p-8">
        <div className="pointer-events-none absolute -right-24 -top-20 h-64 w-64 rounded-full bg-emerald-200/35 blur-3xl dark:bg-emerald-500/12" />
        <div className="pointer-events-none absolute bottom-0 left-1/4 h-44 w-44 rounded-full bg-sky-200/30 blur-3xl dark:bg-sky-500/10" />

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <Badge className="w-fit rounded-full border-0 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
              {t('admin.aiWorkspace.badge')}
            </Badge>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
                {t('admin.aiWorkspace.title')}
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
                {t('admin.aiWorkspace.subtitle')}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusPill tone={assistant.chat_enabled ? 'success' : 'warning'}>
                {assistant.chat_enabled ? t('admin.aiWorkspace.chatReady') : t('admin.aiWorkspace.chatUnavailable')}
              </StatusPill>
              <StatusPill tone={assistant.intent_enabled ? 'success' : 'warning'}>
                {assistant.intent_enabled ? t('admin.aiWorkspace.intentReady') : t('admin.aiWorkspace.intentUnavailable')}
              </StatusPill>
              {assistant.default_confirmation_policy ? (
                <StatusPill>{t('admin.aiWorkspace.confirmationPolicy', { policy: assistant.default_confirmation_policy })}</StatusPill>
              ) : null}
              {assistant.max_history_messages ? (
                <StatusPill>{t('admin.aiWorkspace.historyWindow', { count: assistant.max_history_messages })}</StatusPill>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <WorkspaceMetricCard label={t('admin.aiWorkspace.readActions')} value={capabilitySummary.readCount} />
            <WorkspaceMetricCard label={t('admin.aiWorkspace.writeActions')} value={capabilitySummary.writeCount} />
            <WorkspaceMetricCard label={t('admin.aiWorkspace.pendingConfirmations')} value={capabilitySummary.confirmationCount} />
          </div>
        </div>
      </section>

      {assistant.chat_enabled === false ? (
        <Alert className="border-amber-200 bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-500/10">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>{t('admin.aiWorkspace.unavailableTitle')}</AlertTitle>
          <AlertDescription>{t('admin.aiWorkspace.unavailableDescription')}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <Card className="overflow-hidden rounded-[30px] border-slate-200/80 bg-white/75 backdrop-blur dark:border-white/10 dark:bg-slate-950/55">
            <CardHeader className="border-b border-slate-200/70 bg-white/50 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <History className="h-4 w-4 text-emerald-500" />
                    {t('admin.aiWorkspace.conversationsTitle')}
                  </CardTitle>
                  <CardDescription>{t('admin.aiWorkspace.conversationsDescription')}</CardDescription>
                </div>
                <Button size="sm" variant="outline" className="rounded-full" disabled={!canCreateConversation} onClick={handleStartConversation}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {t('admin.command.newConversation')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[24rem]">
                <div className="space-y-3 p-4">
                  {isCreatingConversation ? (
                    <div className="rounded-[24px] border border-emerald-300/90 bg-emerald-50/85 px-4 py-4 dark:border-emerald-500/25 dark:bg-emerald-500/10">
                      <div className="text-sm font-semibold text-foreground">{t('admin.aiWorkspace.newConversationTitle')}</div>
                      <div className="mt-1 text-xs leading-5 text-muted-foreground">
                        {t('admin.aiWorkspace.newConversationDescription')}
                      </div>
                    </div>
                  ) : null}

                  {conversationItems.map((item) => (
                    <ConversationListItem
                      key={item.conversation_id}
                      item={item}
                      active={selectedConversationId === item.conversation_id && !isCreatingConversation}
                      locale={locale}
                      onSelect={handleSelectConversation}
                      t={t}
                    />
                  ))}

                  {conversationItems.length === 0 && !conversationsQuery.isLoading && !workspaceQuery.isLoading ? (
                    <div className="rounded-[24px] border border-dashed border-slate-300/80 px-4 py-8 text-center text-sm leading-6 text-muted-foreground dark:border-white/15">
                      {t('admin.command.aiEmptyState')}
                    </div>
                  ) : null}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="rounded-[30px] border-slate-200/80 bg-white/75 backdrop-blur dark:border-white/10 dark:bg-slate-950/55">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Waypoints className="h-4 w-4 text-emerald-500" />
                {t('admin.aiWorkspace.shortcutsTitle')}
              </CardTitle>
              <CardDescription>{t('admin.aiWorkspace.shortcutsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {quickActions.slice(0, 6).map((action) => (
                <ShortcutButton key={action.id} action={action} onRun={handleRunQuickAction} />
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden rounded-[32px] border-slate-200/80 bg-white/78 backdrop-blur dark:border-white/10 dark:bg-slate-950/55">
          <CardHeader className="border-b border-slate-200/70 bg-white/55 dark:border-white/10 dark:bg-white/5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <CardTitle className="text-2xl tracking-tight text-foreground">{selectedConversationTitle}</CardTitle>
                <CardDescription>
                  {isCreatingConversation
                    ? t('admin.aiWorkspace.newConversationDescription')
                    : t('admin.aiWorkspace.conversationDescription')}
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {lastActivityLabel ? (
                  <StatusPill>
                    <Clock3 className="h-3.5 w-3.5" />
                    {lastActivityLabel}
                  </StatusPill>
                ) : null}
                {currentSummary.message_count ? (
                  <StatusPill>{t('admin.aiWorkspace.messageCount', { count: currentSummary.message_count })}</StatusPill>
                ) : null}
                <Button variant="ghost" size="sm" className="rounded-full" onClick={() => navigate('/admin/llm-usage')}>
                  {t('admin.aiWorkspace.auditAction')}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="flex min-h-[42rem] flex-col">
              <div className="min-h-0 flex-1">
                {conversationDetailQuery.isLoading && !isCreatingConversation ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : visibleMessages.length === 0 ? (
                  <EmptyConversationState prompts={starterPrompts.slice(0, 4)} onUsePrompt={handleUsePrompt} t={t} />
                ) : (
                  <ScrollArea className="h-[42rem]">
                    <div className="space-y-8 p-5 md:p-6">
                      {visibleMessages.map((message) => (
                        <ConversationMessageBubble
                          key={message.id}
                          message={message}
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
                          t={t}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>

              <div className="border-t border-slate-200/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.62),rgba(255,255,255,0.92))] p-4 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.5),rgba(2,6,23,0.82))]">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{t('admin.aiWorkspace.composerHint')}</span>
                  {sendMutation.isLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t('admin.command.aiSending')}
                    </span>
                  ) : null}
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_148px]">
                  <Textarea
                    ref={composerRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder={assistant.chat_enabled === false ? t('admin.aiWorkspace.placeholderUnavailable') : t('admin.aiWorkspace.placeholderReady')}
                    disabled={assistant.chat_enabled === false}
                    className="min-h-[132px] rounded-[28px] border-slate-200/80 bg-white/92 px-4 py-4 text-sm shadow-[0_12px_24px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-slate-950/70 dark:shadow-none"
                  />
                  <Button className="h-auto rounded-[28px] text-sm" disabled={!canSend} onClick={handleSend}>
                    {sendMutation.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    {t('admin.command.send')}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <Card className="rounded-[30px] border-slate-200/80 bg-white/75 backdrop-blur dark:border-white/10 dark:bg-slate-950/55">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                {t('admin.aiWorkspace.starterPromptsTitle')}
              </CardTitle>
              <CardDescription>{t('admin.aiWorkspace.starterPromptsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {starterPrompts.length > 0 ? starterPrompts.map((item) => (
                <PromptCard key={item.id} item={item} onUse={handleUsePrompt} compact />
              )) : (
                <div className="rounded-[22px] border border-dashed border-slate-300/80 px-4 py-6 text-sm leading-6 text-muted-foreground dark:border-white/15">
                  {t('admin.aiWorkspace.noStarterPrompts')}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[30px] border-slate-200/80 bg-white/75 backdrop-blur dark:border-white/10 dark:bg-slate-950/55">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                {t('admin.aiWorkspace.pendingTitle')}
              </CardTitle>
              <CardDescription>{t('admin.aiWorkspace.pendingDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingActions.length > 0 ? pendingActions.map((action) => (
                <PendingActionCard
                  key={action.proposal_id}
                  action={action}
                  disabled={disableProposalActions}
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
                  t={t}
                />
              )) : (
                <div className="rounded-[22px] border border-dashed border-slate-300/80 px-4 py-6 text-sm leading-6 text-muted-foreground dark:border-white/15">
                  {t('admin.aiWorkspace.pendingEmpty')}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[30px] border-slate-200/80 bg-white/75 backdrop-blur dark:border-white/10 dark:bg-slate-950/55">
            <CardHeader>
              <CardTitle className="text-base">{t('admin.aiWorkspace.capabilityTitle')}</CardTitle>
              <CardDescription>{t('admin.aiWorkspace.capabilityDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-[24px] border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-950/50">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  {t('admin.aiWorkspace.navigationTitle')}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {navigationTargets.slice(0, 10).map((target) => (
                    <button
                      key={target.id}
                      type="button"
                      onClick={() => navigate(target.route)}
                      className="rounded-full border border-slate-200/80 bg-background/90 px-3 py-1.5 text-xs transition-all hover:border-emerald-200 hover:bg-emerald-50 dark:border-white/10 dark:bg-slate-900/70 dark:hover:border-emerald-500/20 dark:hover:bg-emerald-500/8"
                    >
                      {target.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  {t('admin.aiWorkspace.managementActionsTitle')}
                </div>
                {managementActions.slice(0, 8).map((action) => (
                  <CapabilityRow key={action.name} action={action} t={t} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
