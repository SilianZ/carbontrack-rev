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

const KEY_MAP = {
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
  lstatus: 'llm_status',
  llm_status: 'llm_status'
};

const RANGE_KEYS = new Set(['duration_ms','status_code']);

export function parseLogQuery(input) {
  const tokens = {};
  const ranges = {};
  const rest = [];
  const regex = /("[^"]+"|\S+)/g;
  const parts = (input || '').match(regex) || [];
  for (const partRaw of parts) {
    const part = partRaw.trim();
    if (!part) continue;
    const m = part.match(/^([^:!<>=]+)(!?=|>=|<=|>|<|:)(.+)$/);
    if (m) {
      let [, k, op, v] = m;
      k = k.trim(); v = v.trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      const mapped = KEY_MAP[k] || k;
      if (RANGE_KEYS.has(mapped) && /^(>=|<=|>|<)$/.test(op)) {
        ranges[mapped] = ranges[mapped] || {};
        ranges[mapped][op] = v;
        continue;
      }
      if (op === '!=') { // negation placeholder (not sent to backend yet)
        tokens[mapped] = { value: v, negate: true };
        continue;
      }
      tokens[mapped] = v;
    } else {
      rest.push(part.replace(/^"|"$/g, ''));
    }
  }
  return { tokens, free: rest.join(' '), ranges, raw: input };
}

export function buildQueryParams(parsed) {
  const params = {};
  Object.entries(parsed.tokens).forEach(([k,v]) => {
    if (v && typeof v === 'object' && v.negate) return; // skip negate for now
    switch (k) {
      case 'duration_ms':
        // handled via ranges mapping
        break;
      case 'audit_status':
        params['audit_status'] = v;
        break;
      default:
        params[k] = typeof v === 'object' ? v.value : v;
    }
  });
  // ranges mapping -> backend param names
  if (parsed.ranges.duration_ms) {
    const r = parsed.ranges.duration_ms;
    if (r['>'] || r['>=']) params.min_duration = r['>'] || r['>='];
    if (r['<'] || r['<=']) params.max_duration = r['<'] || r['<='];
  }
  // status_code range not currently supported server-side (only equality). Ignore >/< for now.
  if (parsed.free) params.q = (params.q ? params.q + ' ' : '') + parsed.free;
  return params;
}

export default { parseLogQuery, buildQueryParams };
