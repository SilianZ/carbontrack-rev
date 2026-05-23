import Silian_React, { useState as Silian_useState, useMemo as Silian_useMemo, useCallback as Silian_useCallback, useEffect as Silian_useEffect, useRef as Silian_useRef } from 'react';
import Silian_PropTypes from 'prop-types';
import {
  ChevronRight as Silian_ChevronRight,
  ChevronDown as Silian_ChevronDown,
  ChevronsDown as Silian_ChevronsDown,
  ChevronsUp as Silian_ChevronsUp,
  Copy as Silian_Copy,
  FileJson as Silian_FileJson,
  Search as Silian_Search
} from 'lucide-react';

import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { cn as Silian_cn } from '@/lib/utils';
import { Input as Silian_Input } from '../ui/Input';
import { Button as Silian_Button } from '../ui/Button';
import { Badge as Silian_Badge } from '../ui/badge';
import { Tooltip as Silian_Tooltip, TooltipTrigger as Silian_TooltipTrigger, TooltipContent as Silian_TooltipContent } from '../ui/tooltip';

const Silian_ROOT_PATH = [];
const Silian_ROOT_KEY = '$';

function Silian_getType(Silian_value) {
  if (Silian_value === null) return 'null';
  if (Array.isArray(Silian_value)) return 'array';
  return typeof Silian_value;
}

function Silian_isExpandableType(Silian_type) {
  return Silian_type === 'object' || Silian_type === 'array';
}

function Silian_formatValue(Silian_value, Silian_type) {
  switch (Silian_type) {
    case 'string':
      return `"${Silian_value}"`;
    case 'number':
    case 'boolean':
      return String(Silian_value);
    case 'null':
      return 'null';
    case 'undefined':
      return 'undefined';
    default:
      return String(Silian_value);
  }
}

function Silian_valueClass(Silian_type) {
  switch (Silian_type) {
    case 'string':
      return 'text-emerald-600';
    case 'number':
      return 'text-sky-600';
    case 'boolean':
      return 'text-purple-600';
    case 'null':
    case 'undefined':
      return 'text-muted-foreground';
    default:
      return 'text-foreground';
  }
}

function Silian_getPathKey(Silian_path) {
  if (!Silian_path || Silian_path.length === 0) return Silian_ROOT_KEY;
  return `${Silian_ROOT_KEY}${Silian_path
    .map((Silian_segment) => (typeof Silian_segment === 'number' ? `[${Silian_segment}]` : `.${Silian_segment}`))
    .join('')}`;
}

function Silian_pathToString(Silian_path) {
  if (!Silian_path || Silian_path.length === 0) return Silian_ROOT_KEY;
  return Silian_path.reduce((Silian_acc, Silian_segment) => {
    if (typeof Silian_segment === 'number') {
      return `${Silian_acc}[${Silian_segment}]`;
    }
    return `${Silian_acc}.${Silian_segment}`;
  }, Silian_ROOT_KEY);
}

function Silian_collectExpandablePaths(Silian_value, Silian_path = [], Silian_result = new Set()) {
  const Silian_type = Silian_getType(Silian_value);
  if (!Silian_isExpandableType(Silian_type)) return Silian_result;

  Silian_result.add(Silian_getPathKey(Silian_path));
  const Silian_entries = Silian_type === 'array'
    ? Silian_value.map((Silian_child, Silian_index) => [Silian_index, Silian_child])
    : Object.entries(Silian_value || {});

  Silian_entries.forEach(([Silian_key, Silian_child]) => {
    Silian_collectExpandablePaths(Silian_child, Silian_path.concat(Silian_key), Silian_result);
  });

  return Silian_result;
}

