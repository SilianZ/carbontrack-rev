
import Silian_React, { useEffect as Silian_useEffect, useMemo as Silian_useMemo, useState as Silian_useState } from 'react';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { useQuery as Silian_useQuery } from 'react-query';
import {
  Card as Silian_Card,
  CardHeader as Silian_CardHeader,
  CardTitle as Silian_CardTitle,
  CardDescription as Silian_CardDescription,
  CardContent as Silian_CardContent,
} from '../../components/ui/Card';
import { Button as Silian_Button } from '../../components/ui/Button';
import { Badge as Silian_Badge } from '../../components/ui/badge';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription, AlertTitle as Silian_AlertTitle } from '../../components/ui/Alert';
import { Input as Silian_Input } from '../../components/ui/Input';
import { Textarea as Silian_Textarea } from '../../components/ui/textarea';
import {
  Select as Silian_Select,
  SelectContent as Silian_SelectContent,
  SelectItem as Silian_SelectItem,
  SelectTrigger as Silian_SelectTrigger,
  SelectValue as Silian_SelectValue,
} from '../../components/ui/select';
import {
  Accordion as Silian_Accordion,
  AccordionContent as Silian_AccordionContent,
  AccordionItem as Silian_AccordionItem,
  AccordionTrigger as Silian_AccordionTrigger,
} from '../../components/ui/accordion';
import { Switch as Silian_Switch } from '../../components/ui/switch';
import {
  RefreshCw as Silian_RefreshCw,
  Loader2 as Silian_Loader2,
  ListChecks as Silian_ListChecks,
  ShieldCheck as Silian_ShieldCheck,
  Shield as Silian_Shield,
  Layers as Silian_Layers,
  Code as Silian_Code,
  Globe2 as Silian_Globe2,
  Download as Silian_Download,
  Search as Silian_Search,
} from 'lucide-react';
import { cn as Silian_cn } from '../../lib/utils';
import { API_BASE_URL as Silian_API_BASE_URL } from '../../lib/api';

const Silian_HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];
const Silian_UNTAGGED_TOKEN = '__untagged__';
const Silian_REMOTE_SPEC_FALLBACK =
  'https://raw.githubusercontent.com/carbon-track/carbontrack-rev/refs/heads/main/backend/openapi.json';
const Silian_API_TEST_BASE_URL = Silian_API_BASE_URL;
const Silian_METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const Silian_HTTP_METHOD_STYLES = {
  GET: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300',
  POST: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300',
  PUT: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300',
  PATCH: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300',
  DELETE: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300',
  OPTIONS: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-border dark:bg-muted/60 dark:text-muted-foreground',
  HEAD: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-border dark:bg-muted/60 dark:text-muted-foreground',
  DEFAULT: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-border dark:bg-muted dark:text-muted-foreground',
};

function Silian_computeDefaultSpecUrl() {
  const Silian_explicit = import.meta.env?.VITE_OPENAPI_SPEC_URL;
  if (Silian_explicit) {
    return Silian_explicit;
  }
  return Silian_REMOTE_SPEC_FALLBACK;
}

const Silian_DEFAULT_SPEC_URL = Silian_computeDefaultSpecUrl();
async function Silian_fetchOpenApiSpec({ signal: Silian_signal }) {
  const Silian_response = await fetch(Silian_DEFAULT_SPEC_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal: Silian_signal,
  });

  if (!Silian_response.ok) {
    throw new Error(`Failed to load OpenAPI spec (${Silian_response.status})`);
  }

  const Silian_spec = await Silian_response.json();
  if (!Silian_spec || typeof Silian_spec !== 'object' || !Silian_spec.paths) {
    throw new Error('OpenAPI document is missing path definitions');
  }

  return Silian_spec;
}

function Silian_buildOperations(Silian_spec) {
  if (!Silian_spec?.paths) {
    return [];
  }

  const Silian_globalSecurity = Array.isArray(Silian_spec.security) ? Silian_spec.security : [];
  const Silian_operations = [];

  Object.entries(Silian_spec.paths).forEach(([Silian_path, Silian_pathItem]) => {
    if (!Silian_pathItem || typeof Silian_pathItem !== 'object') return;

    Object.entries(Silian_pathItem).forEach(([Silian_method, Silian_operation]) => {
      if (!Silian_HTTP_METHODS.includes(Silian_method.toLowerCase())) return;
      if (!Silian_operation || typeof Silian_operation !== 'object') return;

      const Silian_requestBody = Silian_operation.requestBody || null;
      const Silian_responses = Silian_operation.responses || {};
      const Silian_responseCodes = Object.keys(Silian_responses);
      const Silian_security = Array.isArray(Silian_operation.security) ? Silian_operation.security : Silian_globalSecurity;
      const Silian_requiresAuth = Array.isArray(Silian_security) && Silian_security.length > 0;

      const Silian_combinedParameters = [
        ...(Array.isArray(Silian_pathItem.parameters) ? Silian_pathItem.parameters : []),
        ...(Array.isArray(Silian_operation.parameters) ? Silian_operation.parameters : []),
      ];

      const Silian_securitySchemes = Array.isArray(Silian_security)
        ? [...new Set(Silian_security.flatMap((Silian_rule) => Object.keys(Silian_rule || {})))]
        : [];

      Silian_operations.push({
        id: `${Silian_method.toUpperCase()} ${Silian_path}`,
        path: Silian_path,
        method: Silian_method.toUpperCase(),
        summary: Silian_operation.summary || '',
        description: Silian_operation.description || '',
        tags: Silian_operation.tags && Silian_operation.tags.length ? Silian_operation.tags : [Silian_UNTAGGED_TOKEN],
        deprecated: Boolean(Silian_operation.deprecated),
        servers: Silian_operation.servers || Silian_spec.servers || [],
        requestBody: Silian_requestBody,
        responses: Silian_responses,
        responseCodes: Silian_responseCodes,
        parameters: Silian_combinedParameters,
        security: Silian_security,
        securitySchemes: Silian_securitySchemes,
        requiresAuth: Silian_requiresAuth,
        requestContentTypes: Silian_requestBody?.content ? Object.keys(Silian_requestBody.content) : [],
        responseContentTypes: Object.entries(Silian_responses).reduce((Silian_acc, [Silian_status, Silian_payload]) => {
          Silian_acc[Silian_status] = Silian_payload?.content ? Object.keys(Silian_payload.content) : [];
          return Silian_acc;
        }, {}),
      });
    });
  });

  return Silian_operations.sort((Silian_a, Silian_b) => {
    if (Silian_a.path === Silian_b.path) {
      return Silian_a.method.localeCompare(Silian_b.method);
    }
    return Silian_a.path.localeCompare(Silian_b.path);
  });
}
function Silian_formatSchema(Silian_schema) {
  if (!Silian_schema) return '';
  if (Silian_schema.$ref) {
    return Silian_schema.$ref.split('/').pop();
  }
  if (Silian_schema.type === 'array') {
    const Silian_inner = Silian_formatSchema(Silian_schema.items);
    return Silian_inner ? `array<${Silian_inner}>` : 'array';
  }
  return Silian_schema.type || '';
}

