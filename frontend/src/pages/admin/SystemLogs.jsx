import Silian_React, { useState as Silian_useState, useMemo as Silian_useMemo, useEffect as Silian_useEffect, useRef as Silian_useRef, useCallback as Silian_useCallback } from 'react';
import { RefreshCw as Silian_RefreshCw, Download as Silian_Download, Columns2 as Silian_Columns2, X as Silian_X, Loader2 as Silian_Loader2 } from 'lucide-react';

import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { useSystemLogDetail as Silian_useSystemLogDetail } from '../../hooks/useSystemLogs';
import { useLogSearch as Silian_useLogSearch } from '../../hooks/useLogSearch';
import { parseLogQuery as Silian_parseLogQuery } from '../../lib/logQueryParser';
import { fetchRelatedLogs as Silian_fetchRelatedLogs, exportLogs as Silian_exportLogs } from '../../lib/api/logSearch';
import Silian_TimelineView from '../../components/logs/TimelineView';
import Silian_RawView from '../../components/logs/RawView';
import Silian_RequestIdRelatedDrawer from '../../components/logs/RequestIdRelatedDrawer';
import Silian_JsonTreeViewer from '../../components/logs/JsonTreeViewer';
import Silian_AuditDiffViewer from '../../components/logs/AuditDiffViewer';
import { Card as Silian_Card, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle, CardDescription as Silian_CardDescription, CardContent as Silian_CardContent, CardFooter as Silian_CardFooter } from '../../components/ui/Card';
import { Button as Silian_Button } from '../../components/ui/Button';
import { Badge as Silian_Badge } from '../../components/ui/badge';
import { Dialog as Silian_Dialog, DialogContent as Silian_DialogContent, DialogDescription as Silian_DialogDescription, DialogHeader as Silian_DialogHeader, DialogTitle as Silian_DialogTitle } from '../../components/ui/dialog';
import { ScrollArea as Silian_ScrollArea } from '../../components/ui/scroll-area';
import { Switch as Silian_Switch } from '../../components/ui/switch';
import { Label as Silian_Label } from '../../components/ui/label';
import { Input as Silian_Input } from '../../components/ui/Input';
import { ToggleGroup as Silian_ToggleGroup, ToggleGroupItem as Silian_ToggleGroupItem } from '../../components/ui/toggle-group';
import { Popover as Silian_Popover, PopoverContent as Silian_PopoverContent, PopoverTrigger as Silian_PopoverTrigger } from '../../components/ui/popover';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription, AlertTitle as Silian_AlertTitle } from '../../components/ui/Alert';
import { cn as Silian_cn } from '../../lib/utils';

const Silian_SYSTEM_COLUMNS = ['id', 'method', 'path', 'status_code', 'user_id', 'duration_ms', 'created_at', 'ops'];
const Silian_AUDIT_COLUMNS = ['id', 'conversation_id', 'request_id', 'actor_type', 'action', 'operation_category', 'status', 'user_id', 'ip_address', 'created_at', 'ops'];
const Silian_ERROR_COLUMNS = ['id', 'request_id', 'error_type', 'error_message', 'error_file', 'error_line', 'error_time', 'ops'];
const Silian_LLM_COLUMNS = ['id', 'conversation_id', 'turn_no', 'actor_type', 'actor_id', 'source', 'model', 'llm_status', 'total_tokens', 'latency_ms', 'created_at', 'ops'];
const Silian_TABLE_RENDER_LIMIT = 120;

const Silian_COLUMN_STORAGE_KEYS = {
  system: 'logCols_system',
  audit: 'logCols_audit',
  error: 'logCols_error',
  llm: 'logCols_llm'
};

function Silian_loadStoredColumns(Silian_key, Silian_fallback) {
  try {
    const Silian_raw = localStorage.getItem(Silian_key);
    const Silian_parsed = Silian_raw ? JSON.parse(Silian_raw) : null;
    return Array.isArray(Silian_parsed) && Silian_parsed.length ? Silian_parsed : Silian_fallback;
  } catch (Silian_error) {
    console.warn('Failed to load stored columns', Silian_error);
    return Silian_fallback;
  }
}

