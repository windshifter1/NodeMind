import React, { useMemo } from 'react';

function inputClass(darkNodes, color) {
  return {
    className: `w-full min-w-[4rem] rounded border px-1.5 py-1 text-xs outline-none ${
      darkNodes
        ? 'border-white/10 bg-black/20 text-zinc-100'
        : 'border-slate-200 bg-white/90 text-slate-800'
    }`,
    style: { borderColor: `${color}55` },
  };
}

function colId() {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
}

export default function TableNodeBody({ node, darkNodes, onUpdate }) {
  const fieldLooks = useMemo(() => inputClass(darkNodes, node.color), [darkNodes, node.color]);
  const columns =
    Array.isArray(node.columns) && node.columns.length
      ? node.columns
      : [
          { id: 'c1', name: 'A' },
          { id: 'c2', name: 'B' },
        ];
  const rows = Array.isArray(node.rows) ? node.rows : [];

  const setColumns = (columnsNext, rowsNext = rows) =>
    onUpdate({ columns: columnsNext, rows: rowsNext });

  return (
    <div className="max-w-full overflow-x-auto px-2 pb-3 pt-1" onPointerDown={(e) => e.stopPropagation()}>
      <p className={`mb-1.5 px-1 text-[11px] tabular-nums ${darkNodes ? 'text-zinc-400' : 'text-slate-500'}`}>
        {rows.length}×{columns.length}
      </p>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {columns.map((col, ci) => (
              <th key={col.id} className="p-0.5">
                <input
                  value={col.name}
                  onChange={(e) => {
                    const next = columns.map((c, i) =>
                      i === ci ? { ...c, name: e.target.value } : c
                    );
                    setColumns(next);
                  }}
                  className={`${fieldLooks.className} font-semibold`}
                  style={fieldLooks.style}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {columns.map((col) => (
                <td key={col.id} className="p-0.5">
                  <input
                    value={row?.[col.id] ?? ''}
                    onChange={(e) => {
                      const nextRows = rows.map((r, i) =>
                        i === ri ? { ...r, [col.id]: e.target.value } : r
                      );
                      onUpdate({ rows: nextRows });
                    }}
                    className={fieldLooks.className}
                    style={fieldLooks.style}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap gap-2 px-1">
        <button
          type="button"
          className={`text-xs font-medium ${darkNodes ? 'text-indigo-200' : 'text-indigo-700'}`}
          onClick={() => {
            const blank = {};
            columns.forEach((c) => {
              blank[c.id] = '';
            });
            onUpdate({ rows: [...rows, blank] });
          }}
        >
          + Row
        </button>
        <button
          type="button"
          className={`text-xs font-medium ${darkNodes ? 'text-indigo-200' : 'text-indigo-700'}`}
          onClick={() => {
            const id = colId();
            const name = String.fromCharCode(65 + (columns.length % 26));
            setColumns(
              [...columns, { id, name }],
              rows.map((r) => ({ ...r, [id]: '' }))
            );
          }}
        >
          + Column
        </button>
      </div>
    </div>
  );
}
