import React, { useEffect, useState } from 'react';
import {
  getBlobRecord,
  getBlobUrl,
  isCodeLike,
  isImageMime,
  isPdfMime,
  languageFromName,
} from '@/lib/mediaStore';

export function formatFileSize(n) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Resolve blob URL + optional text preview for a stored fileId. */
export function useBlobPreview(fileId) {
  const [url, setUrl] = useState(null);
  const [textPreview, setTextPreview] = useState('');
  const [size, setSize] = useState(0);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let revoked = null;
    let cancelled = false;
    (async () => {
      setErr(null);
      setTextPreview('');
      setSize(0);
      if (!fileId) {
        setUrl(null);
        return;
      }
      try {
        const objectUrl = await getBlobUrl(fileId);
        if (cancelled) {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          return;
        }
        revoked = objectUrl;
        setUrl(objectUrl);
        const record = await getBlobRecord(fileId);
        if (cancelled || !record) return;
        if (record.size) setSize(record.size);
        if (
          record.blob &&
          isCodeLike(record.mime, record.name) &&
          !isImageMime(record.mime) &&
          !isPdfMime(record.mime, record.name)
        ) {
          const text = await record.blob.text();
          if (!cancelled) setTextPreview(text.slice(0, 20000));
        }
      } catch (e) {
        if (!cancelled) {
          setUrl(null);
          setErr(e?.message || 'Could not load file');
        }
      }
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [fileId]);

  return { url, textPreview, size, err };
}

function CodePreview({ text, language, darkNodes }) {
  const lines = String(text).split('\n');
  return (
    <pre
      className={`m-0 overflow-x-auto p-2 text-[11px] leading-relaxed ${
        darkNodes ? 'text-zinc-200' : 'text-slate-800'
      }`}
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
    >
      <code data-language={language}>
        {lines.map((line, i) => (
          <div key={i} className="flex gap-2">
            <span
              className={`w-6 shrink-0 select-none text-right ${
                darkNodes ? 'text-zinc-600' : 'text-slate-400'
              }`}
            >
              {i + 1}
            </span>
            <span className="whitespace-pre-wrap break-all">{line || ' '}</span>
          </div>
        ))}
      </code>
    </pre>
  );
}

function PdfPreview({ url, darkNodes }) {
  const [pages, setPages] = useState([]);
  const [message, setMessage] = useState('Loading PDF…');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        if (pdfjs.GlobalWorkerOptions) {
          pdfjs.GlobalWorkerOptions.workerSrc = new URL(
            'pdfjs-dist/legacy/build/pdf.worker.mjs',
            import.meta.url
          ).toString();
        }
        const doc = await pdfjs.getDocument(url).promise;
        const max = Math.min(doc.numPages, 3);
        const texts = [];
        for (let i = 1; i <= max; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          texts.push(content.items.map((it) => it.str).join(' '));
        }
        if (!cancelled) {
          setPages(texts);
          setMessage(
            doc.numPages > max ? `Showing first ${max} of ${doc.numPages} pages (selectable text)` : ''
          );
        }
      } catch {
        if (!cancelled) {
          setMessage('PDF preview needs pdfjs-dist. You can still Open the file.');
          setPages([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="space-y-2 p-2">
      {message && (
        <p className={`text-[11px] ${darkNodes ? 'text-zinc-500' : 'text-slate-400'}`}>{message}</p>
      )}
      {pages.map((t, i) => (
        <div
          key={i}
          className={`select-text whitespace-pre-wrap break-words rounded border p-2 text-xs leading-relaxed ${
            darkNodes
              ? 'border-white/10 bg-black/20 text-zinc-200'
              : 'border-slate-200 bg-white text-slate-800'
          }`}
        >
          {t || '(empty page)'}
        </div>
      ))}
    </div>
  );
}

/** Image / PDF / text preview — same UI as Load File. */
export default function FilePreviewPanel({
  url,
  mime = '',
  name = '',
  textPreview = '',
  darkNodes = false,
}) {
  const lang = languageFromName(name, mime);
  const image = isImageMime(mime);
  const pdf = isPdfMime(mime, name);

  return (
    <div
      className={`max-h-56 overflow-auto rounded-md border ${
        darkNodes ? 'border-white/10 bg-black/30' : 'border-slate-200 bg-white/80'
      }`}
    >
      {image && url && (
        <img
          src={url}
          alt={name || 'preview'}
          className="max-h-52 w-full object-contain"
          onContextMenu={(e) => {
            e.stopPropagation();
          }}
        />
      )}
      {pdf && url && <PdfPreview url={url} darkNodes={darkNodes} />}
      {textPreview && <CodePreview text={textPreview} language={lang} darkNodes={darkNodes} />}
      {!image && !pdf && !textPreview && url && (
        <p className={`p-3 text-xs ${darkNodes ? 'text-zinc-500' : 'text-slate-400'}`}>
          Preview not available — use Open link.
        </p>
      )}
    </div>
  );
}