export default function SystemLogsPage() {
  const { t: Silian_t } = Silian_useTranslation(['admin', 'common', 'errors']);

  const [Silian_q, Silian_setQ] = Silian_useState('');
  const [Silian_dateFrom, Silian_setDateFrom] = Silian_useState('');
  const [Silian_dateTo, Silian_setDateTo] = Silian_useState('');
  const [Silian_activeTypes, Silian_setActiveTypes] = Silian_useState(['system', 'audit', 'error', 'llm']);
  const [Silian_limitPerType, Silian_setLimitPerType] = Silian_useState(50);
  const [Silian_selectedSystemId, Silian_setSelectedSystemId] = Silian_useState(null);
  const [Silian_view, Silian_setView] = Silian_useState('table');
  const [Silian_autoRefresh, Silian_setAutoRefresh] = Silian_useState(false);
  const [Silian_requestDrawerId, Silian_setRequestDrawerId] = Silian_useState(null);
  const [Silian_related, Silian_setRelated] = Silian_useState({ system: [], audit: [], error: [], llm: [] });
  const [Silian_loadingRelated, Silian_setLoadingRelated] = Silian_useState(false);
  const [Silian_exporting, Silian_setExporting] = Silian_useState(false);

  const [Silian_systemCols, Silian_setSystemCols] = Silian_useState(() => Silian_loadStoredColumns(Silian_COLUMN_STORAGE_KEYS.system, Silian_SYSTEM_COLUMNS));
  const [Silian_auditCols, Silian_setAuditCols] = Silian_useState(() => Silian_loadStoredColumns(Silian_COLUMN_STORAGE_KEYS.audit, Silian_AUDIT_COLUMNS));
  const [Silian_errorCols, Silian_setErrorCols] = Silian_useState(() => Silian_loadStoredColumns(Silian_COLUMN_STORAGE_KEYS.error, Silian_ERROR_COLUMNS));
  const [Silian_llmCols, Silian_setLlmCols] = Silian_useState(() => Silian_loadStoredColumns(Silian_COLUMN_STORAGE_KEYS.llm, Silian_LLM_COLUMNS));

  const Silian_prevMaxSystemId = Silian_useRef(0);
  const [Silian_highlightIds, Silian_setHighlightIds] = Silian_useState(new Set());

  const Silian_parsedQuery = Silian_useMemo(() => Silian_parseLogQuery(Silian_q || ''), [Silian_q]);

  const Silian_extraParams = Silian_useMemo(() => {
    const Silian_params = {};
    const Silian_tokens = Silian_parsedQuery.tokens || {};

    ['method', 'status_code', 'user_id', 'request_id', 'path', 'action', 'audit_status', 'error_type', 'model', 'source', 'actor_type', 'actor_id', 'llm_status', 'conversation_id', 'turn_no'].forEach((Silian_key) => {
      if (Silian_tokens[Silian_key]) Silian_params[Silian_key] = Silian_tokens[Silian_key];
    });

    if (Silian_parsedQuery.ranges?.duration_ms) {
      const Silian_durationRange = Silian_parsedQuery.ranges.duration_ms;
      if (Silian_durationRange['>'] || Silian_durationRange['>=']) Silian_params.min_duration = Silian_durationRange['>'] || Silian_durationRange['>='];
      if (Silian_durationRange['<'] || Silian_durationRange['<=']) Silian_params.max_duration = Silian_durationRange['<'] || Silian_durationRange['<='];
    }

    return Silian_params;
  }, [Silian_parsedQuery]);

  const {
    data: Silian_data,
    isLoading: Silian_isLoading,
    isError: Silian_isError,
    error: Silian_error,
    refetch: Silian_refetch,
    isFetching: Silian_isFetching
  } = Silian_useLogSearch({
    q: Silian_parsedQuery.free,
    date_from: Silian_dateFrom,
    date_to: Silian_dateTo,
    types: Silian_activeTypes,
    limit_per_type: Silian_limitPerType,
    ...Silian_extraParams
  });

  const { data: Silian_detailData, isLoading: Silian_loadingDetail } = Silian_useSystemLogDetail(Silian_selectedSystemId);

  Silian_useEffect(() => {
    if (!Silian_autoRefresh) return undefined;
    const Silian_timer = setInterval(() => {
      Silian_refetch();
    }, 8000);
    return () => clearInterval(Silian_timer);
  }, [Silian_autoRefresh, Silian_refetch]);

  const Silian_copy = Silian_useCallback((Silian_text) => {
    if (Silian_text == null) return;
    try {
      const Silian_value = typeof Silian_text === 'string' ? Silian_text : JSON.stringify(Silian_text, null, 2);
      navigator.clipboard.writeText(Silian_value);
    } catch (Silian_error) {
      console.warn('Failed to copy content', Silian_error);
    }
  }, []);

  const Silian_systemLogs = Silian_useMemo(() => (
    Array.isArray(Silian_data?.data?.system?.items) ? Silian_data.data.system.items : []
  ), [Silian_data]);
  const Silian_auditLogs = Silian_useMemo(() => (
    Array.isArray(Silian_data?.data?.audit?.items) ? Silian_data.data.audit.items : []
  ), [Silian_data]);
  const Silian_errorLogs = Silian_useMemo(() => (
    Array.isArray(Silian_data?.data?.error?.items) ? Silian_data.data.error.items : []
  ), [Silian_data]);
  const Silian_llmLogs = Silian_useMemo(() => (
    Array.isArray(Silian_data?.data?.llm?.items) ? Silian_data.data.llm.items : []
  ), [Silian_data]);

  Silian_useEffect(() => {
    if (!Silian_systemLogs.length) return;
    const Silian_currentMax = Math.max(...Silian_systemLogs.map((Silian_log) => Silian_log.id));
    if (Silian_prevMaxSystemId.current === 0) {
      Silian_prevMaxSystemId.current = Silian_currentMax;
      return;
    }
    if (Silian_currentMax > Silian_prevMaxSystemId.current) {
      const Silian_incomingIds = Silian_systemLogs.filter((Silian_log) => Silian_log.id > Silian_prevMaxSystemId.current).map((Silian_log) => Silian_log.id);
      Silian_setHighlightIds(new Set(Silian_incomingIds));
      Silian_prevMaxSystemId.current = Silian_currentMax;
      const Silian_timeout = setTimeout(() => Silian_setHighlightIds(new Set()), 4000);
      return () => clearTimeout(Silian_timeout);
    }
    return undefined;
  }, [Silian_systemLogs]);

  const Silian_handleTypeChange = Silian_useCallback((Silian_next) => {
    if (!Silian_next) return;
    Silian_setActiveTypes(Silian_next);
  }, []);

  const Silian_saveColumns = Silian_useCallback((Silian_storageKey, Silian_next) => {
    try {
      localStorage.setItem(Silian_storageKey, JSON.stringify(Silian_next));
    } catch (Silian_error) {
      console.warn('Failed to persist selected columns', Silian_error);
    }
  }, []);

  const Silian_toggleColumn = Silian_useCallback((Silian_type, Silian_column) => {
    if (Silian_column === 'id' || Silian_column === 'ops') return;
    if (Silian_type === 'system') {
      Silian_setSystemCols((Silian_current) => {
        const Silian_next = Silian_current.includes(Silian_column) ? Silian_current.filter((Silian_col) => Silian_col !== Silian_column) : [...Silian_current, Silian_column];
        Silian_saveColumns(Silian_COLUMN_STORAGE_KEYS.system, Silian_next);
        return Silian_next;
      });
    } else if (Silian_type === 'audit') {
      Silian_setAuditCols((Silian_current) => {
        const Silian_next = Silian_current.includes(Silian_column) ? Silian_current.filter((Silian_col) => Silian_col !== Silian_column) : [...Silian_current, Silian_column];
        Silian_saveColumns(Silian_COLUMN_STORAGE_KEYS.audit, Silian_next);
        return Silian_next;
      });
    } else if (Silian_type === 'error') {
      Silian_setErrorCols((Silian_current) => {
        const Silian_next = Silian_current.includes(Silian_column) ? Silian_current.filter((Silian_col) => Silian_col !== Silian_column) : [...Silian_current, Silian_column];
        Silian_saveColumns(Silian_COLUMN_STORAGE_KEYS.error, Silian_next);
        return Silian_next;
      });
    } else if (Silian_type === 'llm') {
      Silian_setLlmCols((Silian_current) => {
        const Silian_next = Silian_current.includes(Silian_column) ? Silian_current.filter((Silian_col) => Silian_col !== Silian_column) : [...Silian_current, Silian_column];
        Silian_saveColumns(Silian_COLUMN_STORAGE_KEYS.llm, Silian_next);
        return Silian_next;
      });
    }
  }, [Silian_saveColumns]);

  const Silian_openRelated = Silian_useCallback(async (Silian_requestId) => {
    Silian_setRequestDrawerId(Silian_requestId);
    Silian_setLoadingRelated(true);
    try {
      const Silian_response = await Silian_fetchRelatedLogs(Silian_requestId);
      Silian_setRelated(Silian_response?.data || Silian_response || { system: [], audit: [], error: [], llm: [] });
    } finally {
      Silian_setLoadingRelated(false);
    }
  }, []);

  const Silian_doExport = Silian_useCallback(async (Silian_format) => {
    Silian_setExporting(true);
    try {
      const Silian_blob = await Silian_exportLogs(
        {
          q: Silian_parsedQuery.free,
          date_from: Silian_dateFrom,
          date_to: Silian_dateTo,
          types: Silian_activeTypes,
          limit_per_type: Silian_limitPerType,
          ...Silian_extraParams
        },
        Silian_format
      );
      const Silian_url = URL.createObjectURL(Silian_blob);
      const Silian_anchor = document.createElement('a');
      Silian_anchor.href = Silian_url;
      Silian_anchor.download = `logs_${Date.now()}.${Silian_format === 'csv' ? 'csv' : 'ndjson'}`;
      Silian_anchor.click();
      setTimeout(() => URL.revokeObjectURL(Silian_url), 2000);
    } finally {
      Silian_setExporting(false);
    }
  }, [Silian_parsedQuery.free, Silian_dateFrom, Silian_dateTo, Silian_activeTypes, Silian_limitPerType, Silian_extraParams]);

  const Silian_hasResults = Silian_systemLogs.length + Silian_auditLogs.length + Silian_errorLogs.length + Silian_llmLogs.length > 0;
  const Silian_activeFilterEntries = Object.entries(Silian_parsedQuery.tokens || {}).filter(([, Silian_value]) => Silian_value && typeof Silian_value !== 'object');
  const Silian_hasActiveFilters = Silian_activeFilterEntries.length > 0 || Boolean(Silian_parsedQuery.free);

  const Silian_columnLabel = Silian_useCallback(
    (Silian_key) => Silian_t(`admin.systemLogs.columns.${Silian_key}`, { defaultValue: Silian_key }),
    [Silian_t]
  );

  const Silian_auditHeaders = Silian_useMemo(() => Silian_auditCols.filter((Silian_col) => Silian_col !== 'ops'), [Silian_auditCols]);
  const Silian_llmHeaders = Silian_useMemo(() => Silian_llmCols.filter((Silian_col) => Silian_col !== 'ops'), [Silian_llmCols]);

  return (
    <div className="space-y-6">
      <Silian_Card>
        <Silian_CardHeader className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <Silian_CardTitle>{Silian_t('admin.systemLogs.title')}</Silian_CardTitle>
              <Silian_CardDescription>{Silian_t('admin.systemLogs.subtitle')}</Silian_CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Silian_ToggleGroup
                type="single"
                value={Silian_view}
                onValueChange={(Silian_value) => Silian_value && Silian_setView(Silian_value)}
                variant="outline"
                size="sm"
              >
                <Silian_ToggleGroupItem value="table">{Silian_t('admin.systemLogs.views.table')}</Silian_ToggleGroupItem>
                <Silian_ToggleGroupItem value="timeline">{Silian_t('admin.systemLogs.views.timeline')}</Silian_ToggleGroupItem>
                <Silian_ToggleGroupItem value="raw">{Silian_t('admin.systemLogs.views.raw')}</Silian_ToggleGroupItem>
              </Silian_ToggleGroup>
              <Silian_Button
                size="sm"
                variant="outline"
                onClick={() => Silian_refetch()}
                disabled={Silian_isFetching}
              >
                <Silian_RefreshCw className={Silian_cn('mr-2 h-4 w-4', Silian_isFetching && 'animate-spin')} />
                {Silian_t('admin.systemLogs.refresh')}
              </Silian_Button>
              <Silian_Button
                size="sm"
                variant="outline"
                onClick={() => Silian_doExport('csv')}
                disabled={Silian_exporting}
              >
                <Silian_Download className="mr-2 h-4 w-4" />
                {Silian_t('admin.systemLogs.exportCsv')}
              </Silian_Button>
              <Silian_Button
                size="sm"
                variant="outline"
                onClick={() => Silian_doExport('ndjson')}
                disabled={Silian_exporting}
              >
                <Silian_Download className="mr-2 h-4 w-4" />
                {Silian_t('admin.systemLogs.exportNdjson')}
              </Silian_Button>
              <Silian_ColumnSelector
                systemCols={Silian_systemCols}
                auditCols={Silian_auditCols}
                errorCols={Silian_errorCols}
                llmCols={Silian_llmCols}
                onToggle={Silian_toggleColumn}
                columnLabel={Silian_columnLabel}
                t={Silian_t}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Silian_Switch
                id="logs-auto-refresh"
                checked={Silian_autoRefresh}
                onCheckedChange={Silian_setAutoRefresh}
              />
              <Silian_Label htmlFor="logs-auto-refresh" className="text-sm text-muted-foreground">
                {Silian_t('admin.systemLogs.autoRefresh')}
              </Silian_Label>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{Silian_t('admin.systemLogs.perTypeLimit')}</span>
              <Silian_Input
                id="limit-per-type"
                type="number"
                min={1}
                max={200}
                value={Silian_limitPerType}
                onChange={(Silian_event) => {
                  const Silian_value = Number(Silian_event.target.value);
                  Silian_setLimitPerType(Number.isNaN(Silian_value) ? 50 : Silian_value);
                }}
                className="h-9 w-24"
              />
            </div>
            <Silian_ToggleGroup
              type="multiple"
              value={Silian_activeTypes}
              onValueChange={Silian_handleTypeChange}
              variant="outline"
              size="sm"
              className="flex-wrap"
            >
              <Silian_ToggleGroupItem value="system">{Silian_t('admin.systemLogs.types.system')}</Silian_ToggleGroupItem>
              <Silian_ToggleGroupItem value="audit">{Silian_t('admin.systemLogs.types.audit')}</Silian_ToggleGroupItem>
              <Silian_ToggleGroupItem value="error">{Silian_t('admin.systemLogs.types.error')}</Silian_ToggleGroupItem>
              <Silian_ToggleGroupItem value="llm">{Silian_t('admin.systemLogs.types.llm')}</Silian_ToggleGroupItem>
            </Silian_ToggleGroup>
          </div>
        </Silian_CardHeader>
        <Silian_CardContent className="pt-0">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <Silian_FilterField label={Silian_t('admin.systemLogs.filters.keyword')} htmlFor="log-search">
              <Silian_Input
                id="log-search"
                value={Silian_q}
                onChange={(Silian_event) => Silian_setQ(Silian_event.target.value)}
                placeholder={Silian_t('admin.systemLogs.searchPlaceholder')}
                className="font-mono"
              />
            </Silian_FilterField>
            <Silian_FilterField label={Silian_t('admin.systemLogs.filters.method')} htmlFor="log-method">
              <Silian_Input
                id="log-method"
                value={Silian_extraParams.method || ''}
                onChange={(Silian_event) => {
                  const Silian_v = Silian_event.target.value;
                  Silian_setQ((Silian_prev) => Silian_mergeToken(Silian_prev, 'method', Silian_v));
                }}
                placeholder={Silian_t('admin.systemLogs.placeholders.method')}
                className="font-mono"
              />
            </Silian_FilterField>
            <Silian_FilterField label={Silian_t('admin.systemLogs.filters.status')} htmlFor="log-status">
              <Silian_Input
                id="log-status"
                value={Silian_extraParams.status_code || ''}
                onChange={(Silian_event) => {
                  const Silian_v = Silian_event.target.value;
                  Silian_setQ((Silian_prev) => Silian_mergeToken(Silian_prev, 'status', Silian_v));
                }}
                placeholder={Silian_t('admin.systemLogs.placeholders.status')}
                className="font-mono"
              />
            </Silian_FilterField>
            <Silian_FilterField label={Silian_t('admin.systemLogs.filters.userId')} htmlFor="log-user-id">
              <Silian_Input
                id="log-user-id"
                value={Silian_extraParams.user_id || ''}
                onChange={(Silian_event) => {
                  const Silian_v = Silian_event.target.value;
                  Silian_setQ((Silian_prev) => Silian_mergeToken(Silian_prev, 'user', Silian_v));
                }}
                placeholder={Silian_t('admin.systemLogs.placeholders.userId')}
                className="font-mono"
              />
            </Silian_FilterField>
            <Silian_FilterField label={Silian_t('admin.systemLogs.filters.requestId')} htmlFor="log-request-id">
              <Silian_Input
                id="log-request-id"
                value={Silian_extraParams.request_id || ''}
                onChange={(Silian_event) => {
                  const Silian_v = Silian_event.target.value;
                  Silian_setQ((Silian_prev) => Silian_mergeToken(Silian_prev, 'rid', Silian_v));
                }}
                placeholder={Silian_t('admin.systemLogs.placeholders.requestId')}
                className="font-mono"
              />
            </Silian_FilterField>
            <Silian_FilterField
              label={Silian_t('admin.systemLogs.filters.conversationId', { defaultValue: 'Conversation ID' })}
              htmlFor="log-conversation-id"
            >
              <Silian_Input
                id="log-conversation-id"
                value={Silian_extraParams.conversation_id || ''}
                onChange={(Silian_event) => {
                  const Silian_v = Silian_event.target.value;
                  Silian_setQ((Silian_prev) => Silian_mergeToken(Silian_prev, 'cid', Silian_v));
                }}
                placeholder={Silian_t('admin.systemLogs.placeholders.conversationId', { defaultValue: 'admin-ai-...' })}
                className="font-mono"
              />
            </Silian_FilterField>
            <Silian_FilterField
              label={Silian_t('admin.systemLogs.filters.turnNo', { defaultValue: 'Turn No.' })}
              htmlFor="log-turn-no"
            >
              <Silian_Input
                id="log-turn-no"
                value={Silian_extraParams.turn_no || ''}
                onChange={(Silian_event) => {
                  const Silian_v = Silian_event.target.value;
                  Silian_setQ((Silian_prev) => Silian_mergeToken(Silian_prev, 'turn', Silian_v));
                }}
                placeholder={Silian_t('admin.systemLogs.placeholders.turnNo', { defaultValue: '1' })}
                className="font-mono"
              />
            </Silian_FilterField>
            <Silian_FilterField label={Silian_t('admin.systemLogs.filters.path')} htmlFor="log-path">
              <Silian_Input
                id="log-path"
                value={Silian_extraParams.path || ''}
                onChange={(Silian_event) => {
                  const Silian_v = Silian_event.target.value;
                  Silian_setQ((Silian_prev) => Silian_mergeToken(Silian_prev, 'path', Silian_v));
                }}
                placeholder={Silian_t('admin.systemLogs.placeholders.path')}
                className="font-mono"
              />
            </Silian_FilterField>
            <Silian_FilterField label={Silian_t('admin.systemLogs.filters.durationMin')} htmlFor="log-duration-min">
              <Silian_Input
                id="log-duration-min"
                value={Silian_extraParams.min_duration || ''}
                onChange={(Silian_event) => Silian_setQ((Silian_prev) => Silian_mergeRange(Silian_prev, 'dur', '>=', Silian_event.target.value))}
                placeholder={Silian_t('admin.systemLogs.placeholders.duration')}
                className="font-mono"
              />
            </Silian_FilterField>
            <Silian_FilterField label={Silian_t('admin.systemLogs.filters.durationMax')} htmlFor="log-duration-max">
              <Silian_Input
                id="log-duration-max"
                value={Silian_extraParams.max_duration || ''}
                onChange={(Silian_event) => Silian_setQ((Silian_prev) => Silian_setDurationUpper(Silian_prev, Silian_event.target.value))}
                placeholder={Silian_t('admin.systemLogs.placeholders.duration')}
                className="font-mono"
              />
            </Silian_FilterField>
            <Silian_FilterField label={Silian_t('admin.systemLogs.filters.auditAction')} htmlFor="log-audit-action">
              <Silian_Input
                id="log-audit-action"
                value={Silian_extraParams.action || ''}
                onChange={(Silian_event) => {
                  const Silian_v = Silian_event.target.value;
                  Silian_setQ((Silian_prev) => Silian_mergeToken(Silian_prev, 'action', Silian_v));
                }}
                placeholder={Silian_t('admin.systemLogs.placeholders.auditAction')}
                className="font-mono"
              />
            </Silian_FilterField>
            <Silian_FilterField label={Silian_t('admin.systemLogs.filters.auditStatus')} htmlFor="log-audit-status">
              <Silian_Input
                id="log-audit-status"
                value={Silian_extraParams.audit_status || ''}
                onChange={(Silian_event) => {
                  const Silian_v = Silian_event.target.value;
                  Silian_setQ((Silian_prev) => Silian_mergeToken(Silian_prev, 'astatus', Silian_v));
                }}
                placeholder={Silian_t('admin.systemLogs.placeholders.auditStatus')}
                className="font-mono"
              />
            </Silian_FilterField>
            <Silian_FilterField label={Silian_t('admin.systemLogs.filters.errorType')} htmlFor="log-error-type">
              <Silian_Input
                id="log-error-type"
                value={Silian_extraParams.error_type || ''}
                onChange={(Silian_event) => {
                  const Silian_v = Silian_event.target.value;
                  Silian_setQ((Silian_prev) => Silian_mergeToken(Silian_prev, 'etype', Silian_v));
                }}
                placeholder={Silian_t('admin.systemLogs.placeholders.errorType')}
                className="font-mono"
              />
            </Silian_FilterField>
            <Silian_FilterField label={Silian_t('admin.systemLogs.filters.model')} htmlFor="log-model">
              <Silian_Input
                id="log-model"
                value={Silian_extraParams.model || ''}
                onChange={(Silian_event) => {
                  const Silian_v = Silian_event.target.value;
                  Silian_setQ((Silian_prev) => Silian_mergeToken(Silian_prev, 'model', Silian_v));
                }}
                placeholder={Silian_t('admin.systemLogs.placeholders.model')}
                className="font-mono"
              />
            </Silian_FilterField>
            <Silian_FilterField label={Silian_t('admin.systemLogs.filters.source')} htmlFor="log-source">
              <Silian_Input
                id="log-source"
                value={Silian_extraParams.source || ''}
                onChange={(Silian_event) => {
                  const Silian_v = Silian_event.target.value;
                  Silian_setQ((Silian_prev) => Silian_mergeToken(Silian_prev, 'source', Silian_v));
                }}
                placeholder={Silian_t('admin.systemLogs.placeholders.source')}
                className="font-mono"
              />
            </Silian_FilterField>
            <Silian_FilterField label={Silian_t('admin.systemLogs.filters.actorType')} htmlFor="log-actor-type">
              <Silian_Input
                id="log-actor-type"
                value={Silian_extraParams.actor_type || ''}
                onChange={(Silian_event) => {
                  const Silian_v = Silian_event.target.value;
                  Silian_setQ((Silian_prev) => Silian_mergeToken(Silian_prev, 'actor', Silian_v));
                }}
                placeholder={Silian_t('admin.systemLogs.placeholders.actorType')}
                className="font-mono"
              />
            </Silian_FilterField>
            <Silian_FilterField label={Silian_t('admin.systemLogs.filters.llmStatus')} htmlFor="log-llm-status">
              <Silian_Input
                id="log-llm-status"
                value={Silian_extraParams.llm_status || ''}
                onChange={(Silian_event) => {
                  const Silian_v = Silian_event.target.value;
                  Silian_setQ((Silian_prev) => Silian_mergeToken(Silian_prev, 'lstatus', Silian_v));
                }}
                placeholder={Silian_t('admin.systemLogs.placeholders.llmStatus')}
                className="font-mono"
              />
            </Silian_FilterField>
            <Silian_FilterField label={Silian_t('admin.systemLogs.dateFrom')} htmlFor="log-date-from">
              <Silian_Input
                id="log-date-from"
                type="date"
                value={Silian_dateFrom}
                onChange={(Silian_event) => Silian_setDateFrom(Silian_event.target.value)}
              />
            </Silian_FilterField>
            <Silian_FilterField label={Silian_t('admin.systemLogs.dateTo')} htmlFor="log-date-to">
              <Silian_Input
                id="log-date-to"
                type="date"
                value={Silian_dateTo}
                onChange={(Silian_event) => Silian_setDateTo(Silian_event.target.value)}
              />
            </Silian_FilterField>
          </div>
        </Silian_CardContent>
        {Silian_hasActiveFilters && (
          <Silian_CardFooter className="pt-0">
            <Silian_ActiveFilters
              parsed={Silian_parsedQuery}
              onRemove={(Silian_tokenKey) => Silian_setQ((Silian_prev) => Silian_removeToken(Silian_prev, Silian_tokenKey))}
              t={Silian_t}
            />
          </Silian_CardFooter>
        )}
      </Silian_Card>

      {Silian_isLoading && (
        <Silian_Card>
          <Silian_CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Silian_Loader2 className="h-4 w-4 animate-spin" />
            {Silian_t('common.loading')}
          </Silian_CardContent>
        </Silian_Card>
      )}

      {Silian_isError && (
        <Silian_Alert variant="destructive">
          <Silian_AlertTitle>{Silian_t('common.error')}</Silian_AlertTitle>
          <Silian_AlertDescription>{Silian_error?.message || Silian_t('errors.loadFailed')}</Silian_AlertDescription>
        </Silian_Alert>
      )}

      {!Silian_isLoading && !Silian_isError && (
        <>
          {Silian_view === 'table' && (
            <div className="space-y-6">
              <Silian_SystemLogSection
                title={Silian_t('admin.systemLogs.sections.system')}
                items={Silian_systemLogs}
                emptyText={Silian_t('admin.systemLogs.empty.system')}
                columns={Silian_systemCols}
                highlightIds={Silian_highlightIds}
                onDetail={Silian_setSelectedSystemId}
                onCopyReq={Silian_copy}
                onRelated={Silian_openRelated}
                columnLabel={Silian_columnLabel}
                t={Silian_t}
              />

              <Silian_LogSection
                title={Silian_t('admin.systemLogs.sections.llm')}
                items={Silian_llmLogs}
                emptyText={Silian_t('admin.systemLogs.empty.llm')}
                headers={Silian_llmHeaders}
                columnLabel={Silian_columnLabel}
                t={Silian_t}
                renderItem={(Silian_log) => (
                  <Silian_ExpandableRow
                    key={`llm-${Silian_log.id}`}
                    summaryCells={Silian_llmHeaders.map((Silian_column) => Silian_llmCell(Silian_log, Silian_column))}
                    detail={<Silian_LlmDetail log={Silian_log} columnLabel={Silian_columnLabel} onRelated={Silian_openRelated} t={Silian_t} />}
                    t={Silian_t}
                  />
                )}
              />

              <Silian_LogSection
                title={Silian_t('admin.systemLogs.sections.audit')}
                items={Silian_auditLogs}
                emptyText={Silian_t('admin.systemLogs.empty.audit')}
                headers={Silian_auditHeaders}
                columnLabel={Silian_columnLabel}
                t={Silian_t}
                renderItem={(Silian_log) => (
                  <Silian_ExpandableRow
                    key={`audit-${Silian_log.id}`}
                    summaryCells={Silian_auditHeaders.map((Silian_column) => Silian_auditCell(Silian_log, Silian_column, Silian_openRelated))}
                    detail={<Silian_AuditDetail log={Silian_log} columnLabel={Silian_columnLabel} onRelated={Silian_openRelated} t={Silian_t} />}
                    t={Silian_t}
                  />
                )}
              />

              <Silian_LogSection
                title={Silian_t('admin.systemLogs.sections.error')}
                items={Silian_errorLogs}
                emptyText={Silian_t('admin.systemLogs.empty.error')}
                headers={['id', 'request_id', 'error_type', 'error_message', 'error_file', 'error_line', 'error_time']}
                columnLabel={Silian_columnLabel}
                t={Silian_t}
                renderItem={(Silian_log) => (
                  <Silian_ExpandableRow
                    key={`error-${Silian_log.id}`}
                    summaryCells={[
                      Silian_log.id,
                      Silian_log.request_id ? (
                        <Silian_Button
                          key="request"
                          variant="link"
                          className="h-auto p-0 text-[11px] font-mono text-primary"
                          onClick={() => Silian_openRelated(Silian_log.request_id)}
                        >
                          {Silian_log.request_id}
                        </Silian_Button>
                      ) : (
                        '-'
                      ),
                      Silian_log.error_type,
                      <span
                        key="message"
                        className="font-mono text-[11px] max-w-[240px] truncate"
                        title={Silian_log.error_message}
                      >
                        {Silian_log.error_message}
                      </span>,
                      Silian_log.error_file?.split('/').pop() || '-',
                      Silian_log.error_line,
                      Silian_log.error_time
                    ]}
                    detail={<Silian_ErrorDetail log={Silian_log} columnLabel={Silian_columnLabel} onRelated={Silian_openRelated} t={Silian_t} />}
                    t={Silian_t}
                  />
                )}
              />

              {!Silian_hasResults && (
                <Silian_Card>
                  <Silian_CardContent className="py-12 text-center text-sm text-muted-foreground">
                    {Silian_t('admin.systemLogs.noEvents')}
                  </Silian_CardContent>
                </Silian_Card>
              )}
            </div>
          )}

          {Silian_view === 'timeline' && (
            <Silian_Card>
              <Silian_CardHeader>
                <Silian_CardTitle className="text-lg">{Silian_t('admin.systemLogs.views.timeline')}</Silian_CardTitle>
                <Silian_CardDescription>{Silian_t('admin.systemLogs.timelineDescription')}</Silian_CardDescription>
              </Silian_CardHeader>
              <Silian_CardContent>
                <Silian_TimelineView
                  system={Silian_systemLogs}
                  audit={Silian_auditLogs}
                  error={Silian_errorLogs}
                  llm={Silian_llmLogs}
                  onSelectRequest={Silian_openRelated}
                  emptyLabel={Silian_t('admin.systemLogs.noEvents')}
                />
              </Silian_CardContent>
            </Silian_Card>
          )}

          {Silian_view === 'raw' && (
            <Silian_Card>
              <Silian_CardHeader>
                <Silian_CardTitle className="text-lg">{Silian_t('admin.systemLogs.views.raw')}</Silian_CardTitle>
                <Silian_CardDescription>{Silian_t('admin.systemLogs.rawDescription')}</Silian_CardDescription>
              </Silian_CardHeader>
              <Silian_CardContent>
                <Silian_RawView
                  system={Silian_systemLogs}
                  audit={Silian_auditLogs}
                  error={Silian_errorLogs}
                  llm={Silian_llmLogs}
                  onExportCsv={() => Silian_doExport('csv')}
                  onExportNdjson={() => Silian_doExport('ndjson')}
                  labels={{
                    copy: Silian_t('admin.systemLogs.copyNdjson'),
                    exportNdjson: Silian_t('admin.systemLogs.exportNdjson'),
                    exportCsv: Silian_t('admin.systemLogs.exportCsv'),
                    records: Silian_t('admin.systemLogs.records'),
                    maxHint: Silian_t('admin.systemLogs.maxRecords')
                  }}
                />
              </Silian_CardContent>
            </Silian_Card>
          )}
        </>
      )}

      <Silian_Dialog open={Boolean(Silian_selectedSystemId)} onOpenChange={(Silian_open) => !Silian_open && Silian_setSelectedSystemId(null)}>
        <Silian_DialogContent className="max-w-4xl">
          <Silian_DialogHeader>
            <Silian_DialogTitle>
              {Silian_selectedSystemId
                ? Silian_t('admin.systemLogs.dialog.titleWithId', { id: Silian_selectedSystemId })
                : Silian_t('admin.systemLogs.dialog.title')}
            </Silian_DialogTitle>
            <Silian_DialogDescription>
              {Silian_t('admin.systemLogs.dialog.requestId', {
                id: Silian_detailData?.data?.request_id || Silian_t('common.none')
              })}
            </Silian_DialogDescription>
          </Silian_DialogHeader>
          {Silian_loadingDetail && (
            <div className="py-4 text-sm text-muted-foreground">{Silian_t('admin.systemLogs.dialog.loading')}</div>
          )}
          {Silian_detailData?.data && (
            <Silian_ScrollArea className="max-h-[70vh] pr-2">
              <div className="space-y-6 text-sm">
                <div className="grid gap-3 md:grid-cols-2">
                  <Silian_KeyVal label={Silian_t('admin.systemLogs.columns.request_id')} value={Silian_detailData.data.request_id} />
                  <Silian_KeyVal label={Silian_t('admin.systemLogs.columns.method')} value={Silian_detailData.data.method} />
                  <Silian_KeyVal label={Silian_t('admin.systemLogs.columns.path')} value={Silian_detailData.data.path} className="md:col-span-2" />
                  <Silian_KeyVal label={Silian_t('admin.systemLogs.columns.status_code')} value={Silian_detailData.data.status_code} />
                  <Silian_KeyVal label={Silian_t('admin.systemLogs.columns.user_id')} value={Silian_detailData.data.user_id || Silian_t('common.none')} />
                  <Silian_KeyVal label={Silian_t('admin.systemLogs.columns.duration_ms')} value={`${Silian_detailData.data.duration_ms} ms`} />
                  <Silian_KeyVal label={Silian_t('admin.systemLogs.columns.created_at')} value={Silian_detailData.data.created_at} className="md:col-span-2" />
                </div>

                <Silian_JsonSection
                  title={Silian_t('admin.systemLogs.requestBody')}
                  value={Silian_detailData.data.request_body}
                  onCopy={Silian_copy}
                  copyLabel={Silian_t('common.copy')}
                />
                <Silian_JsonSection
                  title={Silian_t('admin.systemLogs.responseBody')}
                  value={Silian_detailData.data.response_body}
                  onCopy={Silian_copy}
                  copyLabel={Silian_t('common.copy')}
                />
                {Silian_detailData.data.server_meta && (
                  <Silian_JsonSection
                    title={Silian_t('admin.systemLogs.serverMeta')}
                    value={Silian_detailData.data.server_meta}
                    onCopy={Silian_copy}
                    copyLabel={Silian_t('common.copy')}
                  />
                )}
              </div>
            </Silian_ScrollArea>
          )}
        </Silian_DialogContent>
      </Silian_Dialog>

      <Silian_RequestIdRelatedDrawer
        open={Boolean(Silian_requestDrawerId)}
        requestId={Silian_requestDrawerId}
        onClose={() => Silian_setRequestDrawerId(null)}
        loading={Silian_loadingRelated}
        data={Silian_related}
        onRefresh={() => Silian_requestDrawerId && Silian_openRelated(Silian_requestDrawerId)}
      />
    </div>
  );
}

