import React, { useMemo } from 'react';
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
 */
export default function MathPreview({ latex, flat, error, empty }) {
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

  if (error) {
    return (
      <div className="mt-2 min-h-[2.25rem] break-words text-center text-sm font-medium text-rose-400">
        {error}
      </div>
    );
  }

  if (empty || (!html && !flat)) {
    return (
      <div className="mt-2 min-h-[2.25rem]" aria-hidden="true">
        {'\u00a0'}
      </div>
    );
  }

  if (html) {
    return (
      <div
        className="math-preview mt-2 flex min-h-[2.5rem] items-center justify-center overflow-x-auto px-1 text-gray-500"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <div className="math-preview mt-2 min-h-[2.25rem] break-all text-center text-2xl font-semibold tabular-nums tracking-tight text-gray-500">
      {flat}
    </div>
  );
}
