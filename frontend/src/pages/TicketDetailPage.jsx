import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'react-hot-toast';
import { ArrowLeft, ImageIcon, MessageSquareMore, Paperclip, Send } from 'lucide-react';

import { useTranslation } from '../hooks/useTranslation';
import { ticketAPI } from '../lib/api';
import { formatSupportDate, getPriorityVariant, getStatusTone, isImageAttachment, mergeUploadedFiles } from '../lib/supportTickets';
import Turnstile from '../components/common/Turnstile';
import FileUpload from '../components/FileUpload';
import { Button } from '../components/ui/Button';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/Alert';

const replySchema = z.object({
  content: z.string().trim().min(2).max(5000),
});

function AttachmentList({ attachments }) {
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
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
        >
          {isImageAttachment(attachment) ? <ImageIcon className="h-3.5 w-3.5" /> : <Paperclip className="h-3.5 w-3.5" />}
          {attachment.original_name}
        </a>
      ))}
    </div>
  );
}

export default function TicketDetailPage() {
  const { ticketId } = useParams();
  const { t, currentLanguage } = useTranslation();
  const queryClient = useQueryClient();
  const turnstileRef = useRef(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [attachments, setAttachments] = useState([]);

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
    ['ticket-detail', ticketId],
    () => ticketAPI.getTicket(ticketId),
    {
      enabled: Boolean(ticketId),
      refetchOnWindowFocus: false,
    }
  );

  const replyMutation = useMutation(
    (payload) => ticketAPI.replyTicket(ticketId, payload),
    {
      onSuccess: () => {
        toast.success(t('support.thread.replyCreated'));
        reset();
        setAttachments([]);
        setTurnstileToken('');
        turnstileRef.current?.reset?.();
        queryClient.invalidateQueries(['ticket-detail', ticketId]);
        queryClient.invalidateQueries(['user-tickets']);
      },
      onError: (error) => {
        const message = error?.response?.data?.message || error.message || t('errors.operationFailed');
        toast.error(message);
        setTurnstileToken('');
        turnstileRef.current?.reset?.();
      },
    }
  );

  const ticket = ticketQuery.data?.data?.data;

  useEffect(() => {
    setAttachments([]);
  }, [ticketId]);

  const onSubmit = handleSubmit((values) => {
    if (!turnstileToken) {
      toast.error(t('support.feedback.turnstileRequired'));
      return;
    }

    replyMutation.mutate({
      content: values.content,
      attachments: attachments.map((file) => file.file_path),
      cf_turnstile_response: turnstileToken,
    });
  });

  if (ticketQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <Alert variant="destructive">
          <AlertDescription>
            {t('support.thread.notFound')}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isClosed = ticket.status === 'closed';

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Link to="/tickets" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600">
        <ArrowLeft className="h-4 w-4" />
        {t('support.thread.backToTickets')}
      </Link>

      <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">#{ticket.id}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">{ticket.subject}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t('support.thread.headerDescription')}
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

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {ticket.messages?.map((message) => {
            const isUser = message.sender_role === 'user';
            return (
              <Card key={message.id} className={isUser ? 'border-emerald-200/60 dark:border-emerald-500/20' : ''}>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {message.sender_name || t('support.thread.unknownSender')}
                      </p>
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                        {t(`support.senderRoles.${message.sender_role}`)}
                      </p>
                    </div>
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                      {formatSupportDate(message.created_at, currentLanguage === 'zh' ? 'zh-CN' : 'en-US')}
                    </p>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground">{message.body}</p>
                  <AttachmentList attachments={message.attachments} />
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('support.thread.summaryTitle')}</CardTitle>
              <CardDescription>{t('support.thread.summarySubtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('support.thread.createdAt')}</span>
                <span>{formatSupportDate(ticket.created_at, currentLanguage === 'zh' ? 'zh-CN' : 'en-US')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('support.thread.lastReply')}</span>
                <span>{formatSupportDate(ticket.last_replied_at || ticket.updated_at, currentLanguage === 'zh' ? 'zh-CN' : 'en-US')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('support.thread.messageCount')}</span>
                <span>{ticket.messages?.length ?? 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('support.thread.replyTitle')}</CardTitle>
              <CardDescription>{t('support.thread.replySubtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isClosed ? (
                <Alert>
                  <AlertDescription>
                    {t('support.thread.closedHint')}
                  </AlertDescription>
                </Alert>
              ) : (
                <form className="space-y-4" onSubmit={onSubmit}>
                  <div className="space-y-2">
                    <Textarea
                      rows={6}
                      placeholder={t('support.thread.replyPlaceholder')}
                      {...register('content')}
                    />
                    {errors.content && <p className="text-sm text-red-600">{errors.content.message}</p>}
                  </div>

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
                          className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
                        >
                          {file.original_name}
                        </button>
                      ))}
                    </div>
                  )}

                  <Turnstile
                    ref={turnstileRef}
                    require
                    action="ticket_reply"
                    onVerify={setTurnstileToken}
                    onExpire={() => setTurnstileToken('')}
                    onError={() => setTurnstileToken('')}
                  />

                  <Button type="submit" className="w-full rounded-full" loading={replyMutation.isLoading}>
                    <Send className="mr-2 h-4 w-4" />
                    {t('support.thread.replySubmit')}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
