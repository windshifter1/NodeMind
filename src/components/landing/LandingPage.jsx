import React, { useEffect } from 'react';
import { ArrowRight, CloudOff, Layers, Shield } from 'lucide-react';

function BrandMark({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="NodeMind"
    >
      <defs>
        <linearGradient id="nm-landing-bg" x1="96" y1="48" x2="416" y2="464" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#141826" />
          <stop offset="100%" stopColor="#080a12" />
        </linearGradient>
        <linearGradient id="nm-landing-node" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c7d2fe" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#nm-landing-bg)" />
      <path
        d="M256 152V272M256 272L168 368M256 272L344 368"
        stroke="#a5b4fc"
        strokeWidth="36"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="168" cy="368" r="56" fill="url(#nm-landing-node)" />
      <circle cx="344" cy="368" r="56" fill="url(#nm-landing-node)" />
      <circle cx="256" cy="152" r="64" fill="#e0e7ff" />
      <circle cx="256" cy="152" r="24" fill="#1e1b4b" fillOpacity="0.45" />
    </svg>
  );
}

const HIGHLIGHTS = [
  { icon: Layers, label: 'Infinite canvas' },
  { icon: CloudOff, label: 'Works offline' },
  { icon: Shield, label: 'Stays on this device' },
];

export default function LandingPage({ onEnter }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onEnter();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onEnter]);

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-nm-page"
      style={{
        paddingTop: 'calc(1.5rem + var(--safe-top))',
        paddingRight: 'calc(1.5rem + var(--safe-right))',
        paddingBottom: 'calc(1.5rem + var(--safe-bottom))',
        paddingLeft: 'calc(1.5rem + var(--safe-left))',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 70% 50% at 50% 18%, rgba(99, 102, 241, 0.22), transparent 60%),
            radial-gradient(ellipse 50% 40% at 85% 70%, rgba(165, 180, 252, 0.12), transparent 55%),
            radial-gradient(ellipse 45% 35% at 12% 78%, rgba(99, 102, 241, 0.1), transparent 50%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        aria-hidden
        style={{
          backgroundImage:
            'radial-gradient(circle at center, var(--nm-canvas-dot) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse 65% 55% at 50% 45%, black 20%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 65% 55% at 50% 45%, black 20%, transparent 75%)',
        }}
      />

      <main className="relative z-[1] flex w-full max-w-md flex-col items-center text-center">
        <div className="mb-7 rounded-[1.75rem] p-[1px] shadow-[0_24px_60px_-20px_rgba(99,102,241,0.55)]">
          <BrandMark className="h-20 w-20 sm:h-24 sm:w-24" />
        </div>

        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-300/90">
          Local-first mind maps
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-nm-text sm:text-5xl">
          NodeMind
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-nm-text-muted sm:text-[15px]">
          Organise ideas as connected notes on an infinite canvas — private, offline-ready, and
          ready when you are.
        </p>

        <ul className="mt-7 flex flex-wrap items-center justify-center gap-2">
          {HIGHLIGHTS.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-nm-border bg-nm-chrome px-3 py-1.5 text-[11px] font-medium text-nm-text-secondary backdrop-blur"
            >
              <Icon size={13} className="text-indigo-300" aria-hidden />
              {label}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onEnter}
          className="mt-9 inline-flex items-center gap-2 rounded-2xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_-10px_rgba(99,102,241,0.75)] transition hover:bg-indigo-400 active:scale-[0.98]"
        >
          Enter canvas
          <ArrowRight size={16} aria-hidden />
        </button>

        <p className="mt-8 text-xs text-nm-text-subtle">
          by <span className="text-nm-text-muted">Windshifter</span>
        </p>
      </main>
    </div>
  );
}
