import React, { useState, useMemo } from 'react';
import { Copy, X, ListTree, AlignLeft } from 'lucide-react';

export default function TextExportDialog({ open, onClose, workspaceName, nodes, edges }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const text = useMemo(() => {
    if (!open) return '';
    const titleOf = (id) => {
      const n = nodes.find((n) => n.id === id);
      return n && n.title && n.title.trim() ? n.title.trim() : 'Untitled';
    };
    const dir = (e) =>
      e.fromType === 'output'
        ? { src: e.fromNode, dst: e.toNode }
        : { src: e.toNode, dst: e.fromNode };

    const lines = [];
    lines.push(`Workspace: ${workspaceName || 'Untitled'}`);
    lines.push('');
    if (!nodes || nodes.length === 0) {
      lines.push('This workspace has no notes.');
      return lines.join('\n');
    }
    nodes.forEach((n, i) => {
      const t = n.title && n.title.trim() ? n.title.trim() : 'Untitled';
      const out = edges.filter((e) => dir(e).src === n.id).map((e) => titleOf(dir(e).dst));
      const inc = edges.filter((e) => dir(e).dst === n.id).map((e) => titleOf(dir(e).src));
      lines.push(`${i + 1}. ${t}`);
      if (out.length) lines.push(`   \u2192  ${out.join('   \u00b7   ')}`);
      if (inc.length) lines.push(`   \u2190  ${inc.join('   \u00b7   ')}`);
      if (!out.length && !inc.length) lines.push('   (no connections)');
      if (expanded && n.content && n.content.trim()) {
        lines.push('');
        n.content.trim().split('\n').forEach((l) => lines.push(`      ${l}`));
      }
      lines.push('');
    });
    return lines.join('\n').trim();
  }, [open, workspaceName, nodes, edges, expanded]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      /* ignore */
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        paddingTop: 'calc(1rem + var(--safe-top))',
        paddingRight: 'calc(1rem + var(--safe-right))',
        paddingBottom: 'calc(1rem + var(--safe-bottom))',
        paddingLeft: 'calc(1rem + var(--safe-left))',
      }}
    >
      <div className="absolute inset-0 bg-nm-overlay backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[80vh] rounded-2xl bg-nm-panel border border-nm-border shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-3 sm:px-4 py-3 border-b border-nm-border bg-nm-header">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-nm-hover hover:bg-nm-hover-strong text-nm-text transition active:scale-95"
          >
            <Copy size={15} />
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-nm-input hover:bg-nm-hover text-nm-text-secondary transition active:scale-95"
          >
            {expanded ? <ListTree size={15} /> : <AlignLeft size={15} />}
            {expanded ? 'Hide text' : 'Show text'}
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-nm-text-faint hover:text-nm-text hover:bg-nm-hover transition active:scale-95"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-auto px-4 sm:px-5 py-4">
          <pre className="whitespace-pre-wrap break-words font-mono text-[13px] sm:text-sm leading-relaxed text-nm-text-secondary">
            {text}
          </pre>
        </div>
      </div>
    </div>
  );
}
