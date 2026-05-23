import Silian_React, { useMemo as Silian_useMemo, useRef as Silian_useRef, useState as Silian_useState } from 'react';
import { Link as Silian_Link, useNavigate as Silian_useNavigate } from 'react-router-dom';
import { useMutation as Silian_useMutation, useQuery as Silian_useQuery, useQueryClient as Silian_useQueryClient } from 'react-query';
import { useController as Silian_useController, useForm as Silian_useForm } from 'react-hook-form';
import { z as Silian_z } from 'zod';
import { zodResolver as Silian_zodResolver } from '@hookform/resolvers/zod';
import { toast as Silian_toast } from 'react-hot-toast';
import { ArrowRight as Silian_ArrowRight, LogIn as Silian_LogIn, MessageSquareMore as Silian_MessageSquareMore, Ticket as Silian_Ticket, Upload as Silian_Upload } from 'lucide-react';

import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';
import { checkAuthStatus as Silian_checkAuthStatus } from '../lib/auth';
import { ticketAPI as Silian_ticketAPI } from '../lib/api';
import {
  mergeUploadedFiles as Silian_mergeUploadedFiles,
  TICKET_CATEGORY_OPTIONS as Silian_TICKET_CATEGORY_OPTIONS,
  TICKET_PRIORITY_OPTIONS as Silian_TICKET_PRIORITY_OPTIONS,
  formatSupportDate as Silian_formatSupportDate,
  getPriorityVariant as Silian_getPriorityVariant,
  getSlaMeta as Silian_getSlaMeta,
  getSlaTone as Silian_getSlaTone,
  getStatusTone as Silian_getStatusTone,
} from '../lib/supportTickets';
import Silian_Turnstile from '../components/common/Turnstile';
import Silian_FileUpload from '../components/FileUpload';
import { Button as Silian_Button } from '../components/ui/Button';
import { Input as Silian_Input } from '../components/ui/Input';
import { Textarea as Silian_Textarea } from '../components/ui/textarea';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../components/ui/Card';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription } from '../components/ui/Alert';
import { Badge as Silian_Badge } from '../components/ui/badge';
import {
  Select as Silian_Select,
  SelectContent as Silian_SelectContent,
  SelectItem as Silian_SelectItem,
  SelectTrigger as Silian_SelectTrigger,
  SelectValue as Silian_SelectValue,
} from '../components/ui/select';

const Silian_createTicketSchema = Silian_z.object({
  subject: Silian_z.string().trim().min(4).max(140),
  category: Silian_z.enum(Silian_TICKET_CATEGORY_OPTIONS.map((Silian_option) => Silian_option.value)),
  priority: Silian_z.enum(Silian_TICKET_PRIORITY_OPTIONS.map((Silian_option) => Silian_option.value)),
  content: Silian_z.string().trim().min(12).max(5000),
});

const Silian_scenarioKeys = ['website_bug', 'business_issue', 'feature_request', 'account'];
const Silian_helpFormDefaults = {
  subject: '',
  category: 'website_bug',
  priority: 'normal',
  content: '',
};

