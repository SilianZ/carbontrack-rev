import Silian_React, { useMemo as Silian_useMemo } from 'react';
import Silian_PropTypes from 'prop-types';

import { Button as Silian_Button } from '../ui/Button';

const Silian_DEFAULT_LABELS = {
  copy: 'Copy NDJSON',
  exportNdjson: 'Export NDJSON',
  exportCsv: 'Export CSV',
  records: 'records',
  maxHint: '(max 1000)'
};

export default function RawView({
  system: Silian_system = [],
  audit: Silian_audit = [],
  error: Silian_error = [],
  llm: Silian_llm = [],
  onExportCsv: Silian_onExportCsv,
  onExportNdjson: Silian_onExportNdjson,
  labels: Silian_labels = {}
}) {
  const Silian_merged = Silian_useMemo(() => (
    [
      ...Silian_system.map((Silian_record) => ({ ...Silian_record, __type: 'system' })),
      ...Silian_audit.map((Silian_record) => ({ ...Silian_record, __type: 'audit' })),
      ...Silian_error.map((Silian_record) => ({ ...Silian_record, __type: 'error' })),
      ...Silian_llm.map((Silian_record) => ({ ...Silian_record, __type: 'llm' }))
    ]
      .sort((Silian_a, Silian_b) => {
        const Silian_ta = Date.parse(Silian_a.created_at || Silian_a.error_time || Silian_a.time || Silian_a.timestamp || 0) || 0;
        const Silian_tb = Date.parse(Silian_b.created_at || Silian_b.error_time || Silian_b.time || Silian_b.timestamp || 0) || 0;
        return Silian_tb - Silian_ta;
      })
      .slice(0, 1000)
  ), [Silian_system, Silian_audit, Silian_error, Silian_llm]);

  const Silian_labelSet = { ...Silian_DEFAULT_LABELS, ...Silian_labels };
  const Silian_ndjson = Silian_useMemo(() => Silian_merged.map((Silian_item) => JSON.stringify(Silian_item)).join('\n'), [Silian_merged]);

  const Silian_copyAll = () => {
    if (!Silian_ndjson) return;
    navigator.clipboard.writeText(Silian_ndjson).catch(() => {});
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Silian_Button size="sm" variant="outline" className="h-8 px-3" onClick={Silian_copyAll}>
          {Silian_labelSet.copy}
        </Silian_Button>
        <Silian_Button size="sm" variant="outline" className="h-8 px-3" onClick={Silian_onExportNdjson}>
          {Silian_labelSet.exportNdjson}
        </Silian_Button>
        <Silian_Button size="sm" variant="outline" className="h-8 px-3" onClick={Silian_onExportCsv}>
          {Silian_labelSet.exportCsv}
        </Silian_Button>
        <div className="text-muted-foreground">
          {Silian_merged.length} {Silian_labelSet.records} {Silian_labelSet.maxHint}
        </div>
      </div>
      <pre className="max-h-[60vh] overflow-auto whitespace-pre rounded bg-black p-3 text-[10px] leading-tight text-green-300">
        {Silian_ndjson}
      </pre>
    </div>
  );
}

RawView.propTypes = {
  system: Silian_PropTypes.array,
  audit: Silian_PropTypes.array,
  error: Silian_PropTypes.array,
  llm: Silian_PropTypes.array,
  onExportCsv: Silian_PropTypes.func,
  onExportNdjson: Silian_PropTypes.func,
  labels: Silian_PropTypes.object
};