function Silian_FilterField({ label: Silian_label, htmlFor: Silian_htmlFor, children: Silian_children }) {
  return (
    <div className="space-y-1.5">
      <Silian_Label htmlFor={Silian_htmlFor} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {Silian_label}
      </Silian_Label>
      {Silian_children}
    </div>
  );
}
function Silian_ColumnSelector({ systemCols: Silian_systemCols, auditCols: Silian_auditCols, errorCols: Silian_errorCols, llmCols: Silian_llmCols, onToggle: Silian_onToggle, columnLabel: Silian_columnLabel, t: Silian_t }) {
  return (
    <Silian_Popover>
      <Silian_PopoverTrigger asChild>
        <Silian_Button size="sm" variant="outline">
          <Silian_Columns2 className="mr-2 h-4 w-4" />
          {Silian_t('admin.systemLogs.columnSettings')}
        </Silian_Button>
      </Silian_PopoverTrigger>
      <Silian_PopoverContent className="w-64 space-y-4" align="end">
        <Silian_ColumnGroup
          title={Silian_t('admin.systemLogs.types.system')}
          columns={Silian_SYSTEM_COLUMNS}
          active={Silian_systemCols}
          onToggle={(Silian_column) => Silian_onToggle('system', Silian_column)}
          columnLabel={Silian_columnLabel}
        />
        <Silian_ColumnGroup
          title={Silian_t('admin.systemLogs.types.audit')}
          columns={Silian_AUDIT_COLUMNS}
          active={Silian_auditCols}
          onToggle={(Silian_column) => Silian_onToggle('audit', Silian_column)}
          columnLabel={Silian_columnLabel}
        />
        <Silian_ColumnGroup
          title={Silian_t('admin.systemLogs.types.error')}
          columns={Silian_ERROR_COLUMNS}
          active={Silian_errorCols}
          onToggle={(Silian_column) => Silian_onToggle('error', Silian_column)}
          columnLabel={Silian_columnLabel}
        />
        <Silian_ColumnGroup
          title={Silian_t('admin.systemLogs.types.llm')}
          columns={Silian_LLM_COLUMNS}
          active={Silian_llmCols}
          onToggle={(Silian_column) => Silian_onToggle('llm', Silian_column)}
          columnLabel={Silian_columnLabel}
        />
      </Silian_PopoverContent>
    </Silian_Popover>
  );
}