export default function HelpPage() {
  const { t: Silian_t, currentLanguage: Silian_currentLanguage } = Silian_useTranslation(['common', 'date', 'errors', 'help', 'support']);
  const Silian_navigate = Silian_useNavigate();
  const Silian_queryClient = Silian_useQueryClient();
  const Silian_turnstileRef = Silian_useRef(null);
  const [Silian_turnstileToken, Silian_setTurnstileToken] = Silian_useState('');
  const [Silian_attachments, Silian_setAttachments] = Silian_useState([]);
  const [Silian_attachmentGate, Silian_setAttachmentGate] = Silian_useState({ hasPendingUploads: false, hasUploadErrors: false, isSubmissionBlocked: false });
  const { isAuthenticated: Silian_isAuthenticated } = Silian_checkAuthStatus();

  const {
    control: Silian_control,
    register: Silian_register,
    handleSubmit: Silian_handleSubmit,
    reset: Silian_reset,
    formState: { errors: Silian_errors },
  } = Silian_useForm({
    resolver: Silian_zodResolver(Silian_createTicketSchema),
    defaultValues: Silian_helpFormDefaults,
  });
  const { field: Silian_categoryField } = Silian_useController({ name: 'category', control: Silian_control });
  const { field: Silian_priorityField } = Silian_useController({ name: 'priority', control: Silian_control });

  const Silian_recentTicketsQuery = Silian_useQuery(
    ['help-recent-tickets'],
    () => Silian_ticketAPI.getTickets({ limit: 3 }),
    {
      enabled: Silian_isAuthenticated,
      refetchOnWindowFocus: false,
    }
  );

  const Silian_scenarios = Silian_useMemo(() => Silian_scenarioKeys.map((Silian_key) => ({
    key: Silian_key,
    title: Silian_t(`support.scenarios.${Silian_key}.title`),
    description: Silian_t(`support.scenarios.${Silian_key}.description`),
  })), [Silian_t]);

  const Silian_createTicketMutation = Silian_useMutation(
    (Silian_payload) => Silian_ticketAPI.createTicket(Silian_payload),
    {
      onSuccess: (Silian_response) => {
        const Silian_ticket = Silian_response?.data?.data;
        Silian_toast.success(Silian_t('support.feedback.created'));
        Silian_reset(Silian_helpFormDefaults);
        Silian_setAttachments([]);
        Silian_setTurnstileToken('');
        Silian_turnstileRef.current?.reset?.();
        Silian_queryClient.invalidateQueries(['help-recent-tickets']);
        Silian_queryClient.invalidateQueries(['user-tickets']);
        if (Silian_ticket?.id) {
          Silian_navigate(`/tickets/${Silian_ticket.id}`);
        }
      },
      onError: (Silian_error) => {
        const Silian_message = Silian_error?.response?.data?.message || Silian_error.message || Silian_t('errors.operationFailed');
        Silian_toast.error(Silian_message);
        Silian_turnstileRef.current?.reset?.();
        Silian_setTurnstileToken('');
      },
    }
  );

  const Silian_recentTickets = Silian_recentTicketsQuery.data?.data?.data?.items ?? [];

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

    Silian_createTicketMutation.mutate({
      ...Silian_values,
      attachments: Silian_attachments.map((Silian_file) => Silian_file.file_path),
      cf_turnstile_response: Silian_turnstileToken,
    });
  });

  return (
    <div className="bg-background text-foreground">
      <section className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">
              {Silian_t('help.hero.eyebrow')}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">{Silian_t('help.hero.title')}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              {Silian_t('help.hero.subtitle')}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {Silian_isAuthenticated ? (
              <Silian_Button className="rounded-full bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => Silian_navigate('/tickets')}>
                <Silian_Ticket className="mr-2 h-4 w-4" />
                {Silian_t('help.hero.primaryAction')}
              </Silian_Button>
            ) : (
              <Silian_Button className="rounded-full bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => Silian_navigate('/auth/login')}>
                <Silian_LogIn className="mr-2 h-4 w-4" />
                {Silian_t('help.hero.loginAction')}
              </Silian_Button>
            )}
            <Silian_Button variant="outline" className="rounded-full border-border text-foreground hover:bg-muted" onClick={() => Silian_navigate('/contact')}>
              {Silian_t('help.hero.secondaryAction')}
            </Silian_Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)] lg:px-8">
        <div className="space-y-6">
          <Silian_Card className="rounded-[1.8rem] border border-border/80 bg-card/70 shadow-sm">
            <Silian_CardHeader className="border-b border-border/70 bg-muted/20">
              <Silian_CardTitle>{Silian_t('help.categories.title')}</Silian_CardTitle>
              <Silian_CardDescription>{Silian_t('help.categories.subtitle')}</Silian_CardDescription>
            </Silian_CardHeader>
            <Silian_CardContent className="grid gap-3 sm:grid-cols-2">
              {Silian_scenarios.map((Silian_scenario) => (
                <div
                  key={Silian_scenario.key}
                  className="rounded-[1.5rem] border border-border bg-muted/30 p-4 transition hover:border-emerald-300 hover:bg-card"
                >
                  <p className="text-sm font-medium text-foreground">{Silian_scenario.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{Silian_scenario.description}</p>
                </div>
              ))}
            </Silian_CardContent>
          </Silian_Card>

          {Silian_isAuthenticated ? (
            <Silian_Card className="overflow-hidden rounded-[1.8rem] border-border/80 bg-card/70 shadow-sm">
              <Silian_CardHeader className="border-b border-border/70 bg-muted/20">
                <Silian_CardTitle className="text-2xl">{Silian_t('support.feedback.title')}</Silian_CardTitle>
                <Silian_CardDescription>{Silian_t('support.feedback.subtitle')}</Silian_CardDescription>
              </Silian_CardHeader>
              <Silian_CardContent className="space-y-5 pt-6">
                <form className="space-y-5" onSubmit={Silian_onSubmit}>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="help-subject">
                      {Silian_t('support.feedback.fields.subject')}
                    </label>
                    <Silian_Input
                      id="help-subject"
                      placeholder={Silian_t('support.feedback.placeholders.subject')}
                      {...Silian_register('subject')}
                      error={Silian_errors.subject?.message}
                    />
                    {Silian_errors.subject && <p className="text-sm text-red-600">{Silian_errors.subject.message}</p>}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        {Silian_t('support.feedback.fields.category')}
                      </label>
                      <Silian_Select value={Silian_categoryField.value} onValueChange={Silian_categoryField.onChange}>
                        <Silian_SelectTrigger className="w-full">
                          <Silian_SelectValue placeholder={Silian_t('support.feedback.fields.category')} />
                        </Silian_SelectTrigger>
                        <Silian_SelectContent>
                          {Silian_TICKET_CATEGORY_OPTIONS.map((Silian_option) => (
                            <Silian_SelectItem key={Silian_option.value} value={Silian_option.value}>
                              {Silian_t(Silian_option.labelKey)}
                            </Silian_SelectItem>
                          ))}
                        </Silian_SelectContent>
                      </Silian_Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        {Silian_t('support.feedback.fields.priority')}
                      </label>
                      <Silian_Select value={Silian_priorityField.value} onValueChange={Silian_priorityField.onChange}>
                        <Silian_SelectTrigger className="w-full">
                          <Silian_SelectValue placeholder={Silian_t('support.feedback.fields.priority')} />
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
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="help-content">
                      {Silian_t('support.feedback.fields.content')}
                    </label>
                    <Silian_Textarea
                      id="help-content"
                      rows={6}
                      placeholder={Silian_t('support.feedback.placeholders.content')}
                      {...Silian_register('content')}
                    />
                    {Silian_errors.content && <p className="text-sm text-red-600">{Silian_errors.content.message}</p>}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Silian_Upload className="h-4 w-4" />
                      {Silian_t('support.feedback.fields.attachments')}
                    </div>
                    <Silian_FileUpload
                      multiple
                      maxFiles={4}
                      directory="support-tickets"
                      entityType="support_ticket"
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
                      <Silian_Alert className="rounded-[1.2rem]">
                        <Silian_AlertDescription>{Silian_t('support.attachments.uploadFailedBlocking')}</Silian_AlertDescription>
                      </Silian_Alert>
                    ) : null}
                    {Silian_attachmentGate.hasPendingUploads ? (
                      <Silian_Alert className="rounded-[1.2rem] border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                        <Silian_AlertDescription>{Silian_t('support.attachments.uploadRequired')}</Silian_AlertDescription>
                      </Silian_Alert>
                    ) : null}
                  </div>

                  <Silian_Turnstile
                    ref={Silian_turnstileRef}
                    require
                    action="contact_ticket"
                    onVerify={Silian_setTurnstileToken}
                    onExpire={() => Silian_setTurnstileToken('')}
                    onError={() => Silian_setTurnstileToken('')}
                  />

                  <Silian_Button
                    type="submit"
                    className="w-full rounded-full bg-emerald-600 text-white hover:bg-emerald-500"
                    loading={Silian_createTicketMutation.isLoading}
                    disabled={Silian_attachmentGate.isSubmissionBlocked}
                  >
                    <Silian_MessageSquareMore className="mr-2 h-4 w-4" />
                    {Silian_t('support.feedback.submit')}
                  </Silian_Button>
                </form>
              </Silian_CardContent>
            </Silian_Card>
          ) : (
            <Silian_Alert className="rounded-[1.6rem] border-border/80 bg-card/70 shadow-sm">
              <Silian_AlertDescription className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <span>{Silian_t('help.loginNotice')}</span>
                <Silian_Link to="/auth/login" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600">
                  {Silian_t('help.hero.loginAction')}
                  <Silian_ArrowRight className="h-4 w-4" />
                </Silian_Link>
              </Silian_AlertDescription>
            </Silian_Alert>
          )}
        </div>

        <Silian_Card className="rounded-[1.8rem] border-border/80 bg-card/70 shadow-sm">
          <Silian_CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <Silian_CardTitle className="text-xl">{Silian_t('support.recent.title')}</Silian_CardTitle>
              <Silian_CardDescription>{Silian_t('support.recent.subtitle')}</Silian_CardDescription>
            </div>
            {Silian_isAuthenticated && (
              <Silian_Button variant="outline" className="rounded-full border-border hover:bg-muted" onClick={() => Silian_navigate('/tickets')}>
                {Silian_t('support.recent.viewAll')}
              </Silian_Button>
            )}
          </Silian_CardHeader>
          <Silian_CardContent className="space-y-3">
            {!Silian_isAuthenticated && (
              <Silian_Alert className="rounded-[1.4rem] border-border/80 bg-muted/30">
                <Silian_AlertDescription>{Silian_t('help.recentGuest')}</Silian_AlertDescription>
              </Silian_Alert>
            )}
            {Silian_isAuthenticated && Silian_recentTicketsQuery.isLoading && (
              <div className="text-sm text-muted-foreground">{Silian_t('common.loading')}</div>
            )}
            {Silian_isAuthenticated && !Silian_recentTicketsQuery.isLoading && Silian_recentTickets.length === 0 && (
              <Silian_Alert className="rounded-[1.4rem] border-border/80 bg-muted/30">
                <Silian_AlertDescription>{Silian_t('support.recent.empty')}</Silian_AlertDescription>
              </Silian_Alert>
            )}
            {Silian_isAuthenticated && Silian_recentTickets.map((Silian_ticket) => (
              (() => {
                const Silian_locale = Silian_currentLanguage === 'zh' ? 'zh-CN' : 'en-US';
                const Silian_slaMeta = Silian_getSlaMeta(Silian_ticket, Silian_locale);

                return (
                  <Silian_Link
                    key={Silian_ticket.id}
                    to={`/tickets/${Silian_ticket.id}`}
                    className="block rounded-[1.5rem] border border-border/80 bg-muted/20 px-4 py-4 transition hover:border-emerald-300 hover:bg-card"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">#{Silian_ticket.id} {Silian_ticket.subject}</p>
                      <Silian_Badge className={Silian_getStatusTone(Silian_ticket.status)} variant="outline">
                        {Silian_t(`support.statuses.${Silian_ticket.status}`)}
                      </Silian_Badge>
                      <Silian_Badge variant={Silian_getPriorityVariant(Silian_ticket.priority)}>
                        {Silian_t(`support.priorities.${Silian_ticket.priority}`)}
                      </Silian_Badge>
                      {Silian_slaMeta.state ? (
                        <Silian_Badge variant="outline" className={Silian_getSlaTone(Silian_slaMeta.state)}>
                          {Silian_t(`support.slaStatuses.${Silian_slaMeta.state}`, { defaultValue: Silian_slaMeta.state })}
                        </Silian_Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{Silian_ticket.latest_message_preview}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                      {Silian_formatSupportDate(Silian_ticket.last_replied_at || Silian_ticket.created_at, Silian_locale)} · {Silian_slaMeta.relativeLabel}
                    </p>
                  </Silian_Link>
                );
              })()
            ))}
          </Silian_CardContent>
        </Silian_Card>
      </section>
    </div>
  );
}