function Silian_findMatches(Silian_value, Silian_term, Silian_path = [], Silian_matches = []) {
  if (Silian_term === '') return Silian_matches;
  const Silian_type = Silian_getType(Silian_value);

  if (Silian_type === 'object') {
    Object.entries(Silian_value || {}).forEach(([Silian_key, Silian_child]) => {
      const Silian_keyMatch = Silian_key.toLowerCase().includes(Silian_term);
      if (Silian_keyMatch) Silian_matches.push(Silian_path.concat(Silian_key));
      Silian_findMatches(Silian_child, Silian_term, Silian_path.concat(Silian_key), Silian_matches);
    });
  } else if (Silian_type === 'array') {
    Silian_value.forEach((Silian_child, Silian_index) => {
      Silian_findMatches(Silian_child, Silian_term, Silian_path.concat(Silian_index), Silian_matches);
    });
  } else if (String(Silian_value ?? '').toLowerCase().includes(Silian_term)) {
    Silian_matches.push(Silian_path);
  }

  return Silian_matches;
}

function Silian_ancestorsOf(Silian_path) {
  const Silian_ancestors = [];
  for (let Silian_i = 0; Silian_i <= Silian_path.length; Silian_i += 1) {
    Silian_ancestors.push(Silian_getPathKey(Silian_path.slice(0, Silian_i)));
  }
  return Silian_ancestors;
}

function Silian_normaliseName(Silian_name, Silian_fallback) {
  if (Silian_name === undefined) return Silian_fallback;
  if (typeof Silian_name === 'number') return `[${Silian_name}]`;
  return Silian_name;
}

const Silian_JsonNode = Silian_React.memo(function JsonNode({
  name: Silian_name,
  value: Silian_value,
  path: Silian_path,
  searchTerm: Silian_searchTerm,
  labels: Silian_labels,
  typeLabels: Silian_typeLabels,
  expandedPaths: Silian_expandedPaths,
  onToggle: Silian_onToggle,
  onCopyPath: Silian_onCopyPath,
  onCopyValue: Silian_onCopyValue
}) {
  const Silian_type = Silian_getType(Silian_value);
  const Silian_expandable = Silian_isExpandableType(Silian_type);
  const Silian_pathKey = Silian_getPathKey(Silian_path);
  const Silian_isExpanded = Silian_expandedPaths.has(Silian_pathKey);
  const Silian_displayName = Silian_normaliseName(Silian_name, Silian_labels.root);

  const Silian_entries = Silian_useMemo(() => {
    if (!Silian_expandable) return [];
    if (Silian_type === 'array') {
      return Silian_value.map((Silian_item, Silian_index) => [Silian_index, Silian_item]);
    }
    return Object.entries(Silian_value || {});
  }, [Silian_expandable, Silian_type, Silian_value]);

  const Silian_valueString = !Silian_expandable ? String(Silian_value ?? '') : '';
  const Silian_matches = Boolean(
    Silian_searchTerm && (
      (Silian_displayName && Silian_displayName.toLowerCase().includes(Silian_searchTerm)) ||
      (!Silian_expandable && Silian_valueString.toLowerCase().includes(Silian_searchTerm))
    )
  );

  const Silian_typeLabel = Silian_typeLabels[Silian_type] || Silian_typeLabels.unknown;
  const Silian_countLabel = Silian_expandable ? `${Silian_entries.length}` : undefined;

  return (
    <div
      className={Silian_cn(
        'group relative border-l border-muted-foreground/20 pl-3',
        Silian_matches && 'bg-amber-500/10 dark:bg-amber-400/10'
      )}
    >
      <div className="flex items-start gap-2 py-1">
        <button
          type="button"
          className={Silian_cn(
            'mt-1 flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground',
            !Silian_expandable && 'opacity-0'
          )}
          onClick={() => Silian_expandable && Silian_onToggle(Silian_path)}
          aria-label={Silian_isExpanded ? Silian_labels.collapse : Silian_labels.expand}
        >
          {Silian_isExpanded ? (
            <Silian_ChevronDown className="h-3 w-3" />
          ) : (
            <Silian_ChevronRight className="h-3 w-3" />
          )}
        </button>
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12px] text-foreground">{Silian_displayName}</span>
            <Silian_Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
              {Silian_typeLabel}
              {Silian_countLabel ? ` · ${Silian_countLabel}` : ''}
            </Silian_Badge>
          </div>
          {!Silian_expandable && (
            <div className={Silian_cn('font-mono text-[11px] break-all', Silian_valueClass(Silian_type))}>
              {Silian_formatValue(Silian_value, Silian_type)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 pt-0.5 opacity-0 transition group-hover:opacity-100">
          <Silian_Tooltip>
            <Silian_TooltipTrigger asChild>
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => Silian_onCopyPath(Silian_path)}
                aria-label={Silian_labels.copyPath}
              >
                <Silian_FileJson className="h-4 w-4" />
              </button>
            </Silian_TooltipTrigger>
            <Silian_TooltipContent>{Silian_labels.copyPath}</Silian_TooltipContent>
          </Silian_Tooltip>
          <Silian_Tooltip>
            <Silian_TooltipTrigger asChild>
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => Silian_onCopyValue(Silian_value)}
                aria-label={Silian_labels.copyValue}
              >
                <Silian_Copy className="h-4 w-4" />
              </button>
            </Silian_TooltipTrigger>
            <Silian_TooltipContent>{Silian_labels.copyValue}</Silian_TooltipContent>
          </Silian_Tooltip>
        </div>
      </div>
      {Silian_expandable && Silian_isExpanded && Silian_entries.length > 0 && (
        <div className="pl-4">
          {Silian_entries.map(([Silian_childName, Silian_childValue]) => (
            <JsonNode
              key={typeof Silian_childName === 'number' ? Silian_childName : String(Silian_childName)}
              name={Silian_childName}
              value={Silian_childValue}
              path={Silian_path.concat(Silian_childName)}
              searchTerm={Silian_searchTerm}
              labels={Silian_labels}
              typeLabels={Silian_typeLabels}
              expandedPaths={Silian_expandedPaths}
              onToggle={Silian_onToggle}
              onCopyPath={Silian_onCopyPath}
              onCopyValue={Silian_onCopyValue}
            />
          ))}
        </div>
      )}
    </div>
  );
});

