import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sampleSeriesInRange } from '@/lib/cas/plotting';

const SERIES_COLORS = [
  '#6366f1',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#a855f7',
  '#f97316',
  '#14b8a6',
];

const MIN_SCALE = 1e-6;
const MAX_SCALE = 1e6;
const PAD = { l: 40, r: 14, t: 14, b: 30 };

function niceStep(span, target = 6) {
  if (!(span > 0) || !Number.isFinite(span)) return 1;
  const raw = span / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / pow;
  let step;
  if (norm < 1.5) step = 1;
  else if (norm < 3.5) step = 2;
  else if (norm < 7.5) step = 5;
  else step = 10;
  return step * pow;
}

function formatTick(v, step) {
  if (!Number.isFinite(v)) return '';
  if (Math.abs(v) < step * 1e-9) return '0';
  const abs = Math.abs(v);
  if (abs >= 1000 || (abs > 0 && abs < 0.01)) return v.toExponential(1);
  const decimals = Math.max(0, Math.min(4, -Math.floor(Math.log10(step)) + 1));
  return Number(v.toFixed(decimals)).toString();
}

function viewFromHome(plot, plotW, plotH) {
  const xMin = plot?.xMin ?? -10;
  const xMax = plot?.xMax ?? 10;
  const yMin = plot?.yMin ?? -10;
  const yMax = plot?.yMax ?? 10;
  const cx = (xMin + xMax) / 2;
  const cy = (yMin + yMax) / 2;
  const contentW = Math.max(1e-9, xMax - xMin);
  const contentH = Math.max(1e-9, yMax - yMin);
  const scale = Math.max(contentW / Math.max(1, plotW), contentH / Math.max(1, plotH)) * 1.08;
  return { cx, cy, scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale)) };
}

function boundsFromView(view, plotW, plotH) {
  const halfW = (plotW * view.scale) / 2;
  const halfH = (plotH * view.scale) / 2;
  return {
    xMin: view.cx - halfW,
    xMax: view.cx + halfW,
    yMin: view.cy - halfH,
    yMax: view.cy + halfH,
  };
}

/**
 * Interactive 2D Cartesian plot with equal x/y scale, pan/zoom, and crisp DPR drawing.
 */
export default function GraphPlot({
  plot,
  darkNodes = true,
  colorForSource = null,
  height = 336,
  zoom = 1,
}) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const viewRef = useRef(null);
  const pointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const panRef = useRef(null);
  const [width, setWidth] = useState(488);
  const [view, setView] = useState(null);

  const homeKey = useMemo(() => {
    const labels = (plot?.series || []).map((s) => `${s.kind}:${s.label}`).join('|');
    return `${plot?.xMin ?? ''}:${plot?.xMax ?? ''}:${plot?.yMin ?? ''}:${plot?.yMax ?? ''}:${labels}`;
  }, [plot]);

  const plotBox = useMemo(() => {
    const cssW = Math.max(120, width);
    const cssH = Math.max(120, height);
    return {
      cssW,
      cssH,
      plotW: Math.max(1, cssW - PAD.l - PAD.r),
      plotH: Math.max(1, cssH - PAD.t - PAD.b),
    };
  }, [width, height]);

  // Fit home view when plot content / size changes.
  useEffect(() => {
    const next = viewFromHome(plot, plotBox.plotW, plotBox.plotH);
    viewRef.current = next;
    setView(next);
  }, [homeKey, plotBox.plotW, plotBox.plotH, plot]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect?.width || 0);
      if (next > 0) setWidth((prev) => (prev === next ? prev : next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zoomAt = useCallback((clientX, clientY, factor) => {
    const canvas = canvasRef.current;
    const current = viewRef.current;
    if (!canvas || !current) return;
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left - PAD.l;
    const py = clientY - rect.top - PAD.t;
    const { plotW, plotH } = plotBox;
    if (px < 0 || py < 0 || px > plotW || py > plotH) {
      // Zoom about centre when gesture is outside the plot frame.
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor));
      const next = { ...current, scale: nextScale };
      viewRef.current = next;
      setView(next);
      return;
    }
    const bounds = boundsFromView(current, plotW, plotH);
    const worldX = bounds.xMin + (px / plotW) * (bounds.xMax - bounds.xMin);
    const worldY = bounds.yMax - (py / plotH) * (bounds.yMax - bounds.yMin);
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor));
    const next = {
      scale: nextScale,
      cx: worldX - (px / plotW - 0.5) * plotW * nextScale,
      cy: worldY + (py / plotH - 0.5) * plotH * nextScale,
    };
    viewRef.current = next;
    setView(next);
  }, [plotBox]);

  const panByPixels = useCallback((dx, dy) => {
    const current = viewRef.current;
    if (!current) return;
    const next = {
      ...current,
      cx: current.cx - dx * current.scale,
      cy: current.cy + dy * current.scale,
    };
    viewRef.current = next;
    setView(next);
  }, []);

  // Wheel zoom (non-passive so we can prevent board zoom).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      const factor = Math.exp(Math.sign(e.deltaY) * 0.12);
      zoomAt(e.clientX, e.clientY, factor);
    };
    el.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => el.removeEventListener('wheel', onWheel, { capture: true });
  }, [zoomAt]);

  const onPointerDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const el = wrapRef.current;
    el?.setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      pinchRef.current = {
        dist: Math.hypot(dx, dy) || 1,
        cx: (pts[0].x + pts[1].x) / 2,
        cy: (pts[0].y + pts[1].y) / 2,
        scale: viewRef.current?.scale || 1,
      };
      panRef.current = null;
      return;
    }

    if (pointersRef.current.size === 1) {
      panRef.current = { x: e.clientX, y: e.clientY };
      pinchRef.current = null;
    }
  };

  const onPointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    e.stopPropagation();
    e.preventDefault();
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const pts = [...pointersRef.current.values()];
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const dist = Math.hypot(dx, dy) || 1;
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const factor = pinchRef.current.dist / dist;
      // Pan between pinch midpoints, then zoom about midpoint.
      panByPixels(midX - pinchRef.current.cx, midY - pinchRef.current.cy);
      zoomAt(midX, midY, factor);
      pinchRef.current = {
        dist,
        cx: midX,
        cy: midY,
        scale: viewRef.current?.scale || 1,
      };
      return;
    }

    if (panRef.current && pointersRef.current.size === 1) {
      const dx = e.clientX - panRef.current.x;
      const dy = e.clientY - panRef.current.y;
      panRef.current = { x: e.clientX, y: e.clientY };
      panByPixels(dx, dy);
    }
  };

  const onPointerUp = (e) => {
    e.stopPropagation();
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) panRef.current = null;
    if (pointersRef.current.size === 1) {
      const remaining = [...pointersRef.current.values()][0];
      panRef.current = { x: remaining.x, y: remaining.y };
    }
  };

  const onDoubleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const next = viewFromHome(plot, plotBox.plotW, plotBox.plotH);
    viewRef.current = next;
    setView(next);
  };

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    const activeView = view || viewRef.current;
    if (!canvas || !activeView) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const zoomScale = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
    // Backing store is zoom×DPR so the parent canvas CSS scale stays sharp.
    const pixelRatio = dpr * zoomScale;
    const { cssW, cssH, plotW, plotH } = plotBox;
    canvas.width = Math.max(1, Math.round(cssW * pixelRatio));
    canvas.height = Math.max(1, Math.round(cssH * pixelRatio));
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const hairline = 1 / pixelRatio;
    const snap = (v) => Math.round(v * pixelRatio) / pixelRatio;
    const strokeWidth = (cssPx) => Math.max(hairline, Math.round(cssPx * pixelRatio) / pixelRatio);

    const bg = darkNodes ? '#1f2226' : '#f8fafc';
    const grid = darkNodes ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
    const axis = darkNodes ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)';
    const labelCol = darkNodes ? 'rgba(255,255,255,0.72)' : 'rgba(15,23,42,0.72)';
    const muted = darkNodes ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.45)';

    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cssW, cssH);

    const { xMin, xMax, yMin, yMax } = boundsFromView(activeView, plotW, plotH);
    const xSpan = xMax - xMin;
    const ySpan = yMax - yMin;
    const step = niceStep(Math.min(xSpan, ySpan));

    const toPx = (x) => PAD.l + ((x - xMin) / xSpan) * plotW;
    const toPy = (y) => PAD.t + ((yMax - y) / ySpan) * plotH;

    ctx.save();
    ctx.beginPath();
    ctx.rect(PAD.l, PAD.t, plotW, plotH);
    ctx.clip();

    // Grid (1 device-pixel hairlines, snapped)
    ctx.strokeStyle = grid;
    ctx.lineWidth = hairline;
    const xStart = Math.ceil(xMin / step) * step;
    for (let x = xStart; x <= xMax + step * 1e-9; x += step) {
      const px = snap(toPx(x));
      ctx.beginPath();
      ctx.moveTo(px, PAD.t);
      ctx.lineTo(px, PAD.t + plotH);
      ctx.stroke();
    }
    const yStart = Math.ceil(yMin / step) * step;
    for (let y = yStart; y <= yMax + step * 1e-9; y += step) {
      const py = snap(toPy(y));
      ctx.beginPath();
      ctx.moveTo(PAD.l, py);
      ctx.lineTo(PAD.l + plotW, py);
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = axis;
    ctx.lineWidth = strokeWidth(1.25);
    if (xMin <= 0 && xMax >= 0) {
      const zx = toPx(0);
      ctx.beginPath();
      ctx.moveTo(zx, PAD.t);
      ctx.lineTo(zx, PAD.t + plotH);
      ctx.stroke();
    }
    if (yMin <= 0 && yMax >= 0) {
      const zy = toPy(0);
      ctx.beginPath();
      ctx.moveTo(PAD.l, zy);
      ctx.lineTo(PAD.l + plotW, zy);
      ctx.stroke();
    }

    const sampleCount = Math.min(900, Math.max(180, Math.round(plotW * pixelRatio)));
    const series = plot?.series || [];
    series.forEach((s, index) => {
      if (s.kind === 'error') return;
      const color =
        (s.sourceId && colorForSource?.(s.sourceId)) ||
        SERIES_COLORS[index % SERIES_COLORS.length];
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth(1.75);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      if (s.kind === 'vline' && Number.isFinite(s.value)) {
        const px = toPx(s.value);
        ctx.beginPath();
        ctx.moveTo(px, PAD.t);
        ctx.lineTo(px, PAD.t + plotH);
        ctx.stroke();
        return;
      }

      if (s.kind === 'hline' && Number.isFinite(s.value)) {
        const py = toPy(s.value);
        ctx.beginPath();
        ctx.moveTo(PAD.l, py);
        ctx.lineTo(PAD.l + plotW, py);
        ctx.stroke();
        return;
      }

      const points =
        s.kind === 'function' && s.exprAst
          ? sampleSeriesInRange(s, xMin, xMax, sampleCount)
          : s.points || [];

      let drawing = false;
      ctx.beginPath();
      points.forEach((p) => {
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
          drawing = false;
          return;
        }
        const px = toPx(p.x);
        const py = toPy(p.y);
        if (!drawing) {
          ctx.moveTo(px, py);
          drawing = true;
        } else {
          ctx.lineTo(px, py);
        }
      });
      ctx.stroke();
    });

    ctx.restore();

    // Frame
    ctx.strokeStyle = darkNodes ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.14)';
    ctx.lineWidth = strokeWidth(1);
    ctx.strokeRect(snap(PAD.l) + hairline / 2, snap(PAD.t) + hairline / 2, plotW - hairline, plotH - hairline);

    // Tick labels (shared step → equal visual scale)
    ctx.fillStyle = labelCol;
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let x = xStart; x <= xMax + step * 1e-9; x += step) {
      if (Math.abs(x) < step * 1e-9) continue;
      const px = toPx(x);
      if (px < PAD.l || px > PAD.l + plotW) continue;
      ctx.fillText(formatTick(x, step), px, PAD.t + plotH + 6);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = yStart; y <= yMax + step * 1e-9; y += step) {
      if (Math.abs(y) < step * 1e-9) continue;
      const py = toPy(y);
      if (py < PAD.t || py > PAD.t + plotH) continue;
      ctx.fillText(formatTick(y, step), PAD.l - 6, py);
    }

    // Axis variable names (when series agree on independent / dependent)
    const xName = plot?.xLabel || 'x';
    const yName = plot?.yLabel || 'y';
    ctx.fillStyle = muted;
    ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(xName, PAD.l + plotW - 2, PAD.t + plotH - 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(yName, PAD.l + 3, PAD.t + 3);

    if (plot?.error && !(plot.series || []).some((s) => s.kind !== 'error')) {
      ctx.fillStyle = muted;
      ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(plot.error, PAD.l + plotW / 2, PAD.t + plotH / 2);
    }

    const legend = (plot?.series || []).filter((s) => s.kind !== 'error' || s.label);
    if (legend.length) {
      let lx = PAD.l + 8;
      const ly = PAD.t + 10;
      ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      legend.slice(0, 4).forEach((s, index) => {
        const color =
          (s.sourceId && colorForSource?.(s.sourceId)) ||
          SERIES_COLORS[index % SERIES_COLORS.length];
        const text = (s.label || `f${index + 1}`).slice(0, 18);
        ctx.fillStyle = color;
        ctx.fillRect(lx, ly - 4, 10, 8);
        ctx.fillStyle = labelCol;
        ctx.fillText(text, lx + 14, ly);
        lx += ctx.measureText(text).width + 28;
      });
    }
  }, [plot, darkNodes, colorForSource, plotBox, view, zoom]);

  return (
    <div
      ref={wrapRef}
      data-graph-plot
      className="w-full touch-none select-none"
      style={{ touchAction: 'none', cursor: 'grab' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      title="Scroll / pinch to zoom · drag to pan · double-click to reset"
    >
      <canvas
        ref={canvasRef}
        className="block w-full rounded-md"
        style={{ width: '100%', height, touchAction: 'none' }}
      />
    </div>
  );
}
