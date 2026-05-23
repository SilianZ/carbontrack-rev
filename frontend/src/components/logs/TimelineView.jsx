import Silian_React, { useMemo as Silian_useMemo } from 'react';
import Silian_PropTypes from 'prop-types';

export function TimelineView({ system: Silian_system = [], audit: Silian_audit = [], error: Silian_error = [], llm: Silian_llm = [], onSelectRequest: Silian_onSelectRequest, emptyLabel: Silian_emptyLabel = 'No events' }) {
  // unify into events with timestamp
  const Silian_items = Silian_useMemo(() => {
    const Silian_mapTs = (Silian_v, Silian_type) => {
      let Silian_ts = Silian_v.created_at || Silian_v.error_time || Silian_v.time || Silian_v.timestamp;
      return { ...Silian_v, __type: Silian_type, __ts: Silian_ts ? Date.parse(Silian_ts) || 0 : 0 };
    };
    return [
      ...Silian_system.map(Silian_r => Silian_mapTs(Silian_r,'system')),
      ...Silian_audit.map(Silian_r => Silian_mapTs(Silian_r,'audit')),
      ...Silian_error.map(Silian_r => Silian_mapTs(Silian_r,'error')),
      ...Silian_llm.map(Silian_r => Silian_mapTs(Silian_r,'llm'))
    ].sort((Silian_a,Silian_b)=> Silian_b.__ts - Silian_a.__ts).slice(0,500);
  }, [Silian_system,Silian_audit,Silian_error,Silian_llm]);

  return (
    <div className="space-y-3">
      {Silian_items.map((Silian_it)=>(
        <div key={`${Silian_it.__type}-${Silian_it.id || Silian_it.request_id || Silian_it.__ts}`} className="flex items-start gap-2 text-xs">
          <div className={`w-20 text-right pr-2 font-mono ${Silian_color(Silian_it.__type)}`}>{Silian_it.__type}</div>
          <div className="flex-1 border-l pl-3 pb-3 relative">
            <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-green-500" />
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {Silian_it.request_id && <Silian_Badge asButton onClick={()=>Silian_onSelectRequest?.(Silian_it.request_id)}>{Silian_short(Silian_it.request_id)}</Silian_Badge>}
              {Silian_it.method && <Silian_Badge>{Silian_it.method}</Silian_Badge>}
              {Silian_it.status_code && <Silian_Badge tone={Silian_statusTone(Silian_it.status_code)}>{Silian_it.status_code}</Silian_Badge>}
              {Silian_it.duration_ms !== undefined && <Silian_Badge tone={Silian_durationTone(Silian_it.duration_ms)}>{Silian_it.duration_ms}ms</Silian_Badge>}
              {Silian_it.error_type && <Silian_Badge tone="red">{Silian_it.error_type}</Silian_Badge>}
              {Silian_it.action && <Silian_Badge>{Silian_it.action}</Silian_Badge>}
              {Silian_it.model && <Silian_Badge tone="blue">{Silian_it.model}</Silian_Badge>}
              {Silian_it.status && Silian_it.__type === 'llm' && <Silian_Badge tone={Silian_it.status === 'failed' ? 'red' : 'green'}>{Silian_it.status}</Silian_Badge>}
              {Silian_it.total_tokens !== undefined && Silian_it.__type === 'llm' && <Silian_Badge tone="orange">{Silian_it.total_tokens}</Silian_Badge>}
            </div>
            {Silian_it.path && <div className="font-mono text-[10px] mt-1 break-all text-gray-600">{Silian_it.path}</div>}
            {Silian_it.error_message && <div className="font-mono text-[10px] mt-1 text-rose-600 break-all" title={Silian_it.error_message}>{Silian_it.error_message.slice(0,180)}</div>}
            {Silian_it.prompt && Silian_it.__type === 'llm' && (
              <div className="font-mono text-[10px] mt-1 text-gray-600 break-all" title={Silian_it.prompt}>
                {String(Silian_it.prompt).slice(0, 180)}
              </div>
            )}
            <div className="text-[10px] text-gray-400 mt-1">{Silian_it.created_at || Silian_it.error_time}</div>
          </div>
        </div>
      ))}
      {Silian_items.length === 0 && <div className="text-xs text-gray-400">{Silian_emptyLabel}</div>}
    </div>
  );
}

function Silian_Badge({ children: Silian_children, tone: Silian_tone='gray', onClick: Silian_onClick, asButton: Silian_asButton=false }) {
  const Silian_colors = {
    gray:'bg-gray-200 text-gray-700',
    green:'bg-green-200 text-green-800',
    yellow:'bg-yellow-200 text-yellow-800',
    red:'bg-red-200 text-red-800',
    blue:'bg-blue-200 text-blue-800',
    orange:'bg-orange-200 text-orange-800'
  };
  const Silian_className = `px-1.5 py-0.5 rounded ${Silian_onClick? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400':'cursor-default'} ${Silian_colors[Silian_tone]||Silian_colors.gray} text-[10px] inline-flex items-center`;
  if (Silian_asButton || Silian_onClick) {
    return <button type="button" className={Silian_className} onClick={Silian_onClick}>{Silian_children}</button>;
  }
  return <span className={Silian_className}>{Silian_children}</span>;
}
Silian_Badge.propTypes = {
  children: Silian_PropTypes.node,
  tone: Silian_PropTypes.string,
  onClick: Silian_PropTypes.func,
  asButton: Silian_PropTypes.bool
};

function Silian_statusTone(Silian_code){
  if (Silian_code >=500) return 'red';
  if (Silian_code >=400) return 'orange';
  if (Silian_code >=300) return 'yellow';
  if (Silian_code >=200) return 'green';
  return 'gray';
}
function Silian_durationTone(Silian_ms){
  if (Silian_ms >= 1500) return 'red';
  if (Silian_ms >= 1000) return 'orange';
  if (Silian_ms >= 500) return 'yellow';
  return 'green';
}
function Silian_color(Silian_type){
  switch(Silian_type){
    case 'system': return 'text-green-600';
    case 'audit': return 'text-blue-600';
    case 'error': return 'text-red-600';
    case 'llm': return 'text-indigo-600';
    default: return 'text-gray-500';
  }
}
function Silian_short(Silian_id){ return Silian_id && Silian_id.length>10 ? Silian_id.slice(0,6)+'…'+Silian_id.slice(-4) : Silian_id; }

TimelineView.propTypes = {
  system: Silian_PropTypes.array,
  audit: Silian_PropTypes.array,
  error: Silian_PropTypes.array,
  llm: Silian_PropTypes.array,
  onSelectRequest: Silian_PropTypes.func,
  emptyLabel: Silian_PropTypes.string
};

export default TimelineView;
