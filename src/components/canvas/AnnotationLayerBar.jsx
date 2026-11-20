import React from 'react';
import { ArrowDown, ArrowUp, CircleHelp } from 'lucide-react';

export default function AnnotationLayerBar({ x, y, onForward, onBack }) {
  return (
    <div
      className="nm-annot-layer-bar"
      style={{ left: x, top: y }}
      role="toolbar"
      aria-label="Annotation layer"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button type="button" title="Bring forward" className="nm-annot-layer-bar__btn" onClick={onForward}>
        <ArrowUp size={16} strokeWidth={1.75} />
      </button>
      <button type="button" title="Send backward" className="nm-annot-layer-bar__btn" onClick={onBack}>
        <ArrowDown size={16} strokeWidth={1.75} />
      </button>
      <button type="button" disabled title="Coming soon" className="nm-annot-layer-bar__btn is-soon">
        <CircleHelp size={16} strokeWidth={1.75} />
      </button>
      <button type="button" disabled title="Coming soon" className="nm-annot-layer-bar__btn is-soon">
        <CircleHelp size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}