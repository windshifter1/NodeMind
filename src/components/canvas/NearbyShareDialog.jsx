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

  useEffect(() => {
    if (open) return undefined;
    setCodeInput('');
    setCodeError(null);
    return undefined;
  }, [open]);

  if (!open) return null;

  const sending = nearby.outgoing.phase === 'waiting' || nearby.outgoing.phase === 'sending';
  const hosting = nearby.mode === 'code' && nearby.codeRole !== 'join';
  const joining = nearby.mode === 'code' && nearby.codeRole === 'join';
  const codeReady = normalizeSessionCode(codeInput).length >= SESSION_CODE_LENGTH;

  const statusLine =
    nearby.status === 'connecting'
      ? hosting
        ? 'Opening a code session…'
        : joining
          ? 'Joining with that code…'
          : 'Looking for NodeMind sessions on this network…'
      : nearby.status === 'error'
        ? nearby.statusError
        : nearby.peers.length
          ? 'Tap a device to send this workspace.'
          : hosting
            ? 'Waiting for the other device to enter this joining code…'
            : joining
              ? 'Waiting for the other device…'
              : 'No other NodeMind session on this network yet.';

  const joinCode = async (event) => {
    event?.preventDefault?.();
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
      setCodeError(error?.message || 'Could not create a joining code.');
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
            {hosting || joining ? 'Connected devices' : 'On this network'}
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
                  {hosting
                    ? 'The other device has not joined yet…'
                    : joining
                      ? 'Waiting for the other device…'
                      : 'Waiting for another session…'}
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

          {hosting ? (
            <div className="mt-4 rounded-2xl border border-nm-border bg-nm-option p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-nm-text-muted">
                Send outside this network
              </h3>
              <p className="mt-1 text-xs text-nm-text-muted">
                On the other device, open Send to device and type this joining code. Do not create a
                second code.
              </p>
              <p className="mt-3 text-center font-mono text-2xl tracking-[0.28em] text-nm-text">
                {formatSessionCode(nearby.sessionCode)}
              </p>
              <button
                type="button"
                disabled={busyCode}
                onClick={() => nearby.returnToLan()}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm text-nm-text-secondary transition hover:bg-nm-hover hover:text-nm-text disabled:opacity-50"
              >
                <ArrowLeft size={14} />
                Back to this network
              </button>
            </div>
          ) : joining ? (
            <div className="mt-4 rounded-2xl border border-nm-border bg-nm-option p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-nm-text-muted">
                Joining code
              </h3>
              <p className="mt-1 text-xs text-nm-text-muted">
                Joined {formatSessionCode(nearby.sessionCode)}. The other device should appear above.
              </p>
              <button
                type="button"
                disabled={busyCode}
                onClick={() => nearby.returnToLan()}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm text-nm-text-secondary transition hover:bg-nm-hover hover:text-nm-text disabled:opacity-50"
              >
                <ArrowLeft size={14} />
                Back to this network
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                disabled={busyCode || nearby.status === 'connecting'}
                onClick={createCode}
                className="mt-4 w-full rounded-xl border border-nm-border px-3 py-2 text-sm text-nm-text-secondary transition hover:bg-nm-hover hover:text-nm-text disabled:opacity-50"
              >
                Send outside this network
              </button>

              <form
                className="mt-4 rounded-2xl border border-indigo-500/30 bg-nm-option p-3"
                onSubmit={joinCode}
              >
                <label htmlFor="nearby-joining-code" className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-nm-text">
                    Joining code
                  </span>
                  <span className="mt-1 block text-xs text-nm-text-muted">
                    If the other device showed you a code, enter it here.
                  </span>
                </label>
                <div className="mt-3 flex gap-2">
                  <input
                    id="nearby-joining-code"
                    value={formatSessionCode(codeInput)}
                    onChange={(e) => setCodeInput(normalizeSessionCode(e.target.value))}
                    placeholder="XXX XXX"
                    autoComplete="off"
                    spellCheck={false}
                    inputMode="text"
                    maxLength={7}
                    aria-label="Joining code"
                    className="min-w-0 flex-1 rounded-xl border border-nm-border bg-nm-panel px-3 py-2 font-mono text-sm uppercase tracking-widest text-nm-text outline-none focus:border-indigo-400"
                  />
                  <button
                    type="submit"
                    disabled={busyCode || !codeReady}
                    className="rounded-xl bg-indigo-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Join
                  </button>
                </div>
                {codeError && <p className="mt-2 text-xs text-rose-300">{codeError}</p>}
              </form>
            </>
          )}

          <p className="mt-4 text-[11px] leading-relaxed text-nm-text-faint">
            This device is {nearby.deviceName}. You can rename it in Settings → Data.
          </p>
        </div>
      </div>
    </div>
  );
}
