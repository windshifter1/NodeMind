import React, { useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import {
  SHARE_FORMATS,
  downloadBlob,
  exportWorkspaceImage,
  shareOrDownloadBlob,
} from '@/lib/shareCanvas';

export default function ShareCanvasDialog({
  open,
  onClose,
  workspaceName,
  nodes,
  edges,
  orientation,
  darkNodes = true,
}) {
  const [format, setFormat] = useState('png');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);

  if (!open) return null;

  const run = async (mode) => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const { blob, fileName, mime } = await exportWorkspaceImage({
        nodes,
        edges,
        orientation,
        name: workspaceName,
        format,
        dark: darkNodes,
      });
      if (mode === 'share') {
        const result = await shareOrDownloadBlob(blob, fileName, mime);
        setStatus(result === 'shared' ? 'Opened share sheet' : result === 'aborted' ? null : 'Downloaded');
      } else {
        downloadBlob(blob, fileName);
        setStatus('Downloaded');
      }
    } catch (e) {
      setError(e?.message || 'Share failed');
    } finally {
      setBusy(false);
    }
  };

  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        paddingTop: 'calc(1rem + var(--safe-top))',
        paddingRight: 'calc(1rem + var(--safe-right))',
        paddingBottom: 'calc(1rem + var(--safe-bottom))',
        paddingLeft: 'calc(1rem + var(--safe-left))',
      }}
    >
      <div className="absolute inset-0 bg-nm-overlay backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-nm-border bg-nm-panel shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 border-b border-nm-border bg-nm-header px-4 py-3">
          <Share2 size={16} className="text-nm-text-muted" />
          <p className="min-w-0 flex-1 text-sm font-medium text-nm-text">Share canvas</p>
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="rounded-lg p-1.5 text-nm-text-faint transition hover:bg-nm-hover hover:text-nm-text active:scale-95"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-4 p-4">
          <p className="text-sm text-nm-text-secondary">
            Export a picture of this workspace, then download it or open your device share sheet.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SHARE_FORMATS.map((fmt) => {
              const on = format === fmt.id;
              return (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setFormat(fmt.id)}
                  className={`rounded-xl px-3 py-2.5 text-sm font-medium transition active:scale-[0.98] ${
                    on
                      ? 'bg-indigo-500/35 text-indigo-100 shadow-[0_0_0_1px_rgba(165,180,252,0.45)]'
                      : 'bg-nm-hover text-nm-text-secondary hover:text-nm-text'
                  }`}
                >
                  {fmt.label}
                </button>
              );
            })}
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          {status && !error && <p className="text-xs text-nm-text-muted">{status}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => run('download')}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-nm-hover px-3 py-2.5 text-sm font-medium text-nm-text transition hover:bg-nm-hover-strong active:scale-95 disabled:opacity-50"
            >
              <Download size={15} />
              {busy ? 'Working…' : 'Download'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run('share')}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-500/35 px-3 py-2.5 text-sm font-medium text-indigo-100 transition hover:bg-indigo-500/50 active:scale-95 disabled:opacity-50"
              title={
                canNativeShare
                  ? 'Open the system share sheet when supported'
                  : 'Downloads if system share is unavailable'
              }
            >
              <Share2 size={15} />
              {busy ? 'Working…' : 'Share'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
