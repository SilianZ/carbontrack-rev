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

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <a
          key={attachment.id ?? attachment.file_path}
          href={attachment.download_url || attachment.file_path}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {isImageAttachment(attachment) ? <ImageIcon className="h-3.5 w-3.5" /> : <Paperclip className="h-3.5 w-3.5" />}
          {attachment.original_name}
        </a>
      ))}
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

export default function SupportTicketDetailPage() {
  const { ticketId } = useParams();
  const { t, currentLanguage } = useTranslation();
  const queryClient = useQueryClient();
  const [attachments, setAttachments] = useState([]);
  const [status, setStatus] = useState('open');
  const [priority, setPriority] = useState('normal');
  const [assignedTo, setAssignedTo] = useState('none');
  const [transferTo, setTransferTo] = useState('none');
  const [transferReason, setTransferReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState({});

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
  const assignees = assigneesQuery.data ?? [];
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
          <Badge variant="outline">
            {t(`support.categories.${ticket.category}`)}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('support.portal.tagsTitle')}</CardTitle>
              <CardDescription>{t('support.portal.tagsSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(ticket.tags ?? []).length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('support.portal.noTags')}</p>
              )}
              {(ticket.tags ?? []).map((tag) => (
                <div
                  key={tag.id}
                  className="flex flex-col gap-3 rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/30"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={getTagTone(tag.color)}>
                      {tag.name}
                    </Badge>
                    <span className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                      {t(`support.portal.tagSource.${tag.source_type || 'rule'}`)}
                    </span>
                    {tag.rule_id ? (
                      <span className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                        {t('support.portal.ruleLabel', { id: tag.rule_id })}
                      </span>
                    ) : null}
                  </div>
                  {tag.description ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">{tag.description}</p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          {ticket.messages?.map((message) => (
            <Card key={message.id}>
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{message.sender_name || t('support.thread.unknownSender')}</p>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                      {t(`support.senderRoles.${message.sender_role}`)}
                    </p>
                  </div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                    {formatSupportDate(message.created_at, currentLanguage === 'zh' ? 'zh-CN' : 'en-US')}
                  </p>
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{message.body}</p>
                <SupportAttachmentList attachments={message.attachments} />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('support.portal.requesterTitle')}</CardTitle>
              <CardDescription>{t('support.portal.requesterSubtitle')}</CardDescription>
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
                <span>{formatSupportDate(ticket.created_at, currentLanguage === 'zh' ? 'zh-CN' : 'en-US')}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('support.portal.workflowTitle')}</CardTitle>
              <CardDescription>{t('support.portal.workflowSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <div className="space-y-3 rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/30">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium">{t('support.portal.assignedTo')}</span>
                    <span className="text-sm">{currentAssignee?.username || currentAssignee?.email || t('support.portal.unassigned')}</span>
                  </div>
                  {currentAssignee ? (
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                          {t('support.portal.workload.assigned')}
                        </p>
                        <p className="mt-2 text-xl font-semibold">{currentAssignee.assigned_total_count ?? 0}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                          {t('support.portal.workload.notStarted')}
                        </p>
                        <p className="mt-2 text-xl font-semibold">{currentAssignee.open_count ?? 0}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                          {t('support.portal.workload.inProgress')}
                        </p>
                        <p className="mt-2 text-xl font-semibold">{currentAssignee.in_progress_count ?? 0}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              <Button type="button" className="w-full rounded-full" onClick={handleWorkflowSave} loading={updateMutation.isLoading}>
                <Save className="mr-2 h-4 w-4" />
                {t('support.portal.saveWorkflow')}
              </Button>
            </CardContent>
          </Card>

          {!isAdmin && isCurrentAssignee && (
            <Card>
              <CardHeader>
                <CardTitle>{t('support.portal.transfer.title')}</CardTitle>
                <CardDescription>{t('support.portal.transfer.subtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{t('support.portal.transfer.historyTitle')}</CardTitle>
              <CardDescription>{t('support.portal.transfer.historySubtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(ticket.transfer_requests ?? []).length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('support.portal.transfer.empty')}</p>
              )}

              {(ticket.transfer_requests ?? []).map((request) => (
                <div
                  key={request.id}
                  className="space-y-3 rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={transferStatusTone(request.status)}>
                        {t(`support.transferStatuses.${request.status}`)}
                      </Badge>
                      <span className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                        {formatSupportDate(request.created_at, currentLanguage === 'zh' ? 'zh-CN' : 'en-US')}
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

                  {isAdmin && request.status === 'pending' ? (
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
                </div>
              ))}

              {isAdmin && pendingTransferRequests.length > 0 ? (
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  {t('support.portal.transfer.pendingHint', { count: pendingTransferRequests.length })}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('support.portal.feedbackTitle')}</CardTitle>
              <CardDescription>{t('support.portal.feedbackSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {feedbackEntries.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('support.portal.feedbackEmpty')}</p>
              )}

              {feedbackEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="space-y-3 rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/30"
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
                      <span>
                        {formatSupportDate(entry.updated_at || entry.created_at, currentLanguage === 'zh' ? 'zh-CN' : 'en-US')}
                      </span>
                    </div>
                  </div>
                  {entry.comment ? (
                    <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{entry.comment}</p>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('support.portal.feedbackNoComment')}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
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

                <Button type="submit" className="w-full rounded-full" loading={replyMutation.isLoading}>
                  <Send className="mr-2 h-4 w-4" />
                  {t('support.portal.replySubmit')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
