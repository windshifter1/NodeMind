import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  isDrawCaptureTool,
  newImageId,
  newStrokeId,
  normalizeBackgroundArt,
} from '@/lib/backgroundArt';
import { getBlobUrl, putFileFromFileList } from '@/lib/mediaStore';
import {
  eraseAreaFromStrokes,
  pointHitsStroke,
  pointsToPath,
} from '@/lib/strokePath';

/** Screen-px → world units. Smooth mode samples denser for cleaner cubics. */
function minPointDist(zoom, smooth = false) {
  const z = Number(zoom);
  const screenPx = smooth ? 0.55 : 1.5;
  return screenPx / (Number.isFinite(z) && z > 0 ? z : 1);
}

function simplifyPoints(points, minDist) {
  if (!points?.length) return points || [];
  if (points.length <= 2) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = out[out.length - 1];
    const p = points[i];
    if (Math.hypot(p.x - prev.x, p.y - prev.y) >= minDist) out.push(p);
  }
  const last = points[points.length - 1];
  const prev = out[out.length - 1];
  if (prev !== last) {
    if (Math.hypot(last.x - prev.x, last.y - prev.y) < 1e-6) out[out.length - 1] = last;
    else out.push(last);
  }
  return out;
}

/**
 * Workspace-world drawing layer (behind nodes). Not a node.
 * Tools: pan (pass-through), pen, erase, select+move, place images.
 */