function Silian_ColumnGroup({ title: Silian_title, columns: Silian_columns, active: Silian_active, onToggle: Silian_onToggle, columnLabel: Silian_columnLabel }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase text-muted-foreground">{Silian_title}</p>
      <div className="flex flex-wrap gap-2">
        {Silian_columns.map((Silian_column) => (
          <Silian_Button
            key={Silian_column}
            size="sm"
            variant={Silian_active.includes(Silian_column) ? 'default' : 'outline'}
            onClick={() => Silian_onToggle(Silian_column)}
            className="h-8 text-xs"
          >
            {Silian_columnLabel(Silian_column)}
          </Silian_Button>
        ))}
      </div>
    </div>
  );
}

function Silian_ActiveFilters({ parsed: Silian_parsed, onRemove: Silian_onRemove, t: Silian_t }) {
  const Silian_entries = Object.entries(Silian_parsed.tokens || {}).filter(([, Silian_value]) => Silian_value && typeof Silian_value !== 'object');
  if (Silian_entries.length === 0 && !Silian_parsed.free) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {Silian_entries.map(([Silian_key, Silian_value]) => (
        <div key={Silian_key} className="flex items-center gap-1">
          <Silian_Badge variant="secondary" className="font-mono">
            {Silian_key}:{String(Silian_value)}
          </Silian_Badge>
          <Silian_Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground"
            onClick={() => Silian_onRemove(Silian_key)}
            aria-label={Silian_t('admin.systemLogs.activeFilters.remove', { key: Silian_key })}
          >
            <Silian_X className="h-3 w-3" />
          </Silian_Button>
        </div>
      ))}
      {Silian_parsed.free && (
        <Silian_Badge variant="outline" className="font-mono">
          {Silian_parsed.free}
        </Silian_Badge>
      )}
    </div>
  );
}

