import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { toast } from 'react-hot-toast';
import { Button } from '../ui/Button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/Alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Textarea } from '../ui/textarea';
import {
  ANNOUNCEMENT_PROMPT_ACTION_GENERATE,
  buildAnnouncementPromptBundle,
  buildAnnouncementSystemPrompt,
  buildAnnouncementUserPrompt,
  normalizeAnnouncementPromptAction,
} from '../../lib/announcementPrompt';

async function copyToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  throw new TypeError(`Clipboard API unavailable. Unable to copy ${text.length} characters.`);
}

export function AnnouncementPromptHelper({
  title,
  content,
  priority,
  contentFormat,
  action: controlledAction,
  instruction: controlledInstruction,
  t,
}) {
  const normalizedAction = normalizeAnnouncementPromptAction(controlledAction ?? ANNOUNCEMENT_PROMPT_ACTION_GENERATE);
  const effectiveInstruction = typeof controlledInstruction === 'string' ? controlledInstruction : '';

  const promptOptions = useMemo(
    () => ({
      action: normalizedAction,
      title,
      content,
      priority,
      contentFormat,
      instruction: effectiveInstruction,
    }),
    [content, contentFormat, effectiveInstruction, normalizedAction, priority, title]
  );

  const systemPrompt = useMemo(() => buildAnnouncementSystemPrompt(), []);
  const userPrompt = useMemo(() => buildAnnouncementUserPrompt(promptOptions), [promptOptions]);
  const fullPrompt = useMemo(() => buildAnnouncementPromptBundle(promptOptions), [promptOptions]);

  const handleCopy = async (text, successMessage) => {
    try {
      await copyToClipboard(text);
      toast.success(successMessage);
    } catch {
      toast.error(t('admin.broadcast.llmHelper.copyFailed'));
    }
  };

  return (
    <div className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t('admin.broadcast.llmHelper.copyPanelTitle')}
            </h4>
            <Badge variant="outline">{t('admin.broadcast.llmHelper.externalLabel')}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('admin.broadcast.llmHelper.copyPanelDescription')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => handleCopy(systemPrompt, t('admin.broadcast.llmHelper.copied.system'))}
          >
            {t('admin.broadcast.llmHelper.copySystem')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => handleCopy(userPrompt, t('admin.broadcast.llmHelper.copied.user'))}
          >
            {t('admin.broadcast.llmHelper.copyUser')}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => handleCopy(fullPrompt, t('admin.broadcast.llmHelper.copied.bundle'))}
          >
            {t('admin.broadcast.llmHelper.copyBundle')}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-2 rounded-md border bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-950/40">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            {t('admin.broadcast.llmHelper.actionLabel')}
          </label>
          <div className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
            {t(`admin.broadcast.llmHelper.actions.${normalizedAction}`)}
          </div>
          <p className="text-xs text-muted-foreground">
            {t('admin.broadcast.llmHelper.actionHint')}
          </p>
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              {t('admin.broadcast.llmHelper.instructionLabel')}
            </label>
            <Textarea
              value={effectiveInstruction}
              readOnly
              rows={4}
              className="min-h-[96px] bg-muted/40"
            />
          </div>
        </div>
        <Alert variant="info" className="border-blue-200/80 bg-white/70 dark:bg-slate-950/40">
          <AlertDescription className="space-y-2">
            <p className="font-medium text-slate-800 dark:text-slate-200">
              {t('admin.broadcast.llmHelper.tipTitle')}
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-slate-700 dark:text-slate-300">
              <li>{t('admin.broadcast.llmHelper.tipStep1')}</li>
              <li>{t('admin.broadcast.llmHelper.tipStep2')}</li>
              <li>{t('admin.broadcast.llmHelper.tipStep3')}</li>
            </ol>
          </AlertDescription>
        </Alert>
      </div>

      <Accordion type="single" collapsible className="mt-4 rounded-md border bg-white/80 px-4 dark:border-slate-800 dark:bg-slate-950/40">
        <AccordionItem value="user-prompt">
          <AccordionTrigger className="text-sm">
            {t('admin.broadcast.llmHelper.previewUser')}
          </AccordionTrigger>
          <AccordionContent>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-slate-950/95 p-3 text-xs leading-6 text-slate-100">
              {userPrompt}
            </pre>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="system-prompt">
          <AccordionTrigger className="text-sm">
            {t('admin.broadcast.llmHelper.previewSystem')}
          </AccordionTrigger>
          <AccordionContent>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-slate-950/95 p-3 text-xs leading-6 text-slate-100">
              {systemPrompt}
            </pre>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

AnnouncementPromptHelper.propTypes = {
  title: PropTypes.string,
  content: PropTypes.string,
  priority: PropTypes.string,
  contentFormat: PropTypes.string,
  action: PropTypes.string,
  instruction: PropTypes.string,
  t: PropTypes.func.isRequired,
};