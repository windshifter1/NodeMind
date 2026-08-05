import React, { useEffect, useState } from 'react';

/**
 * Compact tutorial card that sits inside the terminal chrome.
 * Same visual language as OnboardingTour (indigo chips, panel card).
 */
export default function TerminalTutorial({
  open,
  step,
  index,
  total,
  platform,
  onContinue,
  onSkip,
  inputRef,
  outputRef,
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return undefined;
    }
    const t = window.setTimeout(() => setVisible(true), 40);
    return () => window.clearTimeout(t);
  }, [open, step?.id]);

  useEffect(() => {
    if (!open || !step) return undefined;
    const target =
      step.highlight === 'input'
        ? inputRef?.current
        : step.highlight === 'output'
          ? outputRef?.current
          : null;
    if (!target) return undefined;
    target.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    return undefined;
  }, [open, step, inputRef, outputRef]);

  if (!open || !step) return null;

  const isCommand = step.expect?.kind === 'command';
  const isLast = index >= total - 1;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-3"
      style={{
        paddingBottom: 'calc(0.75rem + var(--safe-bottom, 0px))',
        opacity: visible ? 1 : 0,
        transition: 'opacity 180ms ease',
      }}
    >
      <div
        className="pointer-events-auto w-full max-w-md rounded-2xl border border-nm-border bg-nm-panel p-4 shadow-2xl"
        style={{
          boxShadow:
            step.highlight === 'input' || step.highlight === 'output'
              ? '0 0 0 2px rgba(165,180,252,0.85), 0 0 28px 4px rgba(99,102,241,0.45), 0 16px 40px rgba(0,0,0,0.35)'
              : undefined,
          transform: visible ? 'translateY(0)' : 'translateY(8px)',
          transition: 'transform 200ms ease, opacity 180ms ease',
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-300">
            {platform === 'desktop' ? 'Desktop' : 'Mobile'} terminal
          </span>
          <span className="text-[11px] tabular-nums text-nm-text-muted">
            {index + 1} / {total}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-medium text-nm-text-muted transition hover:text-nm-text"
          >
            Skip
          </button>
        </div>

        <h3 className="text-sm font-semibold text-nm-text">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-nm-text-secondary">{step.body}</p>

        {isCommand && step.hint && (
          <div className="mt-3 rounded-xl border border-indigo-400/40 bg-indigo-500/10 px-3 py-2 font-mono text-[13px] text-indigo-200">
            <span className="mr-2 text-[10px] font-sans font-semibold uppercase tracking-wide text-indigo-300/80">
              Type
            </span>
            {step.hint}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          {isCommand ? (
            <p className="text-xs text-nm-text-muted">Run the highlighted command to continue.</p>
          ) : (
            <>
              <div className="flex-1" />
              <button
                type="button"
                onClick={onContinue}
                className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 active:scale-[0.98]"
              >
                {isLast ? 'Done' : 'Continue'}
              </button>
            </>
          )}
        </div>

        <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === index ? 16 : 6,
                backgroundColor: i === index ? '#818cf8' : 'var(--nm-border-strong)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