function Silian_SystemLogSection({
  title: Silian_title,
  items: Silian_items,
  emptyText: Silian_emptyText,
  columns: Silian_columns,
  highlightIds: Silian_highlightIds,
  onDetail: Silian_onDetail,
  onCopyReq: Silian_onCopyReq,
  onRelated: Silian_onRelated,
  columnLabel: Silian_columnLabel,
  t: Silian_t
}) {
  const Silian_visibleItems = Silian_items.slice(0, Silian_TABLE_RENDER_LIMIT);
  const Silian_isTruncated = Silian_items.length > Silian_visibleItems.length;

  const Silian_header = (
    <thead className="bg-muted/60">
      <tr>
        {Silian_columns.includes('id') && <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{Silian_columnLabel('id')}</th>}
        {Silian_columns.includes('method') && <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{Silian_columnLabel('method')}</th>}
        {Silian_columns.includes('path') && <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{Silian_columnLabel('path')}</th>}
        {Silian_columns.includes('status_code') && <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{Silian_columnLabel('status_code')}</th>}
        {Silian_columns.includes('user_id') && <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{Silian_columnLabel('user_id')}</th>}
        {Silian_columns.includes('duration_ms') && <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{Silian_columnLabel('duration_ms')}</th>}
        {Silian_columns.includes('created_at') && <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{Silian_columnLabel('created_at')}</th>}
        {Silian_columns.includes('ops') && <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{Silian_columnLabel('ops')}</th>}
      </tr>
    </thead>
  );

  const Silian_renderRow = (Silian_log) => {
    const Silian_isHighlighted = Silian_highlightIds.has(Silian_log.id);
    return (
      <tr
        key={Silian_log.id}
        className={Silian_cn(
          'border-b text-xs transition-colors hover:bg-muted/30',
          Silian_isHighlighted && 'bg-amber-500/10 dark:bg-amber-400/10'
        )}
      >
        {Silian_columns.includes('id') && <td className="px-3 py-2 font-medium">{Silian_log.id}</td>}
        {Silian_columns.includes('method') && <td className="px-3 py-2 uppercase">{Silian_log.method}</td>}
        {Silian_columns.includes('path') && (
          <td className="px-3 py-2">
            <span className="block max-w-[420px] truncate font-mono text-[11px]" title={Silian_log.path}>
              {Silian_log.path}
            </span>
          </td>
        )}
        {Silian_columns.includes('status_code') && <td className="px-3 py-2">{Silian_log.status_code}</td>}
        {Silian_columns.includes('user_id') && <td className="px-3 py-2">{Silian_log.user_id || '-'}</td>}
        {Silian_columns.includes('duration_ms') && <td className="px-3 py-2">{Silian_log.duration_ms}</td>}
        {Silian_columns.includes('created_at') && <td className="px-3 py-2 whitespace-nowrap">{Silian_log.created_at}</td>}
        {Silian_columns.includes('ops') && (
          <td className="min-w-[180px] px-3 py-2 align-top">
            <div className="flex items-center gap-3 whitespace-nowrap text-xs">
              <Silian_Button variant="link" className="h-auto p-0" onClick={() => Silian_onDetail(Silian_log.id)}>
                {Silian_t('admin.systemLogs.details')}
              </Silian_Button>
              <Silian_Button variant="link" className="h-auto p-0 text-muted-foreground" onClick={() => Silian_onCopyReq(Silian_log.request_id)}>
                {Silian_t('admin.systemLogs.copyReqId')}
              </Silian_Button>
              {Silian_log.request_id && (
                <Silian_Button variant="link" className="h-auto p-0 text-primary" onClick={() => Silian_onRelated(Silian_log.request_id)}>
                  {Silian_t('admin.systemLogs.related')}
                </Silian_Button>
              )}
            </div>
          </td>
        )}
      </tr>
    );
  };

  return (
    <Silian_Card>
      <Silian_CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <Silian_CardTitle className="text-lg">{Silian_title}</Silian_CardTitle>
          <Silian_Badge variant="outline" className="text-xs">
            {Silian_t('admin.systemLogs.recordCount', { count: Silian_items.length })}
          </Silian_Badge>
        </div>
        {Silian_isTruncated && (
          <Silian_CardDescription className="text-xs text-muted-foreground">
            {Silian_t('admin.systemLogs.renderLimitHint', { visible: Silian_visibleItems.length, total: Silian_items.length })}
          </Silian_CardDescription>
        )}
      </Silian_CardHeader>
      <Silian_CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-t border-border bg-transparent text-xs text-foreground">
            {Silian_header}
            <tbody>
              {Silian_visibleItems.map((Silian_log) => Silian_renderRow(Silian_log))}
              {Silian_visibleItems.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-muted-foreground" colSpan={Silian_columns.length}>
                    {Silian_emptyText}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Silian_CardContent>
    </Silian_Card>
  );
}
function Silian_LogSection({ title: Silian_title, items: Silian_items, emptyText: Silian_emptyText, renderItem: Silian_renderItem, headers: Silian_headers, columnLabel: Silian_columnLabel, t: Silian_t }) {
  const Silian_visibleItems = Silian_items.slice(0, Silian_TABLE_RENDER_LIMIT);
  const Silian_isTruncated = Silian_items.length > Silian_visibleItems.length;

  return (
    <Silian_Card>
      <Silian_CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <Silian_CardTitle className="text-lg">{Silian_title}</Silian_CardTitle>
          <Silian_Badge variant="outline" className="text-xs">
            {Silian_items.length}
          </Silian_Badge>
        </div>
        {Silian_isTruncated && (
          <Silian_CardDescription className="text-xs text-muted-foreground">
            {Silian_t('admin.systemLogs.renderLimitHint', { visible: Silian_visibleItems.length, total: Silian_items.length })}
          </Silian_CardDescription>
        )}
      </Silian_CardHeader>
      <Silian_CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-t border-border bg-transparent text-xs text-foreground">
            <thead className="bg-muted/60">
              <tr>
                {Silian_headers.map((Silian_header) => (
                  <th
                    key={Silian_header}
                    className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground"
                  >
                    {Silian_columnLabel(Silian_header)}
                  </th>
                ))}
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground">
                  {Silian_columnLabel('ops')}
                </th>
              </tr>
            </thead>
            <tbody>
              {Silian_visibleItems.map(Silian_renderItem)}
              {Silian_visibleItems.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-muted-foreground" colSpan={Silian_headers.length + 1}>
                    {Silian_emptyText}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Silian_CardContent>
    </Silian_Card>
  );
}

function Silian_ExpandableRow({ summaryCells: Silian_summaryCells, detail: Silian_detail, t: Silian_t }) {
  const [Silian_open, Silian_setOpen] = Silian_useState(false);
  return (
    <>
      <tr className={Silian_cn('border-b', Silian_open && 'bg-muted/40')}>
        {Silian_summaryCells.map((Silian_cell, Silian_index) => (
          <td key={Silian_index} className="px-3 py-2 align-top">
            {Silian_cell}
          </td>
        ))}
        <td className="px-3 py-2 text-right">
          <Silian_Button
            variant="link"
            className="h-auto p-0 text-xs"
            onClick={() => Silian_setOpen((Silian_prev) => !Silian_prev)}
          >
            {Silian_open ? Silian_t('admin.systemLogs.actions.collapse') : Silian_t('admin.systemLogs.actions.expand')}
          </Silian_Button>
        </td>
      </tr>
      {Silian_open && (
        <tr className="border-b bg-muted/30">
          <td colSpan={Silian_summaryCells.length + 1} className="px-3 py-3">
            {Silian_detail}
          </td>
        </tr>
      )}
    </>
  );
}

function Silian_AuditDetail({ log: Silian_log, columnLabel: Silian_columnLabel, onRelated: Silian_onRelated, t: Silian_t }) {
  return (
    <div className="space-y-2 text-xs">
      <Silian_KeyVal label={Silian_columnLabel('id')} value={Silian_log.id} />
      <Silian_KeyVal label={Silian_columnLabel('conversation_id')} value={Silian_log.conversation_id || '-'} />
      <div className="flex flex-wrap items-center gap-2">
        <Silian_KeyVal label={Silian_columnLabel('request_id')} value={Silian_log.request_id || '-'} />
        {Silian_log.request_id && (
          <Silian_Button variant="link" className="h-auto p-0 text-xs" onClick={() => Silian_onRelated?.(Silian_log.request_id)}>
            {Silian_t('admin.systemLogs.related')}
          </Silian_Button>
        )}
      </div>
      <Silian_KeyVal label={Silian_columnLabel('action')} value={Silian_log.action} />
      <Silian_KeyVal label={Silian_columnLabel('operation_category')} value={Silian_log.operation_category || '-'} />
      <Silian_KeyVal label={Silian_columnLabel('actor_type')} value={Silian_log.actor_type} />
      <Silian_KeyVal label={Silian_columnLabel('status')} value={Silian_log.status} />
      {Silian_log.details_raw && (
        <Silian_JsonTreeBlock title="details_raw" value={Silian_safeParse(Silian_log.details_raw)} />
      )}
      {Silian_log.summary && <Silian_JsonTreeBlock title="summary" value={Silian_safeParse(Silian_log.summary)} />}
      {(Silian_log.old_data || Silian_log.new_data) && (
        <div className="space-y-1">
          <Silian_AuditDiffViewer oldData={Silian_log.old_data} newData={Silian_log.new_data} />
        </div>
      )}
    </div>
  );
}

function Silian_ErrorDetail({ log: Silian_log, columnLabel: Silian_columnLabel, onRelated: Silian_onRelated, t: Silian_t }) {
  return (
    <div className="space-y-2 text-xs">
      <Silian_KeyVal label={Silian_columnLabel('id')} value={Silian_log.id} />
      <div className="flex flex-wrap items-center gap-2">
        <Silian_KeyVal label={Silian_columnLabel('request_id')} value={Silian_log.request_id || '-'} />
        {Silian_log.request_id && (
          <Silian_Button variant="link" className="h-auto p-0 text-xs" onClick={() => Silian_onRelated?.(Silian_log.request_id)}>
            {Silian_t('admin.systemLogs.related')}
          </Silian_Button>
        )}
      </div>
      <Silian_KeyVal label={Silian_columnLabel('error_type')} value={Silian_log.error_type} />
      <Silian_KeyVal label={Silian_columnLabel('error_file')} value={Silian_log.error_file} />
      <Silian_KeyVal label={Silian_columnLabel('error_line')} value={Silian_log.error_line} />
      <Silian_JsonTreeBlock title="message" value={Silian_safeParse(Silian_log.error_message)} />
      {Silian_log.stack_trace && (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-900 p-3 font-mono text-[11px] text-green-300">
          {Silian_log.stack_trace}
        </pre>
      )}
      {Silian_log.context_json && <Silian_JsonTreeBlock title="context" value={Silian_safeParse(Silian_log.context_json)} />}
    </div>
  );
}

function Silian_LlmDetail({ log: Silian_log, columnLabel: Silian_columnLabel, onRelated: Silian_onRelated, t: Silian_t }) {
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Silian_KeyVal label={Silian_columnLabel('conversation_id')} value={Silian_log.conversation_id || '-'} />
        <Silian_KeyVal label={Silian_columnLabel('turn_no')} value={Silian_log.turn_no ?? '-'} />
        <Silian_KeyVal label={Silian_columnLabel('request_id')} value={Silian_log.request_id || '-'} />
        {Silian_log.request_id && (
          <Silian_Button variant="link" className="h-auto p-0 text-xs" onClick={() => Silian_onRelated?.(Silian_log.request_id)}>
            {Silian_t('admin.systemLogs.related')}
          </Silian_Button>
        )}
      </div>
      <Silian_KeyVal label={Silian_columnLabel('actor_type')} value={Silian_log.actor_type} />
      <Silian_KeyVal label={Silian_columnLabel('actor_id')} value={Silian_log.actor_id || '-'} />
      <Silian_KeyVal label={Silian_columnLabel('source')} value={Silian_log.source || '-'} />
      <Silian_KeyVal label={Silian_columnLabel('model')} value={Silian_log.model || '-'} />
      <Silian_KeyVal label={Silian_columnLabel('llm_status')} value={Silian_log.status || '-'} />
      <Silian_KeyVal label={Silian_columnLabel('response_id')} value={Silian_log.response_id || '-'} />
      <Silian_KeyVal label={Silian_columnLabel('total_tokens')} value={Silian_log.total_tokens ?? '-'} />
      <Silian_KeyVal label={Silian_columnLabel('latency_ms')} value={Silian_log.latency_ms ?? '-'} />
      {Silian_log.prompt && <Silian_JsonTreeBlock title="prompt" value={Silian_safeParse(Silian_log.prompt)} />}
      {Silian_log.error_message && <Silian_JsonTreeBlock title="error_message" value={Silian_safeParse(Silian_log.error_message)} />}
    </div>
  );
}

function Silian_JsonSection({ title: Silian_title, value: Silian_value, onCopy: Silian_onCopy, copyLabel: Silian_copyLabel }) {
  if (!Silian_value) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{Silian_title}</h3>
        <Silian_Button variant="link" className="h-auto p-0 text-xs" onClick={() => Silian_onCopy(Silian_value)}>
          {Silian_copyLabel}
        </Silian_Button>
      </div>
      <Silian_JsonTreeViewer value={Silian_safeParse(Silian_value)} />
    </div>
  );
}

