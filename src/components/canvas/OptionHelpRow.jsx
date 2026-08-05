import React, { useEffect, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';

export default function OptionHelpRow({
  icon: Icon,
  label,
  selected,
  onToggle,
  helpText,
  ariaLabel,
  compactLabel = false,
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpHover, setHelpHover] = useState(false);
  const [tooltipHover, setTooltipHover] = useState(false);
  const helpRef = useRef(null);
  const tooltipRef = useRef(null);
  const hoverLeaveTimer = useRef(0);
  const [tooltipPos, setTooltipPos] = useState(null);

  const showHelp = helpOpen || helpHover || tooltipHover;

  const dismissHelp = () => {
    if (hoverLeaveTimer.current) {
      window.clearTimeout(hoverLeaveTimer.current);
      hoverLeaveTimer.current = 0;
    }
    setHelpOpen(false);
    setHelpHover(false);
    setTooltipHover(false);
  };

  useEffect(() => {
    if (!showHelp || !helpRef.current) {
      setTooltipPos(null);
      return undefined;
    }

    const update = () => {
      const rect = helpRef.current.getBoundingClientRect();
      setTooltipPos({
        top: rect.top - 8,
        left: rect.right,
      });
    };

    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [showHelp]);

  useEffect(() => {
    if (!showHelp) return undefined;

    const dismiss = (e) => {
      if (helpRef.current?.contains(e.target)) return;
      if (tooltipRef.current?.contains(e.target)) return;
      dismissHelp();
    };

    document.addEventListener('pointerdown', dismiss, true);
    return () => document.removeEventListener('pointerdown', dismiss, true);
  }, [showHelp]);

  return (
    <>
      <div
        className="flex items-center gap-2 rounded-xl border px-3 py-3 transition hover:bg-nm-hover"
        style={{
          backgroundColor: selected ? 'rgba(99,102,241,0.18)' : 'var(--nm-option)',
          borderColor: selected ? '#818cf8' : 'var(--nm-border)',
          color: selected ? 'var(--nm-text)' : 'var(--nm-option-text)',
        }}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={selected}
          aria-label={ariaLabel || label}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <Icon size={18} className="shrink-0" />
          <span className={`font-medium whitespace-nowrap ${compactLabel ? 'text-xs' : 'text-sm'}`}>{label}</span>
        </button>

        <button
          ref={helpRef}
          type="button"
          aria-label={`${label} help`}
          aria-expanded={showHelp}
          onClick={() => setHelpOpen((value) => !value)}
          onMouseEnter={() => {
            if (hoverLeaveTimer.current) {
              window.clearTimeout(hoverLeaveTimer.current);
              hoverLeaveTimer.current = 0;
            }
            setHelpHover(true);
          }}
          onMouseLeave={() => {
            hoverLeaveTimer.current = window.setTimeout(() => {
              setHelpHover(false);
              hoverLeaveTimer.current = 0;
            }, 120);
          }}
          className="shrink-0 rounded-lg p-1.5 text-nm-text-faint transition hover:bg-nm-hover/80 hover:text-nm-text active:scale-95"
        >
          <HelpCircle size={16} />
        </button>
      </div>

      {showHelp && tooltipPos && (
        <div
          ref={tooltipRef}
          role="tooltip"
          onMouseEnter={() => {
            if (hoverLeaveTimer.current) {
              window.clearTimeout(hoverLeaveTimer.current);
              hoverLeaveTimer.current = 0;
            }
            setTooltipHover(true);
          }}
          onMouseLeave={() => setTooltipHover(false)}
          className="fixed z-[200] w-56 max-w-[min(16rem,calc(100vw-2rem))] -translate-x-full -translate-y-full rounded-md border border-nm-border bg-nm-tooltip px-2.5 py-2 text-left text-xs leading-relaxed text-nm-tooltip-text shadow-lg"
          style={{ top: tooltipPos.top, left: tooltipPos.left }}
        >
          {helpText}
        </div>
      )}
    </>
  );
}
