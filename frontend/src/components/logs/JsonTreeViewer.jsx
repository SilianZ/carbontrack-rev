import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  ChevronRight,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  Copy,
  FileJson,
  Search
} from 'lucide-react';

import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '@/lib/utils';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';

const ROOT_PATH = [];
const ROOT_KEY = '$';

function getType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function isExpandableType(type) {
  return type === 'object' || type === 'array';
}

function formatValue(value, type) {
  switch (type) {
    case 'string':
      return `"${value}"`;
    case 'number':
    case 'boolean':
      return String(value);
    case 'null':
      return 'null';
    case 'undefined':
      return 'undefined';
    default:
      return String(value);
  }
}

function valueClass(type) {
  switch (type) {
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

function getPathKey(path) {
  if (!path || path.length === 0) return ROOT_KEY;
  return `${ROOT_KEY}${path
    .map((segment) => (typeof segment === 'number' ? `[${segment}]` : `.${segment}`))
    .join('')}`;
}

function pathToString(path) {
  if (!path || path.length === 0) return ROOT_KEY;
  return path.reduce((acc, segment) => {
    if (typeof segment === 'number') {
      return `${acc}[${segment}]`;
    }
    return `${acc}.${segment}`;
  }, ROOT_KEY);
}

function collectExpandablePaths(value, path = [], result = new Set()) {
  const type = getType(value);
  if (!isExpandableType(type)) return result;

  result.add(getPathKey(path));
  const entries = type === 'array'
    ? value.map((child, index) => [index, child])
    : Object.entries(value || {});

  entries.forEach(([key, child]) => {
    collectExpandablePaths(child, path.concat(key), result);
  });

  return result;
}

function findMatches(value, term, path = [], matches = []) {
  if (term === '') return matches;
  const type = getType(value);

  if (type === 'object') {
    Object.entries(value || {}).forEach(([key, child]) => {
      const keyMatch = key.toLowerCase().includes(term);
      if (keyMatch) matches.push(path.concat(key));
      findMatches(child, term, path.concat(key), matches);
    });
  } else if (type === 'array') {
    value.forEach((child, index) => {
      findMatches(child, term, path.concat(index), matches);
    });
  } else if (String(value ?? '').toLowerCase().includes(term)) {
    matches.push(path);
  }

  return matches;
}

function ancestorsOf(path) {
  const ancestors = [];
  for (let i = 0; i <= path.length; i += 1) {
    ancestors.push(getPathKey(path.slice(0, i)));
  }
  return ancestors;
}

function normaliseName(name, fallback) {
  if (name === undefined) return fallback;
  if (typeof name === 'number') return `[${name}]`;
  return name;
}

const JsonNode = React.memo(function JsonNode({
  name,
  value,
  path,
  searchTerm,
  labels,
  typeLabels,
  expandedPaths,
  onToggle,
  onCopyPath,
  onCopyValue
}) {
  const type = getType(value);
  const expandable = isExpandableType(type);
  const pathKey = getPathKey(path);
  const isExpanded = expandedPaths.has(pathKey);
  const displayName = normaliseName(name, labels.root);

  const entries = useMemo(() => {
    if (!expandable) return [];
    if (type === 'array') {
      return value.map((item, index) => [index, item]);
    }
    return Object.entries(value || {});
  }, [expandable, type, value]);

  const valueString = !expandable ? String(value ?? '') : '';
  const matches = Boolean(
    searchTerm && (
      (displayName && displayName.toLowerCase().includes(searchTerm)) ||
      (!expandable && valueString.toLowerCase().includes(searchTerm))
    )
  );

  const typeLabel = typeLabels[type] || typeLabels.unknown;
  const countLabel = expandable ? `${entries.length}` : undefined;

  return (
    <div
      className={cn(
        'group relative border-l border-muted-foreground/20 pl-3',
        matches && 'bg-amber-500/10 dark:bg-amber-400/10'
      )}
    >
      <div className="flex items-start gap-2 py-1">
        <button
          type="button"
          className={cn(
            'mt-1 flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground',
            !expandable && 'opacity-0'
          )}
          onClick={() => expandable && onToggle(path)}
          aria-label={isExpanded ? labels.collapse : labels.expand}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12px] text-foreground">{displayName}</span>
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
              {typeLabel}
              {countLabel ? ` · ${countLabel}` : ''}
            </Badge>
          </div>
          {!expandable && (
            <div className={cn('font-mono text-[11px] break-all', valueClass(type))}>
              {formatValue(value, type)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 pt-0.5 opacity-0 transition group-hover:opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => onCopyPath(path)}
                aria-label={labels.copyPath}
              >
                <FileJson className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{labels.copyPath}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => onCopyValue(value)}
                aria-label={labels.copyValue}
              >
                <Copy className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{labels.copyValue}</TooltipContent>
          </Tooltip>
        </div>
      </div>
      {expandable && isExpanded && entries.length > 0 && (
        <div className="pl-4">
          {entries.map(([childName, childValue]) => (
            <JsonNode
              key={typeof childName === 'number' ? childName : String(childName)}
              name={childName}
              value={childValue}
              path={path.concat(childName)}
              searchTerm={searchTerm}
              labels={labels}
              typeLabels={typeLabels}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              onCopyPath={onCopyPath}
              onCopyValue={onCopyValue}
            />
          ))}
        </div>
      )}
    </div>
  );
});

JsonNode.displayName = 'JsonNode';

export function JsonTreeViewer({ value, collapsed = false, maxHeight = '20rem', className }) {
  const { t } = useTranslation(['common', 'jsonViewer', 'messages']);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(new Set([ROOT_KEY]));
  const [feedback, setFeedback] = useState('');
  const feedbackTimer = useRef();

  const data = useMemo(() => value, [value]);
  const searchTerm = search.trim().toLowerCase();

  const typeLabels = useMemo(
    () => ({
      // NOTE: useTranslation 默认命名空间是 'common'，
      // 这里不应再在 key 前加 'common.' 前缀，否则会导致找不到翻译而显示原 key。
      object: t('jsonViewer.typeLabels.object'),
      array: t('jsonViewer.typeLabels.array'),
      string: t('jsonViewer.typeLabels.string'),
      number: t('jsonViewer.typeLabels.number'),
      boolean: t('jsonViewer.typeLabels.boolean'),
      null: t('jsonViewer.typeLabels.null'),
      undefined: t('jsonViewer.typeLabels.undefined'),
      unknown: t('jsonViewer.typeLabels.unknown')
    }),
    [t]
  );

  const labels = useMemo(
    () => ({
      root: t('jsonViewer.root'),
      searchPlaceholder: t('jsonViewer.searchPlaceholder'),
      expandAll: t('jsonViewer.expandAll'),
      collapseAll: t('jsonViewer.collapseAll'),
      copyJson: t('jsonViewer.copyJson'),
      copyPath: t('jsonViewer.copyPath'),
      copyValue: t('jsonViewer.copyValue'),
      expand: t('jsonViewer.expandNode'),
      collapse: t('jsonViewer.collapseNode'),
      copied: t('jsonViewer.copied'),
      noData: t('jsonViewer.noData')
    }),
    [t]
  );

  const defaultExpanded = useMemo(() => {
    const defaults = new Set([ROOT_KEY]);
    if (!collapsed) {
      const type = getType(data);
      const entries = type === 'array'
        ? data.map((_, index) => [index, data[index]])
        : Object.entries(data || {});
      entries.forEach(([key, child]) => {
        if (isExpandableType(getType(child))) {
          defaults.add(getPathKey([key]));
        }
      });
    }
    return defaults;
  }, [data, collapsed]);

  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);

  const showFeedback = useCallback((message) => {
    setFeedback(message);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(''), 1200);
  }, []);

  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  useEffect(() => {
    if (!searchTerm) return;
    const matches = findMatches(data, searchTerm);
    if (matches.length === 0) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      matches.forEach((matchPath) => {
        ancestorsOf(matchPath).forEach((ancestorKey) => next.add(ancestorKey));
      });
      return next;
    });
  }, [data, searchTerm]);

  const expandablePaths = useMemo(() => collectExpandablePaths(data), [data]);

  const handleToggle = useCallback((path) => {
    const key = getPathKey(path);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    setExpanded(new Set(expandablePaths));
  }, [expandablePaths]);

  const handleCollapseAll = useCallback(() => {
    setExpanded(new Set([ROOT_KEY]));
  }, []);

  const copyToClipboard = useCallback((text) => {
    if (!text && text !== '') return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          showFeedback(labels.copied);
        })
        .catch(() => {});
    }
  }, [labels.copied, showFeedback]);

  const handleCopyJson = useCallback(() => {
    try {
      const json = JSON.stringify(data, null, 2);
      copyToClipboard(json);
    } catch {
      copyToClipboard(String(data));
    }
  }, [copyToClipboard, data]);

  const handleCopyPath = useCallback((path) => {
    copyToClipboard(pathToString(path));
  }, [copyToClipboard]);

  const handleCopyValue = useCallback((valueToCopy) => {
    const type = getType(valueToCopy);
    const text = isExpandableType(type)
      ? JSON.stringify(valueToCopy, null, 2)
      : String(valueToCopy ?? '');
    copyToClipboard(text);
  }, [copyToClipboard]);

  return (
    <div
      className={cn('border rounded bg-background text-xs shadow-sm', className)}
      style={{ maxHeight, display: 'flex', flexDirection: 'column' }}
    >
      <div className="flex items-center gap-2 border-b bg-muted/30 px-2 py-2">
        <div className="relative flex-1">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={labels.searchPlaceholder}
            className="h-8 w-full pl-7 text-xs"
          />
          <span className="pointer-events-none absolute left-2 top-1/2 flex -translate-y-1/2 text-muted-foreground">
            <Search className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleExpandAll}
            className="h-8 w-8"
            aria-label={labels.expandAll}
          >
            <ChevronsDown className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleCollapseAll}
            className="h-8 w-8"
            aria-label={labels.collapseAll}
          >
            <ChevronsUp className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleCopyJson}
            className="h-8 w-8"
            aria-label={labels.copyJson}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        {feedback && (
          <span className="ml-2 text-[10px] text-muted-foreground">{feedback}</span>
        )}
      </div>
      <div className="flex-1 overflow-auto px-2 py-2">
        {data === undefined || data === null ? (
          <div className="text-xs text-muted-foreground">{labels.noData}</div>
        ) : (
          <JsonNode
            name={labels.root}
            value={data}
            path={ROOT_PATH}
            searchTerm={searchTerm}
            labels={labels}
            typeLabels={typeLabels}
            expandedPaths={expanded}
            onToggle={handleToggle}
            onCopyPath={handleCopyPath}
            onCopyValue={handleCopyValue}
          />
        )}
      </div>
    </div>
  );
}

JsonTreeViewer.propTypes = {
  value: PropTypes.any,
  collapsed: PropTypes.bool,
  maxHeight: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  className: PropTypes.string
};

export default JsonTreeViewer;
