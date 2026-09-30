import React, { useEffect, useMemo, useRef, useState } from 'react';
import { newImageId, newStrokeId, normalizeBackgroundArt } from '@/lib/backgroundArt';
import { getBlobUrl, putFileFromFileList } from '@/lib/mediaStore';

/**
 * Workspace-world drawing layer (behind nodes). Not a node.
 * Tools: pen, erase (stroke|area), select+move, emissiveness glow (default 0), place images.
 */
export default function BackgroundDrawLayer({
  art,
  onChange,
  enabled,
  pan,
  zoom,
}) {
  const bg = useMemo(() => normalizeBackgroundArt(art), [art]);
  const [draft, setDraft] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedKind, setSelectedKind] = useState(null); // stroke | image
  const dragRef = useRef(null);
  const [imageUrls, setImageUrls] = useState({});

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

  const screenToWorld = (clientX, clientY, el) => {
    const rect = el.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  };

  const hitStroke = (x, y) => {
    for (let i = bg.strokes.length - 1; i >= 0; i--) {
      const s = bg.strokes[i];
      for (const p of s.points || []) {
        if (Math.hypot(p.x - x, p.y - y) <= Math.max(8, (s.width || 3) + 4)) return s;
      }
    }
    return null;
  };

  const hitImage = (x, y) => {
    for (let i = bg.images.length - 1; i >= 0; i--) {
      const img = bg.images[i];
      if (x >= img.x && x <= img.x + img.w && y >= img.y && y <= img.y + img.h) return img;
    }
    return null;
  };

  const eraseNear = (x, y) => {
    if (bg.eraseMode === 'area') {
      const r = Math.max(12, bg.penWidth * 3);
      const next = bg.strokes
        .map((s) => ({
          ...s,
          points: (s.points || []).filter((p) => Math.hypot(p.x - x, p.y - y) > r),
        }))
        .filter((s) => (s.points || []).length > 1);
      onChange({ ...bg, strokes: next });
      return;
    }
    const hit = hitStroke(x, y);
    if (hit) onChange({ ...bg, strokes: bg.strokes.filter((s) => s.id !== hit.id) });
  };

  const onPointerDown = (e) => {
    if (!enabled) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    const layer = e.currentTarget;
    const w = screenToWorld(e.clientX, e.clientY, layer.parentElement);
    layer.setPointerCapture?.(e.pointerId);

    if (bg.tool === 'erase') {
      eraseNear(w.x, w.y);
      return;
    }
    if (bg.tool === 'select') {
      const img = hitImage(w.x, w.y);
      if (img) {
        setSelectedId(img.id);
        setSelectedKind('image');
        dragRef.current = { kind: 'image', id: img.id, ox: w.x - img.x, oy: w.y - img.y };
        return;
      }
      const stroke = hitStroke(w.x, w.y);
      if (stroke) {
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
      setSelectedId(null);
      setSelectedKind(null);
      return;
    }
    if (bg.tool === 'pen') {
      const id = newStrokeId();
      setDraft({
        id,
        color: bg.color,
        width: bg.penWidth,
        emissiveness: bg.emissiveness ?? 0,
        points: [{ x: w.x, y: w.y }],
      });
    }
  };

  const onPointerMove = (e) => {
    if (!enabled) return;
    const layer = e.currentTarget;
    const w = screenToWorld(e.clientX, e.clientY, layer.parentElement);
    if (bg.tool === 'erase' && e.buttons === 1) {
      eraseNear(w.x, w.y);
      return;
    }
    if (draft) {
      setDraft({ ...draft, points: [...draft.points, { x: w.x, y: w.y }] });
      return;
    }
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === 'image') {
      onChange({
        ...bg,
        images: bg.images.map((img) =>
          img.id === drag.id ? { ...img, x: w.x - drag.ox, y: w.y - drag.oy } : img
        ),
      });
    } else if (drag.kind === 'stroke') {
      const dx = w.x - drag.lastX;
      const dy = w.y - drag.lastY;
      dragRef.current = { ...drag, lastX: w.x, lastY: w.y };
      onChange({
        ...bg,
        strokes: bg.strokes.map((s) =>
          s.id === drag.id
            ? { ...s, points: (s.points || []).map((p) => ({ x: p.x + dx, y: p.y + dy })) }
            : s
        ),
      });
    }
  };

  const onPointerUp = () => {
    if (draft) {
      onChange({ ...bg, strokes: [...bg.strokes, draft] });
      setDraft(null);
    }
    dragRef.current = null;
  };

  const strokes = draft ? [...bg.strokes, draft] : bg.strokes;

  return (
    <svg
      data-background-draw
      className="absolute inset-0 overflow-visible"
      style={{
        width: '100%',
        height: '100%',
        pointerEvents: enabled ? 'auto' : 'none',
        zIndex: enabled ? 4 : 0,
        touchAction: 'none',
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
        {strokes.map((s) => {
          const d = pointsToPath(s.points);
          if (!d) return null;
          const glow = Number(s.emissiveness) || 0;
          return (
            <path
              key={s.id}
              d={d}
              fill="none"
              stroke={s.color || '#334155'}
              strokeWidth={s.width || 3}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                filter:
                  glow > 0
                    ? `drop-shadow(0 0 ${4 + glow * 16}px ${s.color || '#334155'})`
                    : undefined,
                outline:
                  selectedKind === 'stroke' && selectedId === s.id ? '1px solid #818cf8' : undefined,
              }}
            />
          );
        })}
      </g>
    </svg>
  );
}

function pointsToPath(points) {
  if (!points?.length) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
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
