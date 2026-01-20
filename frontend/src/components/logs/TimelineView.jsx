import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

export function TimelineView({ system = [], audit = [], error = [], llm = [], onSelectRequest, emptyLabel = 'No events' }) {
  // unify into events with timestamp
  const items = useMemo(() => {
    const mapTs = (v, type) => {
      let ts = v.created_at || v.error_time || v.time || v.timestamp;
      return { ...v, __type: type, __ts: ts ? Date.parse(ts) || 0 : 0 };
    };
    return [
      ...system.map(r => mapTs(r,'system')),
      ...audit.map(r => mapTs(r,'audit')),
      ...error.map(r => mapTs(r,'error')),
      ...llm.map(r => mapTs(r,'llm'))
    ].sort((a,b)=> b.__ts - a.__ts).slice(0,500);
  }, [system,audit,error,llm]);

  return (
    <div className="space-y-3">
      {items.map((it)=>(
        <div key={`${it.__type}-${it.id || it.request_id || it.__ts}`} className="flex items-start gap-2 text-xs">
          <div className={`w-20 text-right pr-2 font-mono ${color(it.__type)}`}>{it.__type}</div>
          <div className="flex-1 border-l pl-3 pb-3 relative">
            <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-green-500" />
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {it.request_id && <Badge asButton onClick={()=>onSelectRequest?.(it.request_id)}>{short(it.request_id)}</Badge>}
              {it.method && <Badge>{it.method}</Badge>}
              {it.status_code && <Badge tone={statusTone(it.status_code)}>{it.status_code}</Badge>}
              {it.duration_ms !== undefined && <Badge tone={durationTone(it.duration_ms)}>{it.duration_ms}ms</Badge>}
              {it.error_type && <Badge tone="red">{it.error_type}</Badge>}
              {it.action && <Badge>{it.action}</Badge>}
              {it.model && <Badge tone="blue">{it.model}</Badge>}
              {it.status && it.__type === 'llm' && <Badge tone={it.status === 'failed' ? 'red' : 'green'}>{it.status}</Badge>}
              {it.total_tokens !== undefined && it.__type === 'llm' && <Badge tone="orange">{it.total_tokens}</Badge>}
            </div>
            {it.path && <div className="font-mono text-[10px] mt-1 break-all text-gray-600">{it.path}</div>}
            {it.error_message && <div className="font-mono text-[10px] mt-1 text-rose-600 break-all" title={it.error_message}>{it.error_message.slice(0,180)}</div>}
            {it.prompt && it.__type === 'llm' && (
              <div className="font-mono text-[10px] mt-1 text-gray-600 break-all" title={it.prompt}>
                {String(it.prompt).slice(0, 180)}
              </div>
            )}
            <div className="text-[10px] text-gray-400 mt-1">{it.created_at || it.error_time}</div>
          </div>
        </div>
      ))}
      {items.length === 0 && <div className="text-xs text-gray-400">{emptyLabel}</div>}
    </div>
  );
}

function Badge({ children, tone='gray', onClick, asButton=false }) {
  const colors = {
    gray:'bg-gray-200 text-gray-700',
    green:'bg-green-200 text-green-800',
    yellow:'bg-yellow-200 text-yellow-800',
    red:'bg-red-200 text-red-800',
    blue:'bg-blue-200 text-blue-800',
    orange:'bg-orange-200 text-orange-800'
  };
  const className = `px-1.5 py-0.5 rounded ${onClick? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400':'cursor-default'} ${colors[tone]||colors.gray} text-[10px] inline-flex items-center`;
  if (asButton || onClick) {
    return <button type="button" className={className} onClick={onClick}>{children}</button>;
  }
  return <span className={className}>{children}</span>;
}
Badge.propTypes = {
  children: PropTypes.node,
  tone: PropTypes.string,
  onClick: PropTypes.func,
  asButton: PropTypes.bool
};

function statusTone(code){
  if (code >=500) return 'red';
  if (code >=400) return 'orange';
  if (code >=300) return 'yellow';
  if (code >=200) return 'green';
  return 'gray';
}
function durationTone(ms){
  if (ms >= 1500) return 'red';
  if (ms >= 1000) return 'orange';
  if (ms >= 500) return 'yellow';
  return 'green';
}
function color(type){
  switch(type){
    case 'system': return 'text-green-600';
    case 'audit': return 'text-blue-600';
    case 'error': return 'text-red-600';
    case 'llm': return 'text-indigo-600';
    default: return 'text-gray-500';
  }
}
function short(id){ return id && id.length>10 ? id.slice(0,6)+'…'+id.slice(-4) : id; }

TimelineView.propTypes = {
  system: PropTypes.array,
  audit: PropTypes.array,
  error: PropTypes.array,
  llm: PropTypes.array,
  onSelectRequest: PropTypes.func,
  emptyLabel: PropTypes.string
};

export default TimelineView;
