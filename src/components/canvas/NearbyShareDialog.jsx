import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, MonitorSmartphone, Radio, X } from 'lucide-react';
import {
  formatSessionCode,
  normalizeSessionCode,
  SESSION_CODE_LENGTH,
} from '@/lib/nearbyShare';

function PeerOrb({ peer, disabled, onSend }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSend(peer)}
      className="flex w-24 flex-col items-center gap-2 rounded-2xl p-2 text-center transition hover:bg-nm-hover disabled:opacity-50"
    >
      <span
        className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold text-white shadow-lg"
        style={{ backgroundColor: peer.color || '#6366f1' }}
      >
        {(peer.name || '?').slice(0, 1).toUpperCase()}
      </span>
      <span className="w-full truncate text-xs font-medium text-nm-text">{peer.name}</span>
      <span className="w-full truncate text-[10px] text-nm-text-muted">{peer.workspaceName}</span>
    </button>
  );
}

export default function NearbyShareDialog({
  open,
  onClose,
  workspaceName,
  nearby,
  onSend,
}) {
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState(null);
  const [busyCode, setBusyCode] = useState(false);
  const [outsideOpen, setOutsideOpen] = useState(false);

  useEffect(() => {
    if (open) return undefined;
    setCodeInput('');
    setCodeError(null);
    setOutsideOpen(false);
    return undefined;
  }, [open]);

  if (!open) return null;

  const sending = nearby.outgoing.phase === 'waiting' || nearby.outgoing.phase === 'sending';
  const onCode = nearby.mode === 'code';
  const showOutside = onCode || outsideOpen;
  const codeReady = normalizeSessionCode(codeInput).length >= SESSION_CODE_LENGTH;

  const statusLine =
    nearby.status === 'connecting'
      ? onCode
        ? 'Opening a code session…'
        : 'Looking for NodeMind sessions on this network…'
      : nearby.status === 'error'
        ? nearby.statusError
        : onCode
          ? nearby.peers.length
            ? 'Tap a device to send this workspace.'
            : 'Waiting for the other device to join this code…'
          : nearby.peers.length
            ? 'Tap a device to send this workspace.'
            : 'No other NodeMind session on this network yet.';

  const joinCode = async () => {
    setBusyCode(true);
    setCodeError(null);
    try {
      await nearby.joinWithCode(codeInput);
      setCodeInput('');
    } catch (error) {
      setCodeError(error?.message || 'Could not join that session.');
    } finally {
      setBusyCode(false);
    }
  };

  const createCode = async () => {
    setBusyCode(true);
    setCodeError(null);
    try {
      await nearby.hostWithCode();
    } catch (error) {
      setCodeError(error?.message || 'Could not create a session code.');
    } finally {
      setBusyCode(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center"
      style={{
        paddingTop: 'calc(1rem + var(--safe-top))',
        paddingRight: 'calc(1rem + var(--safe-right))',
        paddingBottom: 'calc(1rem + var(--safe-bottom))',
        paddingLeft: 'calc(1rem + var(--safe-left))',
      }}
    >
      <div className="absolute inset-0 bg-nm-overlay backdrop-blur-md" onClick={onClose} />
      <div
        className="relative flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-nm-border bg-nm-panel shadow-2xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-nm-border bg-nm-header px-3 py-3 sm:px-4">
          <MonitorSmartphone size={16} className="text-nm-text-muted" />
          <h2 className="text-sm font-semibold text-nm-text">Send to device</h2>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-nm-text-faint transition hover:bg-nm-hover hover:text-nm-text"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-auto p-4">
          <p className="text-xs text-nm-text-muted">
            Send <span className="font-medium text-nm-text">{workspaceName || 'this workspace'}</span> to
            another open NodeMind session. The other device must accept.
          </p>

          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-nm-text-muted">
            {onCode ? 'On this code' : 'On this network'}
          </h3>
          <p className="mt-1 text-xs text-nm-text-secondary">{statusLine}</p>

          <div className="mt-3 min-h-[7.5rem] rounded-2xl border border-nm-border bg-nm-option p-3">
            {nearby.status === 'connecting' ? (
              <div className="flex h-24 items-center justify-center gap-2 text-sm text-nm-text-muted">
                <Loader2 size={16} className="animate-spin" />
                Connecting…
              </div>
            ) : nearby.peers.length ? (
              <div className="flex flex-wrap justify-center gap-2">
                {nearby.peers.map((peer) => (
                  <PeerOrb key={peer.id} peer={peer} disabled={sending} onSend={onSend} />
                ))}
              </div>
            ) : (
              <div className="flex h-24 flex-col items-center justify-center gap-1 text-center">
                <Radio size={18} className="text-nm-text-faint" />
                <p className="text-xs text-nm-text-muted">
                  {onCode ? 'Waiting for the other device…' : 'Waiting for another session…'}
                </p>
              </div>
            )}
          </div>

          {nearby.outgoing.phase !== 'idle' && (
            <div className="mt-3 rounded-xl border border-nm-border px-3 py-2 text-xs">
              {nearby.outgoing.phase === 'waiting' && (
                <p className="text-nm-text">Waiting for {nearby.outgoing.peerName} to accept…</p>
              )}
              {nearby.outgoing.phase === 'sending' && (
                <p className="text-nm-text">
                  Sending… {Math.round((nearby.outgoing.progress || 0) * 100)}%
                </p>
              )}
              {nearby.outgoing.phase === 'sent' && (
                <p className="text-emerald-400">Sent to {nearby.outgoing.peerName}.</p>
              )}
              {(nearby.outgoing.phase === 'declined' ||
                nearby.outgoing.phase === 'unavailable' ||
                nearby.outgoing.phase === 'error') && (
                <p className="text-rose-300">{nearby.outgoing.error}</p>
              )}
            </div>
          )}

          {showOutside ? (
            <div className="mt-4 rounded-2xl border border-nm-border bg-nm-option p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-nm-text-muted">
                Send outside this network
              </h3>
              <p className="mt-1 text-xs text-nm-text-muted">
                Share a 6-character code with a NodeMind session on another network. The workspace
                goes directly between the two browsers.
              </p>

              {onCode && nearby.sessionCode ? (
                <p className="mt-3 text-center font-mono text-2xl tracking-[0.28em] text-nm-text">
                  {formatSessionCode(nearby.sessionCode)}
                </p>
              ) : (
                <button
                  type="button"
                  disabled={busyCode || nearby.status === 'connecting'}
                  onClick={createCode}
                  className="mt-3 w-full rounded-xl border border-nm-border bg-nm-panel px-3 py-2 text-sm text-nm-text transition hover:bg-nm-hover disabled:opacity-50"
                >
                  Get a code
                </button>
              )}

              <div className="mt-3 flex gap-2">
                <input
                  value={formatSessionCode(codeInput)}
                  onChange={(e) => setCodeInput(normalizeSessionCode(e.target.value))}
                  placeholder="Enter code"
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="text"
                  maxLength={7}
                  className="min-w-0 flex-1 rounded-xl border border-nm-border bg-nm-panel px-3 py-2 font-mono text-sm uppercase tracking-widest text-nm-text outline-none"
                />
                <button
                  type="button"
                  disabled={busyCode || !codeReady}
                  onClick={joinCode}
                  className="rounded-xl bg-indigo-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Join
                </button>
              </div>
              {codeError && <p className="mt-2 text-xs text-rose-300">{codeError}</p>}

              <button
                type="button"
                disabled={busyCode}
                onClick={() => {
                  if (onCode) nearby.returnToLan();
                  else setOutsideOpen(false);
                }}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm text-nm-text-secondary transition hover:bg-nm-hover hover:text-nm-text disabled:opacity-50"
              >
                <ArrowLeft size={14} />
                {onCode ? 'Back to this network' : 'Cancel'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOutsideOpen(true)}
              className="mt-4 w-full rounded-xl border border-nm-border px-3 py-2 text-sm text-nm-text-secondary transition hover:bg-nm-hover hover:text-nm-text"
            >
              Send outside this network
            </button>
          )}

          <p className="mt-4 text-[11px] leading-relaxed text-nm-text-faint">
            This device is {nearby.deviceName}. You can rename it in Settings → Data.
          </p>
        </div>
      </div>
    </div>
  );
}
