import React, { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import {
  applyVisualSelection,
  clearPreviewSelection,
  createPreviewEquation,
  layoutSelectablePreview,
  printflat,
  selectAllPreview,
  selectPreviewAt,
} from '@/lib/cas/engine';
import { listSelectionOps, resolveSelection } from '@/lib/cas/selectionOps';

function astKey(ast) {
  try {
    return JSON.stringify(ast ?? null);
  } catch {
    return String(ast);
  }
}

function selectionKey(selection) {
  if (!selection) return '';
  try {
    return JSON.stringify({
      path: selection.path || [],
      issel: selection.issel || null,
      arg: selection.arg,
      callStyle: selection.callStyle,
      color: selection.color || '',
    });
  } catch {
    return String(selection);
  }
}

/**
 * Grey CAS preview using the original equation canvas so characters can be
 * selected the same way as Algebra Backend. Selection is red/blue; ink is grey.
 * When `ghostSelection` is set (operation node selected), the stored selection
 * is painted in the node outline colour as a read-only highlight.
 */
export default function MathPreview({
  nodeId,
  ast,
  flat,
  error,
  empty,
  zoom = 1,
  onMetrics,
  onSelectionMenu,
  ghostSelection = null,
}) {
  const canvasRef = useRef(null);
  const eqRef = useRef(null);
  const draggingRef = useRef(false);
  const canvasId = `math-eq-${nodeId}`;
  const serializedAst = useMemo(() => astKey(ast), [ast]);
  const ghostKey = useMemo(() => selectionKey(ghostSelection), [ghostSelection]);
  const readOnlyGhost = Boolean(ghostSelection);
  // Stable enough for deps; still tracks live zoom for sharp redraws.
  const previewZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const eq = eqRef.current;
    if (!canvas || !eq) {
      onMetrics?.({ width: 0, height: 0 });
      return;
    }
    try {
      const metrics = layoutSelectablePreview(eq);
      onMetrics?.(metrics);
    } catch {
      onMetrics?.({ width: 0, height: 0 });
    }
  }, [onMetrics]);

  useLayoutEffect(() => {
    if (error || empty || serializedAst === 'null' || serializedAst === '""') {
      eqRef.current = null;
      onMetrics?.({ width: 0, height: 0 });
      return undefined;
    }
    let nextAst;
    try {
      nextAst = JSON.parse(serializedAst);
    } catch {
      nextAst = null;
    }
    if (nextAst == null || nextAst === '') {
      eqRef.current = null;
      onMetrics?.({ width: 0, height: 0 });
      return undefined;
    }
    const eq = createPreviewEquation(nextAst, canvasId, previewZoom);
    eqRef.current = eq;
    paint();
    if (ghostSelection) {
      applyVisualSelection(eq, ghostSelection);
    }
    return () => {
      eqRef.current = null;
    };
  }, [serializedAst, canvasId, empty, error, onMetrics, paint, ghostKey, ghostSelection, previewZoom]);

  const finishSelection = useCallback(
    (clientX, clientY) => {
      const eq = eqRef.current;
      if (!eq || !onSelectionMenu || readOnlyGhost) return;
      const numsel = typeof eq.countselected === 'function' ? eq.countselected(eq.equation) : 0;
      if (!numsel) {
        onSelectionMenu(null);
        return;
      }
      const resolved = resolveSelection(eq);
      if (!resolved) {
        onSelectionMenu(null);
        return;
      }
      let ops = [];
      try {
        ops = listSelectionOps(eq, { printflat });
      } catch {
        ops = [];
      }
      const eqForClear = eq;
      onSelectionMenu({
        ops,
        selection: {
          path: resolved.path,
          issel: resolved.issel,
        },
        clientX,
        clientY,
        clearSelection: () => clearPreviewSelection(eqForClear),
      });
    },
    [onSelectionMenu, readOnlyGhost]
  );

  const onPointerDown = (e) => {
    if (readOnlyGhost) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    draggingRef.current = true;
    const canvas = canvasRef.current;
    const eq = eqRef.current;
    if (!canvas || !eq) return;
    onSelectionMenu?.(null);
    selectPreviewAt(eq, canvas, e.clientX, e.clientY, false, e.offsetX, e.offsetY);
    canvas.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (readOnlyGhost || !draggingRef.current) return;
    e.stopPropagation();
    const canvas = canvasRef.current;
    const eq = eqRef.current;
    if (!canvas || !eq) return;
    selectPreviewAt(eq, canvas, e.clientX, e.clientY, true, e.offsetX, e.offsetY);
  };

  const onPointerUp = (e) => {
    if (readOnlyGhost) return;
    if (!draggingRef.current) return;
    draggingRef.current = false;
    e.stopPropagation();
    try {
      canvasRef.current?.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    finishSelection(e.clientX, e.clientY);
  };

  const onDoubleClick = (e) => {
    if (readOnlyGhost) return;
    e.stopPropagation();
    e.preventDefault();
    const eq = eqRef.current;
    if (!eq) return;
    selectAllPreview(eq);
    finishSelection(e.clientX, e.clientY);
  };

  if (error) {
    return (
      <div className="mt-2 min-h-[2.25rem] break-words text-center text-sm font-medium text-rose-400">
        {error}
      </div>
    );
  }

  if (empty || ((ast == null || ast === '') && !flat)) {
    return (
      <div className="mt-2 min-h-[2.25rem]" aria-hidden="true">
        {'\u00a0'}
      </div>
    );
  }

  return (
    <div className="math-preview-scroll mt-2">
      <div className="flex w-max min-w-full justify-center px-1">
        <canvas
          ref={canvasRef}
          id={canvasId}
          className={`math-eq-canvas math-preview${readOnlyGhost ? ' pointer-events-none' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
        />
      </div>
    </div>
  );
}
