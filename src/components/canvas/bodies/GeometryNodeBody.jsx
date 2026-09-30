import React, { useMemo, useRef, useState } from 'react';

const W = 280;
const H = 180;
const EPS = 1.5;

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleAt(vertex, p1, p2) {
  const v1 = { x: p1.x - vertex.x, y: p1.y - vertex.y };
  const v2 = { x: p2.x - vertex.x, y: p2.y - vertex.y };
  const d = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1;
  const cos = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / d));
  return (Math.acos(cos) * 180) / Math.PI;
}

function nearEqual(a, b, tol = EPS) {
  return Math.abs(a - b) <= tol;
}

function defaultGeometry() {
  return {
    points: [
      { id: 'A', x: 40, y: 140, free: true },
      { id: 'B', x: 220, y: 140, free: true },
      { id: 'C', x: 130, y: 40, free: true },
    ],
    segments: [
      { id: 'AB', a: 'A', b: 'B' },
      { id: 'BC', a: 'B', b: 'C' },
      { id: 'CA', a: 'C', b: 'A' },
    ],
    circles: [],
  };
}

// Fix typo in default - CA segment
function normalizeGeometry(raw) {
  const g = raw && typeof raw === 'object' ? raw : defaultGeometry();
  const points = Array.isArray(g.points) ? g.points : defaultGeometry().points;
  let segments = Array.isArray(g.segments) ? g.segments : defaultGeometry().segments;
  segments = segments.map((s) => ({
    id: s.id,
    a: s.a,
    b: s.b,
  }));
  return {
    points,
    segments,
    circles: Array.isArray(g.circles) ? g.circles : [],
  };
}

const PREDICATES = [
  { id: 'segEq', label: 'Segments equal (AB = BC)' },
  { id: 'angEq', label: 'Angles equal (∠A = ∠B)' },
  { id: 'sas', label: 'Triangle SAS (AB,∠B,BC)' },
];

