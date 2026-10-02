import React, { useMemo, useState } from 'react';
import { putFileFromFileList } from '@/lib/mediaStore';
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

  const collapsed = Boolean(node.previewCollapsed);
  const displayErr = err || loadErr;

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
          {node.fileSize ? ` · ${formatFileSize(node.fileSize)}` : ''}
        </div>
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
          name={node.fileName}
          textPreview={textPreview}
          darkNodes={darkNodes}
        />
      )}
    </div>
  );
}
