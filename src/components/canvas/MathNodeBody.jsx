import React from 'react';
import { defForKind, fieldVisibleForNode, isNumberNode, NODE_KIND } from '@/lib/nodeTypes';

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

export default function MathNodeBody({ node, darkNodes, result, onUpdate }) {
  const def = defForKind(node.kind);
  const fieldLooks = inputClass(darkNodes, node.color);
  const preview = result?.flat || '';
  const emptyHint = !preview && (result?.error === 'Empty number' || result?.error === 'Empty expression' || result?.error === 'Connect a Math node' || !result);
  const isError = Boolean(result?.error) && !emptyHint;
  const showField = fieldVisibleForNode(def, node);

  return (
    <div className="px-3 pt-2 pb-3" onPointerDown={(e) => e.stopPropagation()}>
      {isNumberNode(node) && (
        <input
          type="number"
          step="any"
          value={node.value ?? ''}
          onChange={(e) => onUpdate({ value: e.target.value })}
          placeholder="0"
          {...fieldLooks}
        />
      )}

      {node.kind === NODE_KIND.EXPRESSION && (
        <textarea
          value={node.expr ?? ''}
          onChange={(e) => onUpdate({ expr: e.target.value })}
          placeholder={def?.field?.placeholder || 'x^2+1'}
          rows={2}
          className={`${fieldLooks.className} resize-none leading-relaxed`}
          style={fieldLooks.style}
        />
      )}

      {def?.modes?.length > 0 && (
        <select
          value={node.mode || def.modes[0].id}
          onChange={(e) => onUpdate({ mode: e.target.value })}
          className={`${fieldLooks.className} ${node.kind === NODE_KIND.EXPRESSION || isNumberNode(node) ? 'mt-2' : ''}`}
          style={fieldLooks.style}
        >
          {def.modes.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.label}
            </option>
          ))}
        </select>
      )}

      {showField && def.field.key !== 'expr' && (
        <input
          type="text"
          value={node.field ?? ''}
          onChange={(e) => onUpdate({ field: e.target.value })}
          placeholder={def.field.placeholder || def.field.label}
          className={`${fieldLooks.className} mt-2`}
          style={fieldLooks.style}
        />
      )}

      <div
        className={`mt-2 min-h-[2.25rem] break-all text-center font-semibold tracking-tight ${
          isError ? 'text-sm text-rose-400' : 'text-2xl tabular-nums text-gray-500'
        }`}
      >
        {isError ? result.error : preview || '\u00a0'}
      </div>
    </div>
  );
}
