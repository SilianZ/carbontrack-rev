import React, { useState, useMemo } from 'react';
import JsonTreeViewer from './JsonTreeViewer';

function tryParse(v){
  if (v == null) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return v; }
}

function buildDiff(oldVal, newVal, path = []) {
  if (Object.is(oldVal, newVal)) return [];
  const typeOld = typeof oldVal;
  const typeNew = typeof newVal;
  if (typeOld !== 'object' || typeNew !== 'object' || oldVal === null || newVal === null) {
    return [{ path: path.join('.'), old: oldVal, new: newVal }];
  }
  const keys = Array.from(new Set([...Object.keys(oldVal), ...Object.keys(newVal)]));
  const changes = [];
  for (const k of keys) {
    changes.push(...buildDiff(oldVal[k], newVal[k], path.concat(k)));
  }
  return changes.filter(c=>!(c.old === c.new));
}

export default function AuditDiffViewer({ oldData, newData }) {
  const [mode, setMode] = useState('inline'); // inline | side | tree
  const oldParsed = useMemo(()=> tryParse(oldData), [oldData]);
  const newParsed = useMemo(()=> tryParse(newData), [newData]);
  const diff = useMemo(()=> buildDiff(oldParsed||{}, newParsed||{}), [oldParsed, newParsed]);

  return (
    <div className="rounded border border-border bg-card text-xs text-card-foreground">
      <div className="flex items-center gap-2 border-b border-border bg-muted/50 p-2">
        <strong>变更 Diff</strong>
        <div className="ml-auto flex gap-1">
          {['inline','side','tree'].map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded px-2 py-0.5 transition-colors ${
                mode === m
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      {mode === 'tree' && (
        <div className="grid grid-cols-2 gap-2 p-2">
          <div>
            <div className="font-semibold mb-1">旧</div>
            <JsonTreeViewer value={oldParsed} collapsed />
          </div>
          <div>
            <div className="font-semibold mb-1">新</div>
            <JsonTreeViewer value={newParsed} collapsed />
          </div>
        </div>
      )}
      {mode === 'side' && (
        <div className="p-2 overflow-auto">
          <table className="w-full text-[11px]">
            <thead><tr className="bg-muted"><th className="p-1 text-left">字段</th><th className="p-1 text-left">旧</th><th className="p-1 text-left">新</th></tr></thead>
            <tbody>
            {diff.length === 0 && <tr><td colSpan={3} className="p-2 text-center text-muted-foreground">无差异</td></tr>}
            {diff.map(d => (
              <tr key={d.path} className="border-t">
                <td className="p-1 align-top font-mono">{d.path || '(root)'}</td>
                <td className="p-1 break-all font-mono text-red-600 dark:text-red-300">{JSON.stringify(d.old)}</td>
                <td className="p-1 break-all font-mono text-green-700 dark:text-green-300">{JSON.stringify(d.new)}</td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      )}
      {mode === 'inline' && (
        <div className="p-2 space-y-1 max-h-80 overflow-auto">
          {diff.length === 0 && <div className="text-muted-foreground">无差异</div>}
          {diff.map(d => (
            <div key={d.path} className="rounded border border-border bg-muted/40 p-1">
              <div className="mb-1 font-mono text-[10px] text-muted-foreground">{d.path || '(root)'}</div>
              <div className="flex flex-col md:flex-row gap-2">
                <div className="flex-1 rounded bg-red-500/10 p-1 dark:bg-red-500/15"><span className="text-red-700 dark:text-red-300">旧:</span> <code className="break-all">{JSON.stringify(d.old)}</code></div>
                <div className="flex-1 rounded bg-green-500/10 p-1 dark:bg-green-500/15"><span className="text-green-700 dark:text-green-300">新:</span> <code className="break-all">{JSON.stringify(d.new)}</code></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
