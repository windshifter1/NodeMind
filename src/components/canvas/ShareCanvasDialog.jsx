import React, { useEffect, useRef, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import {
  SHARE_FORMATS,
  downloadBlob,
  exportWorkspaceImage,
  isIosLike,
  shareOrDownloadBlob,
} from '@/lib/shareCanvas';

function statusFor(result) {
  if (result === 'shared') return 'Opened share sheet';
  if (result === 'aborted') return null;
  if (result === 'opened') return 'Opened the image — use Share to save it';
  return 'Downloaded';
}

export default function ShareCanvasDialog({
  open,
  onClose,
  workspaceName,
  nodes,
  backgroundArt,
  pan,
  zoom,
  setPan,
  setZoom,
  darkNodes = true,
}) {
  const [format, setFormat] = useState('png');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const readyRef = useRef(null);
  const argsRef = useRef({});
  argsRef.current = { nodes, backgroundArt, pan, zoom, setPan, setZoom, workspaceName, darkNodes };

  const capture = async (fmt) => {
    if (readyRef.current?.format === fmt && readyRef.current.blob) {
      return readyRef.current;
    }
    const dialogRoot = document.querySelector('[data-share-canvas-dialog]');
    const prevVis = dialogRoot?.style.visibility;
    if (dialogRoot) dialogRoot.style.visibility = 'hidden';
    try {
      const a = argsRef.current;
      const result = await exportWorkspaceImage({
        boardEl: document.querySelector('[data-canvas-board]'),
        nodes: a.nodes,
        backgroundArt: a.backgroundArt,
        pan: a.pan,
        zoom: a.zoom,
        setPan: a.setPan,
        setZoom: a.setZoom,
        name: a.workspaceName,
        format: fmt,
        dark: a.darkNodes,
      });
      readyRef.current = { format: fmt, ...result };
      return readyRef.current;
    } finally {
      if (dialogRoot) dialogRoot.style.visibility = prevVis || '';
    }
  };

  useEffect(() => {
    if (!open) {
      readyRef.current = null;
      setBusy(false);
      setError(null);
      setStatus(null);
      return undefined;
    }
    let cancelled = false;
    setBusy(true);
    setError(null);
    setStatus('Preparing…');
    (async () => {
      try {
        await capture(format);
        if (!cancelled) setStatus('Ready');
      } catch (e) {
        if (!cancelled) {
          readyRef.current = null;
          setError(e?.message || 'Share failed');
          setStatus(null);
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, format]);

  const run = async (mode) => {
    setError(null);
    const ready = readyRef.current?.format === format ? readyRef.current : null;
    if (!ready) {
      setBusy(true);
      setStatus(null);
      try {
        await capture(format);
        setStatus('Ready — tap again to save');
      } catch (e) {
        const dialogRoot = document.querySelector('[data-share-canvas-dialog]');
        if (dialogRoot) dialogRoot.style.visibility = '';
        readyRef.current = null;
        setError(e?.message || 'Share failed');
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    try {
      const { blob, fileName, mime } = ready;
      const result =
        mode === 'share'
          ? await shareOrDownloadBlob(blob, fileName, mime)
          : await downloadBlob(blob, fileName, mime);
      setStatus(statusFor(result));
    } catch (e) {
      setError(e?.message || 'Share failed');
    } finally {
      setBusy(false);
    }
  };

  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const ios = typeof navigator !== 'undefined' && isIosLike();

  if (!open) return null;

  return (
    <div
      data-share-canvas-dialog
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
            Capture this workspace as it looks on the canvas — including note text, math, drawings, and
            loaded images — then download or open your device share sheet.
          </p>
          {ios && (
            <p className="text-xs text-nm-text-muted">
              On iPhone, tap Share or Download, then choose Save Image.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SHARE_FORMATS.map((fmt) => {
              const on = format === fmt.id;
              return (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => {
                    setFormat(fmt.id);
                    if (readyRef.current?.format !== fmt.id) readyRef.current = null;
                  }}
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
              {busy ? (readyRef.current ? 'Saving…' : 'Capturing…') : 'Download'}
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
              {busy ? (readyRef.current ? 'Sharing…' : 'Capturing…') : 'Share'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
