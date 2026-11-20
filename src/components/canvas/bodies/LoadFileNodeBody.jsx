import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { getBlobRecord, putFileFromFileList } from '@/lib/mediaStore';
import { downloadBlob } from '@/lib/shareCanvas';
import FilePreviewPanel, { formatFileSize, useBlobPreview } from './FilePreviewPanel';

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
  const { url, textPreview, err: loadErr } = useBlobPreview(node.fileId);
  const [busy, setBusy] = useState(false);
  const [dlBusy, setDlBusy] = useState(false);
  const [err, setErr] = useState(null);

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

  const onDownload = async () => {
    if (!node.fileId) return;
    setDlBusy(true);
    setErr(null);
    try {
      const record = await getBlobRecord(node.fileId);
      if (!record?.blob) throw new Error('File missing from storage');
      const name = record.name || node.fileName || 'file';
      await downloadBlob(record.blob, name, record.mime || node.fileMime);
      // Keep node label in sync if media meta was restored without a name earlier.
      if ((!node.fileName || node.fileName === 'file') && record.name && record.name !== 'file') {
        onUpdate({ fileName: record.name, fileMime: record.mime || node.fileMime });
      }
    } catch (ex) {
      setErr(ex?.message || 'Download failed');
    } finally {
      setDlBusy(false);
    }
  };

  const collapsed = Boolean(node.previewCollapsed);
  const displayErr = err || loadErr;
  const displayName = node.fileName || 'file';

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
              download={displayName}
              target="_blank"
              rel="noreferrer"
              className={darkNodes ? 'text-indigo-300 underline' : 'text-indigo-700 underline'}
            >
              Open {displayName}
            </a>
          ) : (
            <span>{displayName}</span>
          )}
          {node.fileSize ? ` · ${formatFileSize(node.fileSize)}` : ''}
        </div>
      )}
      {node.fileId && (
        <button
          type="button"
          disabled={dlBusy}
          onClick={onDownload}
          className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition ${
            dlBusy
              ? 'cursor-not-allowed opacity-50'
              : darkNodes
                ? 'bg-nm-hover text-nm-text hover:bg-nm-hover-strong'
                : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
          }`}
        >
          <Download size={14} />
          {dlBusy ? 'Saving…' : 'Download file'}
        </button>
      )}
      {displayErr && (
        <p className={`text-xs ${darkNodes ? 'text-amber-200' : 'text-amber-800'}`}>{displayErr}</p>
      )}
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
        <FilePreviewPanel
          url={url}
          mime={node.fileMime}
          name={displayName}
          textPreview={textPreview}
          darkNodes={darkNodes}
        />
      )}
    </div>
  );
}
