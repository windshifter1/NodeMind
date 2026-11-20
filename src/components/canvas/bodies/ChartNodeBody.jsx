import React, { useMemo } from 'react';
import { parseNumericInput } from '@/lib/units';

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

const CHART_TYPES = [
  { id: 'bar', label: 'Bar' },
  { id: 'line', label: 'Line' },
  { id: 'pie', label: 'Pie' },
  { id: 'scatter', label: 'Scatter' },
];

export default function ChartNodeBody({ node, darkNodes, onUpdate, dataResult }) {
  const fieldLooks = useMemo(() => inputClass(darkNodes, node.color), [darkNodes, node.color]);
  const series = dataResult?.value;
  const table = series?.table;
  const error = dataResult?.error;
  const chartType = node.chartType || 'bar';
  const xKey = node.xKey || table?.columns?.[0]?.id || '';
  const yKeys = Array.isArray(node.yKeys) ? node.yKeys : [];
  const yKey = yKeys[0] || table?.columns?.[1]?.id || '';

  const points = useMemo(() => {
    if (!table) return [];
    return (table.rows || []).map((row, i) => ({
      label: String(row?.[xKey] ?? i + 1),
      x: parseNumericInput(row?.[xKey]),
      y: parseNumericInput(row?.[yKey]),
      rawY: row?.[yKey],
    }));
  }, [table, xKey, yKey]);

  return (
    <div className="flex flex-col gap-2 px-3 pb-3 pt-1" onPointerDown={(e) => e.stopPropagation()}>
      <select
        value={chartType}
        onChange={(e) => onUpdate({ chartType: e.target.value })}
        className={fieldLooks.className}
        style={fieldLooks.style}
      >
        {CHART_TYPES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      {table && (
        <div className="flex gap-2">
          <select
            value={xKey}
            onChange={(e) => onUpdate({ xKey: e.target.value })}
            className={fieldLooks.className}
            style={fieldLooks.style}
            title="X / labels"
          >
            {table.columns.map((c) => (
              <option key={c.id} value={c.id}>
                X: {c.name}
              </option>
            ))}
          </select>
          <select
            value={yKey}
            onChange={(e) => onUpdate({ yKeys: [e.target.value] })}
            className={fieldLooks.className}
            style={fieldLooks.style}
            title="Y values"
          >
            {table.columns.map((c) => (
              <option key={c.id} value={c.id}>
                Y: {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {error ? (
        <p className={`text-xs ${darkNodes ? 'text-amber-200' : 'text-amber-800'}`}>{error}</p>
      ) : (
        <ChartSvg type={chartType} points={points} darkNodes={darkNodes} color={node.color} />
      )}
    </div>
  );
}

function ChartSvg({ type, points, darkNodes, color }) {
  const w = 260;
  const h = 140;
  const pad = 18;
  const usable = points.filter((p) => Number.isFinite(p.y) || p.rawY != null);
  if (!usable.length) {
    return (
      <div
        className={`flex h-[140px] items-center justify-center rounded-md border text-xs ${
          darkNodes ? 'border-white/10 text-zinc-500' : 'border-slate-200 text-slate-400'
        }`}
      >
        No data yet
      </div>
    );
  }

  if (type === 'pie') {
    const vals = usable.map((p) => Math.abs(Number.isFinite(p.y) ? p.y : Number(p.rawY) || 0));
    const sum = vals.reduce((a, b) => a + b, 0) || 1;
    let angle = -Math.PI / 2;
    const cx = w / 2;
    const cy = h / 2;
    const r = 52;
    const slices = vals.map((v, i) => {
      const sweep = (v / sum) * Math.PI * 2;
      const a0 = angle;
      angle += sweep;
      const x0 = cx + r * Math.cos(a0);
      const y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(angle);
      const y1 = cy + r * Math.sin(angle);
      const large = sweep > Math.PI ? 1 : 0;
      return (
        <path
          key={i}
          d={`M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`}
          fill={color}
          opacity={0.35 + (i % 5) * 0.12}
          stroke={darkNodes ? '#fff3' : '#0002'}
        />
      );
    });
    return (
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="rounded-md">
        {slices}
      </svg>
    );
  }

  const ys = usable.map((p) => (Number.isFinite(p.y) ? p.y : 0));
  const xs = usable.map((p, i) => (Number.isFinite(p.x) ? p.x : i));
  const minY = Math.min(0, ...ys);
  const maxY = Math.max(...ys, 1);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs, minX + 1);
  const sx = (x) => pad + ((x - minX) / (maxX - minX || 1)) * (w - pad * 2);
  const sy = (y) => h - pad - ((y - minY) / (maxY - minY || 1)) * (h - pad * 2);

  if (type === 'bar') {
    const barW = Math.max(4, (w - pad * 2) / usable.length - 4);
    return (
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="rounded-md">
        <line x1={pad} y1={sy(0)} x2={w - pad} y2={sy(0)} stroke={darkNodes ? '#fff3' : '#0002'} />
        {usable.map((p, i) => {
          const x = pad + i * ((w - pad * 2) / usable.length) + 2;
          const y = sy(Number.isFinite(p.y) ? p.y : 0);
          const base = sy(0);
          const top = Math.min(y, base);
          const height = Math.abs(base - y) || 1;
          return <rect key={i} x={x} y={top} width={barW} height={height} fill={color} opacity={0.85} rx={2} />;
        })}
      </svg>
    );
  }

  const coords = usable.map((p, i) => ({
    x: type === 'scatter' ? sx(Number.isFinite(p.x) ? p.x : i) : sx(i),
    y: sy(Number.isFinite(p.y) ? p.y : 0),
  }));

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="rounded-md">
      <line x1={pad} y1={sy(0)} x2={w - pad} y2={sy(0)} stroke={darkNodes ? '#fff3' : '#0002'} />
      {type === 'line' && (
        <polyline
          fill="none"
          stroke={color}
          strokeWidth={2}
          points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
        />
      )}
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={type === 'scatter' ? 4 : 3} fill={color} />
      ))}
    </svg>
  );
}
