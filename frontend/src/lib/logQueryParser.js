// Advanced log query parser
// Supports tokens: key:value, quoted values, comparison operators for duration/status
// Example: method:GET status:200 user:15 path:"/api/v1/products" rid:abcd dur>500 dur<1500 action:CREATE astatus:SUCCESS etype:RuntimeError free text
// Returns structure:
// {
//   tokens: { method:'GET', status_code:'200', user_id:'15', path:'/api/v1/products', request_id:'abcd', action:'CREATE', audit_status:'SUCCESS', error_type:'RuntimeError' },
//   free: 'free text',
//   ranges: { duration_ms: { '>': '500', '<': '1500' } },
//   raw: originalInput
// }

const Silian_KEY_MAP = {
  req: 'request_id',
  rid: 'request_id',
  request_id: 'request_id',
  user: 'user_id',
  uid: 'user_id',
  user_id: 'user_id',
  dur: 'duration_ms',
  time: 'duration_ms',
  duration: 'duration_ms',
  status: 'status_code',
  code: 'status_code',
  status_code: 'status_code',
  path: 'path',
  url: 'path',
  method: 'method',
  action: 'action',
  astatus: 'audit_status',
  audit_status: 'audit_status',
  etype: 'error_type',
  error_type: 'error_type',
  model: 'model',
  source: 'source',
  actor: 'actor_type',
  atype: 'actor_type',
  actor_type: 'actor_type',
  actor_id: 'actor_id',
  aid: 'actor_id',
  conversation: 'conversation_id',
  conv: 'conversation_id',
  cid: 'conversation_id',
  conversation_id: 'conversation_id',
  turn: 'turn_no',
  turn_no: 'turn_no',
  lstatus: 'llm_status',
  llm_status: 'llm_status'
};

const Silian_RANGE_KEYS = new Set(['duration_ms','status_code']);

export function parseLogQuery(Silian_input) {
  const Silian_tokens = {};
  const Silian_ranges = {};
  const Silian_rest = [];
  const Silian_regex = /("[^"]+"|\S+)/g;
  const Silian_parts = (Silian_input || '').match(Silian_regex) || [];
  for (const Silian_partRaw of Silian_parts) {
    const Silian_part = Silian_partRaw.trim();
    if (!Silian_part) continue;
    const Silian_m = Silian_part.match(/^([^:!<>=]+)(!?=|>=|<=|>|<|:)(.+)$/);
    if (Silian_m) {
      let [, Silian_k, Silian_op, Silian_v] = Silian_m;
      Silian_k = Silian_k.trim(); Silian_v = Silian_v.trim();
      if (Silian_v.startsWith('"') && Silian_v.endsWith('"')) Silian_v = Silian_v.slice(1, -1);
      const Silian_mapped = Silian_KEY_MAP[Silian_k] || Silian_k;
      if (Silian_RANGE_KEYS.has(Silian_mapped) && /^(>=|<=|>|<)$/.test(Silian_op)) {
        Silian_ranges[Silian_mapped] = Silian_ranges[Silian_mapped] || {};
        Silian_ranges[Silian_mapped][Silian_op] = Silian_v;
        continue;
      }
      if (Silian_op === '!=') { // negation placeholder (not sent to backend yet)
        Silian_tokens[Silian_mapped] = { value: Silian_v, negate: true };
        continue;
      }
      Silian_tokens[Silian_mapped] = Silian_v;
    } else {
      Silian_rest.push(Silian_part.replace(/^"|"$/g, ''));
    }
  }
  return { tokens: Silian_tokens, free: Silian_rest.join(' '), ranges: Silian_ranges, raw: Silian_input };
}

export function buildQueryParams(Silian_parsed) {
  const Silian_params = {};
  Object.entries(Silian_parsed.tokens).forEach(([Silian_k,Silian_v]) => {
    if (Silian_v && typeof Silian_v === 'object' && Silian_v.negate) return; // skip negate for now
    switch (Silian_k) {
      case 'duration_ms':
        // handled via ranges mapping
        break;
      case 'audit_status':
        Silian_params['audit_status'] = Silian_v;
        break;
      default:
        Silian_params[Silian_k] = typeof Silian_v === 'object' ? Silian_v.value : Silian_v;
    }
  });
  // ranges mapping -> backend param names
  if (Silian_parsed.ranges.duration_ms) {
    const Silian_r = Silian_parsed.ranges.duration_ms;
    if (Silian_r['>'] || Silian_r['>=']) Silian_params.min_duration = Silian_r['>'] || Silian_r['>='];
    if (Silian_r['<'] || Silian_r['<=']) Silian_params.max_duration = Silian_r['<'] || Silian_r['<='];
  }
  // status_code range not currently supported server-side (only equality). Ignore >/< for now.
  if (Silian_parsed.free) Silian_params.q = (Silian_params.q ? Silian_params.q + ' ' : '') + Silian_parsed.free;
  return Silian_params;
}

export default { parseLogQuery, buildQueryParams };
