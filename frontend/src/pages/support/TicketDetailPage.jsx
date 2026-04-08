import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'react-hot-toast';
import {
  ArrowLeft,
  Check,
  ImageIcon,
  Paperclip,
  Save,
  Send,
  Star,
  Shuffle,
  X,
} from 'lucide-react';

import { useTranslation } from '../../hooks/useTranslation';
import { supportAPI } from '../../lib/api';
import { checkAuthStatus } from '../../lib/auth';
import {
  formatSupportDate,
  getPriorityVariant,
  getSlaMeta,
  getSlaMilestoneMeta,
  getSlaTone,
  getStatusTone,
  getTagTone,
  isImageAttachment,
  mergeUploadedFiles,
  TICKET_PRIORITY_OPTIONS,
  TICKET_STATUS_OPTIONS,
} from '../../lib/supportTickets';
import FileUpload from '../../components/FileUpload';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/Alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

const replySchema = z.object({
  content: z.string().trim().min(2).max(5000),
});

function SupportAttachmentList({ attachments }) {
  if (!attachments?.length) {
    return null;
  }

  const imageAttachments = attachments.filter((attachment) => isImageAttachment(attachment));
  const fileAttachments = attachments.filter((attachment) => !isImageAttachment(attachment));

  return (
    <div className="mt-4 space-y-3">
      {imageAttachments.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {imageAttachments.map((attachment) => {
            const href = attachment.download_url || attachment.public_url || attachment.file_path;
            return (
              <a
                key={attachment.id ?? attachment.file_path}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-sky-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="aspect-square bg-slate-100 dark:bg-slate-800">
                  <img
                    src={href}
                    alt={attachment.original_name}
                    className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                </div>
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                  <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{attachment.original_name}</span>
                </div>
              </a>
            );
          })}
        </div>
      ) : null}

      {fileAttachments.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {fileAttachments.map((attachment) => (
            <a
              key={attachment.id ?? attachment.file_path}
              href={attachment.download_url || attachment.public_url || attachment.file_path}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Paperclip className="h-3.5 w-3.5" />
              {attachment.original_name}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function assigneeLabel(assignee, t) {
  const identity = assignee.username || assignee.email || `#${assignee.id}`;
  return `${identity} · ${t('support.portal.workload.assigned')} ${assignee.assigned_total_count ?? 0} · ${t('support.portal.workload.notStarted')} ${assignee.open_count ?? 0} · ${t('support.portal.workload.inProgress')} ${assignee.in_progress_count ?? 0}`;
}

function transferStatusTone(status) {
  switch (status) {
    case 'approved':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200';
    case 'rejected':
      return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200';
    case 'cancelled':
      return 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-200';
    default:
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200';
  }
}

function messageTone(senderRole) {
  if (senderRole === 'support' || senderRole === 'admin') {
    return {
      align: 'justify-end',
      surface:
        'border-sky-200 bg-sky-50/80 text-slate-900 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-slate-100',
    };
  }

  return {
    align: 'justify-start',
    surface:
      'border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-100',
  };
}

const FEEDBACK_RATING_VALUES = [1, 2, 3, 4, 5];

function FeedbackStars({ value }) {
  return (
    <div className="flex items-center gap-1">
      {FEEDBACK_RATING_VALUES.map((ratingValue) => (
        <Star
          key={ratingValue}
          className={`h-4 w-4 ${ratingValue <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-700'}`}
        />
      ))}
    </div>
  );
}

function WorkflowLabelWithTooltip({ label, help }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
      <span>{label}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold text-slate-500 transition hover:border-sky-300 hover:text-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-400/50 dark:border-slate-600 dark:text-slate-300 dark:hover:border-sky-400/40 dark:hover:text-sky-200"
            aria-label={label}
          >
            ?
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8} className="max-w-[220px] leading-5">
          {help}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

export default function SupportTicketDetailPage() {
  const { ticketId } = useParams();
  const { t, currentLanguage } = useTranslation();
  const queryClient = useQueryClient();
  const locale = currentLanguage === 'zh' ? 'zh-CN' : 'en-US';
  const [attachments, setAttachments] = useState([]);
  const [attachmentGate, setAttachmentGate] = useState({ hasPendingUploads: false, hasUploadErrors: false, isSubmissionBlocked: false });
  const [status, setStatus] = useState('open');
  const [priority, setPriority] = useState('normal');
  const [assignedTo, setAssignedTo] = useState('none');
  const [transferTo, setTransferTo] = useState('none');
  const [transferReason, setTransferReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState({});
  const [sidePanelTab, setSidePanelTab] = useState('workflow');

  const authState = useMemo(() => checkAuthStatus(), []);
  const currentUser = authState.user;
  const isAdmin = Boolean(currentUser?.is_admin || currentUser?.role === 'admin');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(replySchema),
    defaultValues: { content: '' },
  });

  const ticketQuery = useQuery(
    ['support-ticket-detail', ticketId],
    () => supportAPI.getTicket(ticketId),
    {
      enabled: Boolean(ticketId),
      refetchOnWindowFocus: false,
    }
  );

  const assigneesQuery = useQuery(
    ['support-assignees'],
    async () => {
      const response = await supportAPI.getAssignees();
      return response.data?.data ?? [];
    },
    {
      refetchOnWindowFocus: false,
    }
  );

  const updateMutation = useMutation(
    (payload) => supportAPI.updateTicket(ticketId, payload),
    {
      onSuccess: () => {
        toast.success(t('support.portal.ticketUpdated'));
        queryClient.invalidateQueries(['support-ticket-detail', ticketId]);
        queryClient.invalidateQueries(['support-queue']);
        queryClient.invalidateQueries(['support-assignees']);
      },
      onError: (error) => {
        const message = error?.response?.data?.message || error.message || t('errors.operationFailed');
        toast.error(message);
      },
    }
  );

  const replyMutation = useMutation(
    (payload) => supportAPI.replyTicket(ticketId, payload),
    {
      onSuccess: () => {
        toast.success(t('support.portal.replyCreated'));
        reset();
        setAttachments([]);
        queryClient.invalidateQueries(['support-ticket-detail', ticketId]);
        queryClient.invalidateQueries(['support-queue']);
      },
      onError: (error) => {
        const message = error?.response?.data?.message || error.message || t('errors.operationFailed');
        toast.error(message);
      },
    }
  );

  const transferRequestMutation = useMutation(
    (payload) => supportAPI.createTransferRequest(ticketId, payload),
    {
      onSuccess: () => {
        toast.success(t('support.portal.transfer.requestCreated'));
        setTransferTo('none');
        setTransferReason('');
        queryClient.invalidateQueries(['support-ticket-detail', ticketId]);
      },
      onError: (error) => {
        const message = error?.response?.data?.message || error.message || t('errors.operationFailed');
        toast.error(message);
      },
    }
  );

  const reviewTransferMutation = useMutation(
    ({ requestId, payload }) => supportAPI.reviewTransferRequest(requestId, payload),
    {
      onSuccess: () => {
        toast.success(t('support.portal.transfer.reviewSaved'));
        queryClient.invalidateQueries(['support-ticket-detail', ticketId]);
        queryClient.invalidateQueries(['support-queue']);
        queryClient.invalidateQueries(['support-assignees']);
      },
      onError: (error) => {
        const message = error?.response?.data?.message || error.message || t('errors.operationFailed');
        toast.error(message);
      },
    }
  );

  const ticket = ticketQuery.data?.data?.data;
  const assignees = useMemo(
    () => assigneesQuery.data ?? [],
    [assigneesQuery.data]
  );
  const currentAssignee = useMemo(
    () => assignees.find((entry) => String(entry.id) === String(ticket?.assigned_to ?? '')),
    [assignees, ticket?.assigned_to]
  );
  const isCurrentAssignee = Number(ticket?.assigned_to ?? 0) > 0 && Number(ticket?.assigned_to) === Number(currentUser?.id ?? 0);
  const transferableAssignees = useMemo(
    () => assignees.filter((entry) => String(entry.id) !== String(ticket?.assigned_to ?? '')),
    [assignees, ticket?.assigned_to]
  );
  const pendingTransferRequests = ticket?.transfer_requests?.filter((entry) => entry.status === 'pending') ?? [];
  const feedbackEntries = ticket?.feedback ?? [];

  useEffect(() => {
    if (!ticket) {
      return;
    }
    setStatus(ticket.status || 'open');
    setPriority(ticket.priority || 'normal');
    setAssignedTo(ticket.assigned_to ? String(ticket.assigned_to) : 'none');
  }, [ticket]);

  const handleWorkflowSave = () => {
    const payload = {
      status,
      priority,
    };

    if (isAdmin) {
      payload.assigned_to = assignedTo === 'none' ? null : Number(assignedTo);
    }

    updateMutation.mutate(payload);
  };

  const onReplySubmit = handleSubmit((values) => {
    if (attachmentGate.hasUploadErrors) {
      toast.error(t('support.attachments.uploadFailedBlocking'));
      return;
    }
    if (attachmentGate.hasPendingUploads) {
      toast.error(t('support.attachments.uploadRequired'));
      return;
    }

    replyMutation.mutate({
      content: values.content,
      attachments: attachments.map((file) => file.file_path),
    });
  });

  const handleCreateTransferRequest = () => {
    if (transferTo === 'none') {
      toast.error(t('support.portal.transfer.targetRequired'));
      return;
    }

    transferRequestMutation.mutate({
      to_assignee: Number(transferTo),
      reason: transferReason.trim(),
    });
  };

  const handleReviewTransfer = (requestId, statusValue) => {
    reviewTransferMutation.mutate({
      requestId,
      payload: {
        status: statusValue,
        review_note: reviewNotes[requestId]?.trim() || undefined,
      },
    });
  };

  if (ticketQuery.isLoading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{t('common.loading')}</p>;
  }

  if (!ticket) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('support.thread.notFound')}</AlertDescription>
      </Alert>
    );
  }

  const slaMeta = getSlaMeta(ticket, locale);
  const firstResponseMeta = getSlaMilestoneMeta(ticket, 'first_response', locale);
  const resolutionMeta = getSlaMilestoneMeta(ticket, 'resolution', locale);

  return (
    <div className="space-y-6">
      <Link to="/support/tickets" className="inline-flex items-center gap-2 text-sm font-medium text-sky-600 dark:text-sky-300">
        <ArrowLeft className="h-4 w-4" />
        {t('support.portal.backToQueue')}
      </Link>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">#{ticket.id}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{ticket.subject}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            {t('support.portal.threadSubtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className={getStatusTone(ticket.status)} variant="outline">
            {t(`support.statuses.${ticket.status}`)}
          </Badge>
          <Badge variant={getPriorityVariant(ticket.priority)}>
            {t(`support.priorities.${ticket.priority}`)}
          </Badge>
          {slaMeta.state ? (
            <Badge variant="outline" className={getSlaTone(slaMeta.state)}>
              {t('support.portal.slaBadge', {
                status: t(`support.slaStatuses.${slaMeta.state}`, { defaultValue: slaMeta.state }),
              })}
            </Badge>
          ) : null}
          <Badge variant="outline">
            {t(`support.categories.${ticket.category}`)}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card className="border-slate-200/80 shadow-sm dark:border-white/10">
            <CardHeader>
              <CardTitle>{t('support.portal.conversationTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(ticket.messages ?? []).map((message) => {
                const tone = messageTone(message.sender_role);

                return (
                  <div key={message.id} className={`flex ${tone.align}`}>
                    <div
                      className={`w-full max-w-[92%] rounded-[1.6rem] border px-5 py-4 shadow-sm ${tone.surface}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            {message.sender_name || t('support.thread.unknownSender')}
                          </p>
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                            {t(`support.senderRoles.${message.sender_role}`)}
                          </p>
                        </div>
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                          {formatSupportDate(message.created_at, locale)}
                        </p>
                      </div>
                      <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{message.body}</p>
                      <SupportAttachmentList attachments={message.attachments} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-sm dark:border-white/10">
            <CardHeader>
              <CardTitle>{t('support.portal.replyTitle')}</CardTitle>
              <CardDescription>{t('support.portal.replySubtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="space-y-4" onSubmit={onReplySubmit}>
                <Textarea
                  rows={6}
                  placeholder={t('support.portal.replyPlaceholder')}
                  {...register('content')}
                />
                {errors.content && <p className="text-sm text-red-600">{errors.content.message}</p>}

                <FileUpload
                  multiple
                  maxFiles={4}
                  directory="support-tickets"
                  entityType="support_ticket_message"
                  accept="image/*"
                  compressImages
                  onStateChange={setAttachmentGate}
                  onUploadSuccess={(result) => {
                    setAttachments((current) => mergeUploadedFiles(current, result));
                    toast.success(t('support.feedback.uploaded'));
                  }}
                  onUploadError={(error) => toast.error(error?.message || t('errors.uploadFailed'))}
                />

                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((file) => (
                      <button
                        key={file.file_path}
                        type="button"
                        onClick={() => setAttachments((current) => current.filter((entry) => entry.file_path !== file.file_path))}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        {file.original_name}
                      </button>
                    ))}
                  </div>
                )}
                {attachmentGate.hasUploadErrors ? (
                  <Alert>
                    <AlertDescription>{t('support.attachments.uploadFailedBlocking')}</AlertDescription>
                  </Alert>
                ) : null}
                {attachmentGate.hasPendingUploads ? (
                  <Alert>
                    <AlertDescription>{t('support.attachments.uploadRequired')}</AlertDescription>
                  </Alert>
                ) : null}

                <Button
                  type="submit"
                  className="w-full rounded-full"
                  loading={replyMutation.isLoading}
                  disabled={attachmentGate.isSubmissionBlocked}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {t('support.portal.replySubmit')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Card className="border-slate-200/80 shadow-sm dark:border-white/10">
            <CardHeader>
              <CardTitle>{t('support.portal.ticketMetaTitle', { defaultValue: t('support.portal.requesterTitle') })}</CardTitle>
              <CardDescription>{t('support.portal.ticketMetaSubtitle', { defaultValue: t('support.portal.requesterSubtitle') })}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">{t('support.portal.requesterName')}</span>
                <span>{ticket.requester?.username || '--'}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">{t('support.portal.requesterEmail')}</span>
                <span className="truncate">{ticket.requester?.email || '--'}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">{t('support.portal.createdAt')}</span>
                <span>{formatSupportDate(ticket.created_at, locale)}</span>
              </div>
              {(ticket.tags ?? []).length > 0 && (
                <div className="pt-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{t('support.portal.tagsTitle')}</p>
                  <div className="flex flex-wrap gap-2">
                    {(ticket.tags ?? []).map((tag) => (
                      <Badge key={tag.id} variant="outline" className={getTagTone(tag.color)}>
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-sm dark:border-white/10">
            <CardContent className="pt-6">
              <Tabs value={sidePanelTab} onValueChange={setSidePanelTab} className="space-y-5">
                <TabsList className="grid w-full grid-cols-3 overflow-hidden rounded-[1.2rem] border-slate-200 bg-slate-100/90 dark:border-white/10 dark:bg-white/5">
                  <TabsTrigger value="workflow" className="border-r-slate-200 dark:border-r-white/10">
                    {t('support.portal.workflowTab')}
                  </TabsTrigger>
                  <TabsTrigger value="transfer" className="border-r-slate-200 dark:border-r-white/10">
                    {t('support.portal.transferTab')}
                  </TabsTrigger>
                  <TabsTrigger value="feedback">{t('support.portal.feedbackTab')}</TabsTrigger>
                </TabsList>

                <TabsContent value="workflow" className="space-y-4">
                  <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-white/5">
                    <div className="grid gap-3 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500 dark:text-slate-400">{t('support.portal.firstResponseDueLabel')}</span>
                        <div className="text-right">
                          <div>{firstResponseMeta.dueAtLabel}</div>
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{firstResponseMeta.relativeLabel}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500 dark:text-slate-400">{t('support.portal.resolutionDueLabel')}</span>
                        <div className="text-right">
                          <div>{resolutionMeta.dueAtLabel}</div>
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{resolutionMeta.relativeLabel}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <WorkflowLabelWithTooltip
                          label={t('support.portal.assignmentSourceLabel')}
                          help={t('support.portal.assignmentSourceHelp')}
                        />
                        <span>{ticket.assignment_source || '--'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <WorkflowLabelWithTooltip
                          label={t('support.portal.escalationLevelLabel')}
                          help={t('support.portal.escalationLevelHelp')}
                        />
                        <span>{ticket.escalation_level ?? 0}</span>
                      </div>
                      {ticket.routing_summary ? (
                        <>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">{t('support.portal.routingLastRunLabel')}</span>
                            <span>#{ticket.routing_summary.last_run_id ?? '--'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">{t('support.portal.routingFallbackLabel')}</span>
                            <span className="text-right">{ticket.routing_summary.fallback_reason || '--'}</span>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('support.filters.status')}</label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TICKET_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('support.feedback.fields.priority')}</label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TICKET_PRIORITY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {isAdmin ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t('support.portal.assignedTo')}</label>
                      <Select value={assignedTo} onValueChange={setAssignedTo}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t('support.portal.unassigned')}</SelectItem>
                          {assignees.map((assignee) => (
                            <SelectItem key={assignee.id} value={String(assignee.id)}>
                              {assigneeLabel(assignee, t)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-white/5">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm font-medium">{t('support.portal.assignedTo')}</span>
                        <span className="text-right text-sm">{currentAssignee?.username || currentAssignee?.email || t('support.portal.unassigned')}</span>
                      </div>
                      {currentAssignee ? (
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-slate-950/70">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                              {t('support.portal.workload.assigned')}
                            </p>
                            <p className="mt-2 text-xl font-semibold">{currentAssignee.assigned_total_count ?? 0}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-slate-950/70">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                              {t('support.portal.workload.notStarted')}
                            </p>
                            <p className="mt-2 text-xl font-semibold">{currentAssignee.open_count ?? 0}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-slate-950/70">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                              {t('support.portal.workload.inProgress')}
                            </p>
                            <p className="mt-2 text-xl font-semibold">{currentAssignee.in_progress_count ?? 0}</p>
                          </div>
                        </div>
                      ) : null}
                      {ticket.assignment_locked ? (
                        <Alert>
                          <AlertDescription>{t('support.portal.assignmentLockedHint')}</AlertDescription>
                        </Alert>
                      ) : null}
                    </div>
                  )}

                  <Button type="button" className="w-full rounded-full" onClick={handleWorkflowSave} loading={updateMutation.isLoading}>
                    <Save className="mr-2 h-4 w-4" />
                    {t('support.portal.saveWorkflow')}
                  </Button>
                </TabsContent>

                <TabsContent value="transfer" className="space-y-4">
                  {!isAdmin && isCurrentAssignee ? (
                    <div className="space-y-4 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-white/5">
                      <div>
                        <p className="text-sm font-semibold">{t('support.portal.transfer.title')}</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('support.portal.transfer.subtitle')}</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t('support.portal.transfer.target')}</label>
                        <Select value={transferTo} onValueChange={setTransferTo}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t('support.portal.transfer.targetPlaceholder')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t('support.portal.transfer.targetPlaceholder')}</SelectItem>
                            {transferableAssignees.map((assignee) => (
                              <SelectItem key={assignee.id} value={String(assignee.id)}>
                                {assigneeLabel(assignee, t)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t('support.portal.transfer.reason')}</label>
                        <Textarea
                          rows={4}
                          value={transferReason}
                          onChange={(event) => setTransferReason(event.target.value)}
                          placeholder={t('support.portal.transfer.reasonPlaceholder')}
                        />
                      </div>
                      <Button type="button" className="w-full rounded-full" onClick={handleCreateTransferRequest} loading={transferRequestMutation.isLoading}>
                        <Shuffle className="mr-2 h-4 w-4" />
                        {t('support.portal.transfer.submit')}
                      </Button>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    {(ticket.transfer_requests ?? []).length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t('support.portal.transfer.empty')}</p>
                    ) : null}

                    {(ticket.transfer_requests ?? []).map((request) => (
                      <div
                        key={request.id}
                        className="space-y-3 rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-white/5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={transferStatusTone(request.status)}>
                              {t(`support.transferStatuses.${request.status}`)}
                            </Badge>
                            <span className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                              {formatSupportDate(request.created_at, locale)}
                            </span>
                          </div>
                          <span className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                            #{request.id}
                          </span>
                        </div>

                        <div className="space-y-2 text-sm">
                          <p>
                            {t('support.portal.transfer.requestLine', {
                              from: request.from_user?.username || request.from_user?.email || t('support.portal.unassigned'),
                              to: request.to_user?.username || request.to_user?.email || `#${request.to_assignee}`,
                            })}
                          </p>
                          <p className="text-slate-500 dark:text-slate-400">
                            {t('support.portal.transfer.requestedBy', {
                              name: request.requester?.username || request.requester?.email || `#${request.requested_by}`,
                            })}
                          </p>
                          {request.reason ? (
                            <p className="whitespace-pre-wrap text-slate-500 dark:text-slate-400">{request.reason}</p>
                          ) : null}
                          {request.review_note ? (
                            <p className="whitespace-pre-wrap text-slate-500 dark:text-slate-400">
                              {t('support.portal.transfer.reviewNoteLabel')}: {request.review_note}
                            </p>
                          ) : null}
                        </div>

                        {request.status === 'pending' && Number(request.to_assignee) === Number(currentUser?.id ?? 0) ? (
                          <div className="space-y-3">
                            <Textarea
                              rows={3}
                              value={reviewNotes[request.id] ?? ''}
                              onChange={(event) => setReviewNotes((current) => ({ ...current, [request.id]: event.target.value }))}
                              placeholder={t('support.portal.transfer.reviewPlaceholder')}
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                className="rounded-full"
                                onClick={() => handleReviewTransfer(request.id, 'approved')}
                                loading={reviewTransferMutation.isLoading}
                              >
                                <Check className="mr-2 h-4 w-4" />
                                {t('support.portal.transfer.approve')}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-full"
                                onClick={() => handleReviewTransfer(request.id, 'rejected')}
                                loading={reviewTransferMutation.isLoading}
                              >
                                <X className="mr-2 h-4 w-4" />
                                {t('support.portal.transfer.reject')}
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        {request.status === 'pending' && Number(request.requested_by) === Number(currentUser?.id ?? 0) ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-full"
                            onClick={() => handleReviewTransfer(request.id, 'cancelled')}
                            loading={reviewTransferMutation.isLoading}
                          >
                            <X className="mr-2 h-4 w-4" />
                            {t('support.portal.transfer.cancel')}
                          </Button>
                        ) : null}
                      </div>
                    ))}

                    {pendingTransferRequests.length > 0 ? (
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                        {t('support.portal.transfer.pendingHint', { count: pendingTransferRequests.length })}
                      </p>
                    ) : null}
                  </div>
                </TabsContent>

                <TabsContent value="feedback" className="space-y-3">
                  {feedbackEntries.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('support.portal.feedbackEmpty')}</p>
                  ) : null}

                  {feedbackEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="space-y-3 rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            {entry.rated_user?.username || entry.rated_user?.email || `#${entry.rated_user_id}`}
                          </p>
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                            {t('support.portal.feedbackRatedBy', {
                              name: entry.reviewer?.username || entry.reviewer?.email || `#${entry.user_id}`,
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                          <FeedbackStars value={entry.rating} />
                          <span>{formatSupportDate(entry.updated_at || entry.created_at, locale)}</span>
                        </div>
                      </div>
                      {entry.comment ? (
                        <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{entry.comment}</p>
                      ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">{t('support.portal.feedbackNoComment')}</p>
                      )}
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
