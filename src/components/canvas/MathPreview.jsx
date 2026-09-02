import React, { useLayoutEffect, useMemo, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

function latexForKatex(latex) {
  return String(latex ?? '')
    .replace(/π/g, '\\pi ')
    .replace(/∞/g, '\\infty ')
    .replace(/√/g, '\\sqrt');
}

/**
 * Grey CAS preview: KaTeX when latex is available, otherwise plain flat text.
 * Reports intrinsic content size so the parent Math node can grow (up to max width).
 */
export default function MathPreview({ latex, flat, error, empty, onMetrics }) {
  const contentRef = useRef(null);

  const html = useMemo(() => {
    if (error || empty || !latex) return null;
    try {
      const rendered = katex.renderToString(latexForKatex(latex), {
        throwOnError: false,
        displayMode: true,
        strict: 'ignore',
        trust: false,
      });
      if (rendered.includes('katex-error')) return null;
      return rendered;
    } catch {
      return null;
    }
  }, [latex, error, empty]);

  useLayoutEffect(() => {
    const report = () => {
      const el = contentRef.current;
      if (!el || !onMetrics) {
        onMetrics?.({ width: 0, height: 0 });
        return;
      }
      onMetrics({
        width: Math.ceil(el.scrollWidth),
        height: Math.ceil(el.scrollHeight),
      });
    };

    report();
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [html, flat, error, empty, onMetrics]);

  if (error) {
    return (
      <div
        ref={contentRef}
        className="mt-2 min-h-[2.25rem] break-words text-center text-sm font-medium text-rose-400"
      >
        {error}
      </div>
    );
  }

  if (empty || (!html && !flat)) {
    return (
      <div ref={contentRef} className="mt-2 min-h-[2.25rem]" aria-hidden="true">
        {'\u00a0'}
      </div>
    );
  }

  if (html) {
    return (
      <div className="math-preview-scroll mt-2">
        <div className="flex w-max min-w-full justify-center px-1">
          <div
            ref={contentRef}
            className="math-preview inline-block text-gray-500"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="math-preview-scroll mt-2">
      <div className="flex w-max min-w-full justify-center px-1">
        <div
          ref={contentRef}
          className="math-preview inline-block break-all text-center text-2xl font-semibold tabular-nums tracking-tight text-gray-500"
        >
          {flat}
        </div>
      </div>
    </div>
  );
}
