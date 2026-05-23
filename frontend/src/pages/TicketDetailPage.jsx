import Silian_React, { useEffect as Silian_useEffect, useRef as Silian_useRef, useState as Silian_useState } from 'react';
import { Link as Silian_Link, useParams as Silian_useParams } from 'react-router-dom';
import { useMutation as Silian_useMutation, useQuery as Silian_useQuery, useQueryClient as Silian_useQueryClient } from 'react-query';
import { useForm as Silian_useForm } from 'react-hook-form';
import { z as Silian_z } from 'zod';
import { zodResolver as Silian_zodResolver } from '@hookform/resolvers/zod';
import { toast as Silian_toast } from 'react-hot-toast';
import { ArrowLeft as Silian_ArrowLeft, Headset as Silian_Headset, ImageIcon as Silian_ImageIcon, Paperclip as Silian_Paperclip, Send as Silian_Send, Shield as Silian_Shield, Star as Silian_Star, UserRound as Silian_UserRound } from 'lucide-react';

import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';
import { ticketAPI as Silian_ticketAPI } from '../lib/api';
import { buildAvatarDisplayProps as Silian_buildAvatarDisplayProps } from '../lib/avatarUtils';
import { formatSupportDate as Silian_formatSupportDate, getPriorityVariant as Silian_getPriorityVariant, getSlaMeta as Silian_getSlaMeta, getSlaMilestoneMeta as Silian_getSlaMilestoneMeta, getSlaTone as Silian_getSlaTone, getStatusTone as Silian_getStatusTone, isImageAttachment as Silian_isImageAttachment, mergeUploadedFiles as Silian_mergeUploadedFiles } from '../lib/supportTickets';
import Silian_Turnstile from '../components/common/Turnstile';
import Silian_FileUpload from '../components/FileUpload';
import Silian_R2Image from '../components/common/R2Image';
import { Button as Silian_Button } from '../components/ui/Button';
import { Textarea as Silian_Textarea } from '../components/ui/textarea';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../components/ui/Card';
import { Badge as Silian_Badge } from '../components/ui/badge';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription } from '../components/ui/Alert';

const Silian_replySchema = Silian_z.object({
  content: Silian_z.string().trim().min(2).max(5000),
});

