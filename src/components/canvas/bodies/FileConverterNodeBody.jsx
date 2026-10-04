import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { getBlobRecord, putBlob } from '@/lib/mediaStore';
import { runConversion } from '@/lib/media/conversions';
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

export default function FileConverterNodeBody({ node, darkNodes, onUpdate, dataResult }) {
  const fieldLooks = useMemo(() => inputClass(darkNodes, node.color), [darkNodes, node.color]);
  const ops = dataResult?.applicableConversions || [];
  const source =
    dataResult?.value?.source || (dataResult?.kind === 'fileRef' ? dataResult.value : null);
  const hasInput = Boolean(source?.fileId);
  const isIgnored = Boolean(dataResult?.ignored);
  const error = dataResult?.error;
  const [busy, setBusy] = useState(false);
  const [dlBusy, setDlBusy] = useState(false);
  const [localErr, setLocalErr] = useState(null);

  const { url, textPreview, size: previewSize, err: previewErr } = useBlobPreview(
    node.outputFileId || null
  );
  const outputSize = node.outputFileSize || previewSize || 0;
  const collapsed = Boolean(node.previewCollapsed);
  const selectValue = isIgnored && node.conversionId ? '__ignored__' : node.conversionId || '';

  const run = async () => {
    if (!source?.fileId || !node.conversionId || isIgnored) return;
    setBusy(true);
    setLocalErr(null);
    try {
      const record = await getBlobRecord(source.fileId);
      if (!record?.blob) throw new Error('Source file missing from storage');
      const out = await runConversion(node.conversionId, source, record.blob);
      const blob =
        out.blob ||
        (out.text != null ? new Blob([out.text], { type: out.mime || 'text/plain' }) : null);
      if (!blob) throw new Error('Conversion produced no file');
      const meta = await putBlob(blob, { name: out.name, mime: out.mime });
      onUpdate({
        outputFileId: meta.fileId,
        outputFileName: meta.name,
        outputMime: meta.mime,
        outputFileSize: meta.size,
        previewCollapsed: false,
      });
    } catch (e) {
      setLocalErr(e?.message || 'Conversion failed');
    } finally {
      setBusy(false);
    }
  };

  const onDownload = async () => {
    if (!node.outputFileId) return;
    setDlBusy(true);
    setLocalErr(null);
    try {
      const record = await getBlobRecord(node.outputFileId);
      if (!record?.blob) throw new Error('Converted file missing from storage — run conversion again');
      await downloadBlob(
        record.blob,
        record.name || node.outputFileName || 'converted',
        record.mime || node.outputMime
      );
    } catch (e) {
      setLocalErr(e?.message || 'Download failed');
    } finally {
      setDlBusy(false);
    }
  };

  const displayErr = localErr || previewErr;

  return (
    <div className="flex flex-col gap-2 px-3 pb-3 pt-1" onPointerDown={(e) => e.stopPropagation()}>
      <select
        value={selectValue}
        disabled={!hasInput}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '__ignored__') return;
          onUpdate({
            conversionId: v,
            outputFileId: '',
            outputFileName: '',
            outputMime: '',
            outputFileSize: 0,
            previewCollapsed: false,
          });
        }}
        className={`${fieldLooks.className} ${!hasInput ? 'opacity-60 cursor-not-allowed' : ''}`}
        style={fieldLooks.style}
        title={hasInput ? 'Choose conversion' : 'Connect a Load File node'}
      >
        <option value="">
          {hasInput
            ? ops.length || isIgnored
              ? 'Select conversion…'
              : 'No applicable conversions'
            : 'Connect a file to choose…'}
        </option>
        {isIgnored && node.conversionId && <option value="__ignored__">Ignored</option>}
        {ops.map((op) => (
          <option key={op.id} value={op.id}>
            {op.label}
          </option>
        ))}
      </select>
      {isIgnored && (
        <div
          className={`rounded-md border px-2.5 py-2 text-xs leading-relaxed ${
            darkNodes
              ? 'border-amber-400/35 bg-amber-400/10 text-amber-100/90'
              : 'border-amber-500/40 bg-amber-50 text-amber-900/90'
          }`}
        >
          {error || 'Conversion not applicable for this file — pick another or reconnect.'}
        </div>
      )}
      {!isIgnored && error && error !== 'Select a conversion' && (
        <p className={`text-xs ${darkNodes ? 'text-amber-200' : 'text-amber-800'}`}>{error}</p>
      )}
      <button
        type="button"
        disabled={!hasInput || !node.conversionId || isIgnored || busy}
        onClick={run}
        className={`rounded-md px-2 py-1.5 text-sm font-medium transition ${
          !hasInput || !node.conversionId || isIgnored || busy
            ? 'cursor-not-allowed opacity-50'
            : darkNodes
              ? 'bg-indigo-500/35 text-indigo-100 hover:bg-indigo-500/50'
              : 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'
        }`}
      >
        {busy ? 'Converting…' : 'Run conversion'}
      </button>
      {displayErr && (
        <p className={`text-xs ${darkNodes ? 'text-amber-200' : 'text-amber-800'}`}>{displayErr}</p>
      )}
      {node.outputFileId && (
        <div className="flex flex-col gap-2">
          <div className={`text-xs ${darkNodes ? 'text-zinc-400' : 'text-slate-500'}`}>
            {url ? (
              <a
                href={url}
                download={node.outputFileName || 'file'}
                target="_blank"
                rel="noreferrer"
                className={darkNodes ? 'text-indigo-300 underline' : 'text-indigo-700 underline'}
              >
                Open {node.outputFileName || 'file'}
              </a>
            ) : (
              <span>Output: {node.outputFileName || 'file'}</span>
            )}
            {outputSize ? ` · ${formatFileSize(outputSize)}` : ''}
          </div>
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
          <button
            type="button"
            onClick={() => onUpdate({ previewCollapsed: !collapsed })}
            className={`text-left text-xs font-medium ${darkNodes ? 'text-indigo-200' : 'text-indigo-700'}`}
          >
            {collapsed ? 'Show preview' : 'Hide preview'}
          </button>
          {!collapsed && (
            <FilePreviewPanel
              url={url}
              mime={node.outputMime}
              name={node.outputFileName}
              textPreview={textPreview}
              darkNodes={darkNodes}
            />
          )}
        </div>
      )}
    </div>
  );
}
