import React, { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useController, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'react-hot-toast';
import { motion as Motion } from 'framer-motion';
import { ArrowRight, Clock3, LogIn, MessageSquareMore, ShieldCheck, Ticket, Upload } from 'lucide-react';

import { useTranslation } from '../hooks/useTranslation';
import { checkAuthStatus } from '../lib/auth';
import { ticketAPI } from '../lib/api';
import {
  mergeUploadedFiles,
  TICKET_CATEGORY_OPTIONS,
  TICKET_PRIORITY_OPTIONS,
  formatSupportDate,
  getPriorityVariant,
  getStatusTone,
} from '../lib/supportTickets';
import Turnstile from '../components/common/Turnstile';
import FileUpload from '../components/FileUpload';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Alert, AlertDescription } from '../components/ui/Alert';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

const createTicketSchema = z.object({
  subject: z.string().trim().min(4).max(140),
  category: z.enum(TICKET_CATEGORY_OPTIONS.map((option) => option.value)),
  priority: z.enum(TICKET_PRIORITY_OPTIONS.map((option) => option.value)),
  content: z.string().trim().min(12).max(5000),
});

const scenarioKeys = ['website_bug', 'business_issue', 'feature_request', 'account'];
const helpFormDefaults = {
  subject: '',
  category: 'website_bug',
  priority: 'normal',
  content: '',
};

