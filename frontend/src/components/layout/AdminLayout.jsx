import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  CommandDialog,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from '../ui/command';
import { cn } from '../../lib/utils';
import {
  Award,
  Bot,
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

function AiBubble({ role, content, suggestion, proposal, onSelectSuggestion, onConfirmProposal, onRejectProposal, disabled, t }) {
  const isUser = role === 'user';
  const bubbleClass = isUser
    ? 'bg-muted text-foreground'
    : 'border border-emerald-100 bg-emerald-50 text-emerald-950';

  return (
    <div className={cn('flex flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', isUser ? 'bg-muted text-muted-foreground' : 'bg-emerald-100 text-emerald-700')}>
        {isUser ? t('admin.command.userLabel') : t('admin.command.aiLabel')}
      </span>
      <div className={cn('max-w-full rounded-2xl px-3 py-2 text-sm shadow-sm', bubbleClass)}>
        {content || t('admin.command.aiEmptyMessage')}
      </div>
      {suggestion?.route && (
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          onClick={() => onSelectSuggestion(suggestion)}
        >
          {suggestion.label || t('admin.command.openSuggestion')}
        </Button>
      )}
      {proposal?.proposal_id && proposal?.status === 'pending' && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="rounded-full bg-emerald-600"
            disabled={disabled}
            onClick={() => onConfirmProposal(proposal.proposal_id)}
          >
            {t('admin.command.confirmAction')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
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
      const nextConversation = payload.conversation || null;
      setCurrentConversation(nextConversation);
      setCurrentConversationId(payload.conversation_id || nextConversation?.conversation_id || null);
      setCommandQuery('');
      await loadConversations();
    } catch (error) {
      toast.error(error?.response?.data?.error || t('admin.command.aiErrorGeneric'));
    } finally {
      setIsSending(false);
    }
  }, [aiContext, commandQuery, currentConversationId, isSending, loadConversations, t]);

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
      setCurrentConversation(response.data?.conversation || null);
      await loadConversations();
    } catch (error) {
      toast.error(error?.response?.data?.error || t('admin.command.decisionFailed'));
    } finally {
      setIsDeciding(false);
    }
  }, [aiContext, currentConversationId, isDeciding, loadConversations, t]);

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

  const commandMessages = Array.isArray(currentConversation?.messages) ? currentConversation.messages : [];
  const canSendAiCommand = commandQuery.trim().length >= COMMAND_MIN_LENGTH && !isSending;

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <SidebarProvider>
          <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
            <CommandInput
              value={commandQuery}
              onValueChange={setCommandQuery}
              onKeyDown={handleCommandKeyDown}
              placeholder={t('admin.command.placeholder')}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
              <span className="text-[11px]">{t('admin.command.aiHint')}</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="rounded-full" onClick={startNewConversation}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {t('admin.command.newConversation')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  disabled={!canSendAiCommand}
                  onClick={sendAiMessage}
                >
                  {isSending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Bot className="mr-1 h-3.5 w-3.5 text-emerald-600" />}
                  {isSending ? t('admin.command.aiSending') : t('admin.command.send')}
                </Button>
              </div>
            </div>
            <CommandList>
              <CommandEmpty>{t('admin.command.noResults')}</CommandEmpty>
              <div className="grid gap-4 px-4 py-3 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('admin.command.history')}
                    </div>
                    {isLoadingConversations && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  </div>
                  <div className="space-y-2">
                    {conversationList.map((item) => (
                      <button
                        key={item.conversation_id}
                        type="button"
                        className={cn(
                          'w-full rounded-2xl border px-3 py-2 text-left text-sm transition-colors',
                          currentConversationId === item.conversation_id
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-border bg-card hover:border-emerald-200 hover:bg-emerald-50/60'
                        )}
                        onClick={() => loadConversationDetail(item.conversation_id)}
                      >
                        <div className="truncate font-medium">{item.title || t('admin.command.untitledConversation')}</div>
                        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {item.last_message_preview || t('admin.command.noConversationSummary')}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{item.message_count || 0} {t('admin.command.messagesCount')}</span>
                          {item.pending_action_count > 0 && (
                            <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-700">
                              {t('admin.command.pendingActions', { count: item.pending_action_count })}
                            </Badge>
                          )}
                        </div>
                      </button>
                    ))}
                    {conversationList.length === 0 && !isLoadingConversations && (
                      <div className="rounded-2xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                        {t('admin.command.aiEmptyState')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {commandMessages.length === 0 ? (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                        {t('admin.command.sessionEmptyHint')}
                      </div>
                      <CommandGroup heading={t('admin.command.quickActions')}>
                        {quickActions.map((action) => (
                          <CommandItem key={action.id} value={action.label} onSelect={() => {
                            action.onSelect();
                            setCommandOpen(false);
                          }}>
                            <Sparkles className="h-4 w-4" />
                            <div className="flex flex-col">
                              <span>{action.label}</span>
                              <span className="text-xs text-muted-foreground">{action.description}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </div>
                  ) : (
                    <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
                      {commandMessages.map((message) => {
                        if (message.kind !== 'message') {
                          return null;
                        }
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
                  )}

                  <CommandGroup heading={t('admin.command.navigation')}>
                    {translatedLinks.map((link) => (
                      <CommandItem
                        key={link.to}
                        value={link.label}
                        onSelect={() => {
                          navigate(link.to);
                          setCommandOpen(false);
                        }}
                      >
                        <link.icon className="h-4 w-4" />
                        {link.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </div>
              </div>
            </CommandList>
          </CommandDialog>

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
                      <Badge variant="outline" className="w-fit rounded-full border-emerald-200 bg-emerald-100/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-600">
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
