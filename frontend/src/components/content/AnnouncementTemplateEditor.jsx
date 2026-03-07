import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, placeholder as editorPlaceholder, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { Button } from '../ui/Button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../../lib/utils';
import { Sparkles, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  ANNOUNCEMENT_PROMPT_ACTION_COMPRESS,
  ANNOUNCEMENT_PROMPT_ACTION_CONVERT,
  ANNOUNCEMENT_PROMPT_ACTION_GENERATE,
  ANNOUNCEMENT_PROMPT_ACTION_REWRITE,
  normalizeAnnouncementPromptAction,
} from '../../lib/announcementPrompt';

function getInitialDarkMode() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
}

function insertSnippetWithEditor(value, snippet, editorView) {
  const view = editorView;
  if (!view) return value;
  const selection = view.state.selection.main;
  const from = selection?.from ?? value.length;
  const to = selection?.to ?? value.length;
  view.dispatch({
    changes: { from, to, insert: snippet },
    selection: { anchor: from + snippet.length },
  });
  view.focus();
  return view.state.doc.toString();
}

export function AnnouncementTemplateEditor({
  value,
  onChange,
  onApplyTemplate,
  title,
  priority,
  contentFormat,
  action,
  onActionChange,
  instruction,
  onInstructionChange,
  onRunBuiltin,
  isBuiltinLoading,
  onUpdateTitle,
  onUpdateFormat,
  t,
}) {
  const editorViewRef = useRef(null);
  const presetCards = useMemo(() => ([
    {
      id: 'maintenance',
      label: t('admin.broadcast.editor.templates.maintenance.label'),
      description: t('admin.broadcast.editor.templates.maintenance.description'),
      content: t('admin.broadcast.editor.templates.maintenance.content'),
    },
    {
      id: 'release',
      label: t('admin.broadcast.editor.templates.release.label'),
      description: t('admin.broadcast.editor.templates.release.description'),
      content: t('admin.broadcast.editor.templates.release.content'),
    },
    {
      id: 'event',
      label: t('admin.broadcast.editor.templates.event.label'),
      description: t('admin.broadcast.editor.templates.event.description'),
      content: t('admin.broadcast.editor.templates.event.content'),
    },
  ]), [t]);
  const snippets = useMemo(() => ([
    { label: t('admin.broadcast.editor.snippets.heading'), value: t('admin.broadcast.editor.snippetContent.heading') },
    { label: t('admin.broadcast.editor.snippets.paragraph'), value: t('admin.broadcast.editor.snippetContent.paragraph') },
    { label: t('admin.broadcast.editor.snippets.link'), value: t('admin.broadcast.editor.snippetContent.link') },
    { label: t('admin.broadcast.editor.snippets.quote'), value: t('admin.broadcast.editor.snippetContent.quote') },
    { label: t('admin.broadcast.editor.snippets.code'), value: '<pre><code>npm run build</code></pre>' },
    { label: t('admin.broadcast.editor.snippets.table'), value: t('admin.broadcast.editor.snippetContent.table') },
    { label: t('admin.broadcast.editor.snippets.divider'), value: '<hr />' },
    { label: t('admin.broadcast.editor.snippets.list'), value: t('admin.broadcast.editor.snippetContent.list') },
  ]), [t]);
  const [activeTab, setActiveTab] = useState('code');
  const [isDarkMode, setIsDarkMode] = useState(getInitialDarkMode);
  
  // AI Copilot state
  const [aiMenuState, setAiMenuState] = useState('idle'); // 'idle' | 'composing' | 'generating' | 'reviewing'
  const [diffContext, setDiffContext] = useState(null);

  const normalizedAction = useMemo(() => normalizeAnnouncementPromptAction(action), [action]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const updateDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark') || document.body.classList.contains('dark'));
    };
    updateDarkMode();
    const observer = new MutationObserver(updateDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    const mediaQuery = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
    mediaQuery?.addEventListener?.('change', updateDarkMode);
    return () => {
      observer.disconnect();
      mediaQuery?.removeEventListener?.('change', updateDarkMode);
      editorViewRef.current = null;
    };
  }, []);

  const handleAiHotkey = useCallback((view) => {
    if (aiMenuState !== 'idle') return false;
    setAiMenuState('composing');
    return true;
  }, [aiMenuState]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape' && aiMenuState === 'composing') {
        setAiMenuState('idle');
      }
    };
    globalThis.addEventListener('keydown', handleGlobalKeyDown);
    return () => globalThis.removeEventListener('keydown', handleGlobalKeyDown);
  }, [aiMenuState]);

  const editorExtensions = useMemo(() => {
    const cmdKeymap = keymap.of([
      {
        key: 'Mod-i',
        run: (view) => {
          return handleAiHotkey(view);
        },
        preventDefault: true
      }
    ]);

    return [
      html(),
      EditorView.lineWrapping,
      editorPlaceholder(t('admin.broadcast.editor.placeholder')),
      cmdKeymap,
      aiMenuState === 'generating' || aiMenuState === 'reviewing' || isBuiltinLoading ? EditorState.readOnly.of(true) : [],
    ];
  }, [t, aiMenuState, handleAiHotkey, isBuiltinLoading]);

  const handleInsertSnippet = (snippet) => {
    onChange(insertSnippetWithEditor(value, snippet, editorViewRef.current));
  };

  const handleApplyTemplate = (template) => {
    if (onApplyTemplate) {
      onApplyTemplate(template);
      return;
    }
    onChange(template.content);
  };

  const executeCopilot = async () => {
    const view = editorViewRef.current;
    let currentHtml = value;
    let from = 0;
    let to = currentHtml.length;
    let isSelection = false;
    let originalText = currentHtml;

    if (view) {
        const selection = view.state.selection.main;
        if (selection.from !== selection.to) {
            from = selection.from;
            to = selection.to;
            originalText = view.state.doc.sliceString(from, to);
            isSelection = true;
        }
    }

    if (!originalText.trim() && !instruction.trim() && !title.trim()) {
       toast.error(t('admin.broadcast.llmHelper.builtinInputRequired'));
       return;
    }

    setAiMenuState('generating');

    try {
      if (typeof onRunBuiltin !== 'function') {
        throw new TypeError('Missing onRunBuiltin handler');
      }

      const data = (await onRunBuiltin({
        action: normalizedAction,
        instruction: instruction || '',
        title,
        priority,
        content_format: contentFormat,
        content: originalText,
        source: 'admin:/admin/broadcast',
      })) ?? {};
        const aiText = data.content || '';
        
        if (view) {
            view.dispatch({
                changes: { from, to, insert: aiText },
                selection: { anchor: from, head: from + aiText.length }
            });
        } else {
            onChange(currentHtml.substring(0, from) + aiText + currentHtml.substring(to));
        }

        setDiffContext({
            isSelection,
            originalText,
            insertedLength: aiText.length,
            from,
            newTitle: data.title,
            newFormat: data.content_format
        });
        
        setAiMenuState('reviewing');
        toast.success(t('admin.broadcast.editor.copilot.reviewReady'));
    } catch(err) {
        const message = err?.response?.data?.error || err?.message || t('admin.broadcast.llmHelper.builtinFailed');
        toast.error(message);
        setAiMenuState('composing');
    }
  };

  const isGenerating = aiMenuState === 'generating' || isBuiltinLoading;

  const acceptDiff = () => {
    if (!diffContext) return;
    if (!diffContext.isSelection && diffContext.newTitle && onUpdateTitle) {
        onUpdateTitle(diffContext.newTitle);
    }
    if (!diffContext.isSelection && diffContext.newFormat && onUpdateFormat) {
        onUpdateFormat(diffContext.newFormat);
    }
    setDiffContext(null);
    setAiMenuState('idle');
  };

  const rejectDiff = () => {
    const view = editorViewRef.current;
    if (view && diffContext) {
        const { from, insertedLength, originalText } = diffContext;
        view.dispatch({
            changes: { from, to: from + insertedLength, insert: originalText },
            selection: { anchor: from, head: from + originalText.length }
        });
    }
    setDiffContext(null);
    setAiMenuState('composing');
  };

  const getSelectionContextHint = () => {
    const view = editorViewRef.current;
    if (!view) return '';
    const sel = view.state.selection.main;
    if (sel.from !== sel.to) {
      return t('admin.broadcast.editor.copilot.selectionHint', { count: sel.to - sel.from });
    }
    return t('admin.broadcast.editor.copilot.documentHint');
  };

  const hasSelection = (() => {
    const view = editorViewRef.current;
    if (!view) return false;
    const sel = view.state.selection.main;
    return sel.from !== sel.to;
  })();

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            {t('admin.broadcast.editor.title')}
          </h4>
          <p className="text-xs text-muted-foreground">
            {t('admin.broadcast.editor.description')}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <TabsList>
          <TabsTrigger value="code">{t('admin.broadcast.editor.tabs.code')}</TabsTrigger>
          <TabsTrigger value="templates">{t('admin.broadcast.editor.tabs.templates')}</TabsTrigger>
        </TabsList>

        <TabsContent value="code" className="space-y-3">
          <div
            className={cn(
              'group/cm-wrapper relative overflow-hidden rounded-md border border-input bg-background shadow-xs flex flex-col',
              'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]'
            )}
          >
            {/* Snippets Toolbar - Rendered first to prevent overlapping by relative AI wrapper */}
            <div className="border-b border-border bg-slate-50/90 p-2 dark:bg-slate-950/60 z-10 relative">
              <div className="flex flex-wrap gap-2">
                {snippets.map((snippet) => (
                  <Button key={snippet.label} type="button" variant="outline" size="sm" className="h-7 text-xs bg-white dark:bg-slate-900" onClick={() => handleInsertSnippet(snippet.value)}>
                    {snippet.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Editor Area with Relative positioning for the Inline Copilot */}
            <div className="relative flex-1">
              {/* Inline Copilot Trigger Button */}
              {aiMenuState === 'idle' && (
                <Button
                  variant="default"
                  size="sm"
                  className="absolute top-3 right-4 z-10 shadow-md opacity-0 group-hover/cm-wrapper:opacity-100 transition-opacity bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-4"
                  onClick={() => setAiMenuState('composing')}
                >
                  <Sparkles className="w-3.5 h-3.5 mr-2" />
                  {t('admin.broadcast.editor.copilot.trigger')}
                </Button>
              )}

              {/* Inline Copilot Composing Menu */}
              {(aiMenuState === 'composing' || aiMenuState === 'generating') && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-[95%] max-w-[650px] rounded-lg border border-slate-200/60 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] backdrop-blur-xl flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-1.5 px-2">
                    <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
                    <Select
                      value={normalizedAction}
                      onValueChange={(val) => onActionChange?.(val)}
                      disabled={isGenerating}
                    >
                      <SelectTrigger className="h-8 w-[110px] border-0 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-sm focus:ring-0 shadow-none font-medium px-2 rounded-md">
                        <SelectValue placeholder={t('admin.broadcast.editor.copilot.actionPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ANNOUNCEMENT_PROMPT_ACTION_GENERATE}>{t('admin.broadcast.llmHelper.actions.generate')}</SelectItem>
                        <SelectItem value={ANNOUNCEMENT_PROMPT_ACTION_REWRITE}>{t('admin.broadcast.llmHelper.actions.rewrite')}</SelectItem>
                        <SelectItem value={ANNOUNCEMENT_PROMPT_ACTION_COMPRESS}>{t('admin.broadcast.llmHelper.actions.compress')}</SelectItem>
                        <SelectItem value={ANNOUNCEMENT_PROMPT_ACTION_CONVERT}>{t('admin.broadcast.llmHelper.actions.convert')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 shrink-0 mx-1" />
                    <input
                      type="text"
                      value={instruction ?? ''}
                      onChange={(event) => onInstructionChange?.(event.target.value)}
                      disabled={isGenerating}
                      placeholder={t('admin.broadcast.editor.copilot.instructionPlaceholder')}
                      autoFocus
                      className="flex-1 bg-transparent border-0 text-sm focus:outline-none focus:ring-0 py-1.5 min-w-0 placeholder:text-slate-400"
                      onKeyDown={(e) => {
                         if (e.key === 'Enter') {
                             e.preventDefault();
                           if (!isGenerating) executeCopilot();
                         }
                         if (e.key === 'Escape') {
                             e.preventDefault();
                             setAiMenuState('idle');
                         }
                      }}
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      {hasSelection && (
                        <Badge variant="outline" className="text-[10px] h-5 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 font-normal hidden sm:inline-flex px-1.5">
                           {getSelectionContextHint()}
                        </Badge>
                      )}
                      {!hasSelection && (
                        <Badge variant="outline" className="text-[10px] h-5 bg-slate-50 dark:bg-slate-800 text-slate-500 border-none font-normal hidden sm:inline-flex px-1.5">
                           {t('admin.broadcast.editor.copilot.documentBadge')}
                        </Badge>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className={cn(
                          "h-7 w-7 rounded-md transition-colors",
                          instruction?.trim() 
                            ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 dark:hover:bg-indigo-900" 
                            : "text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                        onClick={executeCopilot}
                        disabled={isGenerating}
                      >
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      </Button>                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          onClick={() => setAiMenuState('idle')}
                          disabled={isGenerating}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>                    </div>
                  </div>
                </div>
              )}

              {/* Inline Copilot Review Menu */}
              {aiMenuState === 'reviewing' && (
                 <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-[90%] max-w-[420px] bg-emerald-50/95 dark:bg-emerald-950/90 backdrop-blur-xl border border-emerald-200 dark:border-emerald-800/50 rounded-lg p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center justify-between animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 pl-3">
                       <Sparkles className="w-4 h-4" />
                        <span className="text-sm font-medium">{t('admin.broadcast.editor.copilot.reviewPrompt')}</span>
                    </div>
                    <div className="flex items-center gap-1.5 pr-1">
                      <Button size="sm" variant="ghost" onClick={rejectDiff} className="h-7 px-3 text-sm text-slate-600 hover:text-red-600 hover:bg-red-100/50 dark:hover:bg-red-950/30 rounded-md">
                         <X className="w-3.5 h-3.5 mr-1" /> {t('admin.broadcast.editor.copilot.reject')}
                      </Button>
                      <Button size="sm" className="h-7 px-3 text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm rounded-md" onClick={acceptDiff}>
                         <Check className="w-3.5 h-3.5 mr-1" /> {t('admin.broadcast.editor.copilot.accept')}
                      </Button>
                    </div>
                 </div>
              )}

              <CodeMirror
              value={value}
              height="380px"
              extensions={editorExtensions}
              theme={isDarkMode ? oneDark : 'light'}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: true,
                highlightSelectionMatches: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: true,
              }}
              onChange={(nextValue) => onChange(nextValue)}
              onCreateEditor={(view) => {
                editorViewRef.current = view;
              }}
              className={cn("text-sm transition-opacity", isGenerating && 'opacity-60 grayscale-[20%]')}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            {t('admin.broadcast.editor.themeHint', { theme: isDarkMode ? 'One Dark' : 'Light' })}
          </p>
        </TabsContent>

        <TabsContent value="templates" className="grid gap-3 md:grid-cols-3">
          {presetCards.map((template) => (
            <div key={template.id} className="rounded-lg border bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950/40">
              <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{template.label}</h5>
              <p className="mt-1 text-xs text-muted-foreground">{template.description}</p>
              <pre className="mt-3 max-h-32 overflow-auto rounded bg-slate-950/95 p-3 text-[11px] leading-5 text-slate-100 dark:border dark:border-slate-800">
                {template.content}
              </pre>
              <Button type="button" size="sm" className="mt-3" onClick={() => handleApplyTemplate(template)}>
                {t('admin.broadcast.editor.applyTemplate')}
              </Button>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

AnnouncementTemplateEditor.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onApplyTemplate: PropTypes.func,
  title: PropTypes.string,
  priority: PropTypes.string,
  contentFormat: PropTypes.string,
  action: PropTypes.string,
  onActionChange: PropTypes.func,
  instruction: PropTypes.string,
  onInstructionChange: PropTypes.func,
  onRunBuiltin: PropTypes.func,
  isBuiltinLoading: PropTypes.bool,
  onUpdateTitle: PropTypes.func,
  onUpdateFormat: PropTypes.func,
  t: PropTypes.func.isRequired,
};
