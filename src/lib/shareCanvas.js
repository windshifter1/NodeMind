import {
  bezierPath,
  nodeSizeForLayout,
  normalizeOrientation,
  socketWorld,
  workspaceNodesBounds,
} from '@/lib/canvasConstants';
import { displayNodeTitle, isExpressionNode, isMathNode } from '@/lib/nodeTypes';

const PAD = 48;

function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nodePreviewText(node) {
  if (isExpressionNode(node) && node.expr) return String(node.expr);
  if (isMathNode(node)) {
    const bits = [node.expr, node.mode, node.field].filter((b) => b != null && String(b).trim());
    return bits.join(' · ');
  }
  if (node.kind === 'checklist' && Array.isArray(node.items)) {
    const done = node.items.filter((i) => i.done).length;
    return `${done}/${node.items.length} done`;
  }
  if (typeof node.content === 'string' && node.content.trim()) {
    return node.content.trim().split('\n').slice(0, 4).join('\n');
  }
  return '';
}

/**
 * Build an SVG document of the workspace graph (nodes + edges) in world space.
 */
export function buildWorkspaceSvg({
  nodes = [],
  edges = [],
  orientation = 'horizontal',
  name = 'NodeMind',
  dark = true,
} = {}) {
  const orient = normalizeOrientation(orientation);
  const bounds = workspaceNodesBounds(nodes);
  if (!bounds) {
    const empty = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270">
  <rect width="100%" height="100%" fill="${dark ? '#18181b' : '#f8fafc'}"/>
  <text x="50%" y="50%" text-anchor="middle" fill="${dark ? '#a1a1aa' : '#64748b'}" font-family="system-ui,sans-serif" font-size="16">Empty workspace</text>
</svg>`;
    return { svg: empty, width: 480, height: 270 };
  }

  const minX = bounds.minX - PAD;
  const minY = bounds.minY - PAD;
  const width = Math.ceil(bounds.width + PAD * 2);
  const height = Math.ceil(bounds.height + PAD * 2);
  const bg = dark ? '#18181b' : '#f1f5f9';
  const edgeStroke = dark ? '#71717a' : '#94a3b8';
  const titleFill = dark ? '#f4f4f5' : '#0f172a';
  const bodyFill = dark ? '#d4d4d8' : '#334155';

  const edgePaths = edges
    .map((edge) => {
      const from = nodes.find((n) => n.id === edge.fromNode);
      const to = nodes.find((n) => n.id === edge.toNode);
      if (!from || !to) return '';
      let out;
      let inp;
      if (edge.fromType === 'output') {
        out = socketWorld(from, 'output', orient);
        inp = socketWorld(to, 'input', orient, nodeSizeForLayout(to), {
          inputSlot: edge.inputSlot || null,
        });
      } else {
        out = socketWorld(to, 'output', orient);
        inp = socketWorld(from, 'input', orient, nodeSizeForLayout(from), {
          inputSlot: edge.inputSlot || null,
        });
      }
      const d = bezierPath(out.x, out.y, inp.x, inp.y, false, orient);
      return `<path d="${d}" fill="none" stroke="${edgeStroke}" stroke-width="2.5" stroke-linecap="round"/>`;
    })
    .join('\n');

  const nodeShapes = nodes
    .map((node) => {
      const size = nodeSizeForLayout(node);
      const color = node.color || '#6366f1';
      const title = escapeXml(displayNodeTitle(node));
      const preview = escapeXml(nodePreviewText(node)).slice(0, 280);
      const barH = 36;
      const rx = 14;
      const lines = preview
        ? preview.split('\n').slice(0, 4).map((line, i) => {
            const y = node.y + barH + 18 + i * 16;
            return `<text x="${node.x + 12}" y="${y}" fill="${bodyFill}" font-family="system-ui,sans-serif" font-size="12">${line}</text>`;
          }).join('\n')
        : '';
      return `
  <g>
    <rect x="${node.x}" y="${node.y}" width="${size.width}" height="${size.height}" rx="${rx}" ry="${rx}" fill="${dark ? '#27272a' : '#ffffff'}" stroke="${color}" stroke-width="1.5"/>
    <path d="M ${node.x + rx} ${node.y} H ${node.x + size.width - rx} Q ${node.x + size.width} ${node.y} ${node.x + size.width} ${node.y + rx} V ${node.y + barH} H ${node.x} V ${node.y + rx} Q ${node.x} ${node.y} ${node.x + rx} ${node.y} Z" fill="${color}55"/>
    <text x="${node.x + 12}" y="${node.y + 24}" fill="${titleFill}" font-family="system-ui,sans-serif" font-size="14" font-weight="600">${title}</text>
    ${lines}
  </g>`;
    })
    .join('\n');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX} ${minY} ${width} ${height}">
  <title>${escapeXml(name)}</title>
  <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${bg}"/>
  ${edgePaths}
  ${nodeShapes}
</svg>`;

  return { svg, width, height, minX, minY };
}

export const SHARE_FORMATS = [
  { id: 'png', label: 'PNG', mime: 'image/png', ext: 'png' },
  { id: 'jpeg', label: 'JPEG', mime: 'image/jpeg', ext: 'jpg' },
  { id: 'svg', label: 'SVG', mime: 'image/svg+xml', ext: 'svg' },
  { id: 'pdf', label: 'PDF', mime: 'application/pdf', ext: 'pdf' },
];

function safeFileBase(name) {
  return String(name || 'nodemind').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'nodemind';
}

function svgToImage(svgText) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not render SVG'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), mime, quality);
  });
}