function Silian_JsonTreeBlock({ title: Silian_title, value: Silian_value }) {
  if (!Silian_value) return null;
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold text-muted-foreground">{Silian_title}</div>
      <Silian_JsonTreeViewer value={Silian_value} />
    </div>
  );
}

function Silian_KeyVal({ label: Silian_label, value: Silian_value, className: Silian_className }) {
  return (
    <div className={Silian_cn('space-x-2', Silian_className)}>
      <span className="font-semibold">{Silian_label}:</span>
      <span className="font-mono break-all text-xs">{String(Silian_value ?? '-')}</span>
    </div>
  );
}

function Silian_safeParse(Silian_value) {
  if (Silian_value == null) return null;
  if (typeof Silian_value === 'object') return Silian_value;
  try {
    return JSON.parse(Silian_value);
  } catch {
    return Silian_value;
  }
}

function Silian_llmCell(Silian_log, Silian_column) {
  switch (Silian_column) {
    case 'id':
      return Silian_log.id;
    case 'conversation_id':
      return Silian_log.conversation_id || '-';
    case 'turn_no':
      return Silian_log.turn_no ?? '-';
    case 'actor_type':
      return Silian_log.actor_type;
    case 'actor_id':
      return Silian_log.actor_id ?? '-';
    case 'source':
      return Silian_log.source || '-';
    case 'model':
      return Silian_log.model || '-';
    case 'llm_status':
      return Silian_log.status || '-';
    case 'total_tokens':
      return Silian_log.total_tokens ?? '-';
    case 'latency_ms':
      return Silian_log.latency_ms ?? '-';
    case 'created_at':
      return Silian_log.created_at;
    default:
      return Silian_log[Silian_column] ?? '-';
  }
}

