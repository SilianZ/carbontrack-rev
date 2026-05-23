import Silian_React, { useEffect as Silian_useEffect, useMemo as Silian_useMemo, useRef as Silian_useRef, useState as Silian_useState } from 'react';
import { Link as Silian_Link, useParams as Silian_useParams } from 'react-router-dom';
import { useMutation as Silian_useMutation, useQuery as Silian_useQuery, useQueryClient as Silian_useQueryClient } from 'react-query';
import { useForm as Silian_useForm } from 'react-hook-form';
import { z as Silian_z } from 'zod';
import { zodResolver as Silian_zodResolver } from '@hookform/resolvers/zod';
import { toast as Silian_toast } from 'react-hot-toast';
import {
  ArrowLeft as Silian_ArrowLeft,
  Check as Silian_Check,
  CheckCircle2 as Silian_CheckCircle2,
  Headset as Silian_Headset,
  ImageIcon as Silian_ImageIcon,
  Paperclip as Silian_Paperclip,
  Save as Silian_Save,
  Send as Silian_Send,
  Shield as Silian_Shield,
  Star as Silian_Star,
  Shuffle as Silian_Shuffle,
  UserRound as Silian_UserRound,
  X as Silian_X,
} from 'lucide-react';

import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { supportAPI as Silian_supportAPI } from '../../lib/api';
import { checkAuthStatus as Silian_checkAuthStatus } from '../../lib/auth';
import { buildAvatarDisplayProps as Silian_buildAvatarDisplayProps } from '../../lib/avatarUtils';
import {
  formatSupportDate as Silian_formatSupportDate,
  getPriorityVariant as Silian_getPriorityVariant,
  getSlaMeta as Silian_getSlaMeta,
  getSlaMilestoneMeta as Silian_getSlaMilestoneMeta,
  getSlaTone as Silian_getSlaTone,
  getStatusTone as Silian_getStatusTone,
  getTagTone as Silian_getTagTone,
  isImageAttachment as Silian_isImageAttachment,
  mergeUploadedFiles as Silian_mergeUploadedFiles,
  TICKET_PRIORITY_OPTIONS as Silian_TICKET_PRIORITY_OPTIONS,
  TICKET_STATUS_OPTIONS as Silian_TICKET_STATUS_OPTIONS,
} from '../../lib/supportTickets';
import Silian_FileUpload from '../../components/FileUpload';
import Silian_R2Image from '../../components/common/R2Image';
import { Button as Silian_Button } from '../../components/ui/Button';
import { Textarea as Silian_Textarea } from '../../components/ui/textarea';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../../components/ui/Card';
import { Badge as Silian_Badge } from '../../components/ui/badge';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription } from '../../components/ui/Alert';
import { Tabs as Silian_Tabs, TabsContent as Silian_TabsContent, TabsList as Silian_TabsList, TabsTrigger as Silian_TabsTrigger } from '../../components/ui/Tabs';
import { Tooltip as Silian_Tooltip, TooltipContent as Silian_TooltipContent, TooltipTrigger as Silian_TooltipTrigger } from '../../components/ui/tooltip';
import {
  Select as Silian_Select,
  SelectContent as Silian_SelectContent,
  SelectItem as Silian_SelectItem,
  SelectTrigger as Silian_SelectTrigger,
  SelectValue as Silian_SelectValue,
} from '../../components/ui/select';

const Silian_replySchema = Silian_z.object({
  content: Silian_z.string().trim().min(2).max(5000),
});

