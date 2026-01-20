import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { RefreshCw, Download, Columns2, X, Loader2 } from 'lucide-react';

import { useTranslation } from '../../hooks/useTranslation';
import { useSystemLogDetail } from '../../hooks/useSystemLogs';
import { useLogSearch } from '../../hooks/useLogSearch';
import { parseLogQuery } from '../../lib/logQueryParser';
import { fetchRelatedLogs, exportLogs } from '../../lib/api/logSearch';
import TimelineView from '../../components/logs/TimelineView';
import RawView from '../../components/logs/RawView';
import RequestIdRelatedDrawer from '../../components/logs/RequestIdRelatedDrawer';
import JsonTreeViewer from '../../components/logs/JsonTreeViewer';
import AuditDiffViewer from '../../components/logs/AuditDiffViewer';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/Input';
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/Alert';
import { cn } from '../../lib/utils';

const SYSTEM_COLUMNS = ['id', 'method', 'path', 'status_code', 'user_id', 'duration_ms', 'created_at', 'ops'];
const AUDIT_COLUMNS = ['id', 'actor_type', 'action', 'operation_category', 'status', 'user_id', 'ip_address', 'created_at', 'ops'];
const ERROR_COLUMNS = ['id', 'request_id', 'error_type', 'error_message', 'error_file', 'error_line', 'error_time', 'ops'];
const LLM_COLUMNS = ['id', 'actor_type', 'actor_id', 'source', 'model', 'llm_status', 'total_tokens', 'latency_ms', 'created_at', 'ops'];

const COLUMN_STORAGE_KEYS = {
  system: 'logCols_system',
  audit: 'logCols_audit',
  error: 'logCols_error',
  llm: 'logCols_llm'
};

function loadStoredColumns(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.length ? parsed : fallback;
  } catch (error) {
    console.warn('Failed to load stored columns', error);
    return fallback;
  }
}

