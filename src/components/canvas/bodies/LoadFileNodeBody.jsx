import React, { useEffect, useMemo, useState } from 'react';
import {
  getBlobRecord,
  getBlobUrl,
  isCodeLike,
  isImageMime,
  isPdfMime,
  languageFromName,
  putFileFromFileList,
} from '@/lib/mediaStore';

function inputClass(darkNodes, color) {
  return {
    className: `w-full rounded-md border px-2 py-1.5 text-sm outline-none ${
      darkNodes
        ? 'border-white/10 bg-black/20 text-zinc-100'
        : 'border-slate-200 bg-white/80 text-slate-800'
    }`,
    style: { borderColor: `${color}55` },
  };
}

export default function LoadFileNodeBody({ node, darkNodes, onUpdate }) {
  const fieldLooks = useMemo(() => inputClass(darkNodes, node.color), [darkNodes, node.color]);
  const [url, setUrl] = useState(null);
  const [textPreview, setTextPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let revoked = null;
    let cancelled = false;
    (async () => {
      setErr(null);
      setTextPreview('');
      if (!node.fileId) {
        setUrl(null);
        return;
      }
      try {
        const objectUrl = await getBlobUrl(node.fileId);
        if (cancelled) {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          return;
        }
        revoked = objectUrl;
        setUrl(objectUrl);
        const record = await getBlobRecord(node.fileId);
        if (
          record?.blob &&
          isCodeLike(record.mime, record.name) &&
          !isImageMime(record.mime) &&
          !isPdfMime(record.mime, record.name)
        ) {
          const text = await record.blob.text();
          if (!cancelled) setTextPreview(text.slice(0, 20000));
        }
      } catch (e) {
        if (!cancelled) setErr(e?.message || 'Could not load file');
      }
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [node.fileId]);

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const meta = await putFileFromFileList(file);
      onUpdate({
        fileId: meta.fileId,
        fileName: meta.name,
        fileMime: meta.mime,
        fileSize: meta.size,
        previewCollapsed: false,
      });
    } catch (ex) {
      setErr(ex?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const lang = languageFromName(node.fileName, node.fileMime);
  const collapsed = Boolean(node.previewCollapsed);

  return (
    <div className="flex flex-col gap-2 px-3 pb-3 pt-1" onPointerDown={(e) => e.stopPropagation()}>
      <label className={`${fieldLooks.className} cursor-pointer text-center`} style={fieldLooks.style}>
        {busy ? 'Uploading…' : node.fileId ? 'Replace file…' : 'Choose file…'}
        <input type="file" className="hidden" onChange={onPick} />
      </label>
      {node.fileId && (
        <div className={`text-xs ${darkNodes ? 'text-zinc-400' : 'text-slate-500'}`}>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className={darkNodes ? 'text-indigo-300 underline' : 'text-indigo-700 underline'}
            >
              Open {node.fileName || 'file'}
            </a>
          ) : (
            <span>{node.fileName || 'file'}</span>
          )}
          {node.fileSize ? ` · ${formatSize(node.fileSize)}` : ''}
        </div>
      )}
      {err && <p className={`text-xs ${darkNodes ? 'text-amber-200' : 'text-amber-800'}`}>{err}</p>}
      {node.fileId && (
        <button
          type="button"
          onClick={() => onUpdate({ previewCollapsed: !collapsed })}
          className={`text-left text-xs font-medium ${darkNodes ? 'text-indigo-200' : 'text-indigo-700'}`}
        >
          {collapsed ? 'Show preview' : 'Hide preview'}
        </button>
      )}
      {!collapsed && node.fileId && (
        <div
          className={`max-h-56 overflow-auto rounded-md border ${
            darkNodes ? 'border-white/10 bg-black/30' : 'border-slate-200 bg-white/80'
          }`}
        >
          {isImageMime(node.fileMime) && url && (
            <img
              src={url}
              alt={node.fileName || 'preview'}
              className="max-h-52 w-full object-contain"
              onContextMenu={(e) => {
                // Allow native copy / save
                e.stopPropagation();
              }}
            />
          )}
          {isPdfMime(node.fileMime, node.fileName) && url && (
            <PdfPreview url={url} darkNodes={darkNodes} />
          )}
          {textPreview && (
            <CodePreview text={textPreview} language={lang} darkNodes={darkNodes} />
          )}
          {!isImageMime(node.fileMime) &&
            !isPdfMime(node.fileMime, node.fileName) &&
            !textPreview &&
            url && (
              <p className={`p-3 text-xs ${darkNodes ? 'text-zinc-500' : 'text-slate-400'}`}>
                Preview not available — use Open link.
              </p>
            )}
        </div>
      )}
    </div>
  );
}

function formatSize(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
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
          setMessage(doc.numPages > max ? `Showing first ${max} of ${doc.numPages} pages (selectable text)` : '');
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
