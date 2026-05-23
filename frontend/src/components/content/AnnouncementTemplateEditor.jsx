import Silian_React, { useEffect as Silian_useEffect, useMemo as Silian_useMemo, useRef as Silian_useRef, useState as Silian_useState, useCallback as Silian_useCallback } from 'react';
import Silian_PropTypes from 'prop-types';
import Silian_CodeMirror from '@uiw/react-codemirror';
import { html as Silian_html } from '@codemirror/lang-html';
import { oneDark as Silian_oneDark } from '@codemirror/theme-one-dark';
import { EditorView as Silian_EditorView, placeholder as Silian_editorPlaceholder, keymap as Silian_keymap } from '@codemirror/view';
import { EditorState as Silian_EditorState } from '@codemirror/state';
import { Button as Silian_Button } from '../ui/Button';
import { Badge as Silian_Badge } from '../ui/badge';
import { Tabs as Silian_Tabs, TabsContent as Silian_TabsContent, TabsList as Silian_TabsList, TabsTrigger as Silian_TabsTrigger } from '../ui/Tabs';
import { Select as Silian_Select, SelectContent as Silian_SelectContent, SelectItem as Silian_SelectItem, SelectTrigger as Silian_SelectTrigger, SelectValue as Silian_SelectValue } from '../ui/select';
import { cn as Silian_cn } from '../../lib/utils';
import { Sparkles as Silian_Sparkles, Check as Silian_Check, X as Silian_X, Loader2 as Silian_Loader2 } from 'lucide-react';
import { toast as Silian_toast } from 'react-hot-toast';
import {
  ANNOUNCEMENT_PROMPT_ACTION_COMPRESS as Silian_ANNOUNCEMENT_PROMPT_ACTION_COMPRESS,
  ANNOUNCEMENT_PROMPT_ACTION_CONVERT as Silian_ANNOUNCEMENT_PROMPT_ACTION_CONVERT,
  ANNOUNCEMENT_PROMPT_ACTION_GENERATE as Silian_ANNOUNCEMENT_PROMPT_ACTION_GENERATE,
  ANNOUNCEMENT_PROMPT_ACTION_REWRITE as Silian_ANNOUNCEMENT_PROMPT_ACTION_REWRITE,
  normalizeAnnouncementPromptAction as Silian_normalizeAnnouncementPromptAction,
} from '../../lib/announcementPrompt';

function Silian_getInitialDarkMode() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
}

function Silian_insertSnippetWithEditor(Silian_value, Silian_snippet, Silian_editorView) {
  const Silian_view = Silian_editorView;
  if (!Silian_view) return Silian_value;
  const Silian_selection = Silian_view.state.selection.main;
  const Silian_from = Silian_selection?.from ?? Silian_value.length;
  const Silian_to = Silian_selection?.to ?? Silian_value.length;
  Silian_view.dispatch({
    changes: { from: Silian_from, to: Silian_to, insert: Silian_snippet },
    selection: { anchor: Silian_from + Silian_snippet.length },
  });
  Silian_view.focus();
  return Silian_view.state.doc.toString();
}