async function rasterFromSvg(svgText, width, height, mime, quality) {
  const img = await svgToImage(svgText);
  const canvas = document.createElement('canvas');
  const scale = 2;
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvasToBlob(canvas, mime, quality);
}

/** Minimal single-page PDF embedding a JPEG/PNG as full-page image. */
async function pngBlobToPdf(imageBlob, width, height) {
  const pngBytes = new Uint8Array(await imageBlob.arrayBuffer());
  // Convert to JPEG for simpler PDF embedding without PNG filters.
  let jpegBlob = imageBlob;
  if (imageBlob.type !== 'image/jpeg') {
    const bitmap = await createImageBitmap(imageBlob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    jpegBlob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
  }
  const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
  const pageW = 612;
  const pageH = Math.max(1, Math.round((height / width) * pageW));
  const imgObj = `<< /Type /XObject /Subtype /Image /Width ${width * 2} /Height ${height * 2} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>`;

  // Build PDF with binary image stream
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

/**
 * @returns {Promise<{ blob: Blob, fileName: string, mime: string }>}
 */
export async function exportWorkspaceImage({
  nodes,
  edges,
  orientation,
  name,
  format = 'png',
  dark = true,
}) {
  const { svg, width, height } = buildWorkspaceSvg({
    nodes,
    edges,
    orientation,
    name,
    dark,
  });
  const base = safeFileBase(name);
  const fmt = SHARE_FORMATS.find((f) => f.id === format) || SHARE_FORMATS[0];

  if (fmt.id === 'svg') {
    const blob = new Blob([svg], { type: fmt.mime });
    return { blob, fileName: `${base}.${fmt.ext}`, mime: fmt.mime };
  }

  if (fmt.id === 'png' || fmt.id === 'jpeg') {
    const blob = await rasterFromSvg(
      svg,
      width,
      height,
      fmt.mime,
      fmt.id === 'jpeg' ? 0.92 : undefined
    );
    return { blob, fileName: `${base}.${fmt.ext}`, mime: fmt.mime };
  }

  // PDF
  const png = await rasterFromSvg(svg, width, height, 'image/png');
  const pdf = await pngBlobToPdf(png, width, height);
  return { blob: pdf, fileName: `${base}.pdf`, mime: 'application/pdf' };
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function shareOrDownloadBlob(blob, fileName, mime) {
  const file = new File([blob], fileName, { type: mime });
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'aborted';
      // fall through to download
    }
  }
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      // Some browsers share URL only — download instead for binary fidelity
    } catch {
      /* ignore */
    }
  }
  downloadBlob(blob, fileName);
  return 'downloaded';
}
