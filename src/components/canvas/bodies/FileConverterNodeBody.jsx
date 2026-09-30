import React, { useMemo, useState } from 'react';
import { getBlobRecord, putBlob } from '@/lib/mediaStore';
import { runConversion } from '@/lib/media/conversions';

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
  const hasInput = Boolean(dataResult?.value?.fileId || dataResult?.value?.source?.fileId);
  const source = dataResult?.value?.source || (dataResult?.kind === 'fileRef' ? dataResult.value : null);
  const isIgnored = Boolean(dataResult?.ignored);
  const error = dataResult?.error;
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState(null);

  const selectValue = isIgnored && node.conversionId ? '__ignored__' : node.conversionId || '';

  const run = async () => {
    if (!source?.fileId || !node.conversionId || isIgnored) return;
    setBusy(true);
    setLocalErr(null);
    try {
      const record = await getBlobRecord(source.fileId);
      if (!record?.blob) throw new Error('Source file missing from storage');
      const out = await runConversion(node.conversionId, source, record.blob);
      if (out.blob) {
        const meta = await putBlob(out.blob, { name: out.name, mime: out.mime });
        onUpdate({
          outputFileId: meta.fileId,
          outputFileName: meta.name,
          outputMime: meta.mime,
        });
      } else if (out.text != null) {
        const blob = new Blob([out.text], { type: out.mime || 'text/plain' });
        const meta = await putBlob(blob, { name: out.name, mime: out.mime });
        onUpdate({
          outputFileId: meta.fileId,
          outputFileName: meta.name,
          outputMime: meta.mime,
        });
      }
    } catch (e) {
      setLocalErr(e?.message || 'Conversion failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 px-3 pb-3 pt-1" onPointerDown={(e) => e.stopPropagation()}>
      <select
        value={selectValue}
        disabled={!hasInput}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '__ignored__') return;
          onUpdate({ conversionId: v, outputFileId: '', outputFileName: '', outputMime: '' });
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
      {localErr && (
        <p className={`text-xs ${darkNodes ? 'text-amber-200' : 'text-amber-800'}`}>{localErr}</p>
      )}
      {node.outputFileName && (
        <p className={`text-xs ${darkNodes ? 'text-zinc-400' : 'text-slate-500'}`}>
          Output: {node.outputFileName}
        </p>
      )}
    </div>
  );
}
