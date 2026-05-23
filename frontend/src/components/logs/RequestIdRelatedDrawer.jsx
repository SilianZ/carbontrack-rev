import Silian_React, { useCallback as Silian_useCallback, useEffect as Silian_useEffect, useState as Silian_useState } from 'react';
import Silian_PropTypes from 'prop-types';
import { Loader2 as Silian_Loader2 } from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import Silian_JsonTreeViewer from './JsonTreeViewer';
import Silian_AuditDiffViewer from './AuditDiffViewer';
import { fetchSystemLogDetail as Silian_fetchSystemLogDetail } from '../../lib/api/systemLogs';
import { adminAPI as Silian_adminAPI } from '../../lib/api';

export function RequestIdRelatedDrawer({
  open: Silian_open,
  onClose: Silian_onClose,
  requestId: Silian_requestId,
  data: Silian_data,
  loading: Silian_loading,
  onRefresh: Silian_onRefresh,
  system: Silian_system,
  audit: Silian_audit,
  error: Silian_error,
  llm: Silian_llm
}) {
  const { t: Silian_t } = Silian_useTranslation(['admin', 'common', 'errors']);
  const [Silian_systemDetails, Silian_setSystemDetails] = Silian_useState({});
  const [Silian_llmDetails, Silian_setLlmDetails] = Silian_useState({});
  const [Silian_detailLoading, Silian_setDetailLoading] = Silian_useState({ system: {}, llm: {} });
  const [Silian_detailErrors, Silian_setDetailErrors] = Silian_useState({ system: {}, llm: {} });

  Silian_useEffect(() => {
    Silian_setSystemDetails({});
    Silian_setLlmDetails({});
    Silian_setDetailLoading({ system: {}, llm: {} });
    Silian_setDetailErrors({ system: {}, llm: {} });
  }, [Silian_requestId]);

  const Silian_setLoadingFlag = Silian_useCallback((Silian_type, Silian_id, Silian_value) => {
    Silian_setDetailLoading((Silian_prev) => {
      const Silian_nextType = { ...Silian_prev[Silian_type] };
      if (Silian_value) {
        Silian_nextType[Silian_id] = true;
      } else {
        delete Silian_nextType[Silian_id];
      }
      return { ...Silian_prev, [Silian_type]: Silian_nextType };
    });
  }, []);

  const Silian_setErrorFlag = Silian_useCallback((Silian_type, Silian_id, Silian_message) => {
    Silian_setDetailErrors((Silian_prev) => {
      const Silian_nextType = { ...Silian_prev[Silian_type] };
      if (Silian_message) {
        Silian_nextType[Silian_id] = Silian_message;
      } else {
        delete Silian_nextType[Silian_id];
      }
      return { ...Silian_prev, [Silian_type]: Silian_nextType };
    });
  }, []);

  const Silian_loadSystemDetail = Silian_useCallback(async (Silian_id) => {
    if (!Silian_id || Silian_systemDetails[Silian_id] || Silian_detailLoading.system[Silian_id]) return;
    Silian_setLoadingFlag('system', Silian_id, true);
    Silian_setErrorFlag('system', Silian_id, null);
    try {
      const Silian_response = await Silian_fetchSystemLogDetail(Silian_id);
      const Silian_payload = Silian_response?.data || Silian_response;
      const Silian_detail = Silian_payload?.data || Silian_payload;
      Silian_setSystemDetails((Silian_prev) => ({ ...Silian_prev, [Silian_id]: Silian_detail }));
    } catch (Silian_err) {
      Silian_setErrorFlag('system', Silian_id, Silian_err?.message || Silian_t('errors.loadFailed'));
    } finally {
      Silian_setLoadingFlag('system', Silian_id, false);
    }
  }, [Silian_detailLoading.system, Silian_setErrorFlag, Silian_setLoadingFlag, Silian_systemDetails, Silian_t]);

  const Silian_loadLlmDetail = Silian_useCallback(async (Silian_id) => {
    if (!Silian_id || Silian_llmDetails[Silian_id] || Silian_detailLoading.llm[Silian_id]) return;
    Silian_setLoadingFlag('llm', Silian_id, true);
    Silian_setErrorFlag('llm', Silian_id, null);
    try {
      const Silian_response = await Silian_adminAPI.getLlmLogDetail(Silian_id);
      const Silian_payload = Silian_response?.data || Silian_response;
      const Silian_detail = Silian_payload?.data || Silian_payload;
      Silian_setLlmDetails((Silian_prev) => ({ ...Silian_prev, [Silian_id]: Silian_detail }));
    } catch (Silian_err) {
      Silian_setErrorFlag('llm', Silian_id, Silian_err?.message || Silian_t('errors.loadFailed'));
    } finally {
      Silian_setLoadingFlag('llm', Silian_id, false);
    }
  }, [Silian_detailLoading.llm, Silian_llmDetails, Silian_setErrorFlag, Silian_setLoadingFlag, Silian_t]);

  if (!Silian_open) return null;

  const Silian_resolved = Silian_data ?? { system: Silian_system, audit: Silian_audit, error: Silian_error, llm: Silian_llm };
  const Silian_systemLogs = Silian_resolved?.system || [];
  const Silian_auditLogs = Silian_resolved?.audit || [];
  const Silian_errorLogs = Silian_resolved?.error || [];
  const Silian_llmLogs = Silian_resolved?.llm || [];

  const Silian_columnLabel = (Silian_key) => Silian_t(`admin.systemLogs.columns.${Silian_key}`, { defaultValue: Silian_key });

  const Silian_renderEmpty = () => (
    <div className="text-xs text-muted-foreground">{Silian_t('common.none')}</div>
  );

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        className="flex-1 bg-black/40"
        onClick={Silian_onClose}
        aria-label={Silian_t('common.close')}
      />
      <div className="flex h-full w-full max-w-3xl flex-col border-l border-border bg-background text-foreground shadow-xl">
        <div className="flex items-center justify-between border-b border-border bg-background/95 p-4 backdrop-blur">
          <h2 className="text-lg font-semibold">
            {Silian_t('admin.systemLogs.drawer.title', { id: Silian_requestId })}
          </h2>
          <div className="flex items-center gap-2">
            <button type="button" className="text-sm text-primary transition-colors hover:text-primary/80" onClick={Silian_onRefresh}>
              {Silian_t('admin.systemLogs.drawer.refresh')}
            </button>
            <button
              type="button"
              className="text-lg leading-none text-muted-foreground transition-colors hover:text-foreground"
              onClick={Silian_onClose}
              aria-label={Silian_t('common.close')}
            >
              &times;
            </button>
          </div>
        </div>
        <div className="flex-1 space-y-6 overflow-auto p-4 text-sm">
          {Silian_loading && <div className="text-muted-foreground">{Silian_t('admin.systemLogs.drawer.loading')}</div>}
          {!Silian_loading && (
            <>
              <Silian_Section title={Silian_t('admin.systemLogs.drawer.systemTitle', { count: Silian_systemLogs.length })}>
                {Silian_systemLogs.length === 0 && Silian_renderEmpty()}
                {Silian_systemLogs.map((Silian_log) => {
                  const Silian_detail = Silian_systemDetails[Silian_log.id];
                  const Silian_isLoading = Silian_detailLoading.system[Silian_log.id];
                  const Silian_errorMessage = Silian_detailErrors.system[Silian_log.id];
                  const Silian_detailData = Silian_detail || Silian_log;
                  return (
                    <Silian_ExpandableItem
                      key={`system-${Silian_log.id}`}
                      toneClass="border-border bg-muted/40"
                      summary={(
                        <>
                          <Silian_KeyValueItem label={Silian_columnLabel('id')} value={Silian_log.id} />
                          <Silian_KeyValueItem label={Silian_columnLabel('method')} value={Silian_log.method} />
                          <Silian_KeyValueItem label={Silian_columnLabel('path')} value={Silian_log.path} />
                          <Silian_KeyValueItem label={Silian_columnLabel('status_code')} value={Silian_log.status_code} />
                          <Silian_KeyValueItem label={Silian_columnLabel('duration_ms')} value={Silian_log.duration_ms} />
                          <Silian_KeyValueItem label={Silian_columnLabel('created_at')} value={Silian_log.created_at} />
                        </>
                      )}
                      onOpen={() => Silian_loadSystemDetail(Silian_log.id)}
                      openLabel={Silian_t('admin.systemLogs.actions.expand')}
                      closeLabel={Silian_t('admin.systemLogs.actions.collapse')}
                      detail={(
                        <div className="space-y-3 text-xs">
                          <Silian_DetailGrid
                            items={[
                              { label: Silian_columnLabel('request_id'), value: Silian_detailData.request_id || Silian_requestId },
                              { label: Silian_columnLabel('method'), value: Silian_detailData.method },
                              { label: Silian_columnLabel('path'), value: Silian_detailData.path, span: true },
                              { label: Silian_columnLabel('status_code'), value: Silian_detailData.status_code },
                              { label: Silian_columnLabel('user_id'), value: Silian_detailData.user_id ?? '-' },
                              { label: Silian_columnLabel('duration_ms'), value: Silian_detailData.duration_ms ?? '-' },
                              { label: Silian_columnLabel('ip_address'), value: Silian_detailData.ip_address ?? '-' },
                              { label: Silian_columnLabel('created_at'), value: Silian_detailData.created_at ?? '-' },
                              { label: Silian_columnLabel('user_agent'), value: Silian_detailData.user_agent ?? '-', span: true }
                            ]}
                          />
                          {Silian_isLoading && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Silian_Loader2 className="h-3.5 w-3.5 animate-spin" />
                              {Silian_t('common.loading')}
                            </div>
                          )}
                          {Silian_errorMessage && (
                            <div className="text-xs text-rose-600">{Silian_errorMessage}</div>
                          )}
                          {Silian_detail && (
                            <>
                              <Silian_DetailValueBlock title={Silian_t('admin.systemLogs.requestBody')} value={Silian_detail.request_body} />
                              <Silian_DetailValueBlock title={Silian_t('admin.systemLogs.responseBody')} value={Silian_detail.response_body} />
                              <Silian_DetailValueBlock title={Silian_t('admin.systemLogs.serverMeta')} value={Silian_detail.server_meta} />
                            </>
                          )}
                        </div>
                      )}
                    />
                  );
                })}
              </Silian_Section>

              <Silian_Section title={Silian_t('admin.systemLogs.drawer.auditTitle', { count: Silian_auditLogs.length })}>
                {Silian_auditLogs.length === 0 && Silian_renderEmpty()}
                {Silian_auditLogs.map((Silian_log) => (
                  <Silian_ExpandableItem
                    key={`audit-${Silian_log.id}`}
                    toneClass="border-border bg-muted/40"
                    summary={(
                      <>
                        <Silian_KeyValueItem label={Silian_columnLabel('id')} value={Silian_log.id} />
                        <Silian_KeyValueItem label={Silian_columnLabel('action')} value={Silian_log.action} />
                        <Silian_KeyValueItem label={Silian_columnLabel('operation_category')} value={Silian_log.operation_category} />
                        <Silian_KeyValueItem label={Silian_columnLabel('actor_type')} value={Silian_log.actor_type} />
                        <Silian_KeyValueItem label={Silian_columnLabel('status')} value={Silian_log.status} />
                        <Silian_KeyValueItem label={Silian_columnLabel('created_at')} value={Silian_log.created_at} />
                      </>
                    )}
                    openLabel={Silian_t('admin.systemLogs.actions.expand')}
                    closeLabel={Silian_t('admin.systemLogs.actions.collapse')}
                    detail={(
                      <div className="space-y-3 text-xs">
                        <Silian_DetailGrid
                          items={[
                            { label: Silian_columnLabel('id'), value: Silian_log.id },
                            { label: Silian_columnLabel('action'), value: Silian_log.action },
                            { label: Silian_columnLabel('operation_category'), value: Silian_log.operation_category || '-' },
                            { label: Silian_columnLabel('actor_type'), value: Silian_log.actor_type },
                            { label: Silian_columnLabel('status'), value: Silian_log.status },
                            { label: Silian_columnLabel('user_id'), value: Silian_log.user_id ?? '-' },
                            { label: Silian_columnLabel('ip_address'), value: Silian_log.ip_address ?? '-' },
                            { label: Silian_columnLabel('created_at'), value: Silian_log.created_at }
                          ]}
                        />
                        {(Silian_log.old_data || Silian_log.new_data) && (
                          <Silian_AuditDiffViewer oldData={Silian_log.old_data} newData={Silian_log.new_data} />
                        )}
                        {Silian_log.data && (
                          <Silian_DetailValueBlock title={Silian_t('admin.audit.requestData')} value={Silian_log.data} />
                        )}
                      </div>
                    )}
                  />
                ))}
              </Silian_Section>

              <Silian_Section title={Silian_t('admin.systemLogs.drawer.errorsTitle', { count: Silian_errorLogs.length })}>
                {Silian_errorLogs.length === 0 && Silian_renderEmpty()}
                {Silian_errorLogs.map((Silian_log) => (
                  <Silian_ExpandableItem
                    key={`error-${Silian_log.id}`}
                    toneClass="border-rose-500/20 bg-rose-500/10"
                    summary={(
                      <>
                        <Silian_KeyValueItem label={Silian_columnLabel('request_id')} value={Silian_log.request_id || Silian_requestId} />
                        <Silian_KeyValueItem label={Silian_columnLabel('error_type')} value={Silian_log.error_type} />
                        <Silian_KeyValueItem label={Silian_columnLabel('error_file')} value={Silian_log.error_file} />
                        <Silian_KeyValueItem label={Silian_columnLabel('error_line')} value={Silian_log.error_line} />
                        <Silian_KeyValueItem label={Silian_columnLabel('error_time')} value={Silian_log.error_time} />
                      </>
                    )}
                    openLabel={Silian_t('admin.systemLogs.actions.expand')}
                    closeLabel={Silian_t('admin.systemLogs.actions.collapse')}
                    detail={(
                      <div className="space-y-3 text-xs">
                        <Silian_DetailGrid
                          items={[
                            { label: Silian_columnLabel('request_id'), value: Silian_log.request_id || Silian_requestId },
                            { label: Silian_columnLabel('error_type'), value: Silian_log.error_type },
                            { label: Silian_columnLabel('error_file'), value: Silian_log.error_file },
                            { label: Silian_columnLabel('error_line'), value: Silian_log.error_line },
                            { label: Silian_columnLabel('error_time'), value: Silian_log.error_time }
                          ]}
                        />
                        {Silian_log.error_message && (
                          <Silian_DetailTextBlock
                            title={Silian_columnLabel('error_message')}
                            value={Silian_log.error_message}
                            toneClass="border border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                          />
                        )}
                      </div>
                    )}
                  />
                ))}
              </Silian_Section>

              <Silian_Section title={Silian_t('admin.systemLogs.drawer.llmTitle', { count: Silian_llmLogs.length })}>
                {Silian_llmLogs.length === 0 && Silian_renderEmpty()}
                {Silian_llmLogs.map((Silian_log) => {
                  const Silian_detail = Silian_llmDetails[Silian_log.id];
                  const Silian_isLoading = Silian_detailLoading.llm[Silian_log.id];
                  const Silian_errorMessage = Silian_detailErrors.llm[Silian_log.id];
                  const Silian_detailData = Silian_detail || Silian_log;
                  return (
                    <Silian_ExpandableItem
                      key={`llm-${Silian_log.id}`}
                      toneClass="border-indigo-500/20 bg-indigo-500/10"
                      summary={(
                        <>
                          <Silian_KeyValueItem label={Silian_columnLabel('actor_type')} value={Silian_log.actor_type} />
                          <Silian_KeyValueItem label={Silian_columnLabel('actor_id')} value={Silian_log.actor_id} />
                          <Silian_KeyValueItem label={Silian_columnLabel('model')} value={Silian_log.model} />
                          <Silian_KeyValueItem label={Silian_columnLabel('llm_status')} value={Silian_log.status} />
                          <Silian_KeyValueItem label={Silian_columnLabel('total_tokens')} value={Silian_log.total_tokens} />
                          <Silian_KeyValueItem label={Silian_columnLabel('latency_ms')} value={Silian_log.latency_ms} />
                          <Silian_KeyValueItem label={Silian_columnLabel('created_at')} value={Silian_log.created_at} />
                        </>
                      )}
                      onOpen={() => Silian_loadLlmDetail(Silian_log.id)}
                      openLabel={Silian_t('admin.systemLogs.actions.expand')}
                      closeLabel={Silian_t('admin.systemLogs.actions.collapse')}
                      detail={(
                        <div className="space-y-3 text-xs">
                          <Silian_DetailGrid
                            items={[
                              { label: Silian_columnLabel('request_id'), value: Silian_detailData.request_id || Silian_requestId },
                              { label: Silian_columnLabel('actor_type'), value: Silian_detailData.actor_type },
                              { label: Silian_columnLabel('actor_id'), value: Silian_detailData.actor_id ?? '-' },
                              { label: Silian_columnLabel('source'), value: Silian_detailData.source || '-' },
                              { label: Silian_columnLabel('model'), value: Silian_detailData.model || '-' },
                              { label: Silian_columnLabel('llm_status'), value: Silian_detailData.status || '-' },
                              { label: Silian_columnLabel('response_id'), value: Silian_detailData.response_id || '-' },
                              { label: Silian_columnLabel('total_tokens'), value: Silian_detailData.total_tokens ?? '-' },
                              { label: Silian_columnLabel('latency_ms'), value: Silian_detailData.latency_ms ?? '-' },
                              { label: Silian_columnLabel('created_at'), value: Silian_detailData.created_at ?? '-' }
                            ]}
                          />
                          {Silian_isLoading && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Silian_Loader2 className="h-3.5 w-3.5 animate-spin" />
                              {Silian_t('common.loading')}
                            </div>
                          )}
                          {Silian_errorMessage && (
                            <div className="text-xs text-rose-600">{Silian_errorMessage}</div>
                          )}
                          <Silian_DetailValueBlock
                            title={Silian_t('admin.llmUsage.logs.prompt')}
                            value={Silian_detail?.prompt ?? Silian_log.prompt}
                          />
                          {Silian_detail?.response_raw && (
                            <Silian_DetailValueBlock
                              title={Silian_t('admin.llmUsage.logs.response')}
                              value={Silian_detail.response_raw}
                            />
                          )}
                          {(Silian_detail?.error_message || Silian_log.error_message) && (
                            <Silian_DetailTextBlock
                              title={Silian_t('admin.llmUsage.logs.error')}
                              value={Silian_detail?.error_message || Silian_log.error_message}
                              toneClass="border border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                            />
                          )}
                          {Silian_detail?.usage && (
                            <Silian_DetailValueBlock title="usage" value={Silian_detail.usage} />
                          )}
                          {Silian_detail?.context && (
                            <Silian_DetailValueBlock title="context" value={Silian_detail.context} />
                          )}
                        </div>
                      )}
                    />
                  );
                })}
              </Silian_Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Silian_Section({ title: Silian_title, children: Silian_children }) {
  return (
    <div>
      <h3 className="mb-2 font-semibold">{Silian_title}</h3>
      {Silian_children}
    </div>
  );
}

function Silian_ExpandableItem({ summary: Silian_summary, detail: Silian_detail, openLabel: Silian_openLabel, closeLabel: Silian_closeLabel, onOpen: Silian_onOpen, toneClass: Silian_toneClass }) {
  const [Silian_open, Silian_setOpen] = Silian_useState(false);
  const Silian_toggleOpen = () => {
    Silian_setOpen((Silian_prev) => {
      const Silian_next = !Silian_prev;
      if (Silian_next) Silian_onOpen?.();
      return Silian_next;
    });
  };

  return (
    <div className={`mb-2 rounded-lg border p-3 ${Silian_toneClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">{Silian_summary}</div>
        <button
          type="button"
          className="text-[11px] text-primary transition-colors hover:text-primary/80"
          onClick={Silian_toggleOpen}
          aria-expanded={Silian_open}
        >
          {Silian_open ? Silian_closeLabel : Silian_openLabel}
        </button>
      </div>
      {Silian_open && (
        <div className="mt-3 border-t border-border pt-3">
          {Silian_detail}
        </div>
      )}
    </div>
  );
}

function Silian_KeyValueItem({ label: Silian_label, value: Silian_value }) {
  return (
    <div>
      <span className="mr-1 text-muted-foreground">{Silian_label}:</span>
      <span className="font-mono">{String(Silian_value ?? '-')}</span>
    </div>
  );
}

function Silian_DetailGrid({ items: Silian_items }) {
  return (
    <div className="grid gap-2 text-[11px] md:grid-cols-2">
      {Silian_items.map((Silian_item, Silian_index) => (
        <div key={`${Silian_item.label}-${Silian_index}`} className={Silian_item.span ? 'md:col-span-2' : ''}>
          <Silian_KeyValueItem label={Silian_item.label} value={Silian_item.value} />
        </div>
      ))}
    </div>
  );
}

function Silian_DetailBlock({ title: Silian_title, children: Silian_children }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {Silian_title}
      </div>
      {Silian_children}
    </div>
  );
}

function Silian_DetailValueBlock({ title: Silian_title, value: Silian_value }) {
  if (Silian_value == null || Silian_value === '') return null;
  return (
    <Silian_DetailBlock title={Silian_title}>
      <Silian_DetailValue value={Silian_value} />
    </Silian_DetailBlock>
  );
}

function Silian_DetailTextBlock({ title: Silian_title, value: Silian_value, toneClass: Silian_toneClass }) {
  if (Silian_value == null || Silian_value === '') return null;
  return (
    <Silian_DetailBlock title={Silian_title}>
      <pre className={`max-h-64 overflow-auto whitespace-pre-wrap rounded p-3 text-[11px] ${Silian_toneClass}`}>
        {String(Silian_value)}
      </pre>
    </Silian_DetailBlock>
  );
}

function Silian_DetailValue({ value: Silian_value }) {
  if (Silian_value == null || Silian_value === '') return null;
  const Silian_parsed = Silian_parseMaybeJson(Silian_value);
  if (typeof Silian_parsed === 'string') {
    return (
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded border border-border bg-slate-950 p-3 text-[11px] text-slate-100">
        {Silian_parsed}
      </pre>
    );
  }
  return <Silian_JsonTreeViewer value={Silian_parsed} collapsed maxHeight="18rem" />;
}

function Silian_parseMaybeJson(Silian_value) {
  if (Silian_value == null) return null;
  if (typeof Silian_value === 'object') return Silian_value;
  if (typeof Silian_value !== 'string') return Silian_value;
  try {
    return JSON.parse(Silian_value);
  } catch {
    return Silian_value;
  }
}

RequestIdRelatedDrawer.propTypes = {
  open: Silian_PropTypes.bool,
  onClose: Silian_PropTypes.func,
  requestId: Silian_PropTypes.string,
  data: Silian_PropTypes.object,
  loading: Silian_PropTypes.bool,
  onRefresh: Silian_PropTypes.func,
  system: Silian_PropTypes.array,
  audit: Silian_PropTypes.array,
  error: Silian_PropTypes.array,
  llm: Silian_PropTypes.array
};

Silian_Section.propTypes = {
  title: Silian_PropTypes.node,
  children: Silian_PropTypes.node
};

Silian_ExpandableItem.propTypes = {
  summary: Silian_PropTypes.node,
  detail: Silian_PropTypes.node,
  openLabel: Silian_PropTypes.node,
  closeLabel: Silian_PropTypes.node,
  onOpen: Silian_PropTypes.func,
  toneClass: Silian_PropTypes.string
};

Silian_KeyValueItem.propTypes = {
  label: Silian_PropTypes.node,
  value: Silian_PropTypes.any
};

Silian_DetailGrid.propTypes = {
  items: Silian_PropTypes.arrayOf(Silian_PropTypes.shape({
    label: Silian_PropTypes.node,
    value: Silian_PropTypes.any,
    span: Silian_PropTypes.bool
  }))
};

Silian_DetailBlock.propTypes = {
  title: Silian_PropTypes.node,
  children: Silian_PropTypes.node
};

Silian_DetailValueBlock.propTypes = {
  title: Silian_PropTypes.node,
  value: Silian_PropTypes.any
};

Silian_DetailTextBlock.propTypes = {
  title: Silian_PropTypes.node,
  value: Silian_PropTypes.any,
  toneClass: Silian_PropTypes.string
};

Silian_DetailValue.propTypes = {
  value: Silian_PropTypes.any
};

export default RequestIdRelatedDrawer;
