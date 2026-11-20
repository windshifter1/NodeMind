/**
 * File conversion registry — Manipulation-style applicability predicates.
 * Uses browser APIs + optional permissive dynamic imports.
 */

function ext(name = '') {
  const m = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

function isImage({ mime, name }) {
  return String(mime || '').startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext(name));
}

function isPdf({ mime, name }) {
  return mime === 'application/pdf' || ext(name) === 'pdf';
}

function isDocx({ mime, name }) {
  return (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext(name) === 'docx'
  );
}

function isSpreadsheet({ mime, name }) {
  const e = ext(name);
  return (
    e === 'csv' ||
    e === 'xlsx' ||
    e === 'xls' ||
    mime === 'text/csv' ||
    (mime || '').includes('spreadsheet')
  );
}

function isMarkdown({ mime, name }) {
  return ext(name) === 'md' || mime === 'text/markdown';
}

function isSvg({ mime, name }) {
  return mime === 'image/svg+xml' || ext(name) === 'svg';
}

function isTextish({ mime, name }) {
  return (
    String(mime || '').startsWith('text/') ||
    ['txt', 'json', 'md', 'csv', 'js', 'ts', 'jsx', 'tsx', 'py', 'css', 'html', 'svg'].includes(ext(name))
  );
}

/** @type {{ id: string, label: string, applies: (meta) => boolean, run: (ctx) => Promise<{blob: Blob, name: string, mime: string}|{text: string, name: string, mime: string}> }[]} */
export const CONVERSION_DEFS = [
  {
    id: 'image-to-png',
    label: 'Image → PNG',
    applies: (m) => isImage(m) && !String(m.mime || '').includes('png') && !isSvg(m),
    async run({ blob, name }) {
      const out = await rasterToFormat(blob, 'image/png');
      return { blob: out, name: rename(name, 'png'), mime: 'image/png' };
    },
  },
  {
    id: 'image-to-jpeg',
    label: 'Image → JPEG',
    applies: (m) => isImage(m) && !isSvg(m),
    async run({ blob, name }) {
      const out = await rasterToFormat(blob, 'image/jpeg', 0.92);
      return { blob: out, name: rename(name, 'jpg'), mime: 'image/jpeg' };
    },
  },
  {
    id: 'image-to-webp',
    label: 'Image → WebP',
    applies: (m) => isImage(m) && !isSvg(m),
    async run({ blob, name }) {
      const out = await rasterToFormat(blob, 'image/webp', 0.9);
      return { blob: out, name: rename(name, 'webp'), mime: 'image/webp' };
    },
  },
  {
    id: 'svg-to-png',
    label: 'SVG → PNG',
    applies: (m) => isSvg(m),
    async run({ blob, name }) {
      const out = await svgBlobToPng(blob);
      return { blob: out, name: rename(name, 'png'), mime: 'image/png' };
    },
  },
  {
    id: 'pdf-to-text',
    label: 'PDF → text',
    applies: (m) => isPdf(m),
    async run({ blob, name }) {
      const text = await pdfToText(blob);
      return {
        text,
        name: rename(name, 'txt'),
        mime: 'text/plain',
      };
    },
  },
  {
    id: 'text-to-pdf',
    label: 'Text → PDF',
    applies: (m) => isTextish(m) && !isPdf(m),
    async run({ blob, name }) {
      const text = await blob.text();
      const out = await textToPdf(text);
      return { blob: out, name: rename(name, 'pdf'), mime: 'application/pdf' };
    },
  },
  {
    id: 'docx-to-text',
    label: 'Word → text',
    applies: (m) => isDocx(m),
    async run({ blob, name }) {
      const text = await docxToText(blob);
      return { text, name: rename(name, 'txt'), mime: 'text/plain' };
    },
  },
  {
    id: 'csv-to-json',
    label: 'CSV → JSON',
    applies: (m) => ext(m.name) === 'csv' || m.mime === 'text/csv',
    async run({ blob, name }) {
      const text = await blob.text();
      const json = csvToJson(text);
      return {
        text: JSON.stringify(json, null, 2),
        name: rename(name, 'json'),
        mime: 'application/json',
      };
    },
  },
  {
    id: 'md-to-html',
    label: 'Markdown → HTML',
    applies: (m) => isMarkdown(m),
    async run({ blob, name }) {
      const md = await blob.text();
      const html = simpleMarkdownToHtml(md);
      return { text: html, name: rename(name, 'html'), mime: 'text/html' };
    },
  },
  {
    id: 'image-resize-half',
    label: 'Image → half size PNG',
    applies: (m) => isImage(m) && !isSvg(m),
    async run({ blob, name }) {
      const out = await resizeImage(blob, 0.5, 'image/png');
      return { blob: out, name: rename(name, 'png'), mime: 'image/png' };
    },
  },
];

