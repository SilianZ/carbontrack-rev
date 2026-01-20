import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import JsonTreeViewer from './JsonTreeViewer';
import AuditDiffViewer from './AuditDiffViewer';
import { fetchSystemLogDetail } from '../../lib/api/systemLogs';
import { adminAPI } from '../../lib/api';

export function RequestIdRelatedDrawer({
  open,
  onClose,
  requestId,
  data,
  loading,
  onRefresh,
  system,
  audit,
  error,
  llm
}) {
  const { t } = useTranslation();
  const [systemDetails, setSystemDetails] = useState({});
  const [llmDetails, setLlmDetails] = useState({});
  const [detailLoading, setDetailLoading] = useState({ system: {}, llm: {} });
  const [detailErrors, setDetailErrors] = useState({ system: {}, llm: {} });

  useEffect(() => {
    setSystemDetails({});
    setLlmDetails({});
    setDetailLoading({ system: {}, llm: {} });
    setDetailErrors({ system: {}, llm: {} });
  }, [requestId]);

  const setLoadingFlag = useCallback((type, id, value) => {
    setDetailLoading((prev) => {
      const nextType = { ...(prev[type] || {}) };
      if (value) {
        nextType[id] = true;
      } else {
        delete nextType[id];
      }
      return { ...prev, [type]: nextType };
    });
  }, []);

  const setErrorFlag = useCallback((type, id, message) => {
    setDetailErrors((prev) => {
      const nextType = { ...(prev[type] || {}) };
      if (message) {
        nextType[id] = message;
      } else {
        delete nextType[id];
      }
      return { ...prev, [type]: nextType };
    });
  }, []);

  const loadSystemDetail = useCallback(async (id) => {
    if (!id || systemDetails[id] || detailLoading.system[id]) return;
    setLoadingFlag('system', id, true);
    setErrorFlag('system', id, null);
    try {
      const response = await fetchSystemLogDetail(id);
      const payload = response?.data || response;
      const detail = payload?.data || payload;
      setSystemDetails((prev) => ({ ...prev, [id]: detail }));
    } catch (err) {
      setErrorFlag('system', id, err?.message || t('errors.loadFailed'));
    } finally {
      setLoadingFlag('system', id, false);
    }
  }, [detailLoading.system, setErrorFlag, setLoadingFlag, systemDetails, t]);

  const loadLlmDetail = useCallback(async (id) => {
    if (!id || llmDetails[id] || detailLoading.llm[id]) return;
    setLoadingFlag('llm', id, true);
    setErrorFlag('llm', id, null);
    try {
      const response = await adminAPI.getLlmLogDetail(id);
      const payload = response?.data || response;
      const detail = payload?.data || payload;
      setLlmDetails((prev) => ({ ...prev, [id]: detail }));
    } catch (err) {
      setErrorFlag('llm', id, err?.message || t('errors.loadFailed'));
    } finally {
      setLoadingFlag('llm', id, false);
    }
  }, [detailLoading.llm, llmDetails, setErrorFlag, setLoadingFlag, t]);

  if (!open) return null;

  const resolved = data ?? { system, audit, error, llm };
  const systemLogs = resolved?.system || [];
  const auditLogs = resolved?.audit || [];
  const errorLogs = resolved?.error || [];
  const llmLogs = resolved?.llm || [];

  const columnLabel = (key) => t(`admin.systemLogs.columns.${key}`, { defaultValue: key });

  const renderEmpty = () => (
    <div className="text-xs text-muted-foreground">{t('common.none')}</div>
  );

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="flex h-full w-full max-w-3xl flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">
            {t('admin.systemLogs.drawer.title', { id: requestId })}
          </h2>
          <div className="flex items-center gap-2">
            <button className="text-sm text-blue-600" onClick={onRefresh}>
              {t('admin.systemLogs.drawer.refresh')}
            </button>
            <button className="text-gray-500" onClick={onClose} aria-label={t('common.close')}>
              &times;
            </button>
          </div>
        </div>
        <div className="flex-1 space-y-6 overflow-auto p-4 text-sm">
          {loading && <div>{t('admin.systemLogs.drawer.loading')}</div>}
          {!loading && (
            <>
              <Section title={t('admin.systemLogs.drawer.systemTitle', { count: systemLogs.length })}>
                {systemLogs.length === 0 && renderEmpty()}
                {systemLogs.map((log) => {
                  const detail = systemDetails[log.id];
                  const isLoading = detailLoading.system[log.id];
                  const errorMessage = detailErrors.system[log.id];
                  const detailData = detail || log;
                  return (
                    <ExpandableItem
                      key={`system-${log.id}`}
                      toneClass="bg-gray-50"
                      summary={(
                        <>
                          <KV label={columnLabel('id')} value={log.id} />
                          <KV label={columnLabel('method')} value={log.method} />
                          <KV label={columnLabel('path')} value={log.path} />
                          <KV label={columnLabel('status_code')} value={log.status_code} />
                          <KV label={columnLabel('duration_ms')} value={log.duration_ms} />
                          <KV label={columnLabel('created_at')} value={log.created_at} />
                        </>
                      )}
                      onOpen={() => loadSystemDetail(log.id)}
                      openLabel={t('admin.systemLogs.actions.expand')}
                      closeLabel={t('admin.systemLogs.actions.collapse')}
                      detail={(
                        <div className="space-y-3 text-xs">
                          <DetailGrid
                            items={[
                              { label: columnLabel('request_id'), value: detailData.request_id || requestId },
                              { label: columnLabel('method'), value: detailData.method },
                              { label: columnLabel('path'), value: detailData.path, span: true },
                              { label: columnLabel('status_code'), value: detailData.status_code },
                              { label: columnLabel('user_id'), value: detailData.user_id ?? '-' },
                              { label: columnLabel('duration_ms'), value: detailData.duration_ms ?? '-' },
                              { label: columnLabel('ip_address'), value: detailData.ip_address ?? '-' },
                              { label: columnLabel('created_at'), value: detailData.created_at ?? '-' },
                              { label: columnLabel('user_agent'), value: detailData.user_agent ?? '-', span: true }
                            ]}
                          />
                          {isLoading && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              {t('common.loading')}
                            </div>
                          )}
                          {errorMessage && (
                            <div className="text-xs text-rose-600">{errorMessage}</div>
                          )}
                          {detail && (
                            <>
                              <DetailValueBlock title={t('admin.systemLogs.requestBody')} value={detail.request_body} />
                              <DetailValueBlock title={t('admin.systemLogs.responseBody')} value={detail.response_body} />
                              <DetailValueBlock title={t('admin.systemLogs.serverMeta')} value={detail.server_meta} />
                            </>
                          )}
                        </div>
                      )}
                    />
                  );
                })}
              </Section>

              <Section title={t('admin.systemLogs.drawer.auditTitle', { count: auditLogs.length })}>
                {auditLogs.length === 0 && renderEmpty()}
                {auditLogs.map((log) => (
                  <ExpandableItem
                    key={`audit-${log.id}`}
                    toneClass="bg-gray-50"
                    summary={(
                      <>
                        <KV label={columnLabel('id')} value={log.id} />
                        <KV label={columnLabel('action')} value={log.action} />
                        <KV label={columnLabel('operation_category')} value={log.operation_category} />
                        <KV label={columnLabel('actor_type')} value={log.actor_type} />
                        <KV label={columnLabel('status')} value={log.status} />
                        <KV label={columnLabel('created_at')} value={log.created_at} />
                      </>
                    )}
                    openLabel={t('admin.systemLogs.actions.expand')}
                    closeLabel={t('admin.systemLogs.actions.collapse')}
                    detail={(
                      <div className="space-y-3 text-xs">
                        <DetailGrid
                          items={[
                            { label: columnLabel('id'), value: log.id },
                            { label: columnLabel('action'), value: log.action },
                            { label: columnLabel('operation_category'), value: log.operation_category || '-' },
                            { label: columnLabel('actor_type'), value: log.actor_type },
                            { label: columnLabel('status'), value: log.status },
                            { label: columnLabel('user_id'), value: log.user_id ?? '-' },
                            { label: columnLabel('ip_address'), value: log.ip_address ?? '-' },
                            { label: columnLabel('created_at'), value: log.created_at }
                          ]}
                        />
                        {(log.old_data || log.new_data) && (
                          <AuditDiffViewer oldData={log.old_data} newData={log.new_data} />
                        )}
                        {log.data && (
                          <DetailValueBlock title={t('admin.audit.requestData')} value={log.data} />
                        )}
                      </div>
                    )}
                  />
                ))}
              </Section>

              <Section title={t('admin.systemLogs.drawer.errorsTitle', { count: errorLogs.length })}>
                {errorLogs.length === 0 && renderEmpty()}
                {errorLogs.map((log) => (
                  <ExpandableItem
                    key={`error-${log.id}`}
                    toneClass="bg-rose-50/60"
                    summary={(
                      <>
                        <KV label={columnLabel('error_type')} value={log.error_type} />
                        <KV label={columnLabel('error_file')} value={log.error_file} />
                        <KV label={columnLabel('error_line')} value={log.error_line} />
                        <KV label={columnLabel('error_time')} value={log.error_time} />
                      </>
                    )}
                    openLabel={t('admin.systemLogs.actions.expand')}
                    closeLabel={t('admin.systemLogs.actions.collapse')}
                    detail={(
                      <div className="space-y-3 text-xs">
                        <DetailGrid
                          items={[
                            { label: columnLabel('error_type'), value: log.error_type },
                            { label: columnLabel('error_file'), value: log.error_file },
                            { label: columnLabel('error_line'), value: log.error_line },
                            { label: columnLabel('error_time'), value: log.error_time }
                          ]}
                        />
                        {log.error_message && (
                          <DetailTextBlock
                            title={columnLabel('error_message')}
                            value={log.error_message}
                            toneClass="bg-rose-50 text-rose-700"
                          />
                        )}
                      </div>
                    )}
                  />
                ))}
              </Section>

              <Section title={t('admin.systemLogs.drawer.llmTitle', { count: llmLogs.length })}>
                {llmLogs.length === 0 && renderEmpty()}
                {llmLogs.map((log) => {
                  const detail = llmDetails[log.id];
                  const isLoading = detailLoading.llm[log.id];
                  const errorMessage = detailErrors.llm[log.id];
                  const detailData = detail || log;
                  return (
                    <ExpandableItem
                      key={`llm-${log.id}`}
                      toneClass="bg-indigo-50/60"
                      summary={(
                        <>
                          <KV label={columnLabel('actor_type')} value={log.actor_type} />
                          <KV label={columnLabel('actor_id')} value={log.actor_id} />
                          <KV label={columnLabel('model')} value={log.model} />
                          <KV label={columnLabel('llm_status')} value={log.status} />
                          <KV label={columnLabel('total_tokens')} value={log.total_tokens} />
                          <KV label={columnLabel('latency_ms')} value={log.latency_ms} />
                          <KV label={columnLabel('created_at')} value={log.created_at} />
                        </>
                      )}
                      onOpen={() => loadLlmDetail(log.id)}
                      openLabel={t('admin.systemLogs.actions.expand')}
                      closeLabel={t('admin.systemLogs.actions.collapse')}
                      detail={(
                        <div className="space-y-3 text-xs">
                          <DetailGrid
                            items={[
                              { label: columnLabel('request_id'), value: detailData.request_id || requestId },
                              { label: columnLabel('actor_type'), value: detailData.actor_type },
                              { label: columnLabel('actor_id'), value: detailData.actor_id ?? '-' },
                              { label: columnLabel('source'), value: detailData.source || '-' },
                              { label: columnLabel('model'), value: detailData.model || '-' },
                              { label: columnLabel('llm_status'), value: detailData.status || '-' },
                              { label: columnLabel('response_id'), value: detailData.response_id || '-' },
                              { label: columnLabel('total_tokens'), value: detailData.total_tokens ?? '-' },
                              { label: columnLabel('latency_ms'), value: detailData.latency_ms ?? '-' },
                              { label: columnLabel('created_at'), value: detailData.created_at ?? '-' }
                            ]}
                          />
                          {isLoading && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              {t('common.loading')}
                            </div>
                          )}
                          {errorMessage && (
                            <div className="text-xs text-rose-600">{errorMessage}</div>
                          )}
                          <DetailValueBlock
                            title={t('admin.llmUsage.logs.prompt')}
                            value={detail?.prompt ?? log.prompt}
                          />
                          {detail?.response_raw && (
                            <DetailValueBlock
                              title={t('admin.llmUsage.logs.response')}
                              value={detail.response_raw}
                            />
                          )}
                          {(detail?.error_message || log.error_message) && (
                            <DetailTextBlock
                              title={t('admin.llmUsage.logs.error')}
                              value={detail?.error_message || log.error_message}
                              toneClass="bg-rose-50 text-rose-700"
                            />
                          )}
                          {detail?.usage && (
                            <DetailValueBlock title="usage" value={detail.usage} />
                          )}
                          {detail?.context && (
                            <DetailValueBlock title="context" value={detail.context} />
                          )}
                        </div>
                      )}
                    />
                  );
                })}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="mb-2 font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function ExpandableItem({ summary, detail, openLabel, closeLabel, onOpen, toneClass }) {
  const [open, setOpen] = useState(false);
  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) onOpen?.();
      return next;
    });
  };

  return (
    <div className={`mb-2 rounded border p-2 ${toneClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">{summary}</div>
        <button
          type="button"
          className="text-[11px] text-blue-600"
          onClick={toggleOpen}
          aria-expanded={open}
        >
          {open ? closeLabel : openLabel}
        </button>
      </div>
      {open && (
        <div className="mt-2 border-t pt-2">
          {detail}
        </div>
      )}
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div>
      <span className="mr-1 text-muted-foreground">{label}:</span>
      <span className="font-mono">{String(value ?? '-')}</span>
    </div>
  );
}

function DetailGrid({ items }) {
  return (
    <div className="grid gap-2 text-[11px] md:grid-cols-2">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className={item.span ? 'md:col-span-2' : ''}>
          <KV label={item.label} value={item.value} />
        </div>
      ))}
    </div>
  );
}

function DetailBlock({ title, children }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function DetailValueBlock({ title, value }) {
  if (value == null || value === '') return null;
  return (
    <DetailBlock title={title}>
      <DetailValue value={value} />
    </DetailBlock>
  );
}

function DetailTextBlock({ title, value, toneClass }) {
  if (value == null || value === '') return null;
  return (
    <DetailBlock title={title}>
      <pre className={`max-h-64 overflow-auto whitespace-pre-wrap rounded p-3 text-[11px] ${toneClass}`}>
        {String(value)}
      </pre>
    </DetailBlock>
  );
}

function DetailValue({ value }) {
  if (value == null || value === '') return null;
  const parsed = parseMaybeJson(value);
  if (typeof parsed === 'string') {
    return (
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-900 p-3 text-[11px] text-green-200">
        {parsed}
      </pre>
    );
  }
  return <JsonTreeViewer value={parsed} collapsed maxHeight="18rem" />;
}

function parseMaybeJson(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
}

RequestIdRelatedDrawer.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  requestId: PropTypes.string,
  data: PropTypes.object,
  loading: PropTypes.bool,
  onRefresh: PropTypes.func,
  system: PropTypes.array,
  audit: PropTypes.array,
  error: PropTypes.array,
  llm: PropTypes.array
};

Section.propTypes = {
  title: PropTypes.node,
  children: PropTypes.node
};

ExpandableItem.propTypes = {
  summary: PropTypes.node,
  detail: PropTypes.node,
  openLabel: PropTypes.node,
  closeLabel: PropTypes.node,
  onOpen: PropTypes.func,
  toneClass: PropTypes.string
};

KV.propTypes = {
  label: PropTypes.node,
  value: PropTypes.any
};

DetailGrid.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.node,
    value: PropTypes.any,
    span: PropTypes.bool
  }))
};

DetailBlock.propTypes = {
  title: PropTypes.node,
  children: PropTypes.node
};

DetailValueBlock.propTypes = {
  title: PropTypes.node,
  value: PropTypes.any
};

DetailTextBlock.propTypes = {
  title: PropTypes.node,
  value: PropTypes.any,
  toneClass: PropTypes.string
};

DetailValue.propTypes = {
  value: PropTypes.any
};

export default RequestIdRelatedDrawer;