Silian_JsonNode.displayName = 'JsonNode';

export function JsonTreeViewer({ value: Silian_value, collapsed: Silian_collapsed = false, maxHeight: Silian_maxHeight = '20rem', className: Silian_className }) {
  const { t: Silian_t } = Silian_useTranslation(['common', 'jsonViewer', 'messages']);
  const [Silian_search, Silian_setSearch] = Silian_useState('');
  const [Silian_expanded, Silian_setExpanded] = Silian_useState(new Set([Silian_ROOT_KEY]));
  const [Silian_feedback, Silian_setFeedback] = Silian_useState('');
  const Silian_feedbackTimer = Silian_useRef();

  const Silian_data = Silian_useMemo(() => Silian_value, [Silian_value]);
  const Silian_searchTerm = Silian_search.trim().toLowerCase();

  const Silian_typeLabels = Silian_useMemo(
    () => ({
      // NOTE: useTranslation 默认命名空间是 'common'，
      // 这里不应再在 key 前加 'common.' 前缀，否则会导致找不到翻译而显示原 key。
      object: Silian_t('jsonViewer.typeLabels.object'),
      array: Silian_t('jsonViewer.typeLabels.array'),
      string: Silian_t('jsonViewer.typeLabels.string'),
      number: Silian_t('jsonViewer.typeLabels.number'),
      boolean: Silian_t('jsonViewer.typeLabels.boolean'),
      null: Silian_t('jsonViewer.typeLabels.null'),
      undefined: Silian_t('jsonViewer.typeLabels.undefined'),
      unknown: Silian_t('jsonViewer.typeLabels.unknown')
    }),
    [Silian_t]
  );

  const Silian_labels = Silian_useMemo(
    () => ({
      root: Silian_t('jsonViewer.root'),
      searchPlaceholder: Silian_t('jsonViewer.searchPlaceholder'),
      expandAll: Silian_t('jsonViewer.expandAll'),
      collapseAll: Silian_t('jsonViewer.collapseAll'),
      copyJson: Silian_t('jsonViewer.copyJson'),
      copyPath: Silian_t('jsonViewer.copyPath'),
      copyValue: Silian_t('jsonViewer.copyValue'),
      expand: Silian_t('jsonViewer.expandNode'),
      collapse: Silian_t('jsonViewer.collapseNode'),
      copied: Silian_t('jsonViewer.copied'),
      noData: Silian_t('jsonViewer.noData')
    }),
    [Silian_t]
  );

  const Silian_defaultExpanded = Silian_useMemo(() => {
    const Silian_defaults = new Set([Silian_ROOT_KEY]);
    if (!Silian_collapsed) {
      const Silian_type = Silian_getType(Silian_data);
      const Silian_entries = Silian_type === 'array'
        ? Silian_data.map((Silian__, Silian_index) => [Silian_index, Silian_data[Silian_index]])
        : Object.entries(Silian_data || {});
      Silian_entries.forEach(([Silian_key, Silian_child]) => {
        if (Silian_isExpandableType(Silian_getType(Silian_child))) {
          Silian_defaults.add(Silian_getPathKey([Silian_key]));
        }
      });
    }
    return Silian_defaults;
  }, [Silian_data, Silian_collapsed]);

  Silian_useEffect(() => {
    Silian_setExpanded(Silian_defaultExpanded);
  }, [Silian_defaultExpanded]);

  const Silian_showFeedback = Silian_useCallback((Silian_message) => {
    Silian_setFeedback(Silian_message);
    if (Silian_feedbackTimer.current) clearTimeout(Silian_feedbackTimer.current);
    Silian_feedbackTimer.current = setTimeout(() => Silian_setFeedback(''), 1200);
  }, []);

  Silian_useEffect(() => () => {
    if (Silian_feedbackTimer.current) clearTimeout(Silian_feedbackTimer.current);
  }, []);

  Silian_useEffect(() => {
    if (!Silian_searchTerm) return;
    const Silian_matches = Silian_findMatches(Silian_data, Silian_searchTerm);
    if (Silian_matches.length === 0) return;
    Silian_setExpanded((Silian_prev) => {
      const Silian_next = new Set(Silian_prev);
      Silian_matches.forEach((Silian_matchPath) => {
        Silian_ancestorsOf(Silian_matchPath).forEach((Silian_ancestorKey) => Silian_next.add(Silian_ancestorKey));
      });
      return Silian_next;
    });
  }, [Silian_data, Silian_searchTerm]);

  const Silian_expandablePaths = Silian_useMemo(() => Silian_collectExpandablePaths(Silian_data), [Silian_data]);

  const Silian_handleToggle = Silian_useCallback((Silian_path) => {
    const Silian_key = Silian_getPathKey(Silian_path);
    Silian_setExpanded((Silian_prev) => {
      const Silian_next = new Set(Silian_prev);
      if (Silian_next.has(Silian_key)) {
        Silian_next.delete(Silian_key);
      } else {
        Silian_next.add(Silian_key);
      }
      return Silian_next;
    });
  }, []);

  const Silian_handleExpandAll = Silian_useCallback(() => {
    Silian_setExpanded(new Set(Silian_expandablePaths));
  }, [Silian_expandablePaths]);

  const Silian_handleCollapseAll = Silian_useCallback(() => {
    Silian_setExpanded(new Set([Silian_ROOT_KEY]));
  }, []);

  const Silian_copyToClipboard = Silian_useCallback((Silian_text) => {
    if (!Silian_text && Silian_text !== '') return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(Silian_text)
        .then(() => {
          Silian_showFeedback(Silian_labels.copied);
        })
        .catch(() => {});
    }
  }, [Silian_labels.copied, Silian_showFeedback]);

  const Silian_handleCopyJson = Silian_useCallback(() => {
    try {
      const Silian_json = JSON.stringify(Silian_data, null, 2);
      Silian_copyToClipboard(Silian_json);
    } catch {
      Silian_copyToClipboard(String(Silian_data));
    }
  }, [Silian_copyToClipboard, Silian_data]);

  const Silian_handleCopyPath = Silian_useCallback((Silian_path) => {
    Silian_copyToClipboard(Silian_pathToString(Silian_path));
  }, [Silian_copyToClipboard]);

  const Silian_handleCopyValue = Silian_useCallback((Silian_valueToCopy) => {
    const Silian_type = Silian_getType(Silian_valueToCopy);
    const Silian_text = Silian_isExpandableType(Silian_type)
      ? JSON.stringify(Silian_valueToCopy, null, 2)
      : String(Silian_valueToCopy ?? '');
    Silian_copyToClipboard(Silian_text);
  }, [Silian_copyToClipboard]);

  return (
    <div
      className={Silian_cn('border rounded bg-background text-xs shadow-sm', Silian_className)}
      style={{ maxHeight: Silian_maxHeight, display: 'flex', flexDirection: 'column' }}
    >
      <div className="flex items-center gap-2 border-b bg-muted/30 px-2 py-2">
        <div className="relative flex-1">
          <Silian_Input
            value={Silian_search}
            onChange={(Silian_event) => Silian_setSearch(Silian_event.target.value)}
            placeholder={Silian_labels.searchPlaceholder}
            className="h-8 w-full pl-7 text-xs"
          />
          <span className="pointer-events-none absolute left-2 top-1/2 flex -translate-y-1/2 text-muted-foreground">
            <Silian_Search className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Silian_Button
            size="icon"
            variant="ghost"
            onClick={Silian_handleExpandAll}
            className="h-8 w-8"
            aria-label={Silian_labels.expandAll}
          >
            <Silian_ChevronsDown className="h-4 w-4" />
          </Silian_Button>
          <Silian_Button
            size="icon"
            variant="ghost"
            onClick={Silian_handleCollapseAll}
            className="h-8 w-8"
            aria-label={Silian_labels.collapseAll}
          >
            <Silian_ChevronsUp className="h-4 w-4" />
          </Silian_Button>
          <Silian_Button
            size="icon"
            variant="ghost"
            onClick={Silian_handleCopyJson}
            className="h-8 w-8"
            aria-label={Silian_labels.copyJson}
          >
            <Silian_Copy className="h-4 w-4" />
          </Silian_Button>
        </div>
        {Silian_feedback && (
          <span className="ml-2 text-[10px] text-muted-foreground">{Silian_feedback}</span>
        )}
      </div>
      <div className="flex-1 overflow-auto px-2 py-2">
        {Silian_data === undefined || Silian_data === null ? (
          <div className="text-xs text-muted-foreground">{Silian_labels.noData}</div>
        ) : (
          <Silian_JsonNode
            name={Silian_labels.root}
            value={Silian_data}
            path={Silian_ROOT_PATH}
            searchTerm={Silian_searchTerm}
            labels={Silian_labels}
            typeLabels={Silian_typeLabels}
            expandedPaths={Silian_expanded}
            onToggle={Silian_handleToggle}
            onCopyPath={Silian_handleCopyPath}
            onCopyValue={Silian_handleCopyValue}
          />
        )}
      </div>
    </div>
  );
}

JsonTreeViewer.propTypes = {
  value: Silian_PropTypes.any,
  collapsed: Silian_PropTypes.bool,
  maxHeight: Silian_PropTypes.oneOfType([Silian_PropTypes.string, Silian_PropTypes.number]),
  className: Silian_PropTypes.string
};

export default JsonTreeViewer;
