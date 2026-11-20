import React, { useMemo } from 'react';

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

function newItemId() {
  return `i_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
}

export default function ChecklistNodeBody({ node, darkNodes, onUpdate }) {
  const items = Array.isArray(node.items) ? node.items : [];
  const fieldLooks = useMemo(() => inputClass(darkNodes, node.color), [darkNodes, node.color]);
  const done = items.filter((i) => i.done).length;

  const patchItems = (next) => onUpdate({ items: next });

  return (
    <div className="px-3 pb-3 pt-1" onPointerDown={(e) => e.stopPropagation()}>
      <p
        className={`mb-2 text-[11px] font-medium tabular-nums ${
          darkNodes ? 'text-zinc-400' : 'text-slate-500'
        }`}
      >
        {done}/{items.length || 0} done
      </p>
      <ul className="flex flex-col gap-1.5">
        {items.map((item, index) => (
          <li key={item.id || index} className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={Boolean(item.done)}
              onChange={(e) => {
                const next = items.map((it, i) =>
                  i === index ? { ...it, done: e.target.checked } : it
                );
                patchItems(next);
              }}
              className="mt-2 h-3.5 w-3.5 shrink-0 rounded border-slate-400"
            />
            <input
              type="text"
              value={item.text || ''}
              onChange={(e) => {
                const next = items.map((it, i) =>
                  i === index ? { ...it, text: e.target.value } : it
                );
                patchItems(next);
              }}
              placeholder="Task…"
              className={`${fieldLooks.className} ${
                item.done ? 'line-through opacity-60' : ''
              }`}
              style={fieldLooks.style}
            />
            <button
              type="button"
              title="Remove"
              onClick={() => patchItems(items.filter((_, i) => i !== index))}
              className={`mt-1 shrink-0 rounded px-1.5 text-xs ${
                darkNodes ? 'text-zinc-400 hover:bg-white/10' : 'text-slate-500 hover:bg-black/5'
              }`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => patchItems([...items, { id: newItemId(), text: '', done: false }])}
        className={`mt-2 w-full rounded-md px-2 py-1.5 text-left text-xs font-medium transition ${
          darkNodes
            ? 'text-indigo-200 hover:bg-white/10'
            : 'text-indigo-700 hover:bg-indigo-50'
        }`}
      >
        + Add item
      </button>
    </div>
  );
}