export default function HelpPage() {
  const { t, currentLanguage } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const turnstileRef = useRef(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [attachments, setAttachments] = useState([]);
  const { isAuthenticated } = checkAuthStatus();

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createTicketSchema),
    defaultValues: helpFormDefaults,
  });
  const { field: categoryField } = useController({ name: 'category', control });
  const { field: priorityField } = useController({ name: 'priority', control });

  const recentTicketsQuery = useQuery(
    ['help-recent-tickets'],
    () => ticketAPI.getTickets({ limit: 3 }),
    {
      enabled: isAuthenticated,
      refetchOnWindowFocus: false,
    }
  );

  const scenarios = useMemo(() => scenarioKeys.map((key) => ({
    key,
    title: t(`support.scenarios.${key}.title`),
    description: t(`support.scenarios.${key}.description`),
  })), [t]);

  const createTicketMutation = useMutation(
    (payload) => ticketAPI.createTicket(payload),
    {
      onSuccess: (response) => {
        const ticket = response?.data?.data;
        toast.success(t('support.feedback.created'));
        reset(helpFormDefaults);
        setAttachments([]);
        setTurnstileToken('');
        turnstileRef.current?.reset?.();
        queryClient.invalidateQueries(['help-recent-tickets']);
        queryClient.invalidateQueries(['user-tickets']);
        if (ticket?.id) {
          navigate(`/tickets/${ticket.id}`);
        }
      },
      onError: (error) => {
        const message = error?.response?.data?.message || error.message || t('errors.operationFailed');
        toast.error(message);
        turnstileRef.current?.reset?.();
        setTurnstileToken('');
      },
    }
  );

  const recentTickets = recentTicketsQuery.data?.data?.data?.items ?? [];

  const onSubmit = handleSubmit((values) => {
    if (!turnstileToken) {
      toast.error(t('support.feedback.turnstileRequired'));
      return;
    }

    createTicketMutation.mutate({
      ...values,
      attachments: attachments.map((file) => file.file_path),
      cf_turnstile_response: turnstileToken,
    });
  });

  return (
    <div className="bg-background text-foreground">
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] lg:px-8 lg:py-18">
          <Motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">
              {t('help.hero.eyebrow')}
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              {t('help.hero.title')}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {t('help.hero.subtitle')}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {isAuthenticated ? (
                <Button className="rounded-full bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => navigate('/tickets')}>
                  <Ticket className="mr-2 h-4 w-4" />
                  {t('help.hero.primaryAction')}
                </Button>
              ) : (
                <Button className="rounded-full bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => navigate('/auth/login')}>
                  <LogIn className="mr-2 h-4 w-4" />
                  {t('help.hero.loginAction')}
                </Button>
              )}
              <Button variant="outline" className="rounded-full border-border text-foreground hover:bg-muted" onClick={() => navigate('/contact')}>
                {t('help.hero.secondaryAction')}
              </Button>
            </div>
          </Motion.div>

          <Motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut', delay: 0.05 }}
            className="rounded-[2rem] border border-border bg-card p-6 shadow-sm"
          >
            <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-300">
              <Ticket className="h-5 w-5" />
              <span className="text-sm font-medium">{t('help.panel.title')}</span>
            </div>
            <p className="mt-4 text-lg font-medium">{t('help.panel.body')}</p>
            <div className="mt-6 space-y-3">
              <div className="flex items-start gap-3 rounded-[1.4rem] border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <Clock3 className="mt-0.5 h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                <div>
                  <p className="text-sm font-medium">{t('help.highlights.threadTitle')}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t('help.highlights.threadDescription')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-[1.4rem] border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                <div>
                  <p className="text-sm font-medium">{t('help.highlights.verificationTitle')}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t('help.highlights.verificationDescription')}</p>
                </div>
              </div>
            </div>
          </Motion.div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)] lg:px-8">
        <div className="space-y-6">
          <Card className="rounded-[1.8rem] border border-border/80 bg-card/70 shadow-sm">
            <CardHeader className="border-b border-border/70 bg-muted/20">
              <CardTitle>{t('help.categories.title')}</CardTitle>
              <CardDescription>{t('help.categories.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {scenarios.map((scenario) => (
                <div
                  key={scenario.key}
                  className="rounded-[1.5rem] border border-border bg-muted/30 p-4 transition hover:border-emerald-300 hover:bg-card"
                >
                  <p className="text-sm font-medium text-foreground">{scenario.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{scenario.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {isAuthenticated ? (
            <Card className="overflow-hidden rounded-[1.8rem] border-border/80 bg-card/70 shadow-sm">
              <CardHeader className="border-b border-border/70 bg-muted/20">
                <CardTitle className="text-2xl">{t('support.feedback.title')}</CardTitle>
                <CardDescription>{t('support.feedback.subtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <form className="space-y-5" onSubmit={onSubmit}>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="help-subject">
                      {t('support.feedback.fields.subject')}
                    </label>
                    <Input
                      id="help-subject"
                      placeholder={t('support.feedback.placeholders.subject')}
                      {...register('subject')}
                      error={errors.subject?.message}
                    />
                    {errors.subject && <p className="text-sm text-red-600">{errors.subject.message}</p>}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        {t('support.feedback.fields.category')}
                      </label>
                      <Select value={categoryField.value} onValueChange={categoryField.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('support.feedback.fields.category')} />
                        </SelectTrigger>
                        <SelectContent>
                          {TICKET_CATEGORY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {t(option.labelKey)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        {t('support.feedback.fields.priority')}
                      </label>
                      <Select value={priorityField.value} onValueChange={priorityField.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('support.feedback.fields.priority')} />
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
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="help-content">
                      {t('support.feedback.fields.content')}
                    </label>
                    <Textarea
                      id="help-content"
                      rows={6}
                      placeholder={t('support.feedback.placeholders.content')}
                      {...register('content')}
                    />
                    {errors.content && <p className="text-sm text-red-600">{errors.content.message}</p>}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Upload className="h-4 w-4" />
                      {t('support.feedback.fields.attachments')}
                    </div>
                    <FileUpload
                      multiple
                      maxFiles={4}
                      directory="support-tickets"
                      entityType="support_ticket"
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
                  </div>

                  <Turnstile
                    ref={turnstileRef}
                    require
                    action="contact_ticket"
                    onVerify={setTurnstileToken}
                    onExpire={() => setTurnstileToken('')}
                    onError={() => setTurnstileToken('')}
                  />

                  <Button
                    type="submit"
                    className="w-full rounded-full bg-emerald-600 text-white hover:bg-emerald-500"
                    loading={createTicketMutation.isLoading}
                  >
                    <MessageSquareMore className="mr-2 h-4 w-4" />
                    {t('support.feedback.submit')}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Alert className="rounded-[1.6rem] border-border/80 bg-card/70 shadow-sm">
              <AlertDescription className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <span>{t('help.loginNotice')}</span>
                <Link to="/auth/login" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600">
                  {t('help.hero.loginAction')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Card className="rounded-[1.8rem] border-border/80 bg-card/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl">{t('support.recent.title')}</CardTitle>
              <CardDescription>{t('support.recent.subtitle')}</CardDescription>
            </div>
            {isAuthenticated && (
              <Button variant="outline" className="rounded-full border-border hover:bg-muted" onClick={() => navigate('/tickets')}>
                {t('support.recent.viewAll')}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {!isAuthenticated && (
              <Alert className="rounded-[1.4rem] border-border/80 bg-muted/30">
                <AlertDescription>{t('help.recentGuest')}</AlertDescription>
              </Alert>
            )}
            {isAuthenticated && recentTicketsQuery.isLoading && (
              <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
            )}
            {isAuthenticated && !recentTicketsQuery.isLoading && recentTickets.length === 0 && (
              <Alert className="rounded-[1.4rem] border-border/80 bg-muted/30">
                <AlertDescription>{t('support.recent.empty')}</AlertDescription>
              </Alert>
            )}
            {isAuthenticated && recentTickets.map((ticket) => (
              <Link
                key={ticket.id}
                to={`/tickets/${ticket.id}`}
                className="block rounded-[1.5rem] border border-border/80 bg-muted/20 px-4 py-4 transition hover:border-emerald-300 hover:bg-card"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">#{ticket.id} {ticket.subject}</p>
                  <Badge className={getStatusTone(ticket.status)} variant="outline">
                    {t(`support.statuses.${ticket.status}`)}
                  </Badge>
                  <Badge variant={getPriorityVariant(ticket.priority)}>
                    {t(`support.priorities.${ticket.priority}`)}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{ticket.latest_message_preview}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  {formatSupportDate(ticket.last_replied_at || ticket.created_at, currentLanguage === 'zh' ? 'zh-CN' : 'en-US')}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
