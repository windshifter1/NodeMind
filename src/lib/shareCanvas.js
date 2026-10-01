import { flushSync } from 'react-dom';
import { toBlob, toJpeg, toPng, toSvg } from 'html-to-image';
import {
  MIN_ZOOM,
  MAX_ZOOM,
  nodeSizeForLayout,
  workspaceNodesBounds,
  zoomToFrameBounds,
} from '@/lib/canvasConstants';
import { normalizeBackgroundArt } from '@/lib/backgroundArt';

const PAD = 64;

export const SHARE_FORMATS = [
  { id: 'png', label: 'PNG', mime: 'image/png', ext: 'png' },
  { id: 'jpeg', label: 'JPEG', mime: 'image/jpeg', ext: 'jpg' },
  { id: 'svg', label: 'SVG', mime: 'image/svg+xml', ext: 'svg' },
  { id: 'pdf', label: 'PDF', mime: 'application/pdf', ext: 'pdf' },
];

function safeFileBase(name) {
  return String(name || 'nodemind').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'nodemind';
}

function clampZoom(z) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

function waitFrames(n = 2) {
  return new Promise((resolve) => {
    const step = (left) => {
      if (left <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => step(left - 1));
    };
    step(n);
  });
}

/** World-space bounds covering nodes and background drawings. */
export function contentBounds(nodes = [], backgroundArt = null, boardEl = null, pan = null, zoom = 1) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;

  const include = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    any = true;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  const includeRect = (x, y, w, h) => {
    include(x, y);
    include(x + w, y + h);
  };

  (nodes || []).forEach((node) => {
    const size = nodeSizeForLayout(node);
    includeRect(node.x, node.y, size.width, size.height);
  });

  // Prefer live DOM measurements when available (includes expanded body text height).
  if (boardEl && pan && Number.isFinite(zoom) && zoom > 0) {
    const boardRect = boardEl.getBoundingClientRect();
    boardEl.querySelectorAll('[data-note-node]').forEach((el) => {
      const r = el.getBoundingClientRect();
      const x1 = (r.left - boardRect.left - pan.x) / zoom;
      const y1 = (r.top - boardRect.top - pan.y) / zoom;
      const x2 = (r.right - boardRect.left - pan.x) / zoom;
      const y2 = (r.bottom - boardRect.top - pan.y) / zoom;
      includeRect(x1, y1, x2 - x1, y2 - y1);
    });
  }

  const art = normalizeBackgroundArt(backgroundArt);
  (art.strokes || []).forEach((stroke) => {
    (stroke.points || []).forEach((p) => include(p.x, p.y));
  });
  (art.images || []).forEach((img) => {
    includeRect(img.x, img.y, img.w || 0, img.h || 0);
  });

  if (!any) {
    const fallback = workspaceNodesBounds(nodes || []);
    if (!fallback) return null;
    return {
      minX: fallback.minX - PAD,
      minY: fallback.minY - PAD,
      maxX: fallback.maxX + PAD,
      maxY: fallback.maxY + PAD,
      width: fallback.width + PAD * 2,
      height: fallback.height + PAD * 2,
      centroid: fallback.centroid,
    };
  }

  return {
    minX: minX - PAD,
    minY: minY - PAD,
    maxX: maxX + PAD,
    maxY: maxY + PAD,
    width: maxX - minX + PAD * 2,
    height: maxY - minY + PAD * 2,
    centroid: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
  };
}

function fitCameraToBounds(bounds, viewportW, viewportH) {
  const fitZoom = clampZoom(zoomToFrameBounds(bounds, viewportW, viewportH, 24));
  return {
    zoom: fitZoom,
    pan: {
      x: viewportW / 2 - bounds.centroid.x * fitZoom,
      y: viewportH / 2 - bounds.centroid.y * fitZoom,
    },
  };
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), mime, quality);
  });
}

