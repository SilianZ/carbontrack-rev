import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

import { Button } from '../ui/Button';

const DEFAULT_LABELS = {
  copy: 'Copy NDJSON',
  exportNdjson: 'Export NDJSON',
  exportCsv: 'Export CSV',
  records: 'records',
  maxHint: '(max 1000)'
};

export default function RawView({
  system = [],
  audit = [],
  error = [],
  llm = [],
  onExportCsv,
  onExportNdjson,
  labels = {}
}) {
  const merged = useMemo(() => (
    [
      ...system.map((record) => ({ ...record, __type: 'system' })),
      ...audit.map((record) => ({ ...record, __type: 'audit' })),
      ...error.map((record) => ({ ...record, __type: 'error' })),
      ...llm.map((record) => ({ ...record, __type: 'llm' }))
    ]
      .sort((a, b) => {
        const ta = Date.parse(a.created_at || a.error_time || a.time || a.timestamp || 0) || 0;
        const tb = Date.parse(b.created_at || b.error_time || b.time || b.timestamp || 0) || 0;
        return tb - ta;
      })
      .slice(0, 1000)
  ), [system, audit, error, llm]);

  const labelSet = { ...DEFAULT_LABELS, ...labels };
  const ndjson = useMemo(() => merged.map((item) => JSON.stringify(item)).join('\n'), [merged]);

  const copyAll = () => {
    if (!ndjson) return;
    navigator.clipboard.writeText(ndjson).catch(() => {});
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Button size="sm" variant="outline" className="h-8 px-3" onClick={copyAll}>
          {labelSet.copy}
        </Button>
        <Button size="sm" variant="outline" className="h-8 px-3" onClick={onExportNdjson}>
          {labelSet.exportNdjson}
        </Button>
        <Button size="sm" variant="outline" className="h-8 px-3" onClick={onExportCsv}>
          {labelSet.exportCsv}
        </Button>
        <div className="text-muted-foreground">
          {merged.length} {labelSet.records} {labelSet.maxHint}
        </div>
      </div>
      <pre className="max-h-[60vh] overflow-auto whitespace-pre rounded bg-black p-3 text-[10px] leading-tight text-green-300">
        {ndjson}
      </pre>
    </div>
  );
}

RawView.propTypes = {
  system: PropTypes.array,
  audit: PropTypes.array,
  error: PropTypes.array,
  llm: PropTypes.array,
  onExportCsv: PropTypes.func,
  onExportNdjson: PropTypes.func,
  labels: PropTypes.object
};
