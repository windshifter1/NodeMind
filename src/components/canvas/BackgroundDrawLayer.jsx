import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  isDrawCaptureTool,
  newImageId,
  newStrokeId,
  normalizeBackgroundArt,
} from '@/lib/backgroundArt';
import { getBlobUrl, putFileFromFileList } from '@/lib/mediaStore';

/** ~1.5 screen-px in world units — keeps paths light when zoomed in. */
function minPointDist(zoom) {
  const z = Number(zoom);
  return 1.5 / (Number.isFinite(z) && z > 0 ? z : 1);
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
      for (const p of s.points || []) {
        if (Math.hypot(p.x - x, p.y - y) <= tol) return s;
      }
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
      const next = {
        ...current,
        strokes: current.strokes
          .map((s) => ({
            ...s,
            points: (s.points || []).filter((p) => Math.hypot(p.x - x, p.y - y) > r),
          }))
          .filter((s) => (s.points || []).length > 1),
      };
      commit(next);
      return;
    }
    const hit = hitStroke(x, y, current.strokes);
    if (hit) {
      commit({ ...current, strokes: current.strokes.filter((s) => s.id !== hit.id) });
    }
  };

  // Pan tool (or space-pan): let the board receive gestures.
  const passThrough = !enabled || spacePanArmed || bg.tool === 'pan';

  const onPointerDown = (e) => {
    if (!enabled || passThrough) return;
    if (e.button !== 0) return;

    const layer = e.currentTarget;
    boardRectRef.current = layer.parentElement?.getBoundingClientRect?.() || null;
    liveBgRef.current = bg;
    const w = screenToWorld(e.clientX, e.clientY);

    if (bg.tool === 'select') {
      const img = hitImage(w.x, w.y);
      if (img) {
        e.stopPropagation();
        capturingRef.current = true;
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
        emissiveness: bg.emissiveness ?? 0,
        points: [{ x: w.x, y: w.y }],
      };
      draftRef.current = next;
      setDraft(next);
    }
  };

  const flushDraftPoint = () => {
    draftRafRef.current = 0;
    const w = pendingPointRef.current;
    pendingPointRef.current = null;
    const current = draftRef.current;
    if (!w || !current) return;
    const last = current.points[current.points.length - 1];
    if (last && Math.hypot(w.x - last.x, w.y - last.y) < minPointDist(zoom)) return;
    const next = { ...current, points: [...current.points, { x: w.x, y: w.y }] };
    draftRef.current = next;
    setDraft(next);
  };

  const onPointerMove = (e) => {
    if (!enabled) return;
    if (!capturingRef.current && !draftRef.current && !dragRef.current) return;
    const w = screenToWorld(e.clientX, e.clientY);
    if (bg.tool === 'erase' && e.buttons === 1 && capturingRef.current) {
      eraseNear(w.x, w.y);
      return;
    }
    if (draftRef.current) {
      pendingPointRef.current = w;
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

  const onPointerUp = () => {
    if (draftRafRef.current) {
      cancelAnimationFrame(draftRafRef.current);
      draftRafRef.current = 0;
      flushDraftPoint();
    }
    flushPersist();
    const current = draftRef.current;
    if (current) {
      const base = artSnapshot();
      const points = simplifyPoints(current.points, minPointDist(zoom));
      onChange({ ...base, strokes: [...base.strokes, { ...current, points }] });
      draftRef.current = null;
      setDraft(null);
    }
    dragRef.current = null;
    capturingRef.current = false;
    boardRectRef.current = null;
    liveBgRef.current = null;
  };

  // Live-update glow on the in-progress draft and selected stroke when the slider moves.
  useEffect(() => {
    const nextGlow = bg.emissiveness ?? 0;
    const current = draftRef.current;
    if (current && Math.abs((Number(current.emissiveness) || 0) - nextGlow) >= 0.001) {
      const next = { ...current, emissiveness: nextGlow };
      draftRef.current = next;
      setDraft(next);
    }
    if (selectedKind !== 'stroke' || !selectedId) return;
    const stroke = bg.strokes.find((s) => s.id === selectedId);
    if (!stroke) return;
    if (Math.abs((Number(stroke.emissiveness) || 0) - nextGlow) < 0.001) return;
    onChange({
      ...bg,
      strokes: bg.strokes.map((s) =>
        s.id === selectedId ? { ...s, emissiveness: nextGlow } : s
      ),
    });
  }, [bg.emissiveness, selectedId, selectedKind]); // eslint-disable-line react-hooks/exhaustive-deps

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
          />
        ))}
        {draft && <StrokeGraphic stroke={draft} selected={false} />}
      </g>
    </svg>
  );
}

/**
 * Soft glow via wider translucent under-strokes only.
 * SVG feGaussianBlur was catastrophically expensive when the parent
 * group is scaled up (zoomed in) — huge filter intermediates.
 */
const StrokeGraphic = memo(function StrokeGraphic({ stroke, selected }) {
  const d = pointsToPath(stroke.points);
  if (!d) return null;
  const color = stroke.color || '#334155';
  const width = Math.max(1, Number(stroke.width) || 3);
  const glow = Math.max(0, Math.min(1, Number(stroke.emissiveness) || 0));
  const common = {
    d,
    fill: 'none',
    stroke: color,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  return (
    <g style={{ outline: selected ? '1px solid #818cf8' : undefined }}>
      {glow > 0 && (
        <>
          <path
            {...common}
            strokeWidth={width + glow * 26}
            opacity={0.1 + glow * 0.18}
          />
          <path
            {...common}
            strokeWidth={width + glow * 12}
            opacity={0.2 + glow * 0.28}
          />
          <path
            {...common}
            strokeWidth={width + glow * 5}
            opacity={0.38 + glow * 0.32}
          />
        </>
      )}
      <path {...common} strokeWidth={width} opacity={1} />
    </g>
  );
});

function pointsToPath(points) {
  if (!points?.length) return '';
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += `L${points[i].x} ${points[i].y}`;
  }
  return d;
}

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
