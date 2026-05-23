import Silian_React, { useState as Silian_useState, useMemo as Silian_useMemo } from 'react';
import Silian_JsonTreeViewer from './JsonTreeViewer';

function Silian_tryParse(Silian_v){
  if (Silian_v == null) return null;
  if (typeof Silian_v === 'object') return Silian_v;
  try { return JSON.parse(Silian_v); } catch { return Silian_v; }
}

function Silian_buildDiff(Silian_oldVal, Silian_newVal, Silian_path = []) {
  if (Object.is(Silian_oldVal, Silian_newVal)) return [];
  const Silian_typeOld = typeof Silian_oldVal;
  const Silian_typeNew = typeof Silian_newVal;
  if (Silian_typeOld !== 'object' || Silian_typeNew !== 'object' || Silian_oldVal === null || Silian_newVal === null) {
    return [{ path: Silian_path.join('.'), old: Silian_oldVal, new: Silian_newVal }];
  }
  const Silian_keys = Array.from(new Set([...Object.keys(Silian_oldVal), ...Object.keys(Silian_newVal)]));
  const Silian_changes = [];
  for (const Silian_k of Silian_keys) {
    Silian_changes.push(...Silian_buildDiff(Silian_oldVal[Silian_k], Silian_newVal[Silian_k], Silian_path.concat(Silian_k)));
  }
  return Silian_changes.filter(Silian_c=>!(Silian_c.old === Silian_c.new));
}

export default function AuditDiffViewer({ oldData: Silian_oldData, newData: Silian_newData }) {
  const [Silian_mode, Silian_setMode] = Silian_useState('inline'); // inline | side | tree
  const Silian_oldParsed = Silian_useMemo(()=> Silian_tryParse(Silian_oldData), [Silian_oldData]);
  const Silian_newParsed = Silian_useMemo(()=> Silian_tryParse(Silian_newData), [Silian_newData]);
  const Silian_diff = Silian_useMemo(()=> Silian_buildDiff(Silian_oldParsed||{}, Silian_newParsed||{}), [Silian_oldParsed, Silian_newParsed]);

  return (
    <div className="rounded border border-border bg-card text-xs text-card-foreground">
      <div className="flex items-center gap-2 border-b border-border bg-muted/50 p-2">
        <strong>变更 Diff</strong>
        <div className="ml-auto flex gap-1">
          {['inline','side','tree'].map(Silian_m => (
            <button
              key={Silian_m}
              onClick={() => Silian_setMode(Silian_m)}
              className={`rounded px-2 py-0.5 transition-colors ${
                Silian_mode === Silian_m
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {Silian_m}
            </button>
          ))}
        </div>
      </div>
      {Silian_mode === 'tree' && (
        <div className="grid grid-cols-2 gap-2 p-2">
          <div>
            <div className="font-semibold mb-1">旧</div>
            <Silian_JsonTreeViewer value={Silian_oldParsed} collapsed />
          </div>
          <div>
            <div className="font-semibold mb-1">新</div>
            <Silian_JsonTreeViewer value={Silian_newParsed} collapsed />
          </div>
        </div>
      )}
      {Silian_mode === 'side' && (
        <div className="p-2 overflow-auto">
          <table className="w-full text-[11px]">
            <thead><tr className="bg-muted"><th className="p-1 text-left">字段</th><th className="p-1 text-left">旧</th><th className="p-1 text-left">新</th></tr></thead>
            <tbody>
            {Silian_diff.length === 0 && <tr><td colSpan={3} className="p-2 text-center text-muted-foreground">无差异</td></tr>}
            {Silian_diff.map(Silian_d => (
              <tr key={Silian_d.path} className="border-t">
                <td className="p-1 align-top font-mono">{Silian_d.path || '(root)'}</td>
                <td className="p-1 break-all font-mono text-red-600 dark:text-red-300">{JSON.stringify(Silian_d.old)}</td>
                <td className="p-1 break-all font-mono text-green-700 dark:text-green-300">{JSON.stringify(Silian_d.new)}</td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      )}
      {Silian_mode === 'inline' && (
        <div className="p-2 space-y-1 max-h-80 overflow-auto">
          {Silian_diff.length === 0 && <div className="text-muted-foreground">无差异</div>}
          {Silian_diff.map(Silian_d => (
            <div key={Silian_d.path} className="rounded border border-border bg-muted/40 p-1">
              <div className="mb-1 font-mono text-[10px] text-muted-foreground">{Silian_d.path || '(root)'}</div>
              <div className="flex flex-col md:flex-row gap-2">
                <div className="flex-1 rounded bg-red-500/10 p-1 dark:bg-red-500/15"><span className="text-red-700 dark:text-red-300">旧:</span> <code className="break-all">{JSON.stringify(Silian_d.old)}</code></div>
                <div className="flex-1 rounded bg-green-500/10 p-1 dark:bg-green-500/15"><span className="text-green-700 dark:text-green-300">新:</span> <code className="break-all">{JSON.stringify(Silian_d.new)}</code></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