function Silian_SupportAttachmentList({ attachments: Silian_attachments }) {
  if (!Silian_attachments?.length) {
    return null;
  }

  const Silian_imageAttachments = Silian_attachments.filter((Silian_attachment) => Silian_isImageAttachment(Silian_attachment));
  const Silian_fileAttachments = Silian_attachments.filter((Silian_attachment) => !Silian_isImageAttachment(Silian_attachment));

  return (
    <div className="mt-4 space-y-3">
      {Silian_imageAttachments.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Silian_imageAttachments.map((Silian_attachment) => {
            const Silian_href = Silian_attachment.download_url || Silian_attachment.public_url || Silian_attachment.file_path;
            return (
              <a
                key={Silian_attachment.id ?? Silian_attachment.file_path}
                href={Silian_href}
                target="_blank"
                rel="noopener noreferrer"
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-sky-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="aspect-square bg-slate-100 dark:bg-slate-800">
                  <img
                    src={Silian_href}
                    alt={Silian_attachment.original_name}
                    className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                </div>
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                  <Silian_ImageIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{Silian_attachment.original_name}</span>
                </div>
              </a>
            );
          })}
        </div>
      ) : null}

      {Silian_fileAttachments.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {Silian_fileAttachments.map((Silian_attachment) => (
            <a
              key={Silian_attachment.id ?? Silian_attachment.file_path}
              href={Silian_attachment.download_url || Silian_attachment.public_url || Silian_attachment.file_path}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Silian_Paperclip className="h-3.5 w-3.5" />
              {Silian_attachment.original_name}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Silian_assigneeLabel(Silian_assignee, Silian_t) {
  const Silian_identity = Silian_assignee.username || Silian_assignee.email || `#${Silian_assignee.id}`;
  return `${Silian_identity} · ${Silian_t('support.portal.workload.assigned')} ${Silian_assignee.assigned_total_count ?? 0} · ${Silian_t('support.portal.workload.notStarted')} ${Silian_assignee.open_count ?? 0} · ${Silian_t('support.portal.workload.inProgress')} ${Silian_assignee.in_progress_count ?? 0}`;
}

function Silian_transferStatusTone(Silian_status) {
  switch (Silian_status) {
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

function Silian_messageTone(Silian_senderRole) {
  if (Silian_senderRole === 'support' || Silian_senderRole === 'admin') {
    return {
      align: 'justify-end',
      rowDirection: 'flex-row-reverse',
      surface:
        Silian_senderRole === 'admin'
          ? 'border-violet-200 bg-violet-50/80 text-slate-900 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-slate-100'
          : 'border-sky-200 bg-sky-50/80 text-slate-900 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-slate-100',
      avatar:
        Silian_senderRole === 'admin'
          ? 'border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-400/30 dark:bg-violet-500/20 dark:text-violet-200'
          : 'border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/20 dark:text-sky-200',
      badge:
        Silian_senderRole === 'admin'
          ? 'border-violet-300 bg-white/80 text-violet-700 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-violet-200'
          : 'border-sky-300 bg-white/80 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-200',
      name: Silian_senderRole === 'admin' ? 'text-violet-700 dark:text-violet-200' : 'text-sky-700 dark:text-sky-200',
      timestamp: Silian_senderRole === 'admin' ? 'text-right text-violet-700/70 dark:text-violet-200/70' : 'text-right text-sky-700/70 dark:text-sky-200/70',
    };
  }

  return {
    align: 'justify-start',
    rowDirection: 'flex-row',
    surface:
      'border-emerald-200 bg-emerald-50/80 text-slate-900 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-slate-100',
    avatar:
      'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/20 dark:text-emerald-200',
    badge:
      'border-emerald-300 bg-white/80 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200',
    name: 'text-emerald-700 dark:text-emerald-200',
    timestamp: 'text-left text-emerald-700/70 dark:text-emerald-200/70',
  };
}

function Silian_MessageIdentity({ message: Silian_message, senderRole: Silian_senderRole, senderName: Silian_senderName, t: Silian_t, tone: Silian_tone }) {
  const Silian_Icon = Silian_senderRole === 'admin' ? Silian_Shield : Silian_senderRole === 'support' ? Silian_Headset : Silian_UserRound;
  const Silian_avatarDisplay = Silian_buildAvatarDisplayProps({
    avatar_path: Silian_message?.avatar_path,
    avatar_url: Silian_message?.avatar_url,
    name: Silian_senderName || Silian_t('support.thread.unknownSender'),
  });
  const Silian_hasAvatar = Boolean(Silian_avatarDisplay.src || Silian_avatarDisplay.filePath);

  return (
    <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border shadow-sm ${Silian_tone.avatar}`}>
      {Silian_hasAvatar ? (
        <Silian_R2Image
          src={Silian_avatarDisplay.src || undefined}
          filePath={!Silian_avatarDisplay.src && Silian_avatarDisplay.filePath ? Silian_avatarDisplay.filePath : undefined}
          alt={Silian_avatarDisplay.alt || Silian_senderName || Silian_t('support.thread.unknownSender')}
          className="h-full w-full object-cover"
        />
      ) : (
        <Silian_Icon className="h-4.5 w-4.5" />
      )}
      <div className={`absolute -bottom-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full border border-background shadow-sm ${Silian_tone.badge}`}>
        <Silian_Icon className="h-2.5 w-2.5" />
      </div>
      <span className="sr-only">{Silian_senderName || Silian_t('support.thread.unknownSender')}</span>
    </div>
  );
}

const Silian_FEEDBACK_RATING_VALUES = [1, 2, 3, 4, 5];

function Silian_FeedbackStars({ value: Silian_value }) {
  return (
    <div className="flex items-center gap-1">
      {Silian_FEEDBACK_RATING_VALUES.map((Silian_ratingValue) => (
        <Silian_Star
          key={Silian_ratingValue}
          className={`h-4 w-4 ${Silian_ratingValue <= Silian_value ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-700'}`}
        />
      ))}
    </div>
  );
}

function Silian_WorkflowLabelWithTooltip({ label: Silian_label, help: Silian_help }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
      <span>{Silian_label}</span>
      <Silian_Tooltip>
        <Silian_TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold text-slate-500 transition hover:border-sky-300 hover:text-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-400/50 dark:border-slate-600 dark:text-slate-300 dark:hover:border-sky-400/40 dark:hover:text-sky-200"
            aria-label={Silian_label}
          >
            ?
          </button>
        </Silian_TooltipTrigger>
        <Silian_TooltipContent side="top" sideOffset={8} className="max-w-[220px] leading-5">
          {Silian_help}
        </Silian_TooltipContent>
      </Silian_Tooltip>
    </span>
  );
}

export default function SupportTicketDetailPage() {
  const { ticketId: Silian_ticketId } = Silian_useParams();
  const { t: Silian_t, currentLanguage: Silian_currentLanguage } = Silian_useTranslation(['activities', 'common', 'date', 'errors', 'messages', 'support']);
  const Silian_queryClient = Silian_useQueryClient();
  const Silian_locale = Silian_currentLanguage === 'zh' ? 'zh-CN' : 'en-US';
  const [Silian_attachments, Silian_setAttachments] = Silian_useState([]);
  const [Silian_attachmentGate, Silian_setAttachmentGate] = Silian_useState({ hasPendingUploads: false, hasUploadErrors: false, isSubmissionBlocked: false });
  const [Silian_status, Silian_setStatus] = Silian_useState('open');
  const [Silian_priority, Silian_setPriority] = Silian_useState('normal');
  const [Silian_assignedTo, Silian_setAssignedTo] = Silian_useState('none');
  const [Silian_ticketWorkflowStateTicketId, Silian_setTicketWorkflowStateTicketId] = Silian_useState(null);
  const [Silian_transferTo, Silian_setTransferTo] = Silian_useState('none');
  const [Silian_transferReason, Silian_setTransferReason] = Silian_useState('');
  const [Silian_reviewNotes, Silian_setReviewNotes] = Silian_useState({});
  const [Silian_sidePanelTab, Silian_setSidePanelTab] = Silian_useState('workflow');
  const [Silian_replyMode, Silian_setReplyMode] = Silian_useState(null);
  const Silian_replyInFlightRef = Silian_useRef(false);

  const Silian_authState = Silian_useMemo(() => Silian_checkAuthStatus(), []);
  const Silian_currentUser = Silian_authState.user;
  const Silian_isAdmin = Boolean(Silian_currentUser?.is_admin || Silian_currentUser?.role === 'admin');

  const {
    register: Silian_register,
    handleSubmit: Silian_handleSubmit,
    reset: Silian_reset,
    formState: { errors: Silian_errors },
  } = Silian_useForm({
    resolver: Silian_zodResolver(Silian_replySchema),
    defaultValues: { content: '' },
  });

  const Silian_ticketQuery = Silian_useQuery(
    ['support-ticket-detail', Silian_ticketId],
    () => Silian_supportAPI.getTicket(Silian_ticketId),
    {
      enabled: Boolean(Silian_ticketId),
      refetchOnWindowFocus: false,
    }
  );

  const Silian_assigneesQuery = Silian_useQuery(
    ['support-assignees'],
    async () => {
      const Silian_response = await Silian_supportAPI.getAssignees();
      return Silian_response.data?.data ?? [];
    },
    {
      refetchOnWindowFocus: false,
    }
  );

  const Silian_updateMutation = Silian_useMutation(
    (Silian_payload) => Silian_supportAPI.updateTicket(Silian_ticketId, Silian_payload)
  );

  const Silian_replyMutation = Silian_useMutation(
    (Silian_payload) => Silian_supportAPI.replyTicket(Silian_ticketId, Silian_payload)
  );

  const Silian_transferRequestMutation = Silian_useMutation(
    (Silian_payload) => Silian_supportAPI.createTransferRequest(Silian_ticketId, Silian_payload),
    {
      onSuccess: () => {
        Silian_toast.success(Silian_t('support.portal.transfer.requestCreated'));
        Silian_setTransferTo('none');
        Silian_setTransferReason('');
        Silian_queryClient.invalidateQueries(['support-ticket-detail', Silian_ticketId]);
      },
      onError: (Silian_error) => {
        const Silian_message = Silian_error?.response?.data?.message || Silian_error.message || Silian_t('errors.operationFailed');
        Silian_toast.error(Silian_message);
      },
    }
  );

  const Silian_reviewTransferMutation = Silian_useMutation(
    ({ requestId: Silian_requestId, payload: Silian_payload }) => Silian_supportAPI.reviewTransferRequest(Silian_requestId, Silian_payload),
    {
      onSuccess: () => {
        Silian_toast.success(Silian_t('support.portal.transfer.reviewSaved'));
        Silian_queryClient.invalidateQueries(['support-ticket-detail', Silian_ticketId]);
        Silian_queryClient.invalidateQueries(['support-queue']);
        Silian_queryClient.invalidateQueries(['support-assignees']);
      },
      onError: (Silian_error) => {
        const Silian_message = Silian_error?.response?.data?.message || Silian_error.message || Silian_t('errors.operationFailed');
        Silian_toast.error(Silian_message);
      },
    }
  );

  const Silian_ticket = Silian_ticketQuery.data?.data?.data;
  const Silian_assignees = Silian_useMemo(
    () => Silian_assigneesQuery.data ?? [],
    [Silian_assigneesQuery.data]
  );
  const Silian_currentAssignee = Silian_useMemo(
    () => Silian_assignees.find((Silian_entry) => String(Silian_entry.id) === String(Silian_ticket?.assigned_to ?? '')),
    [Silian_assignees, Silian_ticket?.assigned_to]
  );
  const Silian_isCurrentAssignee = Number(Silian_ticket?.assigned_to ?? 0) > 0 && Number(Silian_ticket?.assigned_to) === Number(Silian_currentUser?.id ?? 0);
  const Silian_canManageWorkflow = Silian_isAdmin || Silian_isCurrentAssignee;
  const Silian_transferableAssignees = Silian_useMemo(
    () => Silian_assignees.filter((Silian_entry) => String(Silian_entry.id) !== String(Silian_ticket?.assigned_to ?? '')),
    [Silian_assignees, Silian_ticket?.assigned_to]
  );
  const Silian_pendingTransferRequests = Silian_ticket?.transfer_requests?.filter((Silian_entry) => Silian_entry.status === 'pending') ?? [];
  const Silian_feedbackEntries = Silian_ticket?.feedback ?? [];

  Silian_useEffect(() => {
    if (!Silian_ticket) {
      return;
    }
    Silian_setStatus(Silian_ticket.status || 'open');
    Silian_setPriority(Silian_ticket.priority || 'normal');
    Silian_setAssignedTo(Silian_ticket.assigned_to ? String(Silian_ticket.assigned_to) : 'none');
    Silian_setTicketWorkflowStateTicketId(Silian_ticket.id ?? null);
  }, [Silian_ticket]);

  const Silian_invalidateSupportViews = ({ includeAssignees: Silian_includeAssignees = false, includeAdminReports: Silian_includeAdminReports = false, includePendingTransfers: Silian_includePendingTransfers = false } = {}) => {
    Silian_queryClient.invalidateQueries(['support-ticket-detail', Silian_ticketId]);
    Silian_queryClient.invalidateQueries(['support-queue']);
    Silian_queryClient.invalidateQueries(['support-workbench-tickets']);
    Silian_queryClient.invalidateQueries(['admin-support-tickets']);
    Silian_queryClient.invalidateQueries(['admin-support-ticket-detail', Number(Silian_ticketId)]);
    if (Silian_includeAssignees) {
      Silian_queryClient.invalidateQueries(['support-assignees']);
    }
    if (Silian_includeAdminReports) {
      Silian_queryClient.invalidateQueries(['admin-support-reports']);
    }
    if (Silian_includePendingTransfers) {
      Silian_queryClient.invalidateQueries(['support-workbench-pending-transfers']);
    }
  };

  const Silian_resetReplyComposer = () => {
    Silian_reset();
    Silian_setAttachments([]);
  };

  const Silian_handleWorkflowSave = async () => {
    if (Silian_replyMode !== null || Silian_replyInFlightRef.current || Silian_updateMutation.isLoading || Silian_replyMutation.isLoading || !Silian_isTicketWorkflowStateSynced) {
      return;
    }

    const Silian_payload = {
      status: Silian_status,
      priority: Silian_priority,
    };

    if (Silian_isAdmin) {
      Silian_payload.assigned_to = Silian_assignedTo === 'none' ? null : Number(Silian_assignedTo);
    }

    try {
      await Silian_updateMutation.mutateAsync(Silian_payload);
      Silian_invalidateSupportViews({ includeAssignees: true, includeAdminReports: true });
      Silian_toast.success(Silian_t('support.portal.ticketUpdated'));
    } catch (Silian_error) {
      const Silian_message = Silian_error?.response?.data?.message || Silian_error?.message || Silian_t('errors.operationFailed');
      Silian_toast.error(Silian_message);
    }
  };

  const Silian_buildReplyPayload = (Silian_values, Silian_nextStatus = null) => {
    if (Silian_attachmentGate.hasUploadErrors) {
      Silian_toast.error(Silian_t('support.attachments.uploadFailedBlocking'));
      return null;
    }
    if (Silian_attachmentGate.hasPendingUploads) {
      Silian_toast.error(Silian_t('support.attachments.uploadRequired'));
      return null;
    }

    const Silian_payload = {
      content: Silian_values.content,
      attachments: Silian_attachments.map((Silian_file) => Silian_file.file_path),
    };

    if (Silian_nextStatus) {
      Silian_payload.status = Silian_nextStatus;
    }

    return Silian_payload;
  };

  const Silian_submitReply = async (Silian_values, Silian_nextStatus = null) => {
    if (Silian_replyInFlightRef.current) {
      return;
    }

    Silian_replyInFlightRef.current = true;
    Silian_setReplyMode(Silian_nextStatus ? 'resolve' : 'reply');
    const Silian_payload = Silian_buildReplyPayload(Silian_values, Silian_nextStatus);
    if (!Silian_payload) {
      Silian_setReplyMode(null);
      Silian_replyInFlightRef.current = false;
      return;
    }

    try {
      await Silian_replyMutation.mutateAsync(Silian_payload);
    } catch (Silian_error) {
      const Silian_message = Silian_error?.response?.data?.message || Silian_error?.message || Silian_t('errors.operationFailed');
      Silian_toast.error(Silian_message);
      Silian_setReplyMode(null);
      Silian_replyInFlightRef.current = false;
      return;
    }

    if (Silian_nextStatus) {
      Silian_setStatus(Silian_nextStatus);
    }

    Silian_resetReplyComposer();
    Silian_invalidateSupportViews({ includeAssignees: true, includeAdminReports: true });
    Silian_toast.success(Silian_nextStatus ? Silian_t('support.portal.replyResolveSuccess') : Silian_t('support.portal.replyCreated'));
    Silian_setReplyMode(null);
    Silian_replyInFlightRef.current = false;
  };

  const Silian_onReplySubmit = Silian_handleSubmit((Silian_values) => {
    void Silian_submitReply(Silian_values);
  });

  const Silian_onReplyAndResolve = Silian_handleSubmit((Silian_values) => {
    void Silian_submitReply(Silian_values, 'resolved');
  });

  const Silian_handleCreateTransferRequest = () => {
    if (Silian_transferTo === 'none') {
      Silian_toast.error(Silian_t('support.portal.transfer.targetRequired'));
      return;
    }

    Silian_transferRequestMutation.mutate({
      to_assignee: Number(Silian_transferTo),
      reason: Silian_transferReason.trim(),
    });
  };

  const Silian_handleReviewTransfer = (Silian_requestId, Silian_statusValue) => {
    Silian_reviewTransferMutation.mutate({
      requestId: Silian_requestId,
      payload: {
        status: Silian_statusValue,
        review_note: Silian_reviewNotes[Silian_requestId]?.trim() || undefined,
      },
    });
  };

  if (Silian_ticketQuery.isLoading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{Silian_t('common.loading')}</p>;
  }

  if (!Silian_ticket) {
    return (
      <Silian_Alert variant="destructive">
        <Silian_AlertDescription>{Silian_t('support.thread.notFound')}</Silian_AlertDescription>
      </Silian_Alert>
    );
  }

  const Silian_slaMeta = Silian_getSlaMeta(Silian_ticket, Silian_locale);
  const Silian_firstResponseMeta = Silian_getSlaMilestoneMeta(Silian_ticket, 'first_response', Silian_locale);
  const Silian_resolutionMeta = Silian_getSlaMilestoneMeta(Silian_ticket, 'resolution', Silian_locale);
  const Silian_isReplySubmitting = Silian_replyMutation.isLoading || Silian_updateMutation.isLoading;
  const Silian_replyActionsDisabled = Silian_attachmentGate.isSubmissionBlocked || Silian_isReplySubmitting || Silian_replyMode !== null;
  const Silian_isTicketWorkflowStateSynced = Number(Silian_ticket?.id ?? 0) > 0 && Number(Silian_ticketWorkflowStateTicketId ?? 0) === Number(Silian_ticket?.id ?? 0);
  const Silian_workflowActionsDisabled = Silian_updateMutation.isLoading || Silian_isReplySubmitting || Silian_replyMode !== null || !Silian_isTicketWorkflowStateSynced;

  return (
    <div className="space-y-6">
      <Silian_Link to="/support/tickets" className="inline-flex items-center gap-2 text-sm font-medium text-sky-600 dark:text-sky-300">
        <Silian_ArrowLeft className="h-4 w-4" />
        {Silian_t('support.portal.backToQueue')}
      </Silian_Link>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">#{Silian_ticket.id}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{Silian_ticket.subject}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            {Silian_t('support.portal.threadSubtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Silian_Badge className={Silian_getStatusTone(Silian_ticket.status)} variant="outline">
            {Silian_t(`support.statuses.${Silian_ticket.status}`)}
          </Silian_Badge>
          <Silian_Badge variant={Silian_getPriorityVariant(Silian_ticket.priority)}>
            {Silian_t(`support.priorities.${Silian_ticket.priority}`)}
          </Silian_Badge>
          {Silian_slaMeta.state ? (
            <Silian_Badge variant="outline" className={Silian_getSlaTone(Silian_slaMeta.state)}>
              {Silian_t('support.portal.slaBadge', {
                status: Silian_t(`support.slaStatuses.${Silian_slaMeta.state}`, { defaultValue: Silian_slaMeta.state }),
              })}
            </Silian_Badge>
          ) : null}
          <Silian_Badge variant="outline">
            {Silian_t(`support.categories.${Silian_ticket.category}`)}
          </Silian_Badge>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Silian_Card className="border-slate-200/80 shadow-sm dark:border-white/10">
            <Silian_CardHeader>
              <Silian_CardTitle>{Silian_t('support.portal.conversationTitle')}</Silian_CardTitle>
            </Silian_CardHeader>
            <Silian_CardContent className="space-y-4">
              {(Silian_ticket.messages ?? []).map((Silian_message) => {
                const Silian_tone = Silian_messageTone(Silian_message.sender_role);

                return (
                  <div key={Silian_message.id} className={`flex ${Silian_tone.align}`}>
                    <div className={`flex w-full max-w-[95%] ${Silian_tone.rowDirection} items-end gap-3`}>
                      <Silian_MessageIdentity
                        message={Silian_message}
                        senderRole={Silian_message.sender_role}
                        senderName={Silian_message.sender_name}
                        t={Silian_t}
                        tone={Silian_tone}
                      />
                      <div
                        className={`min-w-0 flex-1 rounded-[1.6rem] border px-5 py-4 shadow-sm ${Silian_tone.surface}`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`text-sm font-semibold ${Silian_tone.name}`}>
                            {Silian_message.sender_name || Silian_t('support.thread.unknownSender')}
                          </p>
                          <Silian_Badge variant="outline" className={Silian_tone.badge}>
                            {Silian_t(`support.senderRoles.${Silian_message.sender_role}`)}
                          </Silian_Badge>
                        </div>
                        <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{Silian_message.body}</p>
                        <Silian_SupportAttachmentList attachments={Silian_message.attachments} />
                        <p className={`mt-4 text-[11px] font-medium uppercase tracking-[0.18em] ${Silian_tone.timestamp}`}>
                          {Silian_formatSupportDate(Silian_message.created_at, Silian_locale)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </Silian_CardContent>
          </Silian_Card>

          <Silian_Card className="border-slate-200/80 shadow-sm dark:border-white/10">
            <Silian_CardHeader>
              <Silian_CardTitle>{Silian_t('support.portal.replyTitle')}</Silian_CardTitle>
              <Silian_CardDescription>{Silian_t('support.portal.replySubtitle')}</Silian_CardDescription>
            </Silian_CardHeader>
            <Silian_CardContent className="space-y-4">
              {Silian_canManageWorkflow ? (
                <form className="space-y-4" onSubmit={Silian_onReplySubmit}>
                  <Silian_Textarea
                    rows={6}
                    placeholder={Silian_t('support.portal.replyPlaceholder')}
                    {...Silian_register('content')}
                  />
                  {Silian_errors.content && <p className="text-sm text-red-600">{Silian_errors.content.message}</p>}

                  <Silian_FileUpload
                    multiple
                    maxFiles={4}
                    directory="support-tickets"
                    entityType="support_ticket_message"
                    accept="image/*"
                    compressImages
                    onStateChange={Silian_setAttachmentGate}
                    onUploadSuccess={(Silian_result) => {
                      Silian_setAttachments((Silian_current) => Silian_mergeUploadedFiles(Silian_current, Silian_result));
                      Silian_toast.success(Silian_t('support.feedback.uploaded'));
                    }}
                    onUploadError={(Silian_error) => Silian_toast.error(Silian_error?.message || Silian_t('errors.uploadFailed'))}
                  />

                  {Silian_attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {Silian_attachments.map((Silian_file) => (
                        <button
                          key={Silian_file.file_path}
                          type="button"
                          onClick={() => Silian_setAttachments((Silian_current) => Silian_current.filter((Silian_entry) => Silian_entry.file_path !== Silian_file.file_path))}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          {Silian_file.original_name}
                        </button>
                      ))}
                    </div>
                  )}
                  {Silian_attachmentGate.hasUploadErrors ? (
                    <Silian_Alert>
                      <Silian_AlertDescription>{Silian_t('support.attachments.uploadFailedBlocking')}</Silian_AlertDescription>
                    </Silian_Alert>
                  ) : null}
                  {Silian_attachmentGate.hasPendingUploads ? (
                    <Silian_Alert>
                      <Silian_AlertDescription>{Silian_t('support.attachments.uploadRequired')}</Silian_AlertDescription>
                    </Silian_Alert>
                  ) : null}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Silian_Button
                      type="submit"
                      className="w-full rounded-full sm:flex-1"
                      loading={Silian_isReplySubmitting && Silian_replyMode === 'reply'}
                      disabled={Silian_replyActionsDisabled}
                    >
                      <Silian_Send className="mr-2 h-4 w-4" />
                      {Silian_t('support.portal.replySubmit')}
                    </Silian_Button>
                    <Silian_Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-full border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-400/40 dark:text-emerald-200 dark:hover:bg-emerald-500/10 sm:flex-1"
                      loading={Silian_isReplySubmitting && Silian_replyMode === 'resolve'}
                      disabled={Silian_replyActionsDisabled}
                      onClick={Silian_onReplyAndResolve}
                    >
                      <Silian_CheckCircle2 className="mr-2 h-4 w-4" />
                      {Silian_t('support.portal.replyResolveSubmit')}
                    </Silian_Button>
                  </div>
                </form>
              ) : (
                <Silian_Alert>
                  <Silian_AlertDescription>{Silian_t('support.portal.actionLockedHint')}</Silian_AlertDescription>
                </Silian_Alert>
              )}
            </Silian_CardContent>
          </Silian_Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Silian_Card className="border-slate-200/80 shadow-sm dark:border-white/10">
            <Silian_CardHeader>
              <Silian_CardTitle>{Silian_t('support.portal.ticketMetaTitle', { defaultValue: Silian_t('support.portal.requesterTitle') })}</Silian_CardTitle>
              <Silian_CardDescription>{Silian_t('support.portal.ticketMetaSubtitle', { defaultValue: Silian_t('support.portal.requesterSubtitle') })}</Silian_CardDescription>
            </Silian_CardHeader>
            <Silian_CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">{Silian_t('support.portal.requesterName')}</span>
                <span>{Silian_ticket.requester?.username || '--'}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">{Silian_t('support.portal.requesterEmail')}</span>
                <span className="truncate">{Silian_ticket.requester?.email || '--'}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">{Silian_t('support.portal.createdAt')}</span>
                <span>{Silian_formatSupportDate(Silian_ticket.created_at, Silian_locale)}</span>
              </div>
              {(Silian_ticket.tags ?? []).length > 0 && (
                <div className="pt-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{Silian_t('support.portal.tagsTitle')}</p>
                  <div className="flex flex-wrap gap-2">
                    {(Silian_ticket.tags ?? []).map((Silian_tag) => (
                      <Silian_Badge key={Silian_tag.id} variant="outline" className={Silian_getTagTone(Silian_tag.color)}>
                        {Silian_tag.name}
                      </Silian_Badge>
                    ))}
                  </div>
                </div>
              )}
            </Silian_CardContent>
          </Silian_Card>

          <Silian_Card className="border-slate-200/80 shadow-sm dark:border-white/10">
            <Silian_CardContent className="pt-6">
              <Silian_Tabs value={Silian_sidePanelTab} onValueChange={Silian_setSidePanelTab} className="space-y-5">
                <Silian_TabsList className="grid w-full grid-cols-3 overflow-hidden rounded-[1.2rem] border-slate-200 bg-slate-100/90 dark:border-white/10 dark:bg-white/5">
                  <Silian_TabsTrigger value="workflow" className="border-r-slate-200 dark:border-r-white/10">
                    {Silian_t('support.portal.workflowTab')}
                  </Silian_TabsTrigger>
                  <Silian_TabsTrigger value="transfer" className="border-r-slate-200 dark:border-r-white/10">
                    {Silian_t('support.portal.transferTab')}
                  </Silian_TabsTrigger>
                  <Silian_TabsTrigger value="feedback">{Silian_t('support.portal.feedbackTab')}</Silian_TabsTrigger>
                </Silian_TabsList>

                <Silian_TabsContent value="workflow" className="space-y-4">
                  <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-white/5">
                    <div className="grid gap-3 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500 dark:text-slate-400">{Silian_t('support.portal.firstResponseDueLabel')}</span>
                        <div className="text-right">
                          <div>{Silian_firstResponseMeta.dueAtLabel}</div>
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{Silian_firstResponseMeta.relativeLabel}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500 dark:text-slate-400">{Silian_t('support.portal.resolutionDueLabel')}</span>
                        <div className="text-right">
                          <div>{Silian_resolutionMeta.dueAtLabel}</div>
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{Silian_resolutionMeta.relativeLabel}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <Silian_WorkflowLabelWithTooltip
                          label={Silian_t('support.portal.assignmentSourceLabel')}
                          help={Silian_t('support.portal.assignmentSourceHelp')}
                        />
                        <span>{Silian_ticket.assignment_source || '--'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <Silian_WorkflowLabelWithTooltip
                          label={Silian_t('support.portal.escalationLevelLabel')}
                          help={Silian_t('support.portal.escalationLevelHelp')}
                        />
                        <span>{Silian_ticket.escalation_level ?? 0}</span>
                      </div>
                      {Silian_ticket.routing_summary ? (
                        <>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">{Silian_t('support.portal.routingLastRunLabel')}</span>
                            <span>#{Silian_ticket.routing_summary.last_run_id ?? '--'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">{Silian_t('support.portal.routingFallbackLabel')}</span>
                            <span className="text-right">{Silian_ticket.routing_summary.fallback_reason || '--'}</span>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {Silian_canManageWorkflow ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{Silian_t('support.filters.status')}</label>
                        <Silian_Select value={Silian_status} onValueChange={Silian_setStatus} disabled={Silian_workflowActionsDisabled}>
                          <Silian_SelectTrigger className="w-full">
                            <Silian_SelectValue />
                          </Silian_SelectTrigger>
                          <Silian_SelectContent>
                            {Silian_TICKET_STATUS_OPTIONS.map((Silian_option) => (
                              <Silian_SelectItem key={Silian_option.value} value={Silian_option.value}>
                                {Silian_t(Silian_option.labelKey)}
                              </Silian_SelectItem>
                            ))}
                          </Silian_SelectContent>
                        </Silian_Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">{Silian_t('support.feedback.fields.priority')}</label>
                        <Silian_Select value={Silian_priority} onValueChange={Silian_setPriority} disabled={Silian_workflowActionsDisabled}>
                          <Silian_SelectTrigger className="w-full">
                            <Silian_SelectValue />
                          </Silian_SelectTrigger>
                          <Silian_SelectContent>
                            {Silian_TICKET_PRIORITY_OPTIONS.map((Silian_option) => (
                              <Silian_SelectItem key={Silian_option.value} value={Silian_option.value}>
                                {Silian_t(Silian_option.labelKey)}
                              </Silian_SelectItem>
                            ))}
                          </Silian_SelectContent>
                        </Silian_Select>
                      </div>

                      {Silian_isAdmin ? (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{Silian_t('support.portal.assignedTo')}</label>
                          <Silian_Select value={Silian_assignedTo} onValueChange={Silian_setAssignedTo} disabled={Silian_workflowActionsDisabled}>
                            <Silian_SelectTrigger className="w-full">
                              <Silian_SelectValue />
                            </Silian_SelectTrigger>
                            <Silian_SelectContent>
                              <Silian_SelectItem value="none">{Silian_t('support.portal.unassigned')}</Silian_SelectItem>
                              {Silian_assignees.map((Silian_assignee) => (
                                <Silian_SelectItem key={Silian_assignee.id} value={String(Silian_assignee.id)}>
                                  {Silian_assigneeLabel(Silian_assignee, Silian_t)}
                                </Silian_SelectItem>
                              ))}
                            </Silian_SelectContent>
                          </Silian_Select>
                        </div>
                      ) : null}

                      <Silian_Button type="button" className="w-full rounded-full" onClick={() => { void Silian_handleWorkflowSave(); }} loading={Silian_updateMutation.isLoading} disabled={Silian_workflowActionsDisabled}>
                        <Silian_Save className="mr-2 h-4 w-4" />
                        {Silian_t('support.portal.saveWorkflow')}
                      </Silian_Button>
                    </>
                  ) : (
                    <Silian_Alert>
                      <Silian_AlertDescription>{Silian_t('support.portal.actionLockedHint')}</Silian_AlertDescription>
                    </Silian_Alert>
                  )}

                  <div className="space-y-3 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-medium">{Silian_t('support.portal.assignedTo')}</span>
                      <span className="text-right text-sm">{Silian_currentAssignee?.username || Silian_currentAssignee?.email || Silian_t('support.portal.unassigned')}</span>
                    </div>
                    {Silian_currentAssignee ? (
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-slate-950/70">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                            {Silian_t('support.portal.workload.assigned')}
                          </p>
                          <p className="mt-2 text-xl font-semibold">{Silian_currentAssignee.assigned_total_count ?? 0}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-slate-950/70">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                            {Silian_t('support.portal.workload.notStarted')}
                          </p>
                          <p className="mt-2 text-xl font-semibold">{Silian_currentAssignee.open_count ?? 0}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-slate-950/70">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                            {Silian_t('support.portal.workload.inProgress')}
                          </p>
                          <p className="mt-2 text-xl font-semibold">{Silian_currentAssignee.in_progress_count ?? 0}</p>
                        </div>
                      </div>
                    ) : null}
                    {Silian_ticket.assignment_locked ? (
                      <Silian_Alert>
                        <Silian_AlertDescription>{Silian_t('support.portal.assignmentLockedHint')}</Silian_AlertDescription>
                      </Silian_Alert>
                    ) : null}
                  </div>
                </Silian_TabsContent>

                <Silian_TabsContent value="transfer" className="space-y-4">
                  {!Silian_isAdmin && Silian_isCurrentAssignee ? (
                    <div className="space-y-4 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-white/5">
                      <div>
                        <p className="text-sm font-semibold">{Silian_t('support.portal.transfer.title')}</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{Silian_t('support.portal.transfer.subtitle')}</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{Silian_t('support.portal.transfer.target')}</label>
                        <Silian_Select value={Silian_transferTo} onValueChange={Silian_setTransferTo}>
                          <Silian_SelectTrigger className="w-full">
                            <Silian_SelectValue placeholder={Silian_t('support.portal.transfer.targetPlaceholder')} />
                          </Silian_SelectTrigger>
                          <Silian_SelectContent>
                            <Silian_SelectItem value="none">{Silian_t('support.portal.transfer.targetPlaceholder')}</Silian_SelectItem>
                            {Silian_transferableAssignees.map((Silian_assignee) => (
                              <Silian_SelectItem key={Silian_assignee.id} value={String(Silian_assignee.id)}>
                                {Silian_assigneeLabel(Silian_assignee, Silian_t)}
                              </Silian_SelectItem>
                            ))}
                          </Silian_SelectContent>
                        </Silian_Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{Silian_t('support.portal.transfer.reason')}</label>
                        <Silian_Textarea
                          rows={4}
                          value={Silian_transferReason}
                          onChange={(Silian_event) => Silian_setTransferReason(Silian_event.target.value)}
                          placeholder={Silian_t('support.portal.transfer.reasonPlaceholder')}
                        />
                      </div>
                      <Silian_Button type="button" className="w-full rounded-full" onClick={Silian_handleCreateTransferRequest} loading={Silian_transferRequestMutation.isLoading}>
                        <Silian_Shuffle className="mr-2 h-4 w-4" />
                        {Silian_t('support.portal.transfer.submit')}
                      </Silian_Button>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    {(Silian_ticket.transfer_requests ?? []).length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">{Silian_t('support.portal.transfer.empty')}</p>
                    ) : null}

                    {(Silian_ticket.transfer_requests ?? []).map((Silian_request) => (
                      <div
                        key={Silian_request.id}
                        className="space-y-3 rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-white/5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Silian_Badge variant="outline" className={Silian_transferStatusTone(Silian_request.status)}>
                              {Silian_t(`support.transferStatuses.${Silian_request.status}`)}
                            </Silian_Badge>
                            <span className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                              {Silian_formatSupportDate(Silian_request.created_at, Silian_locale)}
                            </span>
                          </div>
                          <span className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                            #{Silian_request.id}
                          </span>
                        </div>

                        <div className="space-y-2 text-sm">
                          <p>
                            {Silian_t('support.portal.transfer.requestLine', {
                              from: Silian_request.from_user?.username || Silian_request.from_user?.email || Silian_t('support.portal.unassigned'),
                              to: Silian_request.to_user?.username || Silian_request.to_user?.email || `#${Silian_request.to_assignee}`,
                            })}
                          </p>
                          <p className="text-slate-500 dark:text-slate-400">
                            {Silian_t('support.portal.transfer.requestedBy', {
                              name: Silian_request.requester?.username || Silian_request.requester?.email || `#${Silian_request.requested_by}`,
                            })}
                          </p>
                          {Silian_request.reason ? (
                            <p className="whitespace-pre-wrap text-slate-500 dark:text-slate-400">{Silian_request.reason}</p>
                          ) : null}
                          {Silian_request.review_note ? (
                            <p className="whitespace-pre-wrap text-slate-500 dark:text-slate-400">
                              {Silian_t('support.portal.transfer.reviewNoteLabel')}: {Silian_request.review_note}
                            </p>
                          ) : null}
                        </div>

                        {Silian_request.status === 'pending' && Number(Silian_request.to_assignee) === Number(Silian_currentUser?.id ?? 0) ? (
                          <div className="space-y-3">
                            <Silian_Textarea
                              rows={3}
                              value={Silian_reviewNotes[Silian_request.id] ?? ''}
                              onChange={(Silian_event) => Silian_setReviewNotes((Silian_current) => ({ ...Silian_current, [Silian_request.id]: Silian_event.target.value }))}
                              placeholder={Silian_t('support.portal.transfer.reviewPlaceholder')}
                            />
                            <div className="flex flex-wrap gap-2">
                              <Silian_Button
                                type="button"
                                className="rounded-full"
                                onClick={() => Silian_handleReviewTransfer(Silian_request.id, 'approved')}
                                loading={Silian_reviewTransferMutation.isLoading}
                              >
                                <Silian_Check className="mr-2 h-4 w-4" />
                                {Silian_t('support.portal.transfer.approve')}
                              </Silian_Button>
                              <Silian_Button
                                type="button"
                                variant="outline"
                                className="rounded-full"
                                onClick={() => Silian_handleReviewTransfer(Silian_request.id, 'rejected')}
                                loading={Silian_reviewTransferMutation.isLoading}
                              >
                                <Silian_X className="mr-2 h-4 w-4" />
                                {Silian_t('support.portal.transfer.reject')}
                              </Silian_Button>
                            </div>
                          </div>
                        ) : null}

                        {Silian_request.status === 'pending' && Number(Silian_request.requested_by) === Number(Silian_currentUser?.id ?? 0) ? (
                          <Silian_Button
                            type="button"
                            variant="outline"
                            className="rounded-full"
                            onClick={() => Silian_handleReviewTransfer(Silian_request.id, 'cancelled')}
                            loading={Silian_reviewTransferMutation.isLoading}
                          >
                            <Silian_X className="mr-2 h-4 w-4" />
                            {Silian_t('support.portal.transfer.cancel')}
                          </Silian_Button>
                        ) : null}
                      </div>
                    ))}

                    {Silian_pendingTransferRequests.length > 0 ? (
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                        {Silian_t('support.portal.transfer.pendingHint', { count: Silian_pendingTransferRequests.length })}
                      </p>
                    ) : null}
                  </div>
                </Silian_TabsContent>

                <Silian_TabsContent value="feedback" className="space-y-3">
                  {Silian_feedbackEntries.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">{Silian_t('support.portal.feedbackEmpty')}</p>
                  ) : null}

                  {Silian_feedbackEntries.map((Silian_entry) => (
                    <div
                      key={Silian_entry.id}
                      className="space-y-3 rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            {Silian_entry.rated_user?.username || Silian_entry.rated_user?.email || `#${Silian_entry.rated_user_id}`}
                          </p>
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                            {Silian_t('support.portal.feedbackRatedBy', {
                              name: Silian_entry.reviewer?.username || Silian_entry.reviewer?.email || `#${Silian_entry.user_id}`,
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                          <Silian_FeedbackStars value={Silian_entry.rating} />
                          <span>{Silian_formatSupportDate(Silian_entry.updated_at || Silian_entry.created_at, Silian_locale)}</span>
                        </div>
                      </div>
                      {Silian_entry.comment ? (
                        <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{Silian_entry.comment}</p>
                      ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">{Silian_t('support.portal.feedbackNoComment')}</p>
                      )}
                    </div>
                  ))}
                </Silian_TabsContent>
              </Silian_Tabs>
            </Silian_CardContent>
          </Silian_Card>

        </div>
      </div>
    </div>
  );
}
