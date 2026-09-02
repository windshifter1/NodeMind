import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function MathsCreditDialog({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[240] flex items-center justify-center"
      style={{
        paddingTop: 'calc(1rem + var(--safe-top))',
        paddingRight: 'calc(1rem + var(--safe-right))',
        paddingBottom: 'calc(1rem + var(--safe-bottom))',
        paddingLeft: 'calc(1rem + var(--safe-left))',
      }}
      role="presentation"
    >
      <div className="absolute inset-0 bg-nm-overlay backdrop-blur-md" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nm-maths-credit-title"
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-nm-border bg-nm-panel p-5 shadow-2xl sm:p-6"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start gap-2">
          <h2 id="nm-maths-credit-title" className="min-w-0 flex-1 text-base font-semibold text-nm-text">
            A note about the maths nodes.
          </h2>
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="rounded-lg p-1.5 text-nm-text-faint transition hover:bg-nm-hover hover:text-nm-text active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm leading-relaxed text-nm-text-secondary">
          These maths nodes are powered by an algebra system developed by the owner of{' '}
          <a
            href="https://mathsfromnothing.au/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-indigo-300 underline decoration-indigo-400/50 underline-offset-2 transition hover:text-indigo-200"
          >
            Maths From Nothing
          </a>
          . The underlying calculation engine is entirely based on his work, so please check out his site
          above, or try out his complete computer algebra system{' '}
          <a
            href="https://mathsfromnothing.au/wp-content/uploads/algebraprogramnew/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-indigo-300 underline decoration-indigo-400/50 underline-offset-2 transition hover:text-indigo-200"
          >
            here
          </a>
          .
        </p>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 active:scale-95"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