export default function SystemLogsPage() {
  const { t } = useTranslation();

  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeTypes, setActiveTypes] = useState(['system', 'audit', 'error', 'llm']);
  const [limitPerType, setLimitPerType] = useState(50);
  const [selectedSystemId, setSelectedSystemId] = useState(null);
  const [view, setView] = useState('table');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [requestDrawerId, setRequestDrawerId] = useState(null);
  const [related, setRelated] = useState({ system: [], audit: [], error: [], llm: [] });
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [systemCols, setSystemCols] = useState(() => loadStoredColumns(COLUMN_STORAGE_KEYS.system, SYSTEM_COLUMNS));
  const [auditCols, setAuditCols] = useState(() => loadStoredColumns(COLUMN_STORAGE_KEYS.audit, AUDIT_COLUMNS));
  const [errorCols, setErrorCols] = useState(() => loadStoredColumns(COLUMN_STORAGE_KEYS.error, ERROR_COLUMNS));
  const [llmCols, setLlmCols] = useState(() => loadStoredColumns(COLUMN_STORAGE_KEYS.llm, LLM_COLUMNS));

  const prevMaxSystemId = useRef(0);
  const [highlightIds, setHighlightIds] = useState(new Set());

  const parsedQuery = useMemo(() => parseLogQuery(q || ''), [q]);

  const extraParams = useMemo(() => {
    const params = {};
    const tokens = parsedQuery.tokens || {};

    ['method', 'status_code', 'user_id', 'request_id', 'path', 'action', 'audit_status', 'error_type', 'model', 'source', 'actor_type', 'actor_id', 'llm_status'].forEach((key) => {
      if (tokens[key]) params[key] = tokens[key];
    });

    if (parsedQuery.ranges?.duration_ms) {
      const durationRange = parsedQuery.ranges.duration_ms;
      if (durationRange['>'] || durationRange['>=']) params.min_duration = durationRange['>'] || durationRange['>='];
      if (durationRange['<'] || durationRange['<=']) params.max_duration = durationRange['<'] || durationRange['<='];
    }

    return params;
  }, [parsedQuery]);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching
  } = useLogSearch({
    q: parsedQuery.free || q,
    date_from: dateFrom,
    date_to: dateTo,
    types: activeTypes,
    limit_per_type: limitPerType,
    ...extraParams
  });

  const { data: detailData, isLoading: loadingDetail } = useSystemLogDetail(selectedSystemId);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = setInterval(() => {
      refetch();
    }, 8000);
    return () => clearInterval(timer);
  }, [autoRefresh, refetch]);

  const copy = useCallback((text) => {
    if (text == null) return;
    try {
      const value = typeof text === 'string' ? text : JSON.stringify(text, null, 2);
      navigator.clipboard.writeText(value);
    } catch (error) {
      console.warn('Failed to copy content', error);
    }
  }, []);

  const systemLogs = data?.data?.system?.items || [];
  const auditLogs = data?.data?.audit?.items || [];
  const errorLogs = data?.data?.error?.items || [];
  const llmLogs = data?.data?.llm?.items || [];

  useEffect(() => {
    if (!systemLogs.length) return;
    const currentMax = Math.max(...systemLogs.map((log) => log.id));
    if (prevMaxSystemId.current === 0) {
      prevMaxSystemId.current = currentMax;
      return;
    }
    if (currentMax > prevMaxSystemId.current) {
      const incomingIds = systemLogs.filter((log) => log.id > prevMaxSystemId.current).map((log) => log.id);
      setHighlightIds(new Set(incomingIds));
      prevMaxSystemId.current = currentMax;
      const timeout = setTimeout(() => setHighlightIds(new Set()), 4000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [systemLogs]);

  const handleTypeChange = useCallback((next) => {
    if (!next) return;
    setActiveTypes(next);
  }, []);

  const saveColumns = useCallback((storageKey, next) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch (error) {
      console.warn('Failed to persist selected columns', error);
    }
  }, []);

  const toggleColumn = useCallback((type, column) => {
    if (column === 'id' || column === 'ops') return;
    if (type === 'system') {
      setSystemCols((current) => {
        const next = current.includes(column) ? current.filter((col) => col !== column) : [...current, column];
        saveColumns(COLUMN_STORAGE_KEYS.system, next);
        return next;
      });
    } else if (type === 'audit') {
      setAuditCols((current) => {
        const next = current.includes(column) ? current.filter((col) => col !== column) : [...current, column];
        saveColumns(COLUMN_STORAGE_KEYS.audit, next);
        return next;
      });
    } else if (type === 'error') {
      setErrorCols((current) => {
        const next = current.includes(column) ? current.filter((col) => col !== column) : [...current, column];
        saveColumns(COLUMN_STORAGE_KEYS.error, next);
        return next;
      });
    } else if (type === 'llm') {
      setLlmCols((current) => {
        const next = current.includes(column) ? current.filter((col) => col !== column) : [...current, column];
        saveColumns(COLUMN_STORAGE_KEYS.llm, next);
        return next;
      });
    }
  }, [saveColumns]);

  const openRelated = useCallback(async (requestId) => {
    setRequestDrawerId(requestId);
    setLoadingRelated(true);
    try {
      const response = await fetchRelatedLogs(requestId);
      setRelated(response?.data || response || { system: [], audit: [], error: [], llm: [] });
    } finally {
      setLoadingRelated(false);
    }
  }, []);

  const doExport = useCallback(async (format) => {
    setExporting(true);
    try {
      const blob = await exportLogs(
        {
          q,
          date_from: dateFrom,
          date_to: dateTo,
          types: activeTypes,
          limit_per_type: limitPerType,
          ...extraParams
        },
        format
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `logs_${Date.now()}.${format === 'csv' ? 'csv' : 'ndjson'}`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } finally {
      setExporting(false);
    }
  }, [q, dateFrom, dateTo, activeTypes, limitPerType, extraParams]);

  const hasResults = systemLogs.length + auditLogs.length + errorLogs.length + llmLogs.length > 0;
  const activeFilterEntries = Object.entries(parsedQuery.tokens || {}).filter(([, value]) => value && typeof value !== 'object');
  const hasActiveFilters = activeFilterEntries.length > 0 || Boolean(parsedQuery.free);

  const columnLabel = useCallback(
    (key) => t(`admin.systemLogs.columns.${key}`, { defaultValue: key }),
    [t]
  );

  const llmHeaders = useMemo(() => llmCols.filter((col) => col !== 'ops'), [llmCols]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle>{t('admin.systemLogs.title')}</CardTitle>
              <CardDescription>{t('admin.systemLogs.subtitle')}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ToggleGroup
                type="single"
                value={view}
                onValueChange={(value) => value && setView(value)}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="table">{t('admin.systemLogs.views.table')}</ToggleGroupItem>
                <ToggleGroupItem value="timeline">{t('admin.systemLogs.views.timeline')}</ToggleGroupItem>
                <ToggleGroupItem value="raw">{t('admin.systemLogs.views.raw')}</ToggleGroupItem>
              </ToggleGroup>
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
                {t('admin.systemLogs.refresh')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => doExport('csv')}
                disabled={exporting}
              >
                <Download className="mr-2 h-4 w-4" />
                {t('admin.systemLogs.exportCsv')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => doExport('ndjson')}
                disabled={exporting}
              >
                <Download className="mr-2 h-4 w-4" />
                {t('admin.systemLogs.exportNdjson')}
              </Button>
              <ColumnSelector
                systemCols={systemCols}
                auditCols={auditCols}
                errorCols={errorCols}
                llmCols={llmCols}
                onToggle={toggleColumn}
                columnLabel={columnLabel}
                t={t}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="logs-auto-refresh"
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
              />
              <Label htmlFor="logs-auto-refresh" className="text-sm text-muted-foreground">
                {t('admin.systemLogs.autoRefresh')}
              </Label>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{t('admin.systemLogs.perTypeLimit')}</span>
              <Input
                id="limit-per-type"
                type="number"
                min={1}
                max={200}
                value={limitPerType}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setLimitPerType(Number.isNaN(value) ? 50 : value);
                }}
                className="h-9 w-24"
              />
            </div>
            <ToggleGroup
              type="multiple"
              value={activeTypes}
              onValueChange={handleTypeChange}
              variant="outline"
              size="sm"
              className="flex-wrap"
            >
              <ToggleGroupItem value="system">{t('admin.systemLogs.types.system')}</ToggleGroupItem>
              <ToggleGroupItem value="audit">{t('admin.systemLogs.types.audit')}</ToggleGroupItem>
              <ToggleGroupItem value="error">{t('admin.systemLogs.types.error')}</ToggleGroupItem>
              <ToggleGroupItem value="llm">{t('admin.systemLogs.types.llm')}</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <FilterField label={t('admin.systemLogs.filters.keyword')} htmlFor="log-search">
              <Input
                id="log-search"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder={t('admin.systemLogs.searchPlaceholder')}
                className="font-mono"
              />
            </FilterField>
            <FilterField label={t('admin.systemLogs.filters.method')} htmlFor="log-method">
              <Input
                id="log-method"
                value={extraParams.method || ''}
                onChange={(event) => {
                  const v = event.target.value;
                  setQ((prev) => mergeToken(prev, 'method', v));
                }}
                placeholder={t('admin.systemLogs.placeholders.method')}
                className="font-mono"
              />
            </FilterField>
            <FilterField label={t('admin.systemLogs.filters.status')} htmlFor="log-status">
              <Input
                id="log-status"
                value={extraParams.status_code || ''}
                onChange={(event) => {
                  const v = event.target.value;
                  setQ((prev) => mergeToken(prev, 'status', v));
                }}
                placeholder={t('admin.systemLogs.placeholders.status')}
                className="font-mono"
              />
            </FilterField>
            <FilterField label={t('admin.systemLogs.filters.userId')} htmlFor="log-user-id">
              <Input
                id="log-user-id"
                value={extraParams.user_id || ''}
                onChange={(event) => {
                  const v = event.target.value;
                  setQ((prev) => mergeToken(prev, 'user', v));
                }}
                placeholder={t('admin.systemLogs.placeholders.userId')}
                className="font-mono"
              />
            </FilterField>
            <FilterField label={t('admin.systemLogs.filters.requestId')} htmlFor="log-request-id">
              <Input
                id="log-request-id"
                value={extraParams.request_id || ''}
                onChange={(event) => {
                  const v = event.target.value;
                  setQ((prev) => mergeToken(prev, 'rid', v));
                }}
                placeholder={t('admin.systemLogs.placeholders.requestId')}
                className="font-mono"
              />
            </FilterField>
            <FilterField label={t('admin.systemLogs.filters.path')} htmlFor="log-path">
              <Input
                id="log-path"
                value={extraParams.path || ''}
                onChange={(event) => {
                  const v = event.target.value;
                  setQ((prev) => mergeToken(prev, 'path', v));
                }}
                placeholder={t('admin.systemLogs.placeholders.path')}
                className="font-mono"
              />
            </FilterField>
            <FilterField label={t('admin.systemLogs.filters.durationMin')} htmlFor="log-duration-min">
              <Input
                id="log-duration-min"
                value={extraParams.min_duration || ''}
                onChange={(event) => setQ((prev) => mergeRange(prev, 'dur', '>=', event.target.value))}
                placeholder={t('admin.systemLogs.placeholders.duration')}
                className="font-mono"
              />
            </FilterField>
            <FilterField label={t('admin.systemLogs.filters.durationMax')} htmlFor="log-duration-max">
              <Input
                id="log-duration-max"
                value={extraParams.max_duration || ''}
                onChange={(event) => setQ((prev) => setDurationUpper(prev, event.target.value))}
                placeholder={t('admin.systemLogs.placeholders.duration')}
                className="font-mono"
              />
            </FilterField>
            <FilterField label={t('admin.systemLogs.filters.auditAction')} htmlFor="log-audit-action">
              <Input
                id="log-audit-action"
                value={extraParams.action || ''}
                onChange={(event) => {
                  const v = event.target.value;
                  setQ((prev) => mergeToken(prev, 'action', v));
                }}
                placeholder={t('admin.systemLogs.placeholders.auditAction')}
                className="font-mono"
              />
            </FilterField>
            <FilterField label={t('admin.systemLogs.filters.auditStatus')} htmlFor="log-audit-status">
              <Input
                id="log-audit-status"
                value={extraParams.audit_status || ''}
                onChange={(event) => {
                  const v = event.target.value;
                  setQ((prev) => mergeToken(prev, 'astatus', v));
                }}
                placeholder={t('admin.systemLogs.placeholders.auditStatus')}
                className="font-mono"
              />
            </FilterField>
            <FilterField label={t('admin.systemLogs.filters.errorType')} htmlFor="log-error-type">
              <Input
                id="log-error-type"
                value={extraParams.error_type || ''}
                onChange={(event) => {
                  const v = event.target.value;
                  setQ((prev) => mergeToken(prev, 'etype', v));
                }}
                placeholder={t('admin.systemLogs.placeholders.errorType')}
                className="font-mono"
              />
            </FilterField>
            <FilterField label={t('admin.systemLogs.filters.model')} htmlFor="log-model">
              <Input
                id="log-model"
                value={extraParams.model || ''}
                onChange={(event) => {
                  const v = event.target.value;
                  setQ((prev) => mergeToken(prev, 'model', v));
                }}
                placeholder={t('admin.systemLogs.placeholders.model')}
                className="font-mono"
              />
            </FilterField>
            <FilterField label={t('admin.systemLogs.filters.source')} htmlFor="log-source">
              <Input
                id="log-source"
                value={extraParams.source || ''}
                onChange={(event) => {
                  const v = event.target.value;
                  setQ((prev) => mergeToken(prev, 'source', v));
                }}
                placeholder={t('admin.systemLogs.placeholders.source')}
                className="font-mono"
              />
            </FilterField>
            <FilterField label={t('admin.systemLogs.filters.actorType')} htmlFor="log-actor-type">
              <Input
                id="log-actor-type"
                value={extraParams.actor_type || ''}
                onChange={(event) => {
                  const v = event.target.value;
                  setQ((prev) => mergeToken(prev, 'actor', v));
                }}
                placeholder={t('admin.systemLogs.placeholders.actorType')}
                className="font-mono"
              />
            </FilterField>
            <FilterField label={t('admin.systemLogs.filters.llmStatus')} htmlFor="log-llm-status">
              <Input
                id="log-llm-status"
                value={extraParams.llm_status || ''}
                onChange={(event) => {
                  const v = event.target.value;
                  setQ((prev) => mergeToken(prev, 'lstatus', v));
                }}
                placeholder={t('admin.systemLogs.placeholders.llmStatus')}
                className="font-mono"
              />
            </FilterField>
            <FilterField label={t('admin.systemLogs.dateFrom')} htmlFor="log-date-from">
              <Input
                id="log-date-from"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </FilterField>
            <FilterField label={t('admin.systemLogs.dateTo')} htmlFor="log-date-to">
              <Input
                id="log-date-to"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </FilterField>
          </div>
        </CardContent>
        {hasActiveFilters && (
          <CardFooter className="pt-0">
            <ActiveFilters
              parsed={parsedQuery}
              onRemove={(tokenKey) => setQ((prev) => removeToken(prev, tokenKey))}
              t={t}
            />
          </CardFooter>
        )}
      </Card>

      {isLoading && (
        <Card>
          <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('common.loading')}
          </CardContent>
        </Card>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>{error?.message || t('errors.loadFailed')}</AlertDescription>
        </Alert>
      )}

      {!isLoading && !isError && (
        <>
          {view === 'table' && (
            <div className="space-y-6">
              <SystemLogSection
                title={t('admin.systemLogs.sections.system')}
                items={systemLogs}
                emptyText={t('admin.systemLogs.empty.system')}
                columns={systemCols}
                highlightIds={highlightIds}
                onDetail={setSelectedSystemId}
                onCopyReq={copy}
                onRelated={openRelated}
                columnLabel={columnLabel}
                t={t}
              />

              <LogSection
                title={t('admin.systemLogs.sections.llm')}
                items={llmLogs}
                emptyText={t('admin.systemLogs.empty.llm')}
                headers={llmHeaders}
                columnLabel={columnLabel}
                renderItem={(log) => (
                  <ExpandableRow
                    key={`llm-${log.id}`}
                    summaryCells={llmHeaders.map((column) => llmCell(log, column))}
                    detail={<LlmDetail log={log} columnLabel={columnLabel} onRelated={openRelated} t={t} />}
                    t={t}
                  />
                )}
              />

              <LogSection
                title={t('admin.systemLogs.sections.audit')}
                items={auditLogs}
                emptyText={t('admin.systemLogs.empty.audit')}
                headers={[
                  'id',
                  'actor_type',
                  'action',
                  'operation_category',
                  'status',
                  'user_id',
                  'ip_address',
                  'created_at'
                ]}
                columnLabel={columnLabel}
                renderItem={(log) => (
                  <ExpandableRow
                    key={`audit-${log.id}`}
                    summaryCells={[
                      log.id,
                      log.actor_type,
                      log.action,
                      log.operation_category || '- ',
                      log.status,
                      log.user_id || '-',
                      log.ip_address || '-',
                      log.created_at
                    ]}
                    detail={<AuditDetail log={log} columnLabel={columnLabel} />}
                    t={t}
                  />
                )}
              />

              <LogSection
                title={t('admin.systemLogs.sections.error')}
                items={errorLogs}
                emptyText={t('admin.systemLogs.empty.error')}
                headers={['id', 'request_id', 'error_type', 'error_message', 'error_file', 'error_line', 'error_time']}
                columnLabel={columnLabel}
                renderItem={(log) => (
                  <ExpandableRow
                    key={`error-${log.id}`}
                    summaryCells={[
                      log.id,
                      log.request_id ? (
                        <Button
                          key="request"
                          variant="link"
                          className="h-auto p-0 text-[11px] font-mono text-indigo-600"
                          onClick={() => openRelated(log.request_id)}
                        >
                          {log.request_id}
                        </Button>
                      ) : (
                        '-'
                      ),
                      log.error_type,
                      <span
                        key="message"
                        className="font-mono text-[11px] max-w-[240px] truncate"
                        title={log.error_message}
                      >
                        {log.error_message}
                      </span>,
                      log.error_file?.split('/').pop() || '-',
                      log.error_line,
                      log.error_time
                    ]}
                    detail={<ErrorDetail log={log} columnLabel={columnLabel} onRelated={openRelated} t={t} />}
                    t={t}
                  />
                )}
              />

              {!hasResults && (
                <Card>
                  <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    {t('admin.systemLogs.noEvents')}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {view === 'timeline' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('admin.systemLogs.views.timeline')}</CardTitle>
                <CardDescription>{t('admin.systemLogs.timelineDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <TimelineView
                  system={systemLogs}
                  audit={auditLogs}
                  error={errorLogs}
                  llm={llmLogs}
                  onSelectRequest={openRelated}
                  emptyLabel={t('admin.systemLogs.noEvents')}
                />
              </CardContent>
            </Card>
          )}

          {view === 'raw' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('admin.systemLogs.views.raw')}</CardTitle>
                <CardDescription>{t('admin.systemLogs.rawDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <RawView
                  system={systemLogs}
                  audit={auditLogs}
                  error={errorLogs}
                  llm={llmLogs}
                  onExportCsv={() => doExport('csv')}
                  onExportNdjson={() => doExport('ndjson')}
                  labels={{
                    copy: t('admin.systemLogs.copyNdjson'),
                    exportNdjson: t('admin.systemLogs.exportNdjson'),
                    exportCsv: t('admin.systemLogs.exportCsv'),
                    records: t('admin.systemLogs.records'),
                    maxHint: t('admin.systemLogs.maxRecords')
                  }}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={Boolean(selectedSystemId)} onOpenChange={(open) => !open && setSelectedSystemId(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {selectedSystemId
                ? t('admin.systemLogs.dialog.titleWithId', { id: selectedSystemId })
                : t('admin.systemLogs.dialog.title')}
            </DialogTitle>
            <DialogDescription>
              {t('admin.systemLogs.dialog.requestId', {
                id: detailData?.data?.request_id || t('common.none')
              })}
            </DialogDescription>
          </DialogHeader>
          {loadingDetail && (
            <div className="py-4 text-sm text-muted-foreground">{t('admin.systemLogs.dialog.loading')}</div>
          )}
          {detailData?.data && (
            <ScrollArea className="max-h-[70vh] pr-2">
              <div className="space-y-6 text-sm">
                <div className="grid gap-3 md:grid-cols-2">
                  <KeyVal label={t('admin.systemLogs.columns.request_id')} value={detailData.data.request_id} />
                  <KeyVal label={t('admin.systemLogs.columns.method')} value={detailData.data.method} />
                  <KeyVal label={t('admin.systemLogs.columns.path')} value={detailData.data.path} className="md:col-span-2" />
                  <KeyVal label={t('admin.systemLogs.columns.status_code')} value={detailData.data.status_code} />
                  <KeyVal label={t('admin.systemLogs.columns.user_id')} value={detailData.data.user_id || t('common.none')} />
                  <KeyVal label={t('admin.systemLogs.columns.duration_ms')} value={`${detailData.data.duration_ms} ms`} />
                  <KeyVal label={t('admin.systemLogs.columns.created_at')} value={detailData.data.created_at} className="md:col-span-2" />
                </div>

                <JsonSection
                  title={t('admin.systemLogs.requestBody')}
                  value={detailData.data.request_body}
                  onCopy={copy}
                  copyLabel={t('common.copy')}
                />
                <JsonSection
                  title={t('admin.systemLogs.responseBody')}
                  value={detailData.data.response_body}
                  onCopy={copy}
                  copyLabel={t('common.copy')}
                />
                {detailData.data.server_meta && (
                  <JsonSection
                    title={t('admin.systemLogs.serverMeta')}
                    value={detailData.data.server_meta}
                    onCopy={copy}
                    copyLabel={t('common.copy')}
                  />
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <RequestIdRelatedDrawer
        open={Boolean(requestDrawerId)}
        requestId={requestDrawerId}
        onClose={() => setRequestDrawerId(null)}
        loading={loadingRelated}
        data={related}
        onRefresh={() => requestDrawerId && openRelated(requestDrawerId)}
      />
    </div>
  );
}

function FilterField({ label, htmlFor, children }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
function ColumnSelector({ systemCols, auditCols, errorCols, llmCols, onToggle, columnLabel, t }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Columns2 className="mr-2 h-4 w-4" />
          {t('admin.systemLogs.columnSettings')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-4" align="end">
        <ColumnGroup
          title={t('admin.systemLogs.types.system')}
          columns={SYSTEM_COLUMNS}
          active={systemCols}
          onToggle={(column) => onToggle('system', column)}
          columnLabel={columnLabel}
        />
        <ColumnGroup
          title={t('admin.systemLogs.types.audit')}
          columns={AUDIT_COLUMNS}
          active={auditCols}
          onToggle={(column) => onToggle('audit', column)}
          columnLabel={columnLabel}
        />
        <ColumnGroup
          title={t('admin.systemLogs.types.error')}
          columns={ERROR_COLUMNS}
          active={errorCols}
          onToggle={(column) => onToggle('error', column)}
          columnLabel={columnLabel}
        />
        <ColumnGroup
          title={t('admin.systemLogs.types.llm')}
          columns={LLM_COLUMNS}
          active={llmCols}
          onToggle={(column) => onToggle('llm', column)}
          columnLabel={columnLabel}
        />
      </PopoverContent>
    </Popover>
  );
}

function ColumnGroup({ title, columns, active, onToggle, columnLabel }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-2">
        {columns.map((column) => (
          <Button
            key={column}
            size="sm"
            variant={active.includes(column) ? 'default' : 'outline'}
            onClick={() => onToggle(column)}
            className="h-8 text-xs"
          >
            {columnLabel(column)}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ActiveFilters({ parsed, onRemove, t }) {
  const entries = Object.entries(parsed.tokens || {}).filter(([, value]) => value && typeof value !== 'object');
  if (entries.length === 0 && !parsed.free) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center gap-1">
          <Badge variant="secondary" className="font-mono">
            {key}:{String(value)}
          </Badge>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground"
            onClick={() => onRemove(key)}
            aria-label={t('admin.systemLogs.activeFilters.remove', { key })}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
      {parsed.free && (
        <Badge variant="outline" className="font-mono">
          {parsed.free}
        </Badge>
      )}
    </div>
  );
}

function SystemLogSection({
  title,
  items,
  emptyText,
  columns,
  highlightIds,
  onDetail,
  onCopyReq,
  onRelated,
  columnLabel,
  t
}) {
  const useVirtual = items.length > 120;

  const header = (
    <thead className="bg-muted/60">
      <tr>
        {columns.includes('id') && <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{columnLabel('id')}</th>}
        {columns.includes('method') && <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{columnLabel('method')}</th>}
        {columns.includes('path') && <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{columnLabel('path')}</th>}
        {columns.includes('status_code') && <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{columnLabel('status_code')}</th>}
        {columns.includes('user_id') && <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{columnLabel('user_id')}</th>}
        {columns.includes('duration_ms') && <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{columnLabel('duration_ms')}</th>}
        {columns.includes('created_at') && <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{columnLabel('created_at')}</th>}
        {columns.includes('ops') && <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{columnLabel('ops')}</th>}
      </tr>
    </thead>
  );

  const renderRow = (log) => {
    const isHighlighted = highlightIds.has(log.id);
    return (
      <tr key={log.id} className={cn('border-b text-xs transition-colors hover:bg-muted/30', isHighlighted && 'bg-amber-50')}>
        {columns.includes('id') && <td className="px-3 py-2 font-medium">{log.id}</td>}
        {columns.includes('method') && <td className="px-3 py-2 uppercase">{log.method}</td>}
        {columns.includes('path') && (
          <td className="px-3 py-2">
            <span className="font-mono text-[11px]" title={log.path}>
              {log.path}
            </span>
          </td>
        )}
        {columns.includes('status_code') && <td className="px-3 py-2">{log.status_code}</td>}
        {columns.includes('user_id') && <td className="px-3 py-2">{log.user_id || '-'}</td>}
        {columns.includes('duration_ms') && <td className="px-3 py-2">{log.duration_ms}</td>}
        {columns.includes('created_at') && <td className="px-3 py-2 whitespace-nowrap">{log.created_at}</td>}
        {columns.includes('ops') && (
          <td className="px-3 py-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Button variant="link" className="h-auto p-0" onClick={() => onDetail(log.id)}>
                {t('admin.systemLogs.details')}
              </Button>
              <Button variant="link" className="h-auto p-0 text-muted-foreground" onClick={() => onCopyReq(log.request_id)}>
                {t('admin.systemLogs.copyReqId')}
              </Button>
              {log.request_id && (
                <Button variant="link" className="h-auto p-0 text-indigo-600" onClick={() => onRelated(log.request_id)}>
                  {t('admin.systemLogs.related')}
                </Button>
              )}
            </div>
          </td>
        )}
      </tr>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Badge variant="outline" className="text-xs">
            {t('admin.systemLogs.recordCount', { count: items.length })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-t text-xs">
            {header}
            {!useVirtual && (
              <tbody>
                {items.map((log) => renderRow(log))}
                {items.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-muted-foreground" colSpan={columns.length}>
                      {emptyText}
                    </td>
                  </tr>
                )}
              </tbody>
            )}
          </table>
          {useVirtual && (
            <List height={480} itemCount={items.length} itemSize={44} width="100%">
              {({ index, style }) => (
                <table key={items[index].id} style={{ ...style, width: '100%' }} className="table-fixed text-xs">
                  <tbody>{renderRow(items[index])}</tbody>
                </table>
              )}
            </List>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
function LogSection({ title, items, emptyText, renderItem, headers, columnLabel }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Badge variant="outline" className="text-xs">
            {items.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-t text-xs">
            <thead className="bg-muted/60">
              <tr>
                {headers.map((header) => (
                  <th
                    key={header}
                    className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground"
                  >
                    {columnLabel(header)}
                  </th>
                ))}
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground">
                  {columnLabel('ops')}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map(renderItem)}
              {items.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-muted-foreground" colSpan={headers.length + 1}>
                    {emptyText}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ExpandableRow({ summaryCells, detail, t }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className={cn('border-b', open && 'bg-muted/40')}>
        {summaryCells.map((cell, index) => (
          <td key={index} className="px-3 py-2 align-top">
            {cell}
          </td>
        ))}
        <td className="px-3 py-2 text-right">
          <Button
            variant="link"
            className="h-auto p-0 text-xs"
            onClick={() => setOpen((prev) => !prev)}
          >
            {open ? t('admin.systemLogs.actions.collapse') : t('admin.systemLogs.actions.expand')}
          </Button>
        </td>
      </tr>
      {open && (
        <tr className="border-b bg-muted/30">
          <td colSpan={summaryCells.length + 1} className="px-3 py-3">
            {detail}
          </td>
        </tr>
      )}
    </>
  );
}

function AuditDetail({ log, columnLabel }) {
  return (
    <div className="space-y-2 text-xs">
      <KeyVal label={columnLabel('id')} value={log.id} />
      <KeyVal label={columnLabel('action')} value={log.action} />
      <KeyVal label={columnLabel('operation_category')} value={log.operation_category || '-'} />
      <KeyVal label={columnLabel('actor_type')} value={log.actor_type} />
      <KeyVal label={columnLabel('status')} value={log.status} />
      {log.details_raw && (
        <JsonTreeBlock title="details_raw" value={safeParse(log.details_raw)} />
      )}
      {log.summary && <JsonTreeBlock title="summary" value={safeParse(log.summary)} />}
      {(log.old_data || log.new_data) && (
        <div className="space-y-1">
          <AuditDiffViewer oldData={log.old_data} newData={log.new_data} />
        </div>
      )}
    </div>
  );
}

function ErrorDetail({ log, columnLabel, onRelated, t }) {
  return (
    <div className="space-y-2 text-xs">
      <KeyVal label={columnLabel('id')} value={log.id} />
      <div className="flex flex-wrap items-center gap-2">
        <KeyVal label={columnLabel('request_id')} value={log.request_id || '-'} />
        {log.request_id && (
          <Button variant="link" className="h-auto p-0 text-xs" onClick={() => onRelated?.(log.request_id)}>
            {t('admin.systemLogs.related')}
          </Button>
        )}
      </div>
      <KeyVal label={columnLabel('error_type')} value={log.error_type} />
      <KeyVal label={columnLabel('error_file')} value={log.error_file} />
      <KeyVal label={columnLabel('error_line')} value={log.error_line} />
      <JsonTreeBlock title="message" value={safeParse(log.error_message)} />
      {log.stack_trace && (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-900 p-3 font-mono text-[11px] text-green-300">
          {log.stack_trace}
        </pre>
      )}
      {log.context_json && <JsonTreeBlock title="context" value={safeParse(log.context_json)} />}
    </div>
  );
}

function LlmDetail({ log, columnLabel, onRelated, t }) {
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <KeyVal label={columnLabel('request_id')} value={log.request_id || '-'} />
        {log.request_id && (
          <Button variant="link" className="h-auto p-0 text-xs" onClick={() => onRelated?.(log.request_id)}>
            {t('admin.systemLogs.related')}
          </Button>
        )}
      </div>
      <KeyVal label={columnLabel('actor_type')} value={log.actor_type} />
      <KeyVal label={columnLabel('actor_id')} value={log.actor_id || '-'} />
      <KeyVal label={columnLabel('source')} value={log.source || '-'} />
      <KeyVal label={columnLabel('model')} value={log.model || '-'} />
      <KeyVal label={columnLabel('llm_status')} value={log.status || '-'} />
      <KeyVal label={columnLabel('response_id')} value={log.response_id || '-'} />
      <KeyVal label={columnLabel('total_tokens')} value={log.total_tokens ?? '-'} />
      <KeyVal label={columnLabel('latency_ms')} value={log.latency_ms ?? '-'} />
      {log.prompt && <JsonTreeBlock title="prompt" value={safeParse(log.prompt)} />}
      {log.error_message && <JsonTreeBlock title="error_message" value={safeParse(log.error_message)} />}
    </div>
  );
}

function JsonSection({ title, value, onCopy, copyLabel }) {
  if (!value) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button variant="link" className="h-auto p-0 text-xs" onClick={() => onCopy(value)}>
          {copyLabel}
        </Button>
      </div>
      <JsonTreeViewer value={safeParse(value)} />
    </div>
  );
}

function JsonTreeBlock({ title, value }) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold text-muted-foreground">{title}</div>
      <JsonTreeViewer value={value} />
    </div>
  );
}

function KeyVal({ label, value, className }) {
  return (
    <div className={cn('space-x-2', className)}>
      <span className="font-semibold">{label}:</span>
      <span className="font-mono break-all text-xs">{String(value ?? '-')}</span>
    </div>
  );
}

function safeParse(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
}

function llmCell(log, column) {
  switch (column) {
    case 'id':
      return log.id;
    case 'actor_type':
      return log.actor_type;
    case 'actor_id':
      return log.actor_id ?? '-';
    case 'source':
      return log.source || '-';
    case 'model':
      return log.model || '-';
    case 'llm_status':
      return log.status || '-';
    case 'total_tokens':
      return log.total_tokens ?? '-';
    case 'latency_ms':
      return log.latency_ms ?? '-';
    case 'created_at':
      return log.created_at;
    default:
      return log[column] ?? '-';
  }
}

function mergeToken(previous, key, newValue) {
  // Use parseLogQuery to safely map shorthand keys to their canonical form,
  // then update the token and rebuild the query string.
  const parsed = parseLogQuery(previous || '');
  // Probe to determine the mapped key for the provided shorthand.
  // Use a sentinel when newValue is empty so parser still maps the shorthand.
  const probeValue = newValue !== undefined && newValue !== '' ? newValue : '__probe__';
  const probe = parseLogQuery(`${key}:${probeValue}`);
  const mappedKey = Object.keys(probe.tokens || {})[0] || key;

  if (newValue) {
    parsed.tokens = parsed.tokens || {};
    parsed.tokens[mappedKey] = newValue;
  } else {
    // remove the token when newValue is empty
    if (parsed.tokens) delete parsed.tokens[mappedKey];
  }

  // Rebuild the query string from tokens, ranges and free text
  const parts = [];
  Object.entries(parsed.tokens || {}).forEach(([k, v]) => {
    if (v && typeof v === 'object') {
      if (v.negate) parts.push(`${k}!=${v.value}`);
      else parts.push(`${k}:${v.value}`);
    } else {
      parts.push(`${k}:${v}`);
    }
  });
  Object.entries(parsed.ranges || {}).forEach(([k, ops]) => {
    Object.entries(ops).forEach(([op, val]) => {
      parts.push(`${k}${op}${val}`);
    });
  });
  if (parsed.free) parts.push(parsed.free);
  return parts.join(' ').trim();
}

function mergeRange(previous, key, operator, newValue) {
  // Update a comparison range (eg dur>500) by using parseLogQuery to map keys
  const parsed = parseLogQuery(previous || '');
  // When newValue is empty, use sentinel so parsing maps shorthand key to canonical key
  const probeValue = newValue !== undefined && newValue !== '' ? newValue : '__probe__';
  const probe = parseLogQuery(`${key}${operator}${probeValue}`);
  const mappedKey = Object.keys(probe.ranges || {})[0] || Object.keys(probe.tokens || {})[0] || key;

  parsed.ranges = parsed.ranges || {};
  if (!newValue) {
    // remove the specific operator if present
    if (parsed.ranges[mappedKey]) {
      delete parsed.ranges[mappedKey][operator];
      if (Object.keys(parsed.ranges[mappedKey]).length === 0) delete parsed.ranges[mappedKey];
    }
  } else {
    parsed.ranges[mappedKey] = parsed.ranges[mappedKey] || {};
    parsed.ranges[mappedKey][operator] = newValue;
  }

  // Rebuild string similar to mergeToken
  const parts = [];
  Object.entries(parsed.tokens || {}).forEach(([k, v]) => {
    if (v && typeof v === 'object') {
      if (v.negate) parts.push(`${k}!=${v.value}`);
      else parts.push(`${k}:${v.value}`);
    } else {
      parts.push(`${k}:${v}`);
    }
  });
  Object.entries(parsed.ranges || {}).forEach(([k, ops]) => {
    Object.entries(ops).forEach(([op, val]) => {
      parts.push(`${k}${op}${val}`);
    });
  });
  if (parsed.free) parts.push(parsed.free);
  return parts.join(' ').trim();
}

function setDurationUpper(previous, value) {
  return mergeRange(previous, 'dur', '<=', value);
}

function removeToken(previous, tokenKey) {
  const parsed = parseLogQuery(previous || '');
  // Use a probe value to map shorthand token key to canonical key
  const probe = parseLogQuery(`${tokenKey}:__probe__`);
  const mappedKey = Object.keys(probe.tokens || {})[0] || tokenKey;
  if (parsed.tokens) delete parsed.tokens[mappedKey];

  const parts = [];
  Object.entries(parsed.tokens || {}).forEach(([k, v]) => {
    if (v && typeof v === 'object') {
      if (v.negate) parts.push(`${k}!=${v.value}`);
      else parts.push(`${k}:${v.value}`);
    } else {
      parts.push(`${k}:${v}`);
    }
  });
  Object.entries(parsed.ranges || {}).forEach(([k, ops]) => {
    Object.entries(ops).forEach(([op, val]) => {
      parts.push(`${k}${op}${val}`);
    });
  });
  if (parsed.free) parts.push(parsed.free);
  return parts.join(' ').trim();
}
