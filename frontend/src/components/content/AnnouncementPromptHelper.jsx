import Silian_React, { useMemo as Silian_useMemo } from 'react';
import Silian_PropTypes from 'prop-types';
import { toast as Silian_toast } from 'react-hot-toast';
import { Button as Silian_Button } from '../ui/Button';
import { Badge as Silian_Badge } from '../ui/badge';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription } from '../ui/Alert';
import { Accordion as Silian_Accordion, AccordionContent as Silian_AccordionContent, AccordionItem as Silian_AccordionItem, AccordionTrigger as Silian_AccordionTrigger } from '../ui/accordion';
import { Textarea as Silian_Textarea } from '../ui/textarea';
import { Select as Silian_Select, SelectContent as Silian_SelectContent, SelectItem as Silian_SelectItem, SelectTrigger as Silian_SelectTrigger, SelectValue as Silian_SelectValue } from '../ui/select';
import {
  ANNOUNCEMENT_PROMPT_ACTION_COMPRESS as Silian_ANNOUNCEMENT_PROMPT_ACTION_COMPRESS,
  ANNOUNCEMENT_PROMPT_ACTION_CONVERT as Silian_ANNOUNCEMENT_PROMPT_ACTION_CONVERT,
  ANNOUNCEMENT_PROMPT_ACTION_GENERATE as Silian_ANNOUNCEMENT_PROMPT_ACTION_GENERATE,
  ANNOUNCEMENT_PROMPT_ACTION_REWRITE as Silian_ANNOUNCEMENT_PROMPT_ACTION_REWRITE,
  buildAnnouncementPromptBundle as Silian_buildAnnouncementPromptBundle,
  buildAnnouncementSystemPrompt as Silian_buildAnnouncementSystemPrompt,
  buildAnnouncementUserPrompt as Silian_buildAnnouncementUserPrompt,
  normalizeAnnouncementPromptAction as Silian_normalizeAnnouncementPromptAction,
} from '../../lib/announcementPrompt';

async function Silian_copyToClipboard(Silian_text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(Silian_text);
    return;
  }

  throw new TypeError(`Clipboard API unavailable. Unable to copy ${Silian_text.length} characters.`);
}