export function AnnouncementTemplateEditor({
  value: Silian_value,
  onChange: Silian_onChange,
  onApplyTemplate: Silian_onApplyTemplate,
  title: Silian_title,
  priority: Silian_priority,
  contentFormat: Silian_contentFormat,
  action: Silian_action,
  onActionChange: Silian_onActionChange,
  instruction: Silian_instruction,
  onInstructionChange: Silian_onInstructionChange,
  onRunBuiltin: Silian_onRunBuiltin,
  isBuiltinLoading: Silian_isBuiltinLoading,
  onUpdateTitle: Silian_onUpdateTitle,
  onUpdateFormat: Silian_onUpdateFormat,
  editorHeight: Silian_editorHeight = '380px',
  t: Silian_t,
}) {
  const Silian_editorViewRef = Silian_useRef(null);
  const Silian_presetCards = Silian_useMemo(() => ([
    {
      id: 'maintenance',
      label: Silian_t('admin.broadcast.editor.templates.maintenance.label'),
      description: Silian_t('admin.broadcast.editor.templates.maintenance.description'),
      content: Silian_t('admin.broadcast.editor.templates.maintenance.content'),
    },
    {
      id: 'release',
      label: Silian_t('admin.broadcast.editor.templates.release.label'),
      description: Silian_t('admin.broadcast.editor.templates.release.description'),
      content: Silian_t('admin.broadcast.editor.templates.release.content'),
    },
    {
      id: 'event',
      label: Silian_t('admin.broadcast.editor.templates.event.label'),
      description: Silian_t('admin.broadcast.editor.templates.event.description'),
      content: Silian_t('admin.broadcast.editor.templates.event.content'),
    },
  ]), [Silian_t]);
  const Silian_snippets = Silian_useMemo(() => ([
    { label: Silian_t('admin.broadcast.editor.snippets.heading'), value: Silian_t('admin.broadcast.editor.snippetContent.heading') },
    { label: Silian_t('admin.broadcast.editor.snippets.paragraph'), value: Silian_t('admin.broadcast.editor.snippetContent.paragraph') },
    { label: Silian_t('admin.broadcast.editor.snippets.link'), value: Silian_t('admin.broadcast.editor.snippetContent.link') },
    { label: Silian_t('admin.broadcast.editor.snippets.quote'), value: Silian_t('admin.broadcast.editor.snippetContent.quote') },
    { label: Silian_t('admin.broadcast.editor.snippets.code'), value: '<pre><code>npm run build</code></pre>' },
    { label: Silian_t('admin.broadcast.editor.snippets.table'), value: Silian_t('admin.broadcast.editor.snippetContent.table') },
    { label: Silian_t('admin.broadcast.editor.snippets.divider'), value: '<hr />' },
    { label: Silian_t('admin.broadcast.editor.snippets.list'), value: Silian_t('admin.broadcast.editor.snippetContent.list') },
  ]), [Silian_t]);
  const [Silian_activeTab, Silian_setActiveTab] = Silian_useState('code');
  const [Silian_isDarkMode, Silian_setIsDarkMode] = Silian_useState(Silian_getInitialDarkMode);

  // AI Copilot state
  const [Silian_aiMenuState, Silian_setAiMenuState] = Silian_useState('idle'); // 'idle' | 'composing' | 'generating' | 'reviewing'
  const [Silian_diffContext, Silian_setDiffContext] = Silian_useState(null);

  const Silian_normalizedAction = Silian_useMemo(() => Silian_normalizeAnnouncementPromptAction(Silian_action), [Silian_action]);

  Silian_useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const Silian_updateDarkMode = () => {
      Silian_setIsDarkMode(document.documentElement.classList.contains('dark') || document.body.classList.contains('dark'));
    };
    Silian_updateDarkMode();
    const Silian_observer = new MutationObserver(Silian_updateDarkMode);
    Silian_observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    Silian_observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    const Silian_mediaQuery = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
    Silian_mediaQuery?.addEventListener?.('change', Silian_updateDarkMode);
    return () => {
      Silian_observer.disconnect();
      Silian_mediaQuery?.removeEventListener?.('change', Silian_updateDarkMode);
      Silian_editorViewRef.current = null;
    };
  }, []);

  const Silian_handleAiHotkey = Silian_useCallback(() => {
    if (Silian_aiMenuState !== 'idle') return false;
    Silian_setAiMenuState('composing');
    return true;
  }, [Silian_aiMenuState]);

  Silian_useEffect(() => {
    const Silian_handleGlobalKeyDown = (Silian_e) => {
      if (Silian_e.key === 'Escape' && Silian_aiMenuState === 'composing') {
        Silian_setAiMenuState('idle');
      }
    };
    globalThis.addEventListener('keydown', Silian_handleGlobalKeyDown);
    return () => globalThis.removeEventListener('keydown', Silian_handleGlobalKeyDown);
  }, [Silian_aiMenuState]);

  const Silian_editorExtensions = Silian_useMemo(() => {
    const Silian_cmdKeymap = Silian_keymap.of([
      {
        key: 'Mod-i',
        run: () => Silian_handleAiHotkey(),
        preventDefault: true
      }
    ]);

    return [
      Silian_html(),
      Silian_EditorView.lineWrapping,
      Silian_editorPlaceholder(Silian_t('admin.broadcast.editor.placeholder')),
      Silian_cmdKeymap,
      Silian_aiMenuState === 'generating' || Silian_aiMenuState === 'reviewing' || Silian_isBuiltinLoading ? Silian_EditorState.readOnly.of(true) : [],
    ];
  }, [Silian_t, Silian_aiMenuState, Silian_handleAiHotkey, Silian_isBuiltinLoading]);

  const Silian_handleInsertSnippet = (Silian_snippet) => {
    Silian_onChange(Silian_insertSnippetWithEditor(Silian_value, Silian_snippet, Silian_editorViewRef.current));
  };

  const Silian_handleApplyTemplate = (Silian_template) => {
    if (Silian_onApplyTemplate) {
      Silian_onApplyTemplate(Silian_template);
      return;
    }
    Silian_onChange(Silian_template.content);
  };

  const Silian_executeCopilot = async () => {
    const Silian_view = Silian_editorViewRef.current;
    let Silian_currentHtml = Silian_value;
    let Silian_from = 0;
    let Silian_to = Silian_currentHtml.length;
    let Silian_isSelection = false;
    let Silian_originalText = Silian_currentHtml;

    if (Silian_view) {
        const Silian_selection = Silian_view.state.selection.main;
        if (Silian_selection.from !== Silian_selection.to) {
            Silian_from = Silian_selection.from;
            Silian_to = Silian_selection.to;
            Silian_originalText = Silian_view.state.doc.sliceString(Silian_from, Silian_to);
            Silian_isSelection = true;
        }
    }

    if (!Silian_originalText.trim() && !Silian_instruction.trim() && !Silian_title.trim()) {
       Silian_toast.error(Silian_t('admin.broadcast.llmHelper.builtinInputRequired'));
       return;
    }

    Silian_setAiMenuState('generating');

    try {
      if (typeof Silian_onRunBuiltin !== 'function') {
        throw new TypeError('Missing onRunBuiltin handler');
      }

      const Silian_data = (await Silian_onRunBuiltin({
        action: Silian_normalizedAction,
        instruction: Silian_instruction || '',
        title: Silian_title,
        priority: Silian_priority,
        content_format: Silian_contentFormat,
        content: Silian_originalText,
        source: 'admin:/admin/broadcast',
      })) ?? {};
        const Silian_aiText = Silian_data.content || '';

        if (Silian_view) {
            Silian_view.dispatch({
                changes: { from: Silian_from, to: Silian_to, insert: Silian_aiText },
                selection: { anchor: Silian_from, head: Silian_from + Silian_aiText.length }
            });
        } else {
            Silian_onChange(Silian_currentHtml.substring(0, Silian_from) + Silian_aiText + Silian_currentHtml.substring(Silian_to));
        }

        Silian_setDiffContext({
            isSelection: Silian_isSelection,
            originalText: Silian_originalText,
            insertedLength: Silian_aiText.length,
            from: Silian_from,
            newTitle: Silian_data.title,
            newFormat: Silian_data.content_format
        });

        Silian_setAiMenuState('reviewing');
        Silian_toast.success(Silian_t('admin.broadcast.editor.copilot.reviewReady'));
    } catch(Silian_err) {
        const Silian_message = Silian_err?.response?.data?.error || Silian_err?.message || Silian_t('admin.broadcast.llmHelper.builtinFailed');
        Silian_toast.error(Silian_message);
        Silian_setAiMenuState('composing');
    }
  };

  const Silian_isGenerating = Silian_aiMenuState === 'generating' || Silian_isBuiltinLoading;

  const Silian_acceptDiff = () => {
    if (!Silian_diffContext) return;
    if (!Silian_diffContext.isSelection && Silian_diffContext.newTitle && Silian_onUpdateTitle) {
        Silian_onUpdateTitle(Silian_diffContext.newTitle);
    }
    if (!Silian_diffContext.isSelection && Silian_diffContext.newFormat && Silian_onUpdateFormat) {
        Silian_onUpdateFormat(Silian_diffContext.newFormat);
    }
    Silian_setDiffContext(null);
    Silian_setAiMenuState('idle');
  };

  const Silian_rejectDiff = () => {
    const Silian_view = Silian_editorViewRef.current;
    if (Silian_view && Silian_diffContext) {
        const { from: Silian_from, insertedLength: Silian_insertedLength, originalText: Silian_originalText } = Silian_diffContext;
        Silian_view.dispatch({
            changes: { from: Silian_from, to: Silian_from + Silian_insertedLength, insert: Silian_originalText },
            selection: { anchor: Silian_from, head: Silian_from + Silian_originalText.length }
        });
    }
    Silian_setDiffContext(null);
    Silian_setAiMenuState('composing');
  };

  const Silian_getSelectionContextHint = () => {
    const Silian_view = Silian_editorViewRef.current;
    if (!Silian_view) return '';
    const Silian_sel = Silian_view.state.selection.main;
    if (Silian_sel.from !== Silian_sel.to) {
      return Silian_t('admin.broadcast.editor.copilot.selectionHint', { count: Silian_sel.to - Silian_sel.from });
    }
    return Silian_t('admin.broadcast.editor.copilot.documentHint');
  };

  const Silian_hasSelection = (() => {
    const Silian_view = Silian_editorViewRef.current;
    if (!Silian_view) return false;
    const Silian_sel = Silian_view.state.selection.main;
    return Silian_sel.from !== Silian_sel.to;
  })();

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            {Silian_t('admin.broadcast.editor.title')}
          </h4>
          <p className="text-xs text-muted-foreground">
            {Silian_t('admin.broadcast.editor.description')}
          </p>
        </div>
      </div>

      <Silian_Tabs value={Silian_activeTab} onValueChange={Silian_setActiveTab} className="space-y-3">
        <Silian_TabsList>
          <Silian_TabsTrigger value="code">{Silian_t('admin.broadcast.editor.tabs.code')}</Silian_TabsTrigger>
          <Silian_TabsTrigger value="templates">{Silian_t('admin.broadcast.editor.tabs.templates')}</Silian_TabsTrigger>
        </Silian_TabsList>

        <Silian_TabsContent value="code" className="space-y-3">
          <div
            className={Silian_cn(
              'group/cm-wrapper relative overflow-hidden rounded-md border border-input bg-background shadow-xs flex flex-col',
              'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]'
            )}
          >
            {/* Snippets Toolbar - Rendered first to prevent overlapping by relative AI wrapper */}
            <div className="border-b border-border bg-slate-50/90 p-2 dark:bg-slate-950/60 z-10 relative">
              <div className="flex flex-wrap gap-2">
                {Silian_snippets.map((Silian_snippet) => (
                  <Silian_Button key={Silian_snippet.label} type="button" variant="outline" size="sm" className="h-7 text-xs bg-white dark:bg-slate-900" onClick={() => Silian_handleInsertSnippet(Silian_snippet.value)}>
                    {Silian_snippet.label}
                  </Silian_Button>
                ))}
              </div>
            </div>

            {/* Editor Area with Relative positioning for the Inline Copilot */}
            <div className="relative flex-1">
              {/* Inline Copilot Trigger Button */}
              {Silian_aiMenuState === 'idle' && (
                <Silian_Button
                  variant="default"
                  size="sm"
                  className="absolute top-3 right-4 z-10 shadow-md opacity-0 group-hover/cm-wrapper:opacity-100 transition-opacity bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-4"
                  onClick={() => Silian_setAiMenuState('composing')}
                >
                  <Silian_Sparkles className="w-3.5 h-3.5 mr-2" />
                  {Silian_t('admin.broadcast.editor.copilot.trigger')}
                </Silian_Button>
              )}

              {/* Inline Copilot Composing Menu */}
              {(Silian_aiMenuState === 'composing' || Silian_aiMenuState === 'generating') && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-[95%] max-w-[650px] rounded-lg border border-slate-200/60 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] backdrop-blur-xl flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-1.5 px-2">
                    <Silian_Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
                    <Silian_Select
                      value={Silian_normalizedAction}
                      onValueChange={(Silian_val) => Silian_onActionChange?.(Silian_val)}
                      disabled={Silian_isGenerating}
                    >
                      <Silian_SelectTrigger className="h-8 w-[110px] border-0 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-sm focus:ring-0 shadow-none font-medium px-2 rounded-md">
                        <Silian_SelectValue placeholder={Silian_t('admin.broadcast.editor.copilot.actionPlaceholder')} />
                      </Silian_SelectTrigger>
                      <Silian_SelectContent>
                        <Silian_SelectItem value={Silian_ANNOUNCEMENT_PROMPT_ACTION_GENERATE}>{Silian_t('admin.broadcast.llmHelper.actions.generate')}</Silian_SelectItem>
                        <Silian_SelectItem value={Silian_ANNOUNCEMENT_PROMPT_ACTION_REWRITE}>{Silian_t('admin.broadcast.llmHelper.actions.rewrite')}</Silian_SelectItem>
                        <Silian_SelectItem value={Silian_ANNOUNCEMENT_PROMPT_ACTION_COMPRESS}>{Silian_t('admin.broadcast.llmHelper.actions.compress')}</Silian_SelectItem>
                        <Silian_SelectItem value={Silian_ANNOUNCEMENT_PROMPT_ACTION_CONVERT}>{Silian_t('admin.broadcast.llmHelper.actions.convert')}</Silian_SelectItem>
                      </Silian_SelectContent>
                    </Silian_Select>
                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 shrink-0 mx-1" />
                    <input
                      type="text"
                      value={Silian_instruction ?? ''}
                      onChange={(Silian_event) => Silian_onInstructionChange?.(Silian_event.target.value)}
                      disabled={Silian_isGenerating}
                      placeholder={Silian_t('admin.broadcast.editor.copilot.instructionPlaceholder')}
                      autoFocus
                      className="flex-1 bg-transparent border-0 text-sm focus:outline-none focus:ring-0 py-1.5 min-w-0 placeholder:text-slate-400"
                      onKeyDown={(Silian_e) => {
                         if (Silian_e.key === 'Enter') {
                             Silian_e.preventDefault();
                           if (!Silian_isGenerating) Silian_executeCopilot();
                         }
                         if (Silian_e.key === 'Escape') {
                             Silian_e.preventDefault();
                             Silian_setAiMenuState('idle');
                         }
                      }}
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      {Silian_hasSelection && (
                        <Silian_Badge variant="outline" className="text-[10px] h-5 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 font-normal hidden sm:inline-flex px-1.5">
                           {Silian_getSelectionContextHint()}
                        </Silian_Badge>
                      )}
                      {!Silian_hasSelection && (
                        <Silian_Badge variant="outline" className="text-[10px] h-5 bg-slate-50 dark:bg-slate-800 text-slate-500 border-none font-normal hidden sm:inline-flex px-1.5">
                           {Silian_t('admin.broadcast.editor.copilot.documentBadge')}
                        </Silian_Badge>
                      )}
                      <Silian_Button
                        variant="ghost"
                        size="icon"
                        className={Silian_cn(
                          "h-7 w-7 rounded-md transition-colors",
                          Silian_instruction?.trim()
                            ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 dark:hover:bg-indigo-900"
                            : "text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                        onClick={Silian_executeCopilot}
                        disabled={Silian_isGenerating}
                      >
                        {Silian_isGenerating ? <Silian_Loader2 className="w-4 h-4 animate-spin" /> : <Silian_Sparkles className="w-3.5 h-3.5" />}
                      </Silian_Button>                        <Silian_Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          onClick={() => Silian_setAiMenuState('idle')}
                          disabled={Silian_isGenerating}
                        >
                          <Silian_X className="w-3.5 h-3.5" />
                        </Silian_Button>                    </div>
                  </div>
                </div>
              )}

              {/* Inline Copilot Review Menu */}
              {Silian_aiMenuState === 'reviewing' && (
                 <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-[90%] max-w-[420px] bg-emerald-50/95 dark:bg-emerald-950/90 backdrop-blur-xl border border-emerald-200 dark:border-emerald-800/50 rounded-lg p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center justify-between animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 pl-3">
                       <Silian_Sparkles className="w-4 h-4" />
                        <span className="text-sm font-medium">{Silian_t('admin.broadcast.editor.copilot.reviewPrompt')}</span>
                    </div>
                    <div className="flex items-center gap-1.5 pr-1">
                      <Silian_Button size="sm" variant="ghost" onClick={Silian_rejectDiff} className="h-7 px-3 text-sm text-slate-600 hover:text-red-600 hover:bg-red-100/50 dark:hover:bg-red-950/30 rounded-md">
                         <Silian_X className="w-3.5 h-3.5 mr-1" /> {Silian_t('admin.broadcast.editor.copilot.reject')}
                      </Silian_Button>
                      <Silian_Button size="sm" className="h-7 px-3 text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm rounded-md" onClick={Silian_acceptDiff}>
                         <Silian_Check className="w-3.5 h-3.5 mr-1" /> {Silian_t('admin.broadcast.editor.copilot.accept')}
                      </Silian_Button>
                    </div>
                 </div>
              )}

              <Silian_CodeMirror
              value={Silian_value}
              height={Silian_editorHeight}
              extensions={Silian_editorExtensions}
              theme={Silian_isDarkMode ? Silian_oneDark : 'light'}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: true,
                highlightSelectionMatches: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: true,
              }}
              onChange={(Silian_nextValue) => Silian_onChange(Silian_nextValue)}
              onCreateEditor={(Silian_view) => {
                Silian_editorViewRef.current = Silian_view;
              }}
              className={Silian_cn("text-sm transition-opacity", Silian_isGenerating && 'opacity-60 grayscale-[20%]')}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            {Silian_t('admin.broadcast.editor.themeHint', { theme: Silian_isDarkMode ? 'One Dark' : 'Light' })}
          </p>
        </Silian_TabsContent>

        <Silian_TabsContent value="templates" className="grid gap-3 md:grid-cols-3">
          {Silian_presetCards.map((Silian_template) => (
            <div key={Silian_template.id} className="rounded-lg border bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950/40">
              <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{Silian_template.label}</h5>
              <p className="mt-1 text-xs text-muted-foreground">{Silian_template.description}</p>
              <pre className="mt-3 max-h-32 overflow-auto rounded bg-slate-950/95 p-3 text-[11px] leading-5 text-slate-100 dark:border dark:border-slate-800">
                {Silian_template.content}
              </pre>
              <Silian_Button type="button" size="sm" className="mt-3" onClick={() => Silian_handleApplyTemplate(Silian_template)}>
                {Silian_t('admin.broadcast.editor.applyTemplate')}
              </Silian_Button>
            </div>
          ))}
        </Silian_TabsContent>
      </Silian_Tabs>
    </div>
  );
}

AnnouncementTemplateEditor.propTypes = {
  value: Silian_PropTypes.string,
  onChange: Silian_PropTypes.func.isRequired,
  onApplyTemplate: Silian_PropTypes.func,
  title: Silian_PropTypes.string,
  priority: Silian_PropTypes.string,
  contentFormat: Silian_PropTypes.string,
  action: Silian_PropTypes.string,
  onActionChange: Silian_PropTypes.func,
  instruction: Silian_PropTypes.string,
  onInstructionChange: Silian_PropTypes.func,
  onRunBuiltin: Silian_PropTypes.func,
  isBuiltinLoading: Silian_PropTypes.bool,
  onUpdateTitle: Silian_PropTypes.func,
  onUpdateFormat: Silian_PropTypes.func,
  editorHeight: Silian_PropTypes.string,
  t: Silian_PropTypes.func.isRequired,
};
