import React, { useMemo } from 'react';
import {
  UNIT_CATEGORIES,
  categoryForUnit,
  formatUnitResult,
  listCompatibleUnits,
} from '@/lib/units';

function inputClass(darkNodes, color) {
  return {
    className: `w-full rounded-md border px-2 py-1.5 text-sm outline-none ${
      darkNodes
        ? 'border-white/10 bg-black/20 text-zinc-100 placeholder:text-zinc-500'
        : 'border-slate-200 bg-white/80 text-slate-800 placeholder:text-slate-400'
    }`,
    style: { borderColor: `${color}55` },
  };
}

export default function UnitConvertNodeBody({
  node,
  darkNodes,
  onUpdate,
  dataResult,
  hasInboundNumber = false,
}) {
  const fieldLooks = useMemo(() => inputClass(darkNodes, node.color), [darkNodes, node.color]);
  const fromUnit = node.fromUnit || 'm';
  const toOptions = listCompatibleUnits(fromUnit);
  const catId = categoryForUnit(fromUnit);
  const result = dataResult?.value;
  const error = dataResult?.error;

  return (
    <div className="flex flex-col gap-2 px-3 pb-3 pt-1" onPointerDown={(e) => e.stopPropagation()}>
      <input
        type="text"
        inputMode="decimal"
        value={node.value ?? ''}
        disabled={hasInboundNumber}
        onChange={(e) => onUpdate({ value: e.target.value })}
        placeholder={hasInboundNumber ? 'Using connected number…' : 'Value'}
        className={`${fieldLooks.className} ${hasInboundNumber ? 'opacity-60' : ''}`}
        style={fieldLooks.style}
        title={hasInboundNumber ? 'Number comes from the connected node' : 'Type a number'}
      />
      <select
        value={fromUnit}
        onChange={(e) => {
          const nextFrom = e.target.value;
          const compatible = listCompatibleUnits(nextFrom);
          const keepTo = compatible.some((u) => u.id === node.toUnit);
          onUpdate({
            fromUnit: nextFrom,
            toUnit: keepTo ? node.toUnit : compatible.find((u) => u.id !== nextFrom)?.id || compatible[0]?.id,
          });
        }}
        className={fieldLooks.className}
        style={fieldLooks.style}
        title="From unit"
      >
        {UNIT_CATEGORIES.map((cat) => (
          <optgroup key={cat.id} label={cat.label}>
            {cat.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <select
        value={toOptions.some((u) => u.id === node.toUnit) ? node.toUnit : toOptions[0]?.id || ''}
        onChange={(e) => onUpdate({ toUnit: e.target.value })}
        className={fieldLooks.className}
        style={fieldLooks.style}
        title={`To unit (${catId || 'matching'} only)`}
      >
        {toOptions.map((u) => (
          <option key={u.id} value={u.id}>
            {u.label}
          </option>
        ))}
      </select>
      <div
        className={`rounded-md border px-2.5 py-2 text-sm tabular-nums ${
          darkNodes
            ? 'border-white/10 bg-black/20 text-zinc-100'
            : 'border-slate-200 bg-white/70 text-slate-800'
        }`}
      >
        {error ? (
          <span className={darkNodes ? 'text-amber-200' : 'text-amber-800'}>{error}</span>
        ) : (
          <>
            {formatUnitResult(result?.result ?? result?.input) != null && result?.display != null
              ? result.display
              : '—'}{' '}
            <span className={darkNodes ? 'text-zinc-400' : 'text-slate-500'}>{node.toUnit}</span>
          </>
        )}
      </div>
    </div>
  );
}