async function pngBlobToPdf(imageBlob) {
  let jpegBlob = imageBlob;
  let imgW;
  let imgH;
  if (imageBlob.type !== 'image/jpeg') {
    const bitmap = await createImageBitmap(imageBlob);
    imgW = bitmap.width;
    imgH = bitmap.height;
    const canvas = document.createElement('canvas');
    canvas.width = imgW;
    canvas.height = imgH;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, imgW, imgH);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    jpegBlob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
  } else {
    const bitmap = await createImageBitmap(imageBlob);
    imgW = bitmap.width;
    imgH = bitmap.height;
    bitmap.close?.();
  }

  const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
  const pageW = 612;
  const pageH = Math.max(1, Math.round((imgH / imgW) * pageW));
  const imgObj = `<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>`;

  const encoder = new TextEncoder();
  const parts = [];
  const push = (s) => parts.push(typeof s === 'string' ? encoder.encode(s) : s);

  push('%PDF-1.4\n');
  const offsets = [0];
  const mark = () => {
    let len = 0;
    parts.forEach((p) => {
      len += p.length;
    });
    offsets.push(len);
  };

  mark();
  push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n');
  mark();
  push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n');
  mark();
  push(
    `3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources<< /XObject<< /Im0 5 0 R >> >> >>endobj\n`
  );
  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`;
  mark();
  push(`4 0 obj<< /Length ${content.length} >>stream\n${content}\nendstream\nendobj\n`);
  mark();
  push(`5 0 obj${imgObj}stream\n`);
  push(jpegBytes);
  push('\nendstream\nendobj\n');

  const xrefStart = parts.reduce((n, p) => n + p.length, 0);
  push(`xref\n0 ${offsets.length}\n`);
  push('0000000000 65535 f \n');
  for (let i = 1; i < offsets.length; i++) {
    push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  parts.forEach((p) => {
    out.set(p, o);
    o += p.length;
  });
  return new Blob([out], { type: 'application/pdf' });
}

function cssColorToRgb(color, fallback = '#18181b') {
  const raw = String(color || '').trim();
  if (!raw || raw === 'transparent') return fallback;
  if (/^#([0-9a-f]{3,8})$/i.test(raw) || /^rgba?\(/i.test(raw)) return raw;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return fallback;
    ctx.fillStyle = '#000000';
    ctx.fillStyle = raw;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    if (!a) return fallback;
    return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
  } catch {
    return fallback;
  }
}

const UNSAFE_COLOR_RE = /oklch|oklab|color-mix|\blab\(|\blch\(|\bcolor\(/i;

function snapshotCanvasesIntoClone(liveRoot, clonedRoot) {
  const liveCanvases = [...liveRoot.querySelectorAll('canvas')];
  clonedRoot.querySelectorAll('canvas').forEach((canvas, index) => {
    const live = liveCanvases[index];
    if (!live || live.width < 2 || live.height < 2) return;
    try {
      const url = live.toDataURL('image/png');
      const img = canvas.ownerDocument.createElement('img');
      img.src = url;
      img.alt = '';
      img.width = live.clientWidth || live.width;
      img.height = live.clientHeight || live.height;
      img.setAttribute('class', canvas.getAttribute('class') || '');
      img.setAttribute('style', canvas.getAttribute('style') || '');
      canvas.replaceWith(img);
    } catch {
      /* tainted or detached canvas */
    }
  });
}

function sanitizeUnsupportedColors(root) {
  const props = [
    'color',
    'background-color',
    'border-color',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'outline-color',
    'fill',
    'stroke',
    'text-decoration-color',
  ];
  root.querySelectorAll('*').forEach((el) => {
    const style = el.style;
    if (!style) return;
    props.forEach((prop) => {
      const value = style.getPropertyValue(prop);
      if (value && UNSAFE_COLOR_RE.test(value)) {
        style.setProperty(prop, cssColorToRgb(value));
      }
    });
  });
}

function dataUrlToBlob(dataUrl) {
  const raw = String(dataUrl || '');
  const comma = raw.indexOf(',');
  if (comma < 0) throw new Error('Invalid image data');
  const header = raw.slice(0, comma);
  const data = raw.slice(comma + 1);
  const mime = /data:([^;,]+)/.exec(header)?.[1] || 'application/octet-stream';
  const isBase64 = /;base64/i.test(header);

  if (isBase64) {
    const bin = atob(data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  // html-to-image's toSvg returns charset URI-encoded (not base64) data URLs.
  // Lone "%" in CSS/SVG crashes decodeURIComponent — escape those first.
  const safe = data.replace(/%(?![0-9A-Fa-f]{2})/g, '%25');
  let text = safe;
  try {
    text = decodeURIComponent(safe);
  } catch {
    try {
      text = decodeURIComponent(data);
    } catch {
      text = data;
    }
  }
  return new Blob([text], { type: mime || 'image/svg+xml' });
}

async function rasterBlobToJpeg(imageBlob, quality = 0.92) {
  const bitmap = await createImageBitmap(imageBlob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return canvasToBlob(canvas, 'image/jpeg', quality);
}

async function captureBoard(board, fmt, common) {
  if (fmt.id === 'png') {
    try {
      const blob = await toBlob(board, common);
      if (blob) return blob;
    } catch {
      /* fall through to data-URL path */
    }
    return dataUrlToBlob(await toPng(board, common));
  }
  if (fmt.id === 'jpeg') {
    const jpegOpts = { ...common, quality: 0.92, backgroundColor: '#ffffff' };
    try {
      const blob = dataUrlToBlob(await toJpeg(board, jpegOpts));
      if (blob?.type === 'image/jpeg' && blob.size > 32) return blob;
    } catch {
      /* convert a PNG fallback */
    }
    let pngBlob = null;
    try {
      pngBlob = await toBlob(board, common);
    } catch {
      pngBlob = null;
    }
    if (!pngBlob) pngBlob = dataUrlToBlob(await toPng(board, common));
    return rasterBlobToJpeg(pngBlob);
  }
  if (fmt.id === 'svg') {
    return dataUrlToBlob(await toSvg(board, common));
  }
  // PDF: rasterize to PNG then wrap.
  let pngBlob;
  try {
    pngBlob = await toBlob(board, common);
  } catch {
    pngBlob = null;
  }
  if (!pngBlob) pngBlob = dataUrlToBlob(await toPng(board, common));
  return pngBlobToPdf(pngBlob);
}

/**
 * Capture the live canvas board (nodes with full rendered content + drawings).
 * Temporarily fits the camera to content, snapshots, then restores.
 *
 * @param {object} opts
 * @param {HTMLElement} opts.boardEl
 * @param {object[]} opts.nodes
 * @param {object} opts.backgroundArt
 * @param {{x:number,y:number}} opts.pan
 * @param {number} opts.zoom
 * @param {(p:{x:number,y:number})=>void} opts.setPan
 * @param {(z:number)=>void} opts.setZoom
 * @param {string} opts.name
 * @param {string} opts.format
 */
export async function exportWorkspaceImage({
  boardEl,
  nodes = [],
  backgroundArt = null,
  pan,
  zoom,
  setPan,
  setZoom,
  name,
  format = 'png',
}) {
  const board = boardEl || document.querySelector('[data-canvas-board]');
  if (!board) throw new Error('Canvas not found');

  const fmt = SHARE_FORMATS.find((f) => f.id === format) || SHARE_FORMATS[0];
  const base = safeFileBase(name);
  const prevPan = { x: pan?.x ?? 0, y: pan?.y ?? 0 };
  const prevZoom = typeof zoom === 'number' ? zoom : 1;

  const bounds = contentBounds(nodes, backgroundArt, board, prevPan, prevZoom);
  if (!bounds) throw new Error('Nothing to share — add nodes or drawings first');

  const rect = board.getBoundingClientRect();
  const fitted = fitCameraToBounds(bounds, rect.width, rect.height);

  // Hide non-content chrome inside the board during capture.
  const hideEls = board.querySelectorAll(
    '[data-onboarding="delete-bin"], [data-node-type-menu], .nm-liquid-ripple'
  );
  const prevVisibility = [];
  hideEls.forEach((el) => {
    prevVisibility.push([el, el.style.visibility]);
    el.style.visibility = 'hidden';
  });

  try {
    const applyCamera = () => {
      setPan?.(fitted.pan);
      setZoom?.(fitted.zoom);
    };
    if (typeof flushSync === 'function') flushSync(applyCamera);
    else applyCamera();
    await waitFrames(3);
    // Allow blob images / KaTeX layout to settle.
    await new Promise((r) => setTimeout(r, 80));

    const filter = (node) => {
      if (!(node instanceof Element)) return true;
      if (node.getAttribute?.('data-node-type-menu') != null) return false;
      if (node.getAttribute?.('data-onboarding') === 'delete-bin') return false;
      if (node.getAttribute?.('data-share-canvas-dialog') != null) return false;
      if (node.getAttribute?.('data-empty-canvas-hint') != null) return false;
      return true;
    };

    const boardRect = board.getBoundingClientRect();
    const pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));

    const common = {
      cacheBust: true,
      skipFonts: true,
      pixelRatio,
      width: Math.max(1, Math.round(boardRect.width)),
      height: Math.max(1, Math.round(boardRect.height)),
      filter,
      backgroundColor: cssColorToRgb(getComputedStyle(board).backgroundColor, '#18181b'),
      imagePlaceholder:
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
      onImageErrorHandler: () => {},
      onclone: (clonedDoc, clonedEl) => {
        const root = clonedEl || clonedDoc.querySelector('[data-canvas-board]') || clonedDoc.body;
        if (!root) return;
        root
          .querySelectorAll(
            '[data-empty-canvas-hint], [data-onboarding="delete-bin"], [data-node-type-menu], .nm-liquid-ripple'
          )
          .forEach((el) => {
            el.style.visibility = 'hidden';
          });
        snapshotCanvasesIntoClone(board, root);
        sanitizeUnsupportedColors(root);
      },
    };

    let blob;
    try {
      blob = await captureBoard(board, fmt, common);
    } catch (err) {
      const msg = err?.message || String(err);
      throw new Error(
        msg.includes('atob') || /URI malformed|decodeURI/i.test(msg)
          ? 'Could not encode the image for this format'
          : msg
      );
    }
    if (!blob || blob.size < 32) throw new Error('Capture produced an empty image');

    return { blob, fileName: `${base}.${fmt.ext}`, mime: fmt.mime };
  } finally {
    prevVisibility.forEach(([el, vis]) => {
      el.style.visibility = vis;
    });
    setPan?.(prevPan);
    setZoom?.(prevZoom);
  }
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function shareOrDownloadBlob(blob, fileName, mime) {
  const file = new File([blob], fileName, { type: mime });
  const canFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] }));
  if (canFiles) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'aborted';
      // Lost user-activation after async capture — fall through to download.
    }
  }
  downloadBlob(blob, fileName);
  return 'downloaded';
}