function Silian_auditCell(Silian_log, Silian_column, Silian_onRelated) {
  switch (Silian_column) {
    case 'id':
      return Silian_log.id;
    case 'conversation_id':
      return Silian_log.conversation_id || '-';
    case 'request_id':
      return Silian_log.request_id ? (
        <Silian_Button
          key={`audit-request-${Silian_log.id}`}
          variant="link"
          className="h-auto p-0 text-[11px] font-mono text-primary"
          onClick={() => Silian_onRelated(Silian_log.request_id)}
        >
          {Silian_log.request_id}
        </Silian_Button>
      ) : (
        '-'
      );
    case 'actor_type':
      return Silian_log.actor_type || '-';
    case 'action':
      return Silian_log.action || '-';
    case 'operation_category':
      return Silian_log.operation_category || '-';
    case 'status':
      return Silian_log.status || '-';
    case 'user_id':
      return Silian_log.user_id || '-';
    case 'ip_address':
      return Silian_log.ip_address || '-';
    case 'created_at':
      return Silian_log.created_at || '-';
    default:
      return Silian_log[Silian_column] ?? '-';
  }
}

function Silian_mergeToken(Silian_previous, Silian_key, Silian_newValue) {
  // Use parseLogQuery to safely map shorthand keys to their canonical form,
  // then update the token and rebuild the query string.
  const Silian_parsed = Silian_parseLogQuery(Silian_previous || '');
  // Probe to determine the mapped key for the provided shorthand.
  // Use a sentinel when newValue is empty so parser still maps the shorthand.
  const Silian_probeValue = Silian_newValue !== undefined && Silian_newValue !== '' ? Silian_newValue : '__probe__';
  const Silian_probe = Silian_parseLogQuery(`${Silian_key}:${Silian_probeValue}`);
  const Silian_mappedKey = Object.keys(Silian_probe.tokens || {})[0] || Silian_key;

  if (Silian_newValue) {
    Silian_parsed.tokens = Silian_parsed.tokens || {};
    Silian_parsed.tokens[Silian_mappedKey] = Silian_newValue;
  } else {
    // remove the token when newValue is empty
    if (Silian_parsed.tokens) delete Silian_parsed.tokens[Silian_mappedKey];
  }

  // Rebuild the query string from tokens, ranges and free text
  const Silian_parts = [];
  Object.entries(Silian_parsed.tokens || {}).forEach(([Silian_k, Silian_v]) => {
    if (Silian_v && typeof Silian_v === 'object') {
      if (Silian_v.negate) Silian_parts.push(`${Silian_k}!=${Silian_v.value}`);
      else Silian_parts.push(`${Silian_k}:${Silian_v.value}`);
    } else {
      Silian_parts.push(`${Silian_k}:${Silian_v}`);
    }
  });
  Object.entries(Silian_parsed.ranges || {}).forEach(([Silian_k, Silian_ops]) => {
    Object.entries(Silian_ops).forEach(([Silian_op, Silian_val]) => {
      Silian_parts.push(`${Silian_k}${Silian_op}${Silian_val}`);
    });
  });
  if (Silian_parsed.free) Silian_parts.push(Silian_parsed.free);
  return Silian_parts.join(' ').trim();
}