export default function BackgroundDrawLayer({
  art,
  onChange,
  enabled,
  pan,
  zoom,
  spacePanArmed = false,
  /** Catmull-Rom cubics + denser capture instead of blocky polylines. */
  smoothStrokes = false,
}) {
  const bg = useMemo(() => normalizeBackgroundArt(art), [art]);
  const [draft, setDraft] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedKind, setSelectedKind] = useState(null); // stroke | image
  const dragRef = useRef(null);
  const capturingRef = useRef(false);
  const boardRectRef = useRef(null);
  const draftRef = useRef(null);
  const pendingPointRef = useRef(null);
  const draftRafRef = useRef(0);
  const persistRafRef = useRef(0);
  const pendingPersistRef = useRef(null);
  const liveBgRef = useRef(null);
  /** Active touch/pen pointers — 2+ means pinch, not draw. */
  const activePointersRef = useRef(new Set());
  /** Pointer that owns the current stroke / erase / drag, if any. */
  const strokePointerIdRef = useRef(null);
  const [imageUrls, setImageUrls] = useState({});

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // Keep a mutable art snapshot while a gesture is in progress so rAF-coalesced
  // erases/drags stack correctly instead of rebasing on a stale React prop.
  const artSnapshot = () => liveBgRef.current || bg;

  useEffect(() => {
    let cancelled = false;
    const urls = {};
    (async () => {
      for (const img of bg.images) {
        if (!img.fileId) continue;
        try {
          const u = await getBlobUrl(img.fileId);
          if (u) urls[img.id] = u;
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) {
        setImageUrls((prev) => {
          Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
          return urls;
        });
      } else {
        Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bg.images]);

  useEffect(
    () => () => {
      if (draftRafRef.current) cancelAnimationFrame(draftRafRef.current);
      if (persistRafRef.current) cancelAnimationFrame(persistRafRef.current);
    },
    []
  );

  const schedulePersist = (next) => {
    liveBgRef.current = next;
    pendingPersistRef.current = next;
    if (persistRafRef.current) return;
    persistRafRef.current = requestAnimationFrame(() => {
      persistRafRef.current = 0;
      const payload = pendingPersistRef.current;
      pendingPersistRef.current = null;
      if (payload) onChange(payload);
    });
  };

  const flushPersist = () => {
    if (persistRafRef.current) {
      cancelAnimationFrame(persistRafRef.current);
      persistRafRef.current = 0;
    }
    const payload = pendingPersistRef.current;
    pendingPersistRef.current = null;
    if (payload) onChange(payload);
  };

  const screenToWorld = (clientX, clientY) => {
    const rect = boardRectRef.current;
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  };

  const hitStroke = (x, y, strokes = artSnapshot().strokes) => {
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i];
      const tol = Math.max(8, (s.width || 3) + 4);
      if (pointHitsStroke(x, y, s, tol)) return s;
    }
    return null;
  };

  const hitImage = (x, y) => {
    const images = artSnapshot().images;
    for (let i = images.length - 1; i >= 0; i--) {
      const img = images[i];
      if (x >= img.x && x <= img.x + img.w && y >= img.y && y <= img.y + img.h) return img;
    }
    return null;
  };

  const eraseNear = (x, y, { immediate = false } = {}) => {
    const current = artSnapshot();
    const commit = (next) => {
      liveBgRef.current = next;
      if (immediate) onChange(next);
      else schedulePersist(next);
    };
    if (current.eraseMode === 'area') {
      const r = Math.max(12, current.penWidth * 3);
      commit({
        ...current,
        strokes: eraseAreaFromStrokes(current.strokes, x, y, r, newStrokeId),
      });
      return;
    }
    const hit = hitStroke(x, y, current.strokes);
    if (hit) {
      commit({ ...current, strokes: current.strokes.filter((s) => s.id !== hit.id) });
    }
  };

  // Pan tool (or space-pan): let the board receive gestures.
  const passThrough = !enabled || spacePanArmed || bg.tool === 'pan';

  const cancelStrokeGesture = (layer) => {
    if (draftRafRef.current) {
      cancelAnimationFrame(draftRafRef.current);
      draftRafRef.current = 0;
    }
    pendingPointRef.current = null;
    const captureId = strokePointerIdRef.current;
    draftRef.current = null;
    setDraft(null);
    dragRef.current = null;
    capturingRef.current = false;
    strokePointerIdRef.current = null;
    boardRectRef.current = null;
    liveBgRef.current = null;
    if (layer && captureId != null) {
      try {
        layer.releasePointerCapture?.(captureId);
      } catch {
        /* ignore */
      }
    }
  };

  const onPointerDown = (e) => {
    if (!enabled || passThrough) return;
    if (e.button !== 0) return;

    const layer = e.currentTarget;
    activePointersRef.current.add(e.pointerId);

    // Pinch / multi-touch: discard any in-progress stroke so zoom doesn't paint.
    if (activePointersRef.current.size >= 2) {
      cancelStrokeGesture(layer);
      return;
    }

    boardRectRef.current = layer.parentElement?.getBoundingClientRect?.() || null;
    liveBgRef.current = bg;
    const w = screenToWorld(e.clientX, e.clientY);

    if (bg.tool === 'select') {
      const img = hitImage(w.x, w.y);
      if (img) {
        e.stopPropagation();
        capturingRef.current = true;
        strokePointerIdRef.current = e.pointerId;
        layer.setPointerCapture?.(e.pointerId);
        setSelectedId(img.id);
        setSelectedKind('image');
        dragRef.current = { kind: 'image', id: img.id, ox: w.x - img.x, oy: w.y - img.y };
        return;
      }
      const stroke = hitStroke(w.x, w.y);
      if (stroke) {
        e.stopPropagation();
        capturingRef.current = true;
        strokePointerIdRef.current = e.pointerId;
        layer.setPointerCapture?.(e.pointerId);
        setSelectedId(stroke.id);
        setSelectedKind('stroke');
        dragRef.current = {
          kind: 'stroke',
          id: stroke.id,
          lastX: w.x,
          lastY: w.y,
        };
        return;
      }
      // Miss: allow canvas pan — do not stopPropagation.
      liveBgRef.current = null;
      setSelectedId(null);
      setSelectedKind(null);
      return;
    }

    if (!isDrawCaptureTool(bg.tool)) return;

    e.stopPropagation();
    capturingRef.current = true;
    strokePointerIdRef.current = e.pointerId;
    layer.setPointerCapture?.(e.pointerId);

    if (bg.tool === 'erase') {
      eraseNear(w.x, w.y, { immediate: true });
      return;
    }
    if (bg.tool === 'pen') {
      const id = newStrokeId();
      const next = {
        id,
        color: bg.color,
        width: bg.penWidth,
        points: [{ x: w.x, y: w.y }],
      };
      draftRef.current = next;
      setDraft(next);
    }
  };

  const flushDraftPoint = () => {
    draftRafRef.current = 0;
    const pending = pendingPointRef.current;
    pendingPointRef.current = null;
    const current = draftRef.current;
    if (!pending?.length || !current) return;
    const minD = minPointDist(zoom, smoothStrokes);
    let points = current.points;
    let changed = false;
    for (const w of pending) {
      const last = points[points.length - 1];
      if (last && Math.hypot(w.x - last.x, w.y - last.y) < minD) continue;
      if (!changed) points = points.slice();
      points.push({ x: w.x, y: w.y });
      changed = true;
    }
    if (!changed) return;
    const next = { ...current, points };
    draftRef.current = next;
    setDraft(next);
  };

  const onPointerMove = (e) => {
    if (!enabled) return;
    // Ignore sibling fingers and any move once a pinch is in progress.
    if (activePointersRef.current.size >= 2) return;
    if (strokePointerIdRef.current != null && e.pointerId !== strokePointerIdRef.current) return;
    if (!capturingRef.current && !draftRef.current && !dragRef.current) return;
    const w = screenToWorld(e.clientX, e.clientY);
    if (bg.tool === 'erase' && e.buttons === 1 && capturingRef.current) {
      eraseNear(w.x, w.y);
      return;
    }
    if (draftRef.current) {
      const coalesced =
        typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
      const events = coalesced?.length ? coalesced : [e];
      const batch = events.map((ev) => screenToWorld(ev.clientX, ev.clientY));
      pendingPointRef.current = pendingPointRef.current
        ? pendingPointRef.current.concat(batch)
        : batch;
      if (!draftRafRef.current) {
        draftRafRef.current = requestAnimationFrame(flushDraftPoint);
      }
      return;
    }
    const drag = dragRef.current;
    if (!drag) return;
    const current = artSnapshot();
    if (drag.kind === 'image') {
      schedulePersist({
        ...current,
        images: current.images.map((img) =>
          img.id === drag.id ? { ...img, x: w.x - drag.ox, y: w.y - drag.oy } : img
        ),
      });
    } else if (drag.kind === 'stroke') {
      const dx = w.x - drag.lastX;
      const dy = w.y - drag.lastY;
      dragRef.current = { ...drag, lastX: w.x, lastY: w.y };
      schedulePersist({
        ...current,
        strokes: current.strokes.map((s) =>
          s.id === drag.id
            ? { ...s, points: (s.points || []).map((p) => ({ x: p.x + dx, y: p.y + dy })) }
            : s
        ),
      });
    }
  };

  const onPointerUp = (e) => {
    activePointersRef.current.delete(e.pointerId);

    // Extra finger lifted after a pinch — nothing to commit for draw.
    if (strokePointerIdRef.current != null && e.pointerId !== strokePointerIdRef.current) {
      return;
    }
    // Pinch already cancelled the stroke; just clear pointer bookkeeping.
    if (strokePointerIdRef.current == null && !draftRef.current && !dragRef.current) {
      if (activePointersRef.current.size === 0) {
        boardRectRef.current = null;
        liveBgRef.current = null;
      }
      return;
    }

    if (draftRafRef.current) {
      cancelAnimationFrame(draftRafRef.current);
      draftRafRef.current = 0;
    }
    flushDraftPoint();
    flushPersist();
    const current = draftRef.current;
    if (current) {
      const base = artSnapshot();
      const points = simplifyPoints(current.points, minPointDist(zoom, smoothStrokes));
      onChange({ ...base, strokes: [...base.strokes, { ...current, points }] });
      draftRef.current = null;
      setDraft(null);
    }
    dragRef.current = null;
    capturingRef.current = false;
    strokePointerIdRef.current = null;
    boardRectRef.current = null;
    liveBgRef.current = null;
  };

  return (
    <svg
      data-background-draw
      className="absolute inset-0 overflow-visible"
      style={{
        width: '100%',
        height: '100%',
        // Pan tool: none so board pans. Pen/erase/select: auto to receive strokes/hits.
        pointerEvents: enabled && !passThrough ? 'auto' : 'none',
        zIndex: enabled && !passThrough ? 4 : 0,
        touchAction: 'none',
        overflow: 'visible',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
        {bg.images.map((img) => (
          <image
            key={img.id}
            href={imageUrls[img.id] || ''}
            x={img.x}
            y={img.y}
            width={img.w}
            height={img.h}
            opacity={0.95}
            style={{
              outline:
                selectedKind === 'image' && selectedId === img.id ? '2px solid #818cf8' : 'none',
            }}
          />
        ))}
        {bg.strokes.map((s) => (
          <StrokeGraphic
            key={s.id}
            stroke={s}
            selected={selectedKind === 'stroke' && selectedId === s.id}
            smooth={smoothStrokes}
          />
        ))}
        {draft && <StrokeGraphic stroke={draft} selected={false} smooth={smoothStrokes} />}
      </g>
    </svg>
  );
}

const StrokeGraphic = memo(function StrokeGraphic({ stroke, selected, smooth = false }) {
  const d = pointsToPath(stroke.points, { smooth });
  if (!d) return null;
  const color = stroke.color || '#334155';
  const width = Math.max(1, Number(stroke.width) || 3);

  return (
    <g style={{ outline: selected ? '1px solid #818cf8' : undefined }}>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={1}
      />
    </g>
  );
});

export async function addBackgroundImage(art, file, at = { x: 80, y: 80 }) {
  const bg = normalizeBackgroundArt(art);
  const meta = await putFileFromFileList(file);
  const img = {
    id: newImageId(),
    fileId: meta.fileId,
    x: at.x,
    y: at.y,
    w: 240,
    h: 180,
  };
  return { ...bg, images: [...bg.images, img], tool: 'select' };
}