export function AnnouncementPromptHelper({
  title: Silian_title,
  content: Silian_content,
  priority: Silian_priority,
  contentFormat: Silian_contentFormat,
  action: Silian_controlledAction,
  instruction: Silian_controlledInstruction,
  onActionChange: Silian_onActionChange,
  onInstructionChange: Silian_onInstructionChange,
  t: Silian_t,
}) {
  const Silian_normalizedAction = Silian_normalizeAnnouncementPromptAction(Silian_controlledAction ?? Silian_ANNOUNCEMENT_PROMPT_ACTION_GENERATE);
  const Silian_effectiveInstruction = typeof Silian_controlledInstruction === 'string' ? Silian_controlledInstruction : '';
  const Silian_isInteractive = typeof Silian_onActionChange === 'function' || typeof Silian_onInstructionChange === 'function';

  const Silian_promptOptions = Silian_useMemo(
    () => ({
      action: Silian_normalizedAction,
      title: Silian_title,
      content: Silian_content,
      priority: Silian_priority,
      contentFormat: Silian_contentFormat,
      instruction: Silian_effectiveInstruction,
    }),
    [Silian_content, Silian_contentFormat, Silian_effectiveInstruction, Silian_normalizedAction, Silian_priority, Silian_title]
  );

  const Silian_systemPrompt = Silian_useMemo(() => Silian_buildAnnouncementSystemPrompt(), []);
  const Silian_userPrompt = Silian_useMemo(() => Silian_buildAnnouncementUserPrompt(Silian_promptOptions), [Silian_promptOptions]);
  const Silian_fullPrompt = Silian_useMemo(() => Silian_buildAnnouncementPromptBundle(Silian_promptOptions), [Silian_promptOptions]);

  const Silian_handleCopy = async (Silian_text, Silian_successMessage) => {
    try {
      await Silian_copyToClipboard(Silian_text);
      Silian_toast.success(Silian_successMessage);
    } catch {
      Silian_toast.error(Silian_t('admin.broadcast.llmHelper.copyFailed'));
    }
  };

  return (
    <div className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {Silian_t('admin.broadcast.llmHelper.copyPanelTitle')}
            </h4>
            <Silian_Badge variant="outline">{Silian_t('admin.broadcast.llmHelper.externalLabel')}</Silian_Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {Silian_t('admin.broadcast.llmHelper.copyPanelDescription')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Silian_Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => Silian_handleCopy(Silian_systemPrompt, Silian_t('admin.broadcast.llmHelper.copied.system'))}
          >
            {Silian_t('admin.broadcast.llmHelper.copySystem')}
          </Silian_Button>
          <Silian_Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => Silian_handleCopy(Silian_userPrompt, Silian_t('admin.broadcast.llmHelper.copied.user'))}
          >
            {Silian_t('admin.broadcast.llmHelper.copyUser')}
          </Silian_Button>
          <Silian_Button
            type="button"
            size="sm"
            onClick={() => Silian_handleCopy(Silian_fullPrompt, Silian_t('admin.broadcast.llmHelper.copied.bundle'))}
          >
            {Silian_t('admin.broadcast.llmHelper.copyBundle')}
          </Silian_Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-2 rounded-md border bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-950/40">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            {Silian_t('admin.broadcast.llmHelper.actionLabel')}
          </label>
          {typeof Silian_onActionChange === 'function' ? (
            <Silian_Select value={Silian_normalizedAction} onValueChange={Silian_onActionChange}>
              <Silian_SelectTrigger className="w-full">
                <Silian_SelectValue placeholder={Silian_t('admin.broadcast.llmHelper.actionLabel')} />
              </Silian_SelectTrigger>
              <Silian_SelectContent>
                <Silian_SelectItem value={Silian_ANNOUNCEMENT_PROMPT_ACTION_GENERATE}>
                  {Silian_t('admin.broadcast.llmHelper.actions.generate')}
                </Silian_SelectItem>
                <Silian_SelectItem value={Silian_ANNOUNCEMENT_PROMPT_ACTION_REWRITE}>
                  {Silian_t('admin.broadcast.llmHelper.actions.rewrite')}
                </Silian_SelectItem>
                <Silian_SelectItem value={Silian_ANNOUNCEMENT_PROMPT_ACTION_COMPRESS}>
                  {Silian_t('admin.broadcast.llmHelper.actions.compress')}
                </Silian_SelectItem>
                <Silian_SelectItem value={Silian_ANNOUNCEMENT_PROMPT_ACTION_CONVERT}>
                  {Silian_t('admin.broadcast.llmHelper.actions.convert')}
                </Silian_SelectItem>
              </Silian_SelectContent>
            </Silian_Select>
          ) : (
            <div className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
              {Silian_t(`admin.broadcast.llmHelper.actions.${Silian_normalizedAction}`)}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {Silian_t('admin.broadcast.llmHelper.actionHint')}
          </p>
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              {Silian_t('admin.broadcast.llmHelper.instructionLabel')}
            </label>
            <Silian_Textarea
              value={Silian_effectiveInstruction}
              onChange={(Silian_event) => Silian_onInstructionChange?.(Silian_event.target.value)}
              readOnly={typeof Silian_onInstructionChange !== 'function'}
              rows={4}
              placeholder={Silian_isInteractive ? Silian_t('admin.broadcast.llmHelper.instructionPlaceholder') : undefined}
              className="min-h-[96px] bg-muted/40"
            />
            {Silian_isInteractive && (
              <p className="text-xs text-muted-foreground">
                {Silian_t('admin.broadcast.llmHelper.instructionHint')}
              </p>
            )}
          </div>
        </div>
        <Silian_Alert variant="info" className="border-blue-200/80 bg-white/70 dark:bg-slate-950/40">
          <Silian_AlertDescription className="space-y-2">
            <p className="font-medium text-slate-800 dark:text-slate-200">
              {Silian_t('admin.broadcast.llmHelper.tipTitle')}
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-slate-700 dark:text-slate-300">
              <li>{Silian_t('admin.broadcast.llmHelper.tipStep1')}</li>
              <li>{Silian_t('admin.broadcast.llmHelper.tipStep2')}</li>
              <li>{Silian_t('admin.broadcast.llmHelper.tipStep3')}</li>
            </ol>
          </Silian_AlertDescription>
        </Silian_Alert>
      </div>

      <Silian_Accordion type="single" collapsible className="mt-4 rounded-md border bg-white/80 px-4 dark:border-slate-800 dark:bg-slate-950/40">
        <Silian_AccordionItem value="user-prompt">
          <Silian_AccordionTrigger className="text-sm">
            {Silian_t('admin.broadcast.llmHelper.previewUser')}
          </Silian_AccordionTrigger>
          <Silian_AccordionContent>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-slate-950/95 p-3 text-xs leading-6 text-slate-100">
              {Silian_userPrompt}
            </pre>
          </Silian_AccordionContent>
        </Silian_AccordionItem>

        <Silian_AccordionItem value="system-prompt">
          <Silian_AccordionTrigger className="text-sm">
            {Silian_t('admin.broadcast.llmHelper.previewSystem')}
          </Silian_AccordionTrigger>
          <Silian_AccordionContent>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-slate-950/95 p-3 text-xs leading-6 text-slate-100">
              {Silian_systemPrompt}
            </pre>
          </Silian_AccordionContent>
        </Silian_AccordionItem>
      </Silian_Accordion>
    </div>
  );
}

AnnouncementPromptHelper.propTypes = {
  title: Silian_PropTypes.string,
  content: Silian_PropTypes.string,
  priority: Silian_PropTypes.string,
  contentFormat: Silian_PropTypes.string,
  action: Silian_PropTypes.string,
  instruction: Silian_PropTypes.string,
  onActionChange: Silian_PropTypes.func,
  onInstructionChange: Silian_PropTypes.func,
  t: Silian_PropTypes.func.isRequired,
};