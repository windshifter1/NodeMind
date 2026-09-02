import React, { useEffect, useRef, useState } from 'react';

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

function mapX(x, xMin, xMax, left, width) {
  return left + ((x - xMin) / (xMax - xMin)) * width;
}

function mapY(y, yMin, yMax, top, height) {
  return top + ((yMax - y) / (yMax - yMin)) * height;
}

/**
 * 2D Cartesian plot for Graph nodes.
 * `plot` comes from evalGraph / buildPlotFromInputs.
 * `colorForSource(sourceId)` optional override (node outline colours).
 */
export default function GraphPlot({
  plot,
  darkNodes = true,
  colorForSource = null,
  height = 336,
}) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(488);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = Math.max(120, width);
    const cssH = Math.max(120, height);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const padL = 36;
    const padR = 12;
    const padT = 12;
    const padB = 28;
    const plotW = cssW - padL - padR;
    const plotH = cssH - padT - padB;

    const bg = darkNodes ? '#1f2226' : '#f8fafc';
    const grid = darkNodes ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
    const axis = darkNodes ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.45)';
    const label = darkNodes ? 'rgba(255,255,255,0.65)' : 'rgba(15,23,42,0.65)';
    const muted = darkNodes ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.45)';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cssW, cssH);

    const xMin = plot?.xMin ?? -10;
    const xMax = plot?.xMax ?? 10;
    const yMin = plot?.yMin ?? -10;
    const yMax = plot?.yMax ?? 10;
    const xSpan = Math.max(1e-9, xMax - xMin);
    const ySpan = Math.max(1e-9, yMax - yMin);

    const xStep = niceStep(xSpan);
    const yStep = niceStep(ySpan);

    ctx.save();
    ctx.beginPath();
    ctx.rect(padL, padT, plotW, plotH);
    ctx.clip();

    // Grid
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    const xStart = Math.ceil(xMin / xStep) * xStep;
    for (let x = xStart; x <= xMax + 1e-9; x += xStep) {
      const px = mapX(x, xMin, xMax, padL, plotW);
      ctx.beginPath();
      ctx.moveTo(px, padT);
      ctx.lineTo(px, padT + plotH);
      ctx.stroke();
    }
    const yStart = Math.ceil(yMin / yStep) * yStep;
    for (let y = yStart; y <= yMax + 1e-9; y += yStep) {
      const py = mapY(y, yMin, yMax, padT, plotH);
      ctx.beginPath();
      ctx.moveTo(padL, py);
      ctx.lineTo(padL + plotW, py);
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = axis;
    ctx.lineWidth = 1.25;
    if (xMin <= 0 && xMax >= 0) {
      const zx = mapX(0, xMin, xMax, padL, plotW);
      ctx.beginPath();
      ctx.moveTo(zx, padT);
      ctx.lineTo(zx, padT + plotH);
      ctx.stroke();
    }
    if (yMin <= 0 && yMax >= 0) {
      const zy = mapY(0, yMin, yMax, padT, plotH);
      ctx.beginPath();
      ctx.moveTo(padL, zy);
      ctx.lineTo(padL + plotW, zy);
      ctx.stroke();
    }

    const series = plot?.series || [];
    series.forEach((s, index) => {
      if (s.kind === 'error') return;
      const color =
        (s.sourceId && colorForSource?.(s.sourceId)) ||
        SERIES_COLORS[index % SERIES_COLORS.length];
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      if (s.kind === 'vline' && Number.isFinite(s.value)) {
        const px = mapX(s.value, xMin, xMax, padL, plotW);
        ctx.beginPath();
        ctx.moveTo(px, padT);
        ctx.lineTo(px, padT + plotH);
        ctx.stroke();
        return;
      }

      let drawing = false;
      ctx.beginPath();
      (s.points || []).forEach((p) => {
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
          drawing = false;
          return;
        }
        const px = mapX(p.x, xMin, xMax, padL, plotW);
        const py = mapY(p.y, yMin, yMax, padT, plotH);
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
    ctx.strokeStyle = darkNodes ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(padL + 0.5, padT + 0.5, plotW - 1, plotH - 1);

    // Tick labels
    ctx.fillStyle = label;
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let x = xStart; x <= xMax + 1e-9; x += xStep) {
      if (Math.abs(x) < xStep * 1e-9) continue;
      const px = mapX(x, xMin, xMax, padL, plotW);
      if (px < padL || px > padL + plotW) continue;
      const text = Number.isInteger(x) ? String(x) : x.toFixed(2).replace(/\.?0+$/, '');
      ctx.fillText(text, px, padT + plotH + 6);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = yStart; y <= yMax + 1e-9; y += yStep) {
      if (Math.abs(y) < yStep * 1e-9) continue;
      const py = mapY(y, yMin, yMax, padT, plotH);
      if (py < padT || py > padT + plotH) continue;
      const text = Number.isInteger(y) ? String(y) : y.toFixed(2).replace(/\.?0+$/, '');
      ctx.fillText(text, padL - 6, py);
    }

    // Empty / error overlay
    if (plot?.error && !(plot.series || []).some((s) => s.kind !== 'error')) {
      ctx.fillStyle = muted;
      ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(plot.error, padL + plotW / 2, padT + plotH / 2);
    }

    // Legend
    const legend = (plot?.series || []).filter((s) => s.kind !== 'error' || s.label);
    if (legend.length) {
      let lx = padL + 8;
      const ly = padT + 10;
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
        ctx.fillStyle = label;
        ctx.fillText(text, lx + 14, ly);
        lx += ctx.measureText(text).width + 28;
      });
    }
  }, [plot, darkNodes, colorForSource, width, height]);

  return (
    <div ref={wrapRef} className="w-full">
      <canvas
        ref={canvasRef}
        className="block w-full rounded-md"
        style={{ width: '100%', height }}
      />
    </div>
  );
}