function Silian_mergeRange(Silian_previous, Silian_key, Silian_operator, Silian_newValue) {
  // Update a comparison range (eg dur>500) by using parseLogQuery to map keys
  const Silian_parsed = Silian_parseLogQuery(Silian_previous || '');
  // When newValue is empty, use sentinel so parsing maps shorthand key to canonical key
  const Silian_probeValue = Silian_newValue !== undefined && Silian_newValue !== '' ? Silian_newValue : '__probe__';
  const Silian_probe = Silian_parseLogQuery(`${Silian_key}${Silian_operator}${Silian_probeValue}`);
  const Silian_mappedKey = Object.keys(Silian_probe.ranges || {})[0] || Object.keys(Silian_probe.tokens || {})[0] || Silian_key;

  Silian_parsed.ranges = Silian_parsed.ranges || {};
  if (!Silian_newValue) {
    // remove the specific operator if present
    if (Silian_parsed.ranges[Silian_mappedKey]) {
      delete Silian_parsed.ranges[Silian_mappedKey][Silian_operator];
      if (Object.keys(Silian_parsed.ranges[Silian_mappedKey]).length === 0) delete Silian_parsed.ranges[Silian_mappedKey];
    }
  } else {
    Silian_parsed.ranges[Silian_mappedKey] = Silian_parsed.ranges[Silian_mappedKey] || {};
    Silian_parsed.ranges[Silian_mappedKey][Silian_operator] = Silian_newValue;
  }

  // Rebuild string similar to mergeToken
  const Silian_parts = [];
  Object.entries(Silian_parsed.tokens || {}).forEach(([Silian_k, Silian_v]) => {
    if (Silian_v && typeof Silian_v === 'object') {
      if (Silian_v.negate) Silian_parts.push(`${Silian_k}!=${Silian_v.value}`);
      else Silian_parts.push(`${Silian_k}:${Silian_v.value}`);
    } else {
      Silian_parts.push(`${Silian_k}:${Silian_v}`);
    }
  });
  Object.entries(Silian_parsed.ranges || {}).forEach(([Silian_k, Silian_ops]) => {
    Object.entries(Silian_ops).forEach(([Silian_op, Silian_val]) => {
      Silian_parts.push(`${Silian_k}${Silian_op}${Silian_val}`);
    });
  });
  if (Silian_parsed.free) Silian_parts.push(Silian_parsed.free);
  return Silian_parts.join(' ').trim();
}

function Silian_setDurationUpper(Silian_previous, Silian_value) {
  return Silian_mergeRange(Silian_previous, 'dur', '<=', Silian_value);
}

function Silian_removeToken(Silian_previous, Silian_tokenKey) {
  const Silian_parsed = Silian_parseLogQuery(Silian_previous || '');
  // Use a probe value to map shorthand token key to canonical key
  const Silian_probe = Silian_parseLogQuery(`${Silian_tokenKey}:__probe__`);
  const Silian_mappedKey = Object.keys(Silian_probe.tokens || {})[0] || Silian_tokenKey;
  if (Silian_parsed.tokens) delete Silian_parsed.tokens[Silian_mappedKey];

  const Silian_parts = [];
  Object.entries(Silian_parsed.tokens || {}).forEach(([Silian_k, Silian_v]) => {
    if (Silian_v && typeof Silian_v === 'object') {
      if (Silian_v.negate) Silian_parts.push(`${Silian_k}!=${Silian_v.value}`);
      else Silian_parts.push(`${Silian_k}:${Silian_v.value}`);
    } else {
      Silian_parts.push(`${Silian_k}:${Silian_v}`);
    }
  });
  Object.entries(Silian_parsed.ranges || {}).forEach(([Silian_k, Silian_ops]) => {
    Object.entries(Silian_ops).forEach(([Silian_op, Silian_val]) => {
      Silian_parts.push(`${Silian_k}${Silian_op}${Silian_val}`);
    });
  });
  if (Silian_parsed.free) Silian_parts.push(Silian_parsed.free);
  return Silian_parts.join(' ').trim();
}