export default function GeometryNodeBody({ node, darkNodes, onUpdate }) {
  const geometry = useMemo(() => normalizeGeometry(node.geometry), [node.geometry]);
  const proofSteps = Array.isArray(node.proofSteps) ? node.proofSteps : [];
  const [dragId, setDragId] = useState(null);
  const svgRef = useRef(null);

  const byId = useMemo(() => {
    const m = new Map();
    geometry.points.forEach((p) => m.set(p.id, p));
    return m;
  }, [geometry.points]);

  const measures = useMemo(() => {
    const A = byId.get('A');
    const B = byId.get('B');
    const C = byId.get('C');
    if (!A || !B || !C) return null;
    return {
      AB: dist(A, B),
      BC: dist(B, C),
      CA: dist(C, A),
      angA: angleAt(A, B, C),
      angB: angleAt(B, A, C),
      angC: angleAt(C, A, B),
    };
  }, [byId]);

  const patchGeometry = (next) => onUpdate({ geometry: next });

  const onPointerDownPoint = (e, id) => {
    e.stopPropagation();
    e.preventDefault();
    setDragId(id);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragId || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    patchGeometry({
      ...geometry,
      points: geometry.points.map((p) =>
        p.id === dragId ? { ...p, x: Math.max(8, Math.min(W - 8, x)), y: Math.max(8, Math.min(H - 8, y)) } : p
      ),
    });
  };

  const onPointerUp = () => setDragId(null);

  const checkStep = (predId) => {
    if (!measures) return { ok: false, reason: 'Need triangle ABC' };
    if (predId === 'segEq') {
      const ok = nearEqual(measures.AB, measures.BC, 4);
      return { ok, reason: ok ? 'AB ≈ BC' : `AB=${measures.AB.toFixed(1)} ≠ BC=${measures.BC.toFixed(1)}` };
    }
    if (predId === 'angEq') {
      const ok = nearEqual(measures.angA, measures.angB, 3);
      return {
        ok,
        reason: ok
          ? '∠A ≈ ∠B'
          : `∠A=${measures.angA.toFixed(1)}° ≠ ∠B=${measures.angB.toFixed(1)}°`,
      };
    }
    if (predId === 'sas') {
      // Educational check: AB length, angle B, BC length — always "structure present"; mark ok if triangle non-degenerate
      const area =
        Math.abs(
          byId.get('A').x * (byId.get('B').y - byId.get('C').y) +
            byId.get('B').x * (byId.get('C').y - byId.get('A').y) +
            byId.get('C').x * (byId.get('A').y - byId.get('B').y)
        ) / 2;
      const ok = area > 20;
      return {
        ok,
        reason: ok
          ? 'SAS elements present on △ABC (non-degenerate)'
          : 'Triangle is degenerate — drag points apart',
      };
    }
    return { ok: false, reason: 'Unknown predicate' };
  };

  const addProofStep = (predId) => {
    const checked = checkStep(predId);
    const label = PREDICATES.find((p) => p.id === predId)?.label || predId;
    onUpdate({
      proofSteps: [
        ...proofSteps,
        {
          id: `p_${Date.now().toString(36)}`,
          predicate: predId,
          label,
          ok: checked.ok,
          reason: checked.reason,
        },
      ],
    });
  };

  const recheckAll = () => {
    onUpdate({
      proofSteps: proofSteps.map((step) => {
        const checked = checkStep(step.predicate);
        return { ...step, ok: checked.ok, reason: checked.reason };
      }),
    });
  };

  return (
    <div className="flex flex-col gap-2 px-3 pb-3 pt-1" onPointerDown={(e) => e.stopPropagation()}>
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        className={`rounded-md border ${darkNodes ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-white/70'}`}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {geometry.segments.map((s) => {
          const a = byId.get(s.a);
          const b = byId.get(s.b);
          if (!a || !b) return null;
          return (
            <line
              key={s.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={node.color || '#6366f1'}
              strokeWidth={2}
            />
          );
        })}
        {geometry.points.map((p) => (
          <g key={p.id}>
            <circle
              cx={p.x}
              cy={p.y}
              r={7}
              fill={node.color || '#6366f1'}
              stroke={darkNodes ? '#fff' : '#fff'}
              strokeWidth={2}
              style={{ cursor: 'grab', touchAction: 'none' }}
              onPointerDown={(e) => onPointerDownPoint(e, p.id)}
            />
            <text
              x={p.x + 10}
              y={p.y - 8}
              fontSize={12}
              fill={darkNodes ? '#e4e4e7' : '#334155'}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {p.id}
            </text>
          </g>
        ))}
      </svg>
      {measures && (
        <p className={`text-[11px] tabular-nums ${darkNodes ? 'text-zinc-400' : 'text-slate-500'}`}>
          AB {measures.AB.toFixed(1)} · BC {measures.BC.toFixed(1)} · CA {measures.CA.toFixed(1)} · ∠A{' '}
          {measures.angA.toFixed(0)}° · ∠B {measures.angB.toFixed(0)}° · ∠C {measures.angC.toFixed(0)}°
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {PREDICATES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => addProofStep(p.id)}
            className={`rounded-md px-2 py-1 text-[11px] font-medium ${
              darkNodes ? 'bg-white/10 text-zinc-200 hover:bg-white/15' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            + {p.label}
          </button>
        ))}
        {proofSteps.length > 0 && (
          <button
            type="button"
            onClick={recheckAll}
            className={`rounded-md px-2 py-1 text-[11px] font-medium ${
              darkNodes ? 'text-indigo-200' : 'text-indigo-700'
            }`}
          >
            Recheck
          </button>
        )}
      </div>
      {proofSteps.length > 0 && (
        <ul className="space-y-1 text-xs">
          {proofSteps.map((step) => (
            <li
              key={step.id}
              className={`rounded-md border px-2 py-1.5 ${
                step.ok
                  ? darkNodes
                    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
                    : 'border-emerald-500/30 bg-emerald-50 text-emerald-900'
                  : darkNodes
                    ? 'border-amber-400/30 bg-amber-400/10 text-amber-100'
                    : 'border-amber-500/30 bg-amber-50 text-amber-900'
              }`}
            >
              <span className="font-medium">{step.ok ? '✓' : '✗'}</span> {step.label}
              <div className="opacity-80">{step.reason}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