function Silian_sortStatusCodes(Silian_codes) {
  return [...Silian_codes].sort((Silian_a, Silian_b) => {
    const Silian_numericA = /^\d+$/.test(Silian_a);
    const Silian_numericB = /^\d+$/.test(Silian_b);
    if (Silian_numericA && Silian_numericB) {
      return Number(Silian_a) - Number(Silian_b);
    }
    if (Silian_numericA) return -1;
    if (Silian_numericB) return 1;
    return Silian_a.localeCompare(Silian_b);
  });
}
export default function AdminDiagnosticsPage() {
  const { t: Silian_t, currentLanguage: Silian_currentLanguage } = Silian_useTranslation(['admin', 'errors', 'messages']);
  const [Silian_searchTerm, Silian_setSearchTerm] = Silian_useState('');
  const [Silian_methodFilter, Silian_setMethodFilter] = Silian_useState('all');
  const [Silian_tagFilter, Silian_setTagFilter] = Silian_useState('all');
  const [Silian_securityFilter, Silian_setSecurityFilter] = Silian_useState('all');
  const [Silian_statusFilter, Silian_setStatusFilter] = Silian_useState('all');

  const Silian_query = Silian_useQuery(['openapi-spec'], Silian_fetchOpenApiSpec, {
    staleTime: 5 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
  });

  const Silian_spec = Silian_query.data;
  const Silian_operations = Silian_useMemo(() => Silian_buildOperations(Silian_spec), [Silian_spec]);

  const Silian_availableMethods = Silian_useMemo(
    () => [...new Set(Silian_operations.map((Silian_op) => Silian_op.method))],
    [Silian_operations]
  );

  const Silian_availableTags = Silian_useMemo(() => {
    const Silian_tagSet = new Set();
    Silian_operations.forEach((Silian_op) => Silian_op.tags.forEach((Silian_tag) => Silian_tagSet.add(Silian_tag)));
    return [...Silian_tagSet];
  }, [Silian_operations]);

  const Silian_availableStatuses = Silian_useMemo(() => {
    const Silian_codes = new Set();
    Silian_operations.forEach((Silian_op) => Silian_op.responseCodes.forEach((Silian_code) => Silian_codes.add(Silian_code)));
    return Silian_sortStatusCodes([...Silian_codes]);
  }, [Silian_operations]);

  const Silian_filteredOperations = Silian_useMemo(() => {
    if (!Silian_operations.length) return [];
    const Silian_normalizedSearch = Silian_searchTerm.trim().toLowerCase();
    return Silian_operations.filter((Silian_operation) => {
      if (Silian_methodFilter !== 'all' && Silian_operation.method !== Silian_methodFilter) {
        return false;
      }
      if (Silian_tagFilter !== 'all' && !Silian_operation.tags.includes(Silian_tagFilter)) {
        return false;
      }
      if (Silian_securityFilter === 'secured' && !Silian_operation.requiresAuth) {
        return false;
      }
      if (Silian_securityFilter === 'public' && Silian_operation.requiresAuth) {
        return false;
      }
      if (Silian_statusFilter !== 'all' && !Silian_operation.responseCodes.includes(Silian_statusFilter)) {
        return false;
      }
      if (!Silian_normalizedSearch) {
        return true;
      }
      return [Silian_operation.path, Silian_operation.summary, Silian_operation.description]
        .filter(Boolean)
        .some((Silian_field) => Silian_field.toLowerCase().includes(Silian_normalizedSearch));
    });
  }, [Silian_operations, Silian_methodFilter, Silian_tagFilter, Silian_securityFilter, Silian_statusFilter, Silian_searchTerm]);

  const Silian_stats = Silian_useMemo(() => {
    if (!Silian_operations.length) {
      return {
        total: 0,
        secured: 0,
        publicCount: 0,
        tags: 0,
        methods: 0,
      };
    }
    const Silian_secured = Silian_operations.filter((Silian_op) => Silian_op.requiresAuth).length;
    const Silian_tagCount = new Set(Silian_operations.flatMap((Silian_op) => Silian_op.tags)).size;
    const Silian_methodCount = new Set(Silian_operations.map((Silian_op) => Silian_op.method)).size;
    return {
      total: Silian_operations.length,
      secured: Silian_secured,
      publicCount: Silian_operations.length - Silian_secured,
      tags: Silian_tagCount,
      methods: Silian_methodCount,
    };
  }, [Silian_operations]);

  const Silian_translatedTag = (Silian_tag) => {
    if (Silian_tag !== Silian_UNTAGGED_TOKEN) return Silian_tag;
    return Silian_t('admin.diagnostics.labels.untagged');
  };

  const Silian_securityLabels = Silian_useMemo(
    () => ({
      secured: Silian_t('admin.diagnostics.labels.authRequired'),
      public: Silian_t('admin.diagnostics.labels.publicEndpoint'),
    }),
    [Silian_t]
  );

  const Silian_lastFetchedText = Silian_useMemo(() => {
    if (!Silian_query.dataUpdatedAt) return null;
    try {
      const Silian_formatter = new Intl.DateTimeFormat(Silian_currentLanguage || undefined, {
        dateStyle: 'medium',
        timeStyle: 'medium',
      });
      return Silian_formatter.format(new Date(Silian_query.dataUpdatedAt));
    } catch {
      return new Date(Silian_query.dataUpdatedAt).toLocaleString();
    }
  }, [Silian_currentLanguage, Silian_query.dataUpdatedAt]);

  const Silian_specVersion = Silian_spec?.info?.version;
  const Silian_specTitle = Silian_spec?.info?.title;
  const Silian_servers = Array.isArray(Silian_spec?.servers) ? Silian_spec.servers : [];

  return (
    <div className="space-y-6">
      <Silian_Card className="border-border/70 bg-card/90">
        <Silian_CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Silian_CardTitle>{Silian_t('admin.diagnostics.title')}</Silian_CardTitle>
            <Silian_CardDescription>
              {Silian_t(
                'admin.diagnostics.description')}
            </Silian_CardDescription>
            <dl className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              {Silian_specTitle && (
                <div>
                  <dt className="font-semibold uppercase tracking-wide">
                    {Silian_t('admin.diagnostics.spec.title')}
                  </dt>
                  <dd>{Silian_specTitle}</dd>
                </div>
              )}
              {Silian_specVersion && (
                <div>
                  <dt className="font-semibold uppercase tracking-wide">
                    {Silian_t('admin.diagnostics.spec.version')}
                  </dt>
                  <dd>{Silian_specVersion}</dd>
                </div>
              )}
              {Silian_lastFetchedText && (
                <div>
                  <dt className="font-semibold uppercase tracking-wide">
                    {Silian_t('admin.diagnostics.spec.fetchedAt')}
                  </dt>
                  <dd>{Silian_lastFetchedText}</dd>
                </div>
              )}
            </dl>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Silian_Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.open(Silian_DEFAULT_SPEC_URL, '_blank', 'noopener,noreferrer')}
            >
              <Silian_Download className="mr-2 h-4 w-4" />
              {Silian_t('admin.diagnostics.spec.download')}
            </Silian_Button>
            <Silian_Button
              type="button"
              size="sm"
              onClick={() => Silian_query.refetch()}
              disabled={Silian_query.isFetching}
            >
              {Silian_query.isFetching ? (
                <Silian_Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Silian_RefreshCw className="mr-2 h-4 w-4" />
              )}
              {Silian_t('admin.diagnostics.actions.refresh')}
            </Silian_Button>
          </div>
        </Silian_CardHeader>
      </Silian_Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Silian_StatCard
          icon={Silian_ListChecks}
          label={Silian_t('admin.diagnostics.stats.endpoints')}
          value={Silian_stats.total}
        />
        <Silian_StatCard
          icon={Silian_ShieldCheck}
          label={Silian_t('admin.diagnostics.stats.secured')}
          value={Silian_stats.secured}
        />
        <Silian_StatCard
          icon={Silian_Shield}
          label={Silian_t('admin.diagnostics.stats.public')}
          value={Silian_stats.publicCount}
        />
        <Silian_StatCard
          icon={Silian_Layers}
          label={Silian_t('admin.diagnostics.stats.tags')}
          value={Silian_stats.tags}
        />
        <Silian_StatCard
          icon={Silian_Code}
          label={Silian_t('admin.diagnostics.stats.methods')}
          value={Silian_stats.methods}
        />
      </div>

      <Silian_Card className="border-border/70 bg-card/90">
        <Silian_CardHeader className="pb-2">
          <Silian_CardTitle className="text-base">
            {Silian_t('admin.diagnostics.filters.title')}
          </Silian_CardTitle>
          <Silian_CardDescription>
            {Silian_t(
              'admin.diagnostics.filters.description')}
          </Silian_CardDescription>
        </Silian_CardHeader>
        <Silian_CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">
              {Silian_t('admin.diagnostics.filters.search')}
            </label>
            <div className="relative">
              <Silian_Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Silian_Input
                value={Silian_searchTerm}
                onChange={(Silian_event) => Silian_setSearchTerm(Silian_event.target.value)}
                placeholder={Silian_t(
                  'admin.diagnostics.filters.searchPlaceholder')}
                className="pl-9"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Silian_FilterSelect
              label={Silian_t('admin.diagnostics.filters.method')}
              value={Silian_methodFilter}
              onValueChange={Silian_setMethodFilter}
              placeholder={Silian_t('admin.diagnostics.filters.methodAll')}
              options={Silian_availableMethods.map((Silian_method) => ({
                label: Silian_method,
                value: Silian_method,
              }))}
            />
            <Silian_FilterSelect
              label={Silian_t('admin.diagnostics.filters.tag')}
              value={Silian_tagFilter}
              onValueChange={Silian_setTagFilter}
              placeholder={Silian_t('admin.diagnostics.filters.tagAll')}
              options={Silian_availableTags.map((Silian_tag) => ({
                label: Silian_translatedTag(Silian_tag),
                value: Silian_tag,
              }))}
            />
            <Silian_FilterSelect
              label={Silian_t('admin.diagnostics.filters.security')}
              value={Silian_securityFilter}
              onValueChange={Silian_setSecurityFilter}
              placeholder={Silian_t('admin.diagnostics.filters.securityAll')}
              options={[
                {
                  value: 'secured',
                  label: Silian_t('admin.diagnostics.filters.securitySecured'),
                },
                {
                  value: 'public',
                  label: Silian_t('admin.diagnostics.filters.securityPublic'),
                },
              ]}
            />
            <Silian_FilterSelect
              label={Silian_t('admin.diagnostics.filters.status')}
              value={Silian_statusFilter}
              onValueChange={Silian_setStatusFilter}
              placeholder={Silian_t('admin.diagnostics.filters.statusAll')}
              options={Silian_availableStatuses.map((Silian_code) => ({
                label: Silian_code,
                value: Silian_code,
              }))}
            />
          </div>
        </Silian_CardContent>
      </Silian_Card>

      {Silian_query.isError && (
        <Silian_Alert variant="destructive">
          <Silian_AlertTitle>{Silian_t('admin.diagnostics.status.errorTitle')}</Silian_AlertTitle>
          <Silian_AlertDescription>
            {Silian_query.error?.message ||
              Silian_t(
                'admin.diagnostics.status.errorDescription')}
          </Silian_AlertDescription>
        </Silian_Alert>
      )}

      <Silian_Card className="border-border/70 bg-card/90">
        <Silian_CardHeader className="flex flex-col gap-2 border-b border-border/80 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Silian_CardTitle className="text-base">
                {Silian_t('admin.diagnostics.results.title')}
              </Silian_CardTitle>
              <Silian_CardDescription>
                {Silian_t('admin.diagnostics.results.count',  {
                  count: Silian_filteredOperations.length,
                })}
              </Silian_CardDescription>
            </div>
            {Silian_servers.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Silian_Globe2 className="h-4 w-4" />
                <span>
                  {Silian_t('admin.diagnostics.spec.servers')}: {Silian_servers.length}
                </span>
              </div>
            )}
          </div>
        </Silian_CardHeader>
        <Silian_CardContent className="p-0">
          {Silian_query.isLoading ? (
            <div className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
              <Silian_Loader2 className="h-4 w-4 animate-spin" />
              {Silian_t('admin.diagnostics.status.loading')}
            </div>
          ) : Silian_filteredOperations.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              {Silian_t('admin.diagnostics.status.empty')}
            </div>
          ) : (
            <Silian_Accordion type="single" collapsible>
              {Silian_filteredOperations.map((Silian_operation) => (
                <Silian_AccordionItem key={Silian_operation.id} value={Silian_operation.id}>
                  <Silian_AccordionTrigger className="px-4">
                    <div className="flex w-full flex-col gap-3 text-left md:flex-row md:items-center md:justify-between">
                      <div className="flex flex-1 flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <Silian_MethodBadge method={Silian_operation.method} />
                          <p className="font-mono text-sm text-foreground">{Silian_operation.path}</p>
                          {Silian_operation.deprecated && (
                            <Silian_Badge
                              variant="destructive"
                              className="border-rose-200 bg-rose-50 text-xs uppercase tracking-wide text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300"
                            >
                              {Silian_t('admin.diagnostics.labels.deprecated')}
                            </Silian_Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {Silian_operation.summary ||
                            Silian_operation.description ||
                            Silian_t('admin.diagnostics.labels.noSummary')}
                        </p>
                      </div>
                      <div className="flex flex-col items-start gap-2 md:items-end">
                        <Silian_SecurityBadge secured={Silian_operation.requiresAuth} labels={Silian_securityLabels} />
                        <div className="flex flex-wrap gap-1">
                          {Silian_operation.tags.slice(0, 3).map((Silian_tag) => (
                            <Silian_Badge key={`${Silian_operation.id}-${Silian_tag}`} variant="outline">
                              {Silian_translatedTag(Silian_tag)}
                            </Silian_Badge>
                          ))}
                          {Silian_operation.tags.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{Silian_operation.tags.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Silian_AccordionTrigger>
                  <Silian_AccordionContent className="bg-muted/40 px-4">
                    <div className="space-y-6 rounded-lg border border-border bg-card/95 p-6">
                      {Silian_operation.description && (
                        <p className="text-sm text-muted-foreground">{Silian_operation.description}</p>
                      )}

                      <div className="grid gap-6 md:grid-cols-2">
                        <Silian_InfoBlock
                          title={Silian_t('admin.diagnostics.labels.tags')}
                          value={
                            <div className="flex flex-wrap gap-2">
                              {Silian_operation.tags.map((Silian_tag) => (
                                <Silian_Badge key={`${Silian_operation.id}-${Silian_tag}-detail`} variant="secondary">
                                  {Silian_translatedTag(Silian_tag)}
                                </Silian_Badge>
                              ))}
                            </div>
                          }
                        />
                        <Silian_InfoBlock
                          title={Silian_t('admin.diagnostics.labels.security')}
                          value={
                            Silian_operation.requiresAuth ? (
                              <div className="space-y-1 text-sm text-foreground/90">
                                <p>{Silian_securityLabels.secured}</p>
                                {Silian_operation.securitySchemes.length > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    {Silian_operation.securitySchemes.join(', ')}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">{Silian_securityLabels.public}</p>
                            )
                          }
                        />
                      </div>

                      <div className="grid gap-6 lg:grid-cols-2">
                        <Silian_Section title={Silian_t('admin.diagnostics.labels.parameters')}>
                          {Silian_operation.parameters.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              {Silian_t('admin.diagnostics.labels.noParameters')}
                            </p>
                          ) : (
                            <div className="overflow-x-auto rounded-lg border border-border">
                              <table className="w-full text-left text-sm">
                                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                                  <tr>
                                    <th className="px-3 py-2 font-semibold">
                                      {Silian_t('admin.diagnostics.table.name')}
                                    </th>
                                    <th className="px-3 py-2 font-semibold">
                                      {Silian_t('admin.diagnostics.table.in')}
                                    </th>
                                    <th className="px-3 py-2 font-semibold">
                                      {Silian_t('admin.diagnostics.table.required')}
                                    </th>
                                    <th className="px-3 py-2 font-semibold">
                                      {Silian_t('admin.diagnostics.table.type')}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Silian_operation.parameters.map((Silian_parameter, Silian_index) => (
                                    <tr key={`${Silian_operation.id}-${Silian_parameter.name || Silian_index}`}>
                                      <td className="border-t px-3 py-2 font-mono text-xs">
                                        {Silian_parameter.name || '—'}
                                      </td>
                                      <td className="border-t border-border px-3 py-2 text-xs uppercase text-muted-foreground">
                                        {Silian_parameter.in || '—'}
                                      </td>
                                      <td className="border-t border-border px-3 py-2 text-xs">
                                        {Silian_parameter.required
                                          ? Silian_t('admin.diagnostics.labels.yes')
                                          : Silian_t('admin.diagnostics.labels.no')}
                                      </td>
                                      <td className="border-t border-border px-3 py-2 text-xs">
                                        {Silian_formatSchema(Silian_parameter.schema) || '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </Silian_Section>

                        <Silian_Section title={Silian_t('admin.diagnostics.labels.requestBody')}>
                          {Silian_operation.requestBody ? (
                            <div className="space-y-2 text-sm">
                              <p className="text-muted-foreground">
                                {Silian_operation.requestBody.description ||
                                  Silian_t('admin.diagnostics.labels.requestBodyDescription')}
                              </p>
                              {Silian_operation.requestContentTypes.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {Silian_operation.requestContentTypes.map((Silian_type) => (
                                    <Silian_Badge key={`${Silian_operation.id}-${Silian_type}`} variant="outline">
                                      {Silian_type}
                                    </Silian_Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              {Silian_t('admin.diagnostics.labels.noRequestBody')}
                            </p>
                          )}
                        </Silian_Section>
                      </div>

                      <Silian_Section title={Silian_t('admin.diagnostics.labels.responses')}>
                        {Silian_operation.responseCodes.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            {Silian_t('admin.diagnostics.labels.noResponses')}
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {Silian_sortStatusCodes(Silian_operation.responseCodes).map((Silian_code) => {
                              const Silian_response = Silian_operation.responses[Silian_code];
                              return (
                                <div
                                  key={`${Silian_operation.id}-${Silian_code}`}
                                  className="rounded-xl border border-border bg-muted/50 p-4"
                                >
                                  <div className="flex flex-wrap items-center gap-3">
                                    <Silian_Badge
                                      variant="outline"
                                      className="border-border bg-background/80 font-mono text-xs"
                                    >
                                      {Silian_code.toUpperCase()}
                                    </Silian_Badge>
                                    <p className="text-sm font-medium text-foreground/90">
                                      {Silian_response?.description ||
                                        Silian_t(
                                          'admin.diagnostics.labels.noResponseDescription')}
                                    </p>
                                  </div>
                                  {Silian_operation.responseContentTypes[Silian_code]?.length > 0 && (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      {Silian_t('admin.diagnostics.labels.responseContent')}:{' '}
                                      {Silian_operation.responseContentTypes[Silian_code].join(', ')}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </Silian_Section>

                      <Silian_Section title={Silian_t('admin.diagnostics.tester.title')}>
                        <Silian_RequestTester operation={Silian_operation} />
                      </Silian_Section>
                    </div>
                  </Silian_AccordionContent>
                </Silian_AccordionItem>
              ))}
            </Silian_Accordion>
          )}
        </Silian_CardContent>
      </Silian_Card>
    </div>
  );
}

function Silian_StatCard({ icon: Silian_icon, label: Silian_label, value: Silian_value }) {
  const Silian_IconComponent = Silian_icon;
  return (
    <Silian_Card className="border-border/70 bg-card/90">
      <Silian_CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-full bg-muted p-2 text-foreground/80">
          <Silian_IconComponent className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{Silian_label}</p>
          <p className="text-xl font-semibold text-foreground">{Silian_value}</p>
        </div>
      </Silian_CardContent>
    </Silian_Card>
  );
}

function Silian_FilterSelect({ label: Silian_label, value: Silian_value, onValueChange: Silian_onValueChange, placeholder: Silian_placeholder, options: Silian_options = [] }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-foreground">{Silian_label}</label>
      <Silian_Select value={Silian_value} onValueChange={(Silian_val) => Silian_onValueChange(Silian_val)}>
        <Silian_SelectTrigger className="w-full">
          <Silian_SelectValue placeholder={Silian_placeholder} />
        </Silian_SelectTrigger>
        <Silian_SelectContent>
          <Silian_SelectItem value="all">{Silian_placeholder}</Silian_SelectItem>
          {Silian_options.map((Silian_option) => (
            <Silian_SelectItem key={Silian_option.value} value={Silian_option.value}>
              {Silian_option.label}
            </Silian_SelectItem>
          ))}
        </Silian_SelectContent>
      </Silian_Select>
    </div>
  );
}

function Silian_MethodBadge({ method: Silian_method }) {
  const Silian_style =
    Silian_HTTP_METHOD_STYLES[Silian_method] || Silian_HTTP_METHOD_STYLES[Silian_method.toUpperCase()] || Silian_HTTP_METHOD_STYLES.DEFAULT;
  return (
    <Silian_Badge variant="outline" className={Silian_cn('font-mono text-xs uppercase', Silian_style)}>
      {Silian_method}
    </Silian_Badge>
  );
}

function Silian_SecurityBadge({ secured: Silian_secured, labels: Silian_labels }) {
  return Silian_secured ? (
    <Silian_Badge
      variant="outline"
      className="border-amber-200 bg-amber-50 text-xs font-medium uppercase tracking-wide text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300"
    >
      {Silian_labels.secured}
    </Silian_Badge>
  ) : (
    <Silian_Badge
      variant="outline"
      className="border-emerald-200 bg-emerald-50 text-xs font-medium uppercase tracking-wide text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300"
    >
      {Silian_labels.public}
    </Silian_Badge>
  );
}

function Silian_Section({ title: Silian_title, children: Silian_children }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground">{Silian_title}</h4>
      <div className="text-sm text-foreground/80">{Silian_children}</div>
    </div>
  );
}

function Silian_InfoBlock({ title: Silian_title, value: Silian_value }) {
  return (
    <div className="space-y-2 rounded-xl border border-border/80 bg-muted/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{Silian_title}</p>
      {typeof Silian_value === 'string' || typeof Silian_value === 'number' ? (
        <p className="text-sm text-foreground/90">{Silian_value}</p>
      ) : (
        Silian_value
      )}
    </div>
  );
}

function Silian_RequestTester({ operation: Silian_operation }) {
  const { t: Silian_t } = Silian_useTranslation();
  const Silian_pathParams = Silian_useMemo(
    () => (Silian_operation.parameters || []).filter((Silian_param) => Silian_param.in === 'path'),
    [Silian_operation.parameters]
  );
  const [Silian_isOpen, Silian_setIsOpen] = Silian_useState(false);
  const [Silian_baseUrl, Silian_setBaseUrl] = Silian_useState(Silian_API_TEST_BASE_URL);
  const [Silian_paramValues, Silian_setParamValues] = Silian_useState(() => Silian_initializePathParamValues(Silian_pathParams));
  const [Silian_queryInput, Silian_setQueryInput] = Silian_useState('');
  const [Silian_headersInput, Silian_setHeadersInput] = Silian_useState('');
  const [Silian_bodyInput, Silian_setBodyInput] = Silian_useState('');
  const [Silian_includeAuth, Silian_setIncludeAuth] = Silian_useState(Silian_operation.requiresAuth);
  const [Silian_isSending, Silian_setIsSending] = Silian_useState(false);
  const [Silian_error, Silian_setError] = Silian_useState(null);
  const [Silian_responseInfo, Silian_setResponseInfo] = Silian_useState(null);
  const [Silian_lastUrl, Silian_setLastUrl] = Silian_useState('');

  Silian_useEffect(() => {
    Silian_setParamValues(Silian_initializePathParamValues(Silian_pathParams));
  }, [Silian_pathParams]);

  const Silian_resolvedPath = Silian_useMemo(
    () => Silian_replacePathParams(Silian_operation.path, Silian_paramValues),
    [Silian_operation.path, Silian_paramValues]
  );
  const Silian_previewUrl = Silian_useMemo(() => Silian_composePreviewUrl(Silian_baseUrl, Silian_resolvedPath), [Silian_baseUrl, Silian_resolvedPath]);
  const Silian_canSendBody = Silian_METHODS_WITH_BODY.has(Silian_operation.method);

  const Silian_handleSendTest = async () => {
    Silian_setError(null);
    Silian_setResponseInfo(null);

    const Silian_missingRequired = Silian_pathParams.find(
      (Silian_param) => Silian_param.required && !Silian_paramValues[Silian_param.name]
    );
    if (Silian_missingRequired) {
      Silian_setError(
        Silian_t('admin.diagnostics.tester.messages.pathParamRequired', {
          name: Silian_missingRequired.name,
        })
      );
      return;
    }

    let Silian_queryObject = {};
    let Silian_headerObject = {};
    let Silian_bodyValue = null;

    try {
      Silian_queryObject = Silian_parseJsonObject(Silian_queryInput);
    } catch {
      Silian_setError(
        Silian_t('admin.diagnostics.tester.messages.invalidJsonObject', {
        field: Silian_t('admin.diagnostics.tester.fields.query'),
        })
      );
      return;
    }

    try {
      Silian_headerObject = Silian_parseJsonObject(Silian_headersInput);
    } catch {
      Silian_setError(
        Silian_t('admin.diagnostics.tester.messages.invalidJsonObject', {
        field: Silian_t('admin.diagnostics.tester.fields.headers'),
        })
      );
      return;
    }

    try {
      Silian_bodyValue = Silian_parseJsonValue(Silian_bodyInput);
    } catch {
      Silian_setError(
        Silian_t('admin.diagnostics.tester.messages.invalidJsonValue', {
        field: Silian_t('admin.diagnostics.tester.fields.body'),
        })
      );
      return;
    }

    if (Silian_bodyValue !== null && !Silian_canSendBody) {
      Silian_setError(
        Silian_t('admin.diagnostics.tester.messages.bodyNotAllowed')
      );
      return;
    }

    const Silian_url = Silian_buildFinalUrl(Silian_baseUrl, Silian_resolvedPath, Silian_queryObject);
    Silian_setIsSending(true);
    try {
      const Silian_headers = Object.entries(Silian_headerObject).reduce((Silian_acc, [Silian_key, Silian_value]) => {
        if (!Silian_key) return Silian_acc;
        Silian_acc[Silian_key] = Silian_value == null ? '' : String(Silian_value);
        return Silian_acc;
      }, {});

      if (Silian_includeAuth && typeof window !== 'undefined') {
        const Silian_token = window.localStorage?.getItem('auth_token');
        if (Silian_token) {
          Silian_headers.Authorization = `Bearer ${Silian_token}`;
        }
      }

      let Silian_bodyPayload;
      if (Silian_bodyValue !== null) {
        Silian_bodyPayload = typeof Silian_bodyValue === 'string' ? Silian_bodyValue : JSON.stringify(Silian_bodyValue);
        if (
          typeof Silian_bodyValue !== 'string' &&
          !Silian_headers['Content-Type'] &&
          !Silian_headers['content-type']
        ) {
          Silian_headers['Content-Type'] = 'application/json';
        }
      }

      const Silian_start = performance.now();
      const Silian_response = await fetch(Silian_url, {
        method: Silian_operation.method,
        headers: Silian_headers,
        body: Silian_bodyPayload,
      });
      const Silian_duration = performance.now() - Silian_start;
      const Silian_responseText = await Silian_response.text();
      let Silian_parsedBody = null;
      try {
        Silian_parsedBody = Silian_responseText ? JSON.parse(Silian_responseText) : null;
      } catch {
        Silian_parsedBody = null;
      }
      const Silian_headerList = [];
      Silian_response.headers.forEach((Silian_value, Silian_key) => {
        Silian_headerList.push({ key: Silian_key, value: Silian_value });
      });
      Silian_setResponseInfo({
        ok: Silian_response.ok,
        status: Silian_response.status,
        statusText: Silian_response.statusText || '',
        duration: Silian_duration,
        headers: Silian_headerList,
        body: Silian_parsedBody ?? Silian_responseText,
        isJson: Silian_parsedBody !== null,
      });
      Silian_setLastUrl(Silian_url);
    } catch (Silian_requestError) {
      Silian_setError(
        Silian_requestError?.message ||
          Silian_t('admin.diagnostics.tester.messages.requestFailed')
      );
    } finally {
      Silian_setIsSending(false);
    }
  };

  const Silian_handleReset = () => {
    Silian_setQueryInput('');
    Silian_setHeadersInput('');
    Silian_setBodyInput('');
    Silian_setResponseInfo(null);
    Silian_setError(null);
    Silian_setLastUrl('');
  };

  return (
    <div className="space-y-4 rounded-xl border border-border/80 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {Silian_t('admin.diagnostics.tester.title')}
          </p>
          <p className="text-xs text-muted-foreground">
            {Silian_t(
              'admin.diagnostics.tester.description')}
          </p>
        </div>
        <Silian_Button variant="outline" size="sm" type="button" onClick={() => Silian_setIsOpen((Silian_prev) => !Silian_prev)}>
          {Silian_isOpen
            ? Silian_t('admin.diagnostics.tester.actions.close')
            : Silian_t('admin.diagnostics.tester.actions.open')}
        </Silian_Button>
      </div>

      {Silian_isOpen && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground">
                {Silian_t('admin.diagnostics.tester.fields.baseUrl')}
              </label>
              <Silian_Input
                value={Silian_baseUrl}
                onChange={(Silian_event) => Silian_setBaseUrl(Silian_event.target.value)}
                placeholder="https://api.example.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">
                {Silian_t('admin.diagnostics.tester.fields.resolvedPath')}
              </label>
              <Silian_Input value={Silian_resolvedPath} readOnly className="font-mono text-xs" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">
              {Silian_t('admin.diagnostics.tester.fields.finalUrl')}
            </label>
            <Silian_Input value={Silian_lastUrl || Silian_previewUrl} readOnly className="font-mono text-xs" />
          </div>

          {Silian_pathParams.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                {Silian_t('admin.diagnostics.tester.fields.pathParams')}
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {Silian_pathParams.map((Silian_param) => (
                  <div key={Silian_param.name}>
                    <label className="text-xs font-semibold text-muted-foreground">
                      {Silian_t('admin.diagnostics.tester.messages.pathParam', {
                        name: Silian_param.name,
                      })}
                    </label>
                    <Silian_Input
                      value={Silian_paramValues[Silian_param.name] ?? ''}
                      placeholder={Silian_param.description || Silian_param.name}
                      onChange={(Silian_event) =>
                        Silian_setParamValues((Silian_current) => ({
                          ...Silian_current,
                          [Silian_param.name]: Silian_event.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground">
                {Silian_t('admin.diagnostics.tester.fields.query')}
              </label>
              <Silian_Textarea
                value={Silian_queryInput}
                onChange={(Silian_event) => Silian_setQueryInput(Silian_event.target.value)}
                placeholder={Silian_t('admin.diagnostics.tester.placeholders.query')}
                className="font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">
                {Silian_t('admin.diagnostics.tester.fields.headers')}
              </label>
              <Silian_Textarea
                value={Silian_headersInput}
                onChange={(Silian_event) => Silian_setHeadersInput(Silian_event.target.value)}
                placeholder={Silian_t('admin.diagnostics.tester.placeholders.headers')}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">
              {Silian_t('admin.diagnostics.tester.fields.body')}
            </label>
            <Silian_Textarea
              value={Silian_bodyInput}
              onChange={(Silian_event) => Silian_setBodyInput(Silian_event.target.value)}
              placeholder={Silian_t(
                'admin.diagnostics.tester.placeholders.body')}
              className="font-mono text-xs"
              disabled={!Silian_canSendBody}
            />
            {!Silian_canSendBody && (
              <p className="mt-1 text-xs text-muted-foreground">
                {Silian_t(
                  'admin.diagnostics.tester.messages.bodyNotAllowed')}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-muted/50 p-3">
            <Silian_Switch
              id={`tester-auth-${Silian_operation.id}`}
              checked={Silian_includeAuth}
              onCheckedChange={Silian_setIncludeAuth}
            />
            <div>
              <label className="text-sm font-medium text-foreground" htmlFor={`tester-auth-${Silian_operation.id}`}>
                {Silian_t('admin.diagnostics.tester.fields.auth')}
              </label>
              <p className="text-xs text-muted-foreground">
                {Silian_t(
                  'admin.diagnostics.tester.fields.authDescription')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Silian_Button type="button" onClick={Silian_handleSendTest} disabled={Silian_isSending}>
              {Silian_isSending ? (
                <>
                  <Silian_Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {Silian_t('admin.diagnostics.tester.actions.sending')}
                </>
              ) : (
                <>
                  <Silian_RefreshCw className="mr-2 h-4 w-4" />
                  {Silian_t('admin.diagnostics.tester.actions.send')}
                </>
              )}
            </Silian_Button>
            <Silian_Button type="button" variant="outline" onClick={Silian_handleReset} disabled={Silian_isSending}>
              {Silian_t('admin.diagnostics.tester.actions.reset')}
            </Silian_Button>
          </div>

          {Silian_error && (
            <Silian_Alert variant="destructive">
              <Silian_AlertTitle>
                {Silian_t('admin.diagnostics.tester.messages.requestFailed')}
              </Silian_AlertTitle>
              <Silian_AlertDescription>{Silian_error}</Silian_AlertDescription>
            </Silian_Alert>
          )}

          {Silian_responseInfo && (
            <div className="space-y-3 rounded-xl border border-border/80 bg-muted/50 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Silian_Badge
                  variant={Silian_responseInfo.ok ? 'secondary' : 'destructive'}
                  className="font-mono text-xs"
                >
                  {Silian_responseInfo.status} {Silian_responseInfo.statusText}
                </Silian_Badge>
                <span className="text-xs text-muted-foreground">
                  {Silian_t('admin.diagnostics.tester.messages.duration', {
                    value: Silian_responseInfo.duration.toFixed(1),
                  })}
                </span>
                {Silian_lastUrl && (
                  <span className="font-mono text-[11px] text-muted-foreground break-all">{Silian_lastUrl}</span>
                )}
              </div>
              {Silian_responseInfo.headers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {Silian_t('admin.diagnostics.tester.results.headers')}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs font-mono text-foreground/80">
                    {Silian_responseInfo.headers.map((Silian_header) => (
                      <li key={`${Silian_header.key}-${Silian_header.value}`}>
                        <span className="text-muted-foreground">{Silian_header.key}:</span> {Silian_header.value}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {Silian_t('admin.diagnostics.tester.results.body')}
                </p>
                <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-slate-900/95 p-3 text-xs leading-relaxed text-emerald-100">
                  {Silian_responseInfo.isJson
                    ? JSON.stringify(Silian_responseInfo.body, null, 2)
                    : String(Silian_responseInfo.body ?? '')}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Silian_initializePathParamValues(Silian_params) {
  return Silian_params.reduce((Silian_acc, Silian_param) => {
    Silian_acc[Silian_param.name] = '';
    return Silian_acc;
  }, {});
}

function Silian_replacePathParams(Silian_path, Silian_values) {
  return Silian_path.replace(/{([^}]+)}/g, (Silian_match, Silian_key) => {
    const Silian_value = Silian_values[Silian_key];
    return Silian_value !== undefined && Silian_value !== '' ? encodeURIComponent(Silian_value) : Silian_match;
  });
}

function Silian_composePreviewUrl(Silian_base, Silian_path) {
  if (!Silian_base) {
    return Silian_path;
  }
  const Silian_trimmedBase = Silian_base.replace(/\/+$/, '');
  const Silian_normalizedPath = Silian_path.startsWith('/') ? Silian_path : `/${Silian_path}`;
  return `${Silian_trimmedBase}${Silian_normalizedPath}`;
}

function Silian_buildFinalUrl(Silian_base, Silian_path, Silian_query) {
  const Silian_preview = Silian_composePreviewUrl(Silian_base, Silian_path);
  const Silian_searchParams = new URLSearchParams();
  Object.entries(Silian_query || {}).forEach(([Silian_key, Silian_value]) => {
    if (Silian_key) {
      Silian_searchParams.append(Silian_key, Silian_value == null ? '' : String(Silian_value));
    }
  });
  const Silian_queryString = Silian_searchParams.toString();
  if (!Silian_queryString) {
    return Silian_preview;
  }
  return `${Silian_preview}${Silian_preview.includes('?') ? '&' : '?'}${Silian_queryString}`;
}

function Silian_parseJsonObject(Silian_value) {
  if (!Silian_value || !Silian_value.trim()) {
    return {};
  }
  try {
    const Silian_parsed = JSON.parse(Silian_value);
    if (Silian_parsed && typeof Silian_parsed === 'object' && !Array.isArray(Silian_parsed)) {
      return Silian_parsed;
    }
  } catch {
    /* noop */
  }
  throw new Error('INVALID_JSON_OBJECT');
}

function Silian_parseJsonValue(Silian_value) {
  if (!Silian_value || !Silian_value.trim()) {
    return null;
  }
  try {
    return JSON.parse(Silian_value);
  } catch {
    throw new Error('INVALID_JSON_VALUE');
  }
}