function Silian_AttachmentList({ attachments: Silian_attachments }) {
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
                className="group overflow-hidden rounded-2xl border border-border bg-background transition hover:border-emerald-300 hover:shadow-sm"
              >
                <div className="aspect-square bg-muted/30">
                  <img
                    src={Silian_href}
                    alt={Silian_attachment.original_name}
                    className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                </div>
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
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
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
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

function Silian_messageTone(Silian_senderRole) {
  if (Silian_senderRole === 'user') {
    return {
      align: 'justify-end',
      rowDirection: 'flex-row-reverse',
      surface:
        'border-emerald-200 bg-emerald-50/80 text-slate-900 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-slate-100',
      avatar:
        'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/20 dark:text-emerald-200',
      badge:
        'border-emerald-300 bg-white/80 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200',
      name: 'text-emerald-700 dark:text-emerald-200',
      timestamp: 'text-right text-emerald-700/70 dark:text-emerald-200/70',
    };
  }

  if (Silian_senderRole === 'admin') {
    return {
      align: 'justify-start',
      rowDirection: 'flex-row',
      surface:
        'border-violet-200 bg-violet-50/80 text-slate-900 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-slate-100',
      avatar:
        'border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-400/30 dark:bg-violet-500/20 dark:text-violet-200',
      badge:
        'border-violet-300 bg-white/80 text-violet-700 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-violet-200',
      name: 'text-violet-700 dark:text-violet-200',
      timestamp: 'text-left text-violet-700/70 dark:text-violet-200/70',
    };
  }

  return {
    align: 'justify-start',
    rowDirection: 'flex-row',
    surface:
      'border-sky-200 bg-sky-50/75 text-slate-900 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-slate-100',
    avatar:
      'border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/20 dark:text-sky-200',
    badge:
      'border-sky-300 bg-white/80 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-200',
    name: 'text-sky-700 dark:text-sky-200',
    timestamp: 'text-left text-sky-700/70 dark:text-sky-200/70',
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

function Silian_buildFeedbackDrafts(Silian_ticket) {
  const Silian_drafts = {};
  const Silian_feedbackEntries = Silian_ticket?.feedback ?? [];

  for (const Silian_candidate of Silian_ticket?.feedback_candidates ?? []) {
    const Silian_existing = Silian_feedbackEntries.find((Silian_entry) => Number(Silian_entry.rated_user_id) === Number(Silian_candidate.id));
    Silian_drafts[Silian_candidate.id] = {
      rating: Silian_existing?.rating ?? 0,
      comment: Silian_existing?.comment ?? '',
    };
  }

  return Silian_drafts;
}

function Silian_FeedbackStars({ value: Silian_value }) {
  return (
    <div className="flex items-center gap-1">
      {Silian_FEEDBACK_RATING_VALUES.map((Silian_ratingValue) => (
        <Silian_Star
          key={Silian_ratingValue}
          className={`h-4 w-4 ${Silian_ratingValue <= Silian_value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/50'}`}
        />
      ))}
    </div>
  );
}

export default function TicketDetailPage() {
  const { ticketId: Silian_ticketId } = Silian_useParams();
  const { t: Silian_t, currentLanguage: Silian_currentLanguage } = Silian_useTranslation(['common', 'date', 'errors', 'support']);
  const Silian_queryClient = Silian_useQueryClient();
  const Silian_turnstileRef = Silian_useRef(null);
  const Silian_dirtyFeedbackDraftIdsRef = Silian_useRef(new Set());
  const [Silian_turnstileToken, Silian_setTurnstileToken] = Silian_useState('');
  const [Silian_attachments, Silian_setAttachments] = Silian_useState([]);
  const [Silian_attachmentGate, Silian_setAttachmentGate] = Silian_useState({ hasPendingUploads: false, hasUploadErrors: false, isSubmissionBlocked: false });
  const [Silian_feedbackDrafts, Silian_setFeedbackDrafts] = Silian_useState({});

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
    ['ticket-detail', Silian_ticketId],
    () => Silian_ticketAPI.getTicket(Silian_ticketId),
    {
      enabled: Boolean(Silian_ticketId),
      refetchOnWindowFocus: false,
    }
  );

  const Silian_replyMutation = Silian_useMutation(
    (Silian_payload) => Silian_ticketAPI.replyTicket(Silian_ticketId, Silian_payload),
    {
      onSuccess: () => {
        Silian_toast.success(Silian_t('support.thread.replyCreated'));
        Silian_reset();
        Silian_setAttachments([]);
        Silian_setTurnstileToken('');
        Silian_turnstileRef.current?.reset?.();
        Silian_queryClient.invalidateQueries(['ticket-detail', Silian_ticketId]);
        Silian_queryClient.invalidateQueries(['user-tickets']);
      },
      onError: (Silian_error) => {
        const Silian_message = Silian_error?.response?.data?.message || Silian_error.message || Silian_t('errors.operationFailed');
        Silian_toast.error(Silian_message);
        Silian_setTurnstileToken('');
        Silian_turnstileRef.current?.reset?.();
      },
    }
  );

  const Silian_feedbackMutation = Silian_useMutation(
    ({ ratedUserId: Silian_ratedUserId, rating: Silian_rating, comment: Silian_comment }) => Silian_ticketAPI.submitFeedback(Silian_ticketId, {
      rated_user_id: Silian_ratedUserId,
      rating: Silian_rating,
      comment: Silian_comment,
    }),
    {
      onSuccess: (Silian__, Silian_variables) => {
        Silian_toast.success(Silian_t('support.thread.feedbackSaved'));
        Silian_dirtyFeedbackDraftIdsRef.current.delete(String(Silian_variables.ratedUserId));
        Silian_queryClient.invalidateQueries(['ticket-detail', Silian_ticketId]);
        Silian_queryClient.invalidateQueries(['user-tickets']);
        Silian_setFeedbackDrafts((Silian_current) => ({
          ...Silian_current,
          [Silian_variables.ratedUserId]: {
            rating: Silian_variables.rating,
            comment: Silian_variables.comment,
          },
        }));
      },
      onError: (Silian_error) => {
        const Silian_message = Silian_error?.response?.data?.message || Silian_error.message || Silian_t('errors.operationFailed');
        Silian_toast.error(Silian_message);
      },
    }
  );

  const Silian_ticket = Silian_ticketQuery.data?.data?.data;

  Silian_useEffect(() => {
    Silian_setAttachments([]);
    Silian_setFeedbackDrafts({});
    Silian_dirtyFeedbackDraftIdsRef.current.clear();
  }, [Silian_ticketId]);

  Silian_useEffect(() => {
    const Silian_nextDrafts = Silian_buildFeedbackDrafts(Silian_ticket);
    Silian_setFeedbackDrafts((Silian_current) => {
      const Silian_mergedDrafts = { ...Silian_nextDrafts };

      for (const [Silian_candidateId, Silian_draft] of Object.entries(Silian_current)) {
        if (Silian_dirtyFeedbackDraftIdsRef.current.has(Silian_candidateId) && Silian_nextDrafts[Silian_candidateId]) {
          Silian_mergedDrafts[Silian_candidateId] = Silian_draft;
        }
      }

      return Silian_mergedDrafts;
    });
  }, [Silian_ticket]);

  const Silian_onSubmit = Silian_handleSubmit((Silian_values) => {
    if (!Silian_turnstileToken) {
      Silian_toast.error(Silian_t('support.feedback.turnstileRequired'));
      return;
    }
    if (Silian_attachmentGate.hasUploadErrors) {
      Silian_toast.error(Silian_t('support.attachments.uploadFailedBlocking'));
      return;
    }
    if (Silian_attachmentGate.hasPendingUploads) {
      Silian_toast.error(Silian_t('support.attachments.uploadRequired'));
      return;
    }

    Silian_replyMutation.mutate({
      content: Silian_values.content,
      attachments: Silian_attachments.map((Silian_file) => Silian_file.file_path),
      cf_turnstile_response: Silian_turnstileToken,
    });
  });

  if (Silian_ticketQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">{Silian_t('common.loading')}</p>
      </div>
    );
  }

  if (!Silian_ticket) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <Silian_Alert variant="destructive">
          <Silian_AlertDescription>
            {Silian_t('support.thread.notFound')}
          </Silian_AlertDescription>
        </Silian_Alert>
      </div>
    );
  }

  const Silian_isClosed = Silian_ticket.status === 'closed';
  const Silian_feedbackCandidates = Silian_ticket.feedback_candidates ?? [];
  const Silian_feedbackEntries = Silian_ticket.feedback ?? [];
  const Silian_canLeaveFeedback = ['resolved', 'closed'].includes(Silian_ticket.status);
  const Silian_locale = Silian_currentLanguage === 'zh' ? 'zh-CN' : 'en-US';
  const Silian_slaMeta = Silian_getSlaMeta(Silian_ticket, Silian_locale);
  const Silian_firstResponseMeta = Silian_getSlaMilestoneMeta(Silian_ticket, 'first_response', Silian_locale);
  const Silian_resolutionMeta = Silian_getSlaMilestoneMeta(Silian_ticket, 'resolution', Silian_locale);
  const Silian_replyActionsDisabled = Silian_replyMutation.isLoading || Silian_attachmentGate.isSubmissionBlocked || !Silian_turnstileToken;

  const Silian_updateFeedbackDraft = (Silian_ratedUserId, Silian_patch) => {
    Silian_dirtyFeedbackDraftIdsRef.current.add(String(Silian_ratedUserId));
    Silian_setFeedbackDrafts((Silian_current) => ({
      ...Silian_current,
      [Silian_ratedUserId]: {
        rating: Silian_current[Silian_ratedUserId]?.rating ?? 0,
        comment: Silian_current[Silian_ratedUserId]?.comment ?? '',
        ...Silian_patch,
      },
    }));
  };

  const Silian_submitFeedback = (Silian_candidate) => {
    const Silian_draft = Silian_feedbackDrafts[Silian_candidate.id] ?? { rating: 0, comment: '' };
    if (!Silian_draft.rating) {
      Silian_toast.error(Silian_t('support.thread.feedbackRatingRequired'));
      return;
    }

    Silian_feedbackMutation.mutate({
      ratedUserId: Silian_candidate.id,
      rating: Silian_draft.rating,
      comment: Silian_draft.comment?.trim() || '',
    });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Silian_Link to="/tickets" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600">
        <Silian_ArrowLeft className="h-4 w-4" />
        {Silian_t('support.thread.backToTickets')}
      </Silian_Link>

      <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">#{Silian_ticket.id}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">{Silian_ticket.subject}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Silian_Badge className={Silian_getStatusTone(Silian_ticket.status)} variant="outline">
            {Silian_t(`support.statuses.${Silian_ticket.status}`)}
          </Silian_Badge>
          <Silian_Badge variant={Silian_getPriorityVariant(Silian_ticket.priority)}>
            {Silian_t(`support.priorities.${Silian_ticket.priority}`)}
          </Silian_Badge>
          <Silian_Badge variant="outline">
            {Silian_t(`support.categories.${Silian_ticket.category}`)}
          </Silian_Badge>
          {Silian_slaMeta.state ? (
            <Silian_Badge variant="outline" className={Silian_getSlaTone(Silian_slaMeta.state)}>
              {Silian_t(`support.slaStatuses.${Silian_slaMeta.state}`, { defaultValue: Silian_slaMeta.state })}
            </Silian_Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Silian_Card>
            <Silian_CardHeader>
              <Silian_CardTitle>{Silian_t('support.thread.conversationTitle')}</Silian_CardTitle>
              <Silian_CardDescription>{Silian_t('support.thread.conversationSubtitle')}</Silian_CardDescription>
            </Silian_CardHeader>
            <Silian_CardContent className="pt-0">
              <div className="max-h-[62vh] space-y-4 overflow-y-auto pr-2">
                {Silian_ticket.messages?.map((Silian_message) => {
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
                        <div className={`min-w-0 flex-1 rounded-[1.6rem] border px-5 py-4 shadow-sm ${Silian_tone.surface}`}>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={`text-sm font-semibold ${Silian_tone.name}`}>
                              {Silian_message.sender_name || Silian_t('support.thread.unknownSender')}
                            </p>
                            <Silian_Badge variant="outline" className={Silian_tone.badge}>
                              {Silian_t(`support.senderRoles.${Silian_message.sender_role}`)}
                            </Silian_Badge>
                          </div>
                          <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{Silian_message.body}</p>
                          <Silian_AttachmentList attachments={Silian_message.attachments} />
                          <p className={`mt-4 text-[11px] font-medium uppercase tracking-[0.18em] ${Silian_tone.timestamp}`}>
                            {Silian_formatSupportDate(Silian_message.created_at, Silian_currentLanguage === 'zh' ? 'zh-CN' : 'en-US')}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Silian_CardContent>
          </Silian_Card>

          <Silian_Card>
            <Silian_CardHeader>
              <Silian_CardTitle>{Silian_t('support.thread.replyTitle')}</Silian_CardTitle>
              <Silian_CardDescription>{Silian_t('support.thread.replySubtitle')}</Silian_CardDescription>
            </Silian_CardHeader>
            <Silian_CardContent className="space-y-4">
              {Silian_isClosed ? (
                <Silian_Alert>
                  <Silian_AlertDescription>
                    {Silian_t('support.thread.closedHint')}
                  </Silian_AlertDescription>
                </Silian_Alert>
              ) : (
                <form className="space-y-4" onSubmit={Silian_onSubmit}>
                  <div className="space-y-2">
                    <Silian_Textarea
                      rows={6}
                      placeholder={Silian_t('support.thread.replyPlaceholder')}
                      {...Silian_register('content')}
                    />
                    {Silian_errors.content && <p className="text-sm text-red-600">{Silian_errors.content.message}</p>}
                  </div>

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
                          className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
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

                  <div className="overflow-hidden rounded-[1.4rem] border border-border/60 bg-muted/20 p-2">
                    <Silian_Turnstile
                      ref={Silian_turnstileRef}
                      require
                      size="flexible"
                      className="w-full max-w-full"
                      action="ticket_reply"
                      onVerify={Silian_setTurnstileToken}
                      onExpire={() => Silian_setTurnstileToken('')}
                      onError={() => Silian_setTurnstileToken('')}
                    />
                  </div>

                  <Silian_Button
                    type="submit"
                    className="w-full rounded-full"
                    loading={Silian_replyMutation.isLoading}
                    disabled={Silian_replyActionsDisabled}
                  >
                    <Silian_Send className="mr-2 h-4 w-4" />
                    {Silian_t('support.thread.replySubmit')}
                  </Silian_Button>
                </form>
              )}
            </Silian_CardContent>
          </Silian_Card>
        </div>

        <div className="space-y-4">
          <Silian_Card>
            <Silian_CardHeader>
              <Silian_CardTitle>{Silian_t('support.thread.summaryTitle')}</Silian_CardTitle>
              <Silian_CardDescription>{Silian_t('support.thread.summarySubtitle')}</Silian_CardDescription>
            </Silian_CardHeader>
            <Silian_CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{Silian_t('support.thread.createdAt')}</span>
                <span>{Silian_formatSupportDate(Silian_ticket.created_at, Silian_locale)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{Silian_t('support.thread.lastReply')}</span>
                <span>{Silian_formatSupportDate(Silian_ticket.last_replied_at || Silian_ticket.updated_at, Silian_locale)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{Silian_t('support.thread.messageCount')}</span>
                <span>{Silian_ticket.messages?.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{Silian_t('support.portal.firstResponseDueLabel')}</span>
                <div className="text-right">
                  <div>{Silian_firstResponseMeta.dueAtLabel}</div>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{Silian_firstResponseMeta.relativeLabel}</div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{Silian_t('support.portal.resolutionDueLabel')}</span>
                <div className="text-right">
                  <div>{Silian_resolutionMeta.dueAtLabel}</div>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{Silian_resolutionMeta.relativeLabel}</div>
                </div>
              </div>
            </Silian_CardContent>
          </Silian_Card>

          {(Silian_canLeaveFeedback || Silian_feedbackEntries.length > 0) && (
            <Silian_Card>
              <Silian_CardHeader>
                <Silian_CardTitle>{Silian_t('support.thread.feedbackTitle')}</Silian_CardTitle>
                <Silian_CardDescription>{Silian_t('support.thread.feedbackSubtitle')}</Silian_CardDescription>
              </Silian_CardHeader>
              <Silian_CardContent className="space-y-4">
                {Silian_feedbackCandidates.length === 0 && (
                  <Silian_Alert>
                    <Silian_AlertDescription>{Silian_t('support.thread.feedbackEmpty')}</Silian_AlertDescription>
                  </Silian_Alert>
                )}

                {Silian_feedbackCandidates.map((Silian_candidate) => {
                  const Silian_draft = Silian_feedbackDrafts[Silian_candidate.id] ?? { rating: 0, comment: '' };
                  const Silian_existing = Silian_feedbackEntries.find((Silian_entry) => Number(Silian_entry.rated_user_id) === Number(Silian_candidate.id));

                  return (
                    <div key={Silian_candidate.id} className="rounded-[1.4rem] border border-border bg-muted/20 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {Silian_candidate.username || Silian_candidate.email || `#${Silian_candidate.id}`}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                            {Silian_t(`support.portal.roles.${Silian_candidate.role}`)}
                          </p>
                        </div>
                        {Silian_existing && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Silian_FeedbackStars value={Silian_existing.rating} />
                            <span>
                              {Silian_t('support.thread.feedbackSavedAt', {
                                date: Silian_formatSupportDate(Silian_existing.updated_at || Silian_existing.created_at, Silian_currentLanguage === 'zh' ? 'zh-CN' : 'en-US'),
                              })}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {Silian_FEEDBACK_RATING_VALUES.map((Silian_ratingValue) => (
                          <button
                            key={Silian_ratingValue}
                            type="button"
                            onClick={() => Silian_updateFeedbackDraft(Silian_candidate.id, { rating: Silian_ratingValue })}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                              Silian_ratingValue <= Silian_draft.rating
                                ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200'
                                : 'border-border bg-background text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            <Silian_Star className={`h-4 w-4 ${Silian_ratingValue <= Silian_draft.rating ? 'fill-current' : ''}`} />
                            <span>{Silian_ratingValue}</span>
                          </button>
                        ))}
                      </div>

                      <div className="mt-4 space-y-2">
                        <p className="text-sm font-medium text-foreground">{Silian_t('support.thread.feedbackCommentLabel')}</p>
                        <Silian_Textarea
                          rows={3}
                          value={Silian_draft.comment}
                          onChange={(Silian_event) => Silian_updateFeedbackDraft(Silian_candidate.id, { comment: Silian_event.target.value })}
                          placeholder={Silian_t('support.thread.feedbackCommentPlaceholder')}
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs text-muted-foreground">
                          {Silian_existing ? Silian_t('support.thread.feedbackUpdateHint') : Silian_t('support.thread.feedbackHint')}
                        </span>
                        <Silian_Button
                          type="button"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => Silian_submitFeedback(Silian_candidate)}
                          loading={Silian_feedbackMutation.isLoading}
                        >
                          {Silian_existing ? Silian_t('support.thread.feedbackUpdate') : Silian_t('support.thread.feedbackSubmit')}
                        </Silian_Button>
                      </div>
                    </div>
                  );
                })}
              </Silian_CardContent>
            </Silian_Card>
          )}
        </div>
      </div>
    </div>
  );
}
