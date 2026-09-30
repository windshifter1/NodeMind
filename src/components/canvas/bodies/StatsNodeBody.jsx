import React, { useMemo } from 'react';
import { STAT_METRIC_OPTIONS } from '@/lib/dataEvalGraph';
import { formatUnitResult } from '@/lib/units';

function inputClass(darkNodes, color) {
  return {
    className: `w-full rounded-md border px-2 py-1.5 text-sm outline-none ${
      darkNodes
        ? 'border-white/10 bg-black/20 text-zinc-100'
        : 'border-slate-200 bg-white/80 text-slate-800'
    }`,
    style: { borderColor: `${color}55` },
  };
}

export default function StatsNodeBody({ node, darkNodes, onUpdate, dataResult }) {
  const fieldLooks = useMemo(() => inputClass(darkNodes, node.color), [darkNodes, node.color]);
  const stats = dataResult?.kind === 'stats' ? dataResult.value : null;
  const error = dataResult?.error;
  const metrics = Array.isArray(node.statsMetrics) ? node.statsMetrics : ['mean'];
  const columns = stats?.table?.columns || [];

  return (
    <div className="flex flex-col gap-2 px-3 pb-3 pt-1" onPointerDown={(e) => e.stopPropagation()}>
      {columns.length > 0 && (
        <select
          value={node.statsColumn || columns[0]?.id || ''}
          onChange={(e) => onUpdate({ statsColumn: e.target.value })}
          className={fieldLooks.className}
          style={fieldLooks.style}
        >
          {columns.map((c) => (
            <option key={c.id} value={c.id}>
              Column: {c.name || c.id}
            </option>
          ))}
        </select>
      )}
      <div className="flex flex-wrap gap-1.5">
        {STAT_METRIC_OPTIONS.map((m) => {
          const on = metrics.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                const next = on ? metrics.filter((id) => id !== m.id) : [...metrics, m.id];
                onUpdate({ statsMetrics: next.length ? next : [m.id] });
              }}
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
                on
                  ? 'bg-indigo-500/35 text-indigo-100'
                  : darkNodes
                    ? 'bg-white/5 text-zinc-400 hover:bg-white/10'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      {error && (
        <p className={`text-xs ${darkNodes ? 'text-amber-200' : 'text-amber-800'}`}>{error}</p>
      )}
      {stats?.metrics && (
        <ul className={`space-y-1 text-sm tabular-nums ${darkNodes ? 'text-zinc-100' : 'text-slate-800'}`}>
          {Object.entries(stats.metrics).map(([key, val]) => (
            <li key={key} className="flex justify-between gap-3">
              <span className={darkNodes ? 'text-zinc-400' : 'text-slate-500'}>
                {STAT_METRIC_OPTIONS.find((m) => m.id === key)?.label || key}
              </span>
              <span>{Number.isFinite(val) ? formatUnitResult(val) : '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