export function listApplicableConversions(meta = {}) {
  return CONVERSION_DEFS.filter((def) => {
    try {
      return def.applies(meta || {});
    } catch {
      return false;
    }
  }).map(({ id, label }) => ({ id, label }));
}

export function getConversion(id) {
  return CONVERSION_DEFS.find((d) => d.id === id) || null;
}

function rename(name, newExt) {
  const base = String(name || 'file').replace(/\.[^.]+$/, '');
  return `${base || 'file'}.${newExt}`;
}

async function rasterToFormat(blob, mime, quality) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const out = await canvasToBlob(canvas, mime, quality);
  return out;
}

async function resizeImage(blob, scale, mime) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvasToBlob(canvas, mime);
}

async function svgBlobToPng(blob) {
  const text = await blob.text();
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 512;
    canvas.height = img.naturalHeight || 512;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return canvasToBlob(canvas, 'image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Export failed'))),
      mime,
      quality
    );
  });
}

async function pdfToText(blob) {
  // Lightweight fallback: try pdf.js if available, else explain.
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    if (pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/legacy/build/pdf.worker.mjs',
        import.meta.url
      ).toString();
    }
    const data = new Uint8Array(await blob.arrayBuffer());
    const doc = await pdfjs.getDocument({ data }).promise;
    const parts = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      parts.push(content.items.map((it) => it.str).join(' '));
    }
    return parts.join('\n\n');
  } catch {
    return '[PDF text extraction requires pdf.js — install pdfjs-dist for full support]\n';
  }
}

async function textToPdf(text) {
  // Minimal PDF writer (no deps) — one page plain text.
  const lines = String(text).split(/\r?\n/).slice(0, 60);
  const escaped = lines.map((l) => pdfEscape(l.slice(0, 90)));
  const content = ['BT /F1 10 Tf 50 780 Td', ...escaped.map((l, i) => (i === 0 ? `(${l}) Tj` : `0 -14 Td (${l}) Tj`)), 'ET'].join(
    '\n'
  );
  const objects = [];
  objects.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n');
  objects.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n');
  objects.push(
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n'
  );
  objects.push(`4 0 obj<< /Length ${content.length} >>stream\n${content}\nendstream\nendobj\n`);
  objects.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n');
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj) => {
    offsets.push(pdf.length);
    pdf += obj;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

function pdfEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

async function docxToText(blob) {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer: await blob.arrayBuffer() });
    return result.value || '';
  } catch {
    return '[Word extraction requires the mammoth package]\n';
  }
}

function csvToJson(text) {
  const rows = String(text)
    .trim()
    .split(/\r?\n/)
    .map((line) => parseCsvLine(line));
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h || `col${i + 1}`] = row[i] ?? '';
    });
    return obj;
  });
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function simpleMarkdownToHtml(md) {
  return String(md)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}

export async function runConversion(conversionId, fileMeta, blob) {
  const def = getConversion(conversionId);
  if (!def) throw new Error('Unknown conversion');
  return def.run({ blob, name: fileMeta.name, mime: fileMeta.mime });
}
