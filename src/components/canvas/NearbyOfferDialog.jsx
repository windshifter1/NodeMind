import React from 'react';
import { MonitorSmartphone } from 'lucide-react';

export default function NearbyOfferDialog({ offer, progress = 0 }) {
  if (!offer) return null;

  const receiving = offer.receiving;

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center"
      style={{
        paddingTop: 'calc(1rem + var(--safe-top))',
        paddingRight: 'calc(1rem + var(--safe-right))',
        paddingBottom: 'calc(1rem + var(--safe-bottom))',
        paddingLeft: 'calc(1rem + var(--safe-left))',
      }}
    >
      <div className="absolute inset-0 bg-nm-overlay backdrop-blur-md" />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-nm-border bg-nm-panel p-5 shadow-2xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2 text-nm-text-muted">
          <MonitorSmartphone size={16} />
          <span className="text-xs font-medium uppercase tracking-wide">Nearby device</span>
        </div>
        {!receiving ? (
          <>
            <h2 className="text-base font-semibold text-nm-text">
              {offer.fromName} wants to send a workspace
            </h2>
            <p className="mt-1 text-sm text-nm-text-muted">
              Accept to add <span className="font-medium text-nm-text">{offer.workspaceName}</span> as
              a new workspace. Your current boards stay as they are.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={offer.decline}
                className="flex-1 rounded-xl border border-nm-border px-3 py-2.5 text-sm font-medium text-nm-text-secondary transition hover:bg-nm-hover"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={offer.accept}
                className="flex-1 rounded-xl bg-indigo-500 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400"
              >
                Accept
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold text-nm-text">Receiving workspace…</h2>
            <p className="mt-2 text-sm text-nm-text-muted">{Math.round(progress * 100)}%</p>
          </>
        )}
      </div>
    </div>
  );
}
