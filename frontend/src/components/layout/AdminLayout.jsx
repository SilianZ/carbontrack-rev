import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { QueryClientProvider } from 'react-query';
import { queryClient } from '../../lib/react-query';
import { Navbar } from './Navbar';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
} from '../ui/sidebar';
import { Button } from '../ui/Button';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../../lib/utils';
import {
  Award,
  Bot,
  Clock3,
  Fingerprint,
  LayoutDashboard,
  Leaf,
  Loader2,
  PackageCheck,
  Plus,
  Radio,
  Repeat2,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserCircle2,
  UserCog,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { adminAPI } from '../../lib/api';

const COMMAND_MIN_LENGTH = 2;
const SESSION_LIMIT = 8;

const NAV_LINKS = [
  { key: 'dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
  { key: 'passkeys', to: '/admin/passkeys', icon: Fingerprint },
  { key: 'users', to: '/admin/users', icon: Users },
  { key: 'groups', to: '/admin/users/groups', icon: UserCog },
  { key: 'activities', to: '/admin/activities', icon: Leaf },
  { key: 'products', to: '/admin/products', icon: PackageCheck },
  { key: 'badges', to: '/admin/badges', icon: Award },
  { key: 'avatars', to: '/admin/avatars', icon: UserCircle2 },
  { key: 'exchanges', to: '/admin/exchanges', icon: Repeat2 },
  { key: 'broadcast', to: '/admin/broadcast', icon: Radio },
  { key: 'llmUsage', to: '/admin/llm-usage', icon: Sparkles },
  { key: 'systemLogs', to: '/admin/system-logs', icon: ScrollText },
  { key: 'diagnostics', to: '/admin/diagnostics', icon: Stethoscope },
];

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
  if (!value) {
    return null;
  }

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

function AiBubble({ role, content, suggestion, proposal, onSelectSuggestion, onConfirmProposal, onRejectProposal, disabled, t }) {
  const isUser = role === 'user';
  const bubbleClass = isUser
    ? 'border border-white/10 bg-white/10 text-white'
    : 'border border-emerald-400/20 bg-emerald-300/12 text-emerald-50';

  return (
    <div className={cn('flex flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
      <span className={cn(
        'rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.26em]',
        isUser ? 'bg-white/10 text-slate-200' : 'bg-emerald-300/16 text-emerald-200',
      )}>
        {isUser ? t('admin.command.userLabel') : t('admin.command.aiLabel')}
      </span>
      <div className={cn(
        'max-w-[min(100%,46rem)] rounded-[26px] px-4 py-3 text-sm leading-7 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur',
        isUser ? 'rounded-tr-md' : 'rounded-tl-md',
        bubbleClass,
      )}>
        {content || t('admin.command.aiEmptyMessage')}
      </div>
      {suggestion?.route && (
        <Button
          size="sm"
          variant="outline"
          className="rounded-full border-emerald-300/30 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/18"
          onClick={() => onSelectSuggestion(suggestion)}
        >
          <ArrowUpRight className="mr-1 h-3.5 w-3.5" />
          {suggestion.label || t('admin.command.openSuggestion')}
        </Button>
      )}
      {proposal?.proposal_id && proposal?.status === 'pending' && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="rounded-full bg-emerald-500 text-slate-950 hover:bg-emerald-400"
            disabled={disabled}
            onClick={() => onConfirmProposal(proposal.proposal_id)}
          >
            {t('admin.command.confirmAction')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full border-white/14 bg-white/6 text-slate-100 hover:bg-white/12"
            disabled={disabled}
            onClick={() => onRejectProposal(proposal.proposal_id)}
          >
            {t('admin.command.rejectAction')}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AdminLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [conversationList, setConversationList] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDeciding, setIsDeciding] = useState(false);
  const messagePanelRef = useRef(null);

  const translatedLinks = useMemo(() => NAV_LINKS.map((link) => ({
    ...link,
    label: t(`admin.nav.${link.key}`),
  })), [t]);

  const quickActions = useMemo(() => ([
    {
      id: 'search-users',
      label: t('admin.command.searchUsers'),
      description: t('admin.command.searchUsersHint'),
      onSelect: () => navigate('/admin/users?focus=search'),
    },
    {
      id: 'create-badge',
      label: t('admin.command.createBadge'),
      description: t('admin.command.createBadgeHint'),
      onSelect: () => navigate('/admin/badges?create=1'),
    },
    {
      id: 'review-activities',
      label: t('admin.command.reviewActivities'),
      description: t('admin.command.reviewActivitiesHint'),
      onSelect: () => navigate('/admin/activities?filter=pending'),
    },
    {
      id: 'broadcast',
      label: t('admin.command.sendBroadcast'),
      description: t('admin.command.sendBroadcastHint'),
      onSelect: () => navigate('/admin/broadcast?compose=1'),
    },
  ]), [navigate, t]);

  const activeLink = useMemo(() => translatedLinks.find((link) => location.pathname.startsWith(link.to)), [location.pathname, translatedLinks]);
  const userLocale = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'zh-CN';

  const aiContext = useMemo(() => ({
    activeRoute: location.pathname,
    locale: userLocale,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
  }), [location.pathname, userLocale]);

  const loadConversationDetail = useCallback(async (conversationId) => {
    if (!conversationId) {
      setCurrentConversation(null);
      setCurrentConversationId(null);
      return;
    }

    const response = await adminAPI.getAiConversation(conversationId);
    const detail = response.data?.data || null;
    setCurrentConversation(detail);
    setCurrentConversationId(detail?.conversation_id || conversationId);
  }, []);

  const loadConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    try {
      const response = await adminAPI.getAiConversations({ limit: SESSION_LIMIT });
      const items = Array.isArray(response.data?.data) ? response.data.data : [];
      setConversationList(items);

      if (items.length > 0) {
        const targetId = currentConversationId && items.some((item) => item.conversation_id === currentConversationId)
          ? currentConversationId
          : items[0].conversation_id;
        await loadConversationDetail(targetId);
      } else if (!currentConversationId) {
        setCurrentConversation(null);
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || t('admin.command.historyLoadFailed'));
    } finally {
      setIsLoadingConversations(false);
    }
  }, [currentConversationId, loadConversationDetail, t]);

  useEffect(() => {
    if (commandOpen) {
      loadConversations();
    }
  }, [commandOpen, loadConversations]);

  useEffect(() => {
    if (!commandOpen) {
      setCommandQuery('');
    }
  }, [commandOpen]);

  useEffect(() => {
    const target = typeof globalThis !== 'undefined' ? globalThis : undefined;
    if (!target?.addEventListener) {
      return undefined;
    }

    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };

    target.addEventListener('keydown', handler);
    return () => target.removeEventListener('keydown', handler);
  }, []);

  const handleSuggestionSelect = useCallback((suggestion) => {
    const fullRoute = buildRouteWithQuery(suggestion?.route, suggestion?.query || {});
    if (!fullRoute) {
      toast.error(t('admin.command.aiMissingRoute'));
      return;
    }
    setCommandOpen(false);
    navigate(fullRoute);
  }, [navigate, t]);

  const sendAiMessage = useCallback(async () => {
    const trimmed = commandQuery.trim();
    if (trimmed.length < COMMAND_MIN_LENGTH || isSending) {
      return;
    }

    setIsSending(true);
    try {
      const response = await adminAPI.chatWithAdminAi({
        conversation_id: currentConversationId || undefined,
        message: trimmed,
        context: aiContext,
        source: aiContext.activeRoute ? `admin:${aiContext.activeRoute}` : 'admin-command',
      });
      const payload = response.data || {};
      const nextConversation = buildFallbackConversation(
        payload.conversation || null,
        payload.conversation_id || null,
        currentConversation,
        trimmed,
        payload.message || null,
      );
      setCurrentConversation(nextConversation);
      setCurrentConversationId(payload.conversation_id || nextConversation?.conversation_id || null);
      setCommandQuery('');
      await loadConversations();
    } catch (error) {
      toast.error(error?.response?.data?.error || t('admin.command.aiErrorGeneric'));
    } finally {
      setIsSending(false);
    }
  }, [aiContext, commandQuery, currentConversation, currentConversationId, isSending, loadConversations, t]);

  const handleProposalDecision = useCallback(async (proposalId, outcome) => {
    if (!currentConversationId || !proposalId || isDeciding) {
      return;
    }

    setIsDeciding(true);
    try {
      const response = await adminAPI.chatWithAdminAi({
        conversation_id: currentConversationId,
        context: aiContext,
        decision: {
          proposal_id: proposalId,
          outcome,
        },
        source: aiContext.activeRoute ? `admin:${aiContext.activeRoute}` : 'admin-command',
      });
      const payload = response.data || {};
      setCurrentConversation(buildFallbackConversation(
        payload.conversation || null,
        payload.conversation_id || currentConversationId,
        currentConversation,
        null,
        payload.message || null,
      ));
      await loadConversations();
    } catch (error) {
      toast.error(error?.response?.data?.error || t('admin.command.decisionFailed'));
    } finally {
      setIsDeciding(false);
    }
  }, [aiContext, currentConversation, currentConversationId, isDeciding, loadConversations, t]);

  const startNewConversation = useCallback(() => {
    setCurrentConversationId(null);
    setCurrentConversation(null);
    setCommandQuery('');
  }, []);

  const handleCommandKeyDown = useCallback((event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendAiMessage();
    }
  }, [sendAiMessage]);

  const commandMessages = useMemo(
    () => (Array.isArray(currentConversation?.messages) ? currentConversation.messages : []),
    [currentConversation?.messages],
  );
  const visibleMessages = useMemo(
    () => commandMessages.filter((message) => message?.kind === 'message'),
    [commandMessages],
  );
  const currentSummary = currentConversation?.summary || {};
  const selectedConversationTitle = currentSummary.title || activeLink?.label || t('admin.command.aiConversation');
  const lastActivityLabel = formatConversationTime(currentSummary.last_activity_at, userLocale);
  const canSendAiCommand = commandQuery.trim().length >= COMMAND_MIN_LENGTH && !isSending;

  useEffect(() => {
    if (!commandOpen) {
      return;
    }

    const viewport = messagePanelRef.current?.querySelector('[data-slot="scroll-area-viewport"]');
    if (!viewport) {
      return;
    }

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: 'smooth',
    });
  }, [commandOpen, visibleMessages.length, currentConversationId]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <SidebarProvider>
          <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
            <DialogContent
              className="border-none bg-transparent p-0 shadow-none"
              style={{
                width: 'min(1380px, calc(100vw - 4rem))',
                maxWidth: 'none',
              }}
            >
              <DialogHeader className="sr-only">
                <DialogTitle>{t('admin.command.aiConversation')}</DialogTitle>
                <DialogDescription>{t('admin.command.aiHint')}</DialogDescription>
              </DialogHeader>

              <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-950 text-slate-50 shadow-[0_36px_120px_rgba(2,6,23,0.78)]">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.16),_transparent_28%),linear-gradient(180deg,_rgba(15,23,42,0.92),_rgba(2,6,23,0.98))]" />

                <div className="relative grid max-h-[88vh] min-h-[78vh] grid-rows-[auto_minmax(0,1fr)]">
                  <div className="border-b border-white/10 px-5 pb-4 pt-5 sm:px-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <Badge className="w-fit rounded-full border-0 bg-emerald-400/14 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-200">
                          Admin AI Copilot
                        </Badge>
                        <div className="space-y-2">
                          <div className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{selectedConversationTitle}</div>
                          <p className="max-w-2xl text-sm leading-6 text-slate-300">
                            {t('admin.command.aiHint')}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                          {activeLink?.label || t('admin.command.aiConversation')}
                        </div>
                        {lastActivityLabel && (
                          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                            <Clock3 className="h-3.5 w-3.5 text-emerald-300" />
                            {lastActivityLabel}
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full border-white/12 bg-white/6 text-slate-100 hover:bg-white/12"
                          onClick={startNewConversation}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          {t('admin.command.newConversation')}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-col xl:grid xl:grid-cols-[340px_minmax(0,1fr)]">
                    <aside className="order-2 flex min-h-0 flex-col border-t border-white/10 bg-white/[0.04] p-4 xl:order-1 xl:border-r xl:border-t-0">
                      <div className="hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-4 xl:block">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/14 text-emerald-200">
                            <Bot className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">{t('admin.command.aiConversation')}</div>
                            <div className="text-xs leading-5 text-slate-400">
                              {t('admin.command.sessionEmptyHint')}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 flex items-center justify-between">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                          {t('admin.command.history')}
                        </div>
                        {isLoadingConversations && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
                      </div>

                      <ScrollArea className="mt-3 min-h-0 flex-1 pr-1">
                        <div className="space-y-3">
                          {conversationList.map((item) => (
                            <button
                              key={item.conversation_id}
                              type="button"
                              className={cn(
                                'w-full rounded-[24px] border px-4 py-3 text-left transition-all duration-200',
                                currentConversationId === item.conversation_id
                                  ? 'border-emerald-300/30 bg-emerald-300/12 shadow-[0_18px_44px_rgba(16,185,129,0.12)]'
                                  : 'border-white/8 bg-white/[0.035] hover:border-white/16 hover:bg-white/[0.08]'
                              )}
                              onClick={() => loadConversationDetail(item.conversation_id)}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium text-white">
                                    {item.title || t('admin.command.untitledConversation')}
                                  </div>
                                  <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                                    {item.last_message_preview || t('admin.command.noConversationSummary')}
                                  </div>
                                </div>
                                <div className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[10px] text-slate-300">
                                  {item.message_count || 0}
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                                <span>{formatConversationTime(item.last_activity_at, userLocale) || '--'}</span>
                                {item.pending_action_count > 0 && (
                                  <Badge className="rounded-full border-0 bg-amber-300/16 text-amber-100">
                                    {t('admin.command.pendingActions', { count: item.pending_action_count })}
                                  </Badge>
                                )}
                              </div>
                            </button>
                          ))}

                          {conversationList.length === 0 && !isLoadingConversations && (
                            <div className="rounded-[24px] border border-dashed border-white/12 bg-white/[0.03] px-4 py-8 text-center text-sm leading-6 text-slate-400">
                              {t('admin.command.aiEmptyState')}
                            </div>
                          )}
                        </div>
                      </ScrollArea>

                      <div className="mt-5 space-y-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                          {t('admin.command.quickActions')}
                        </div>
                        <div className="max-h-[18rem] overflow-y-auto pr-1" style={{ scrollbarGutter: 'stable' }}>
                          <div className="grid gap-2 pb-1">
                            {quickActions.map((action) => (
                              <button
                                key={action.id}
                                type="button"
                                className="rounded-[22px] border border-white/8 bg-white/[0.04] px-4 py-3 text-left transition-all hover:border-emerald-300/24 hover:bg-emerald-300/10"
                                onClick={() => {
                                  action.onSelect();
                                  setCommandOpen(false);
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/8 text-emerald-200">
                                    <Sparkles className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-white">{action.label}</div>
                                    <div className="text-xs leading-5 text-slate-400">{action.description}</div>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </aside>

                    <section className="order-1 flex min-h-0 flex-1 flex-col xl:order-2">
                      <div className="flex min-h-0 flex-1 flex-col gap-4 px-5 pb-5 pt-4 sm:px-6">
                        <div className={cn(
                          'overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.03] shadow-[0_18px_60px_rgba(15,23,42,0.18)]',
                          visibleMessages.length === 0 ? 'min-h-[9rem]' : 'min-h-0 flex-1'
                        )}>
                          {visibleMessages.length === 0 ? (
                            <div className="flex h-full items-center justify-center p-4">
                              <div className="max-w-lg rounded-[26px] border border-white/10 bg-white/[0.045] px-5 py-5 text-center shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[18px] bg-emerald-400/14 text-emerald-200">
                                  <Bot className="h-6 w-6" />
                                </div>
                                <div className="mt-3 text-lg font-semibold text-white">{t('admin.command.aiConversation')}</div>
                                <p className="mt-2 text-sm leading-6 text-slate-300">
                                  {t('admin.command.sessionEmptyHint')}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div ref={messagePanelRef} className="flex h-full min-h-0 flex-col">
                              <ScrollArea className="h-full pr-2">
                                <div className="space-y-5 p-5">
                                  {visibleMessages.map((message) => {
                                    const data = message.meta?.data || {};
                                    return (
                                      <AiBubble
                                        key={message.id}
                                        role={message.role}
                                        content={message.content}
                                        suggestion={data.suggestion}
                                        proposal={message.proposal || data.proposal}
                                        onSelectSuggestion={handleSuggestionSelect}
                                        onConfirmProposal={(proposalId) => handleProposalDecision(proposalId, 'confirm')}
                                        onRejectProposal={(proposalId) => handleProposalDecision(proposalId, 'reject')}
                                        disabled={isDeciding}
                                        t={t}
                                      />
                                    );
                                  })}
                                </div>
                              </ScrollArea>
                            </div>
                          )}
                        </div>

                          <div className="rounded-[30px] border border-white/10 bg-white/[0.055] p-4 shadow-[0_18px_60px_rgba(15,23,42,0.22)] backdrop-blur">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                              <div className="text-xs font-medium text-slate-300">{t('admin.command.aiHint')}</div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                <span>{activeLink?.label || t('admin.command.aiConversation')}</span>
                                {lastActivityLabel && <span>{lastActivityLabel}</span>}
                              </div>
                            </div>

                            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
                              <Textarea
                                value={commandQuery}
                                onChange={(event) => setCommandQuery(event.target.value)}
                                onKeyDown={handleCommandKeyDown}
                                placeholder={t('admin.command.placeholder')}
                                className="min-h-[96px] rounded-[24px] border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus-visible:border-emerald-400/40 focus-visible:ring-emerald-400/15 lg:min-h-[108px]"
                              />
                              <Button
                                size="lg"
                                className="h-auto min-h-[56px] rounded-[24px] bg-emerald-400 px-6 text-slate-950 hover:bg-emerald-300 lg:min-h-[108px] lg:min-w-[180px]"
                                disabled={!canSendAiCommand}
                                onClick={sendAiMessage}
                              >
                                {isSending ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Bot className="mr-2 h-4 w-4" />
                                )}
                                {isSending ? t('admin.command.aiSending') : t('admin.command.send')}
                              </Button>
                            </div>
                          </div>

                      </div>
                    </section>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="relative flex min-h-[calc(100vh-4rem)] flex-col">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_65%)]" />
            <div className="flex flex-1">
              <Sidebar className="top-16 border-r border-border bg-card shadow-sm md:h-[calc(100svh-4rem)]">
                <SidebarHeader className="px-5 py-6">
                  <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <ShieldCheck className="h-4 w-4" />
                    {t('admin.title')}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    {t('admin.subtitle')}
                  </p>
                </SidebarHeader>
                <SidebarContent className="px-3 py-4">
                  <SidebarMenu className="gap-1.5">
                    {translatedLinks.map((link) => {
                      const Icon = link.icon;
                      const isActive = location.pathname.startsWith(link.to);
                      return (
                        <SidebarMenuItem key={link.to}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            tooltip={link.label}
                            size="lg"
                            variant="outline"
                            className={cn(
                              'group justify-start rounded-2xl border border-transparent bg-transparent transition-all duration-150 hover:border-emerald-200 hover:bg-emerald-50/80 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/10',
                              isActive && 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm dark:border-emerald-500/45 dark:bg-emerald-500/12 dark:text-emerald-200'
                            )}
                          >
                            <NavLink
                              to={link.to}
                              className={({ isActive: navIsActive }) => cn(
                                'flex w-full items-center gap-3 text-sm font-medium text-muted-foreground transition-colors',
                                (isActive || navIsActive) && 'text-emerald-700 dark:text-emerald-200'
                              )}
                            >
                              <span className={cn(
                                'flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-100 text-emerald-700 transition-all group-hover:border-emerald-300 group-hover:bg-emerald-100 group-hover:text-emerald-700 dark:border-emerald-500/12 dark:bg-emerald-500/8 dark:text-emerald-400 dark:group-hover:border-emerald-500/30 dark:group-hover:bg-emerald-500/12 dark:group-hover:text-emerald-300',
                                isActive && 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-500/14 dark:text-emerald-300'
                              )}>
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="truncate">{link.label}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarContent>
                <SidebarFooter className="px-5 pb-6 pt-0">
                  <div className="flex items-start gap-3 rounded-2xl border border-border bg-background/70 p-3 shadow-sm">
                    <Sparkles className="mt-1 h-4 w-4 text-emerald-500" />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {t('admin.footer.tip')}
                    </p>
                  </div>
                </SidebarFooter>
              </Sidebar>
              <SidebarInset className="relative flex flex-1 flex-col bg-transparent">
                <header className="top-16 z-30 flex flex-col gap-5 border-b border-transparent px-6 pb-4 pt-6 md:px-10">
                  <div className="flex flex-wrap items-center gap-4">
                    <SidebarTrigger className="md:hidden" />
                    <div className="flex flex-col gap-2">
                      <Badge
                        variant="outline"
                        className="w-fit rounded-full border-emerald-200 bg-emerald-100/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-700 dark:border-emerald-300/40 dark:bg-emerald-500/18 dark:text-emerald-100 dark:shadow-[0_0_0_1px_rgba(110,231,183,0.08)]"
                      >
                        {t('admin.header.section')}
                      </Badge>
                      <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{activeLink?.label}</h1>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <Button
                        variant="outline"
                        className="hidden items-center gap-2 rounded-full border-emerald-200 bg-background/80 px-4 md:inline-flex"
                        onClick={() => setCommandOpen(true)}
                      >
                        <Bot className="h-4 w-4" />
                        {t('admin.command.open')}
                      </Button>
                      <Button variant="ghost" className="md:hidden" onClick={() => setCommandOpen(true)}>
                        <Bot className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="default"
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4"
                        onClick={() => navigate('/admin/badges?create=1')}
                      >
                        <Award className="h-4 w-4" />
                        {t('admin.header.quickBadge')}
                      </Button>
                    </div>
                  </div>
                </header>
                <main className="px-6 pb-10 pt-6 md:px-10">
                  <div className="mx-auto w-full max-w-7xl space-y-6">
                    <Outlet />
                  </div>
                </main>
              </SidebarInset>
            </div>
          </div>
        </SidebarProvider>
      </div>
    </QueryClientProvider>
  );
}
