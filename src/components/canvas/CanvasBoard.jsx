import React, { useRef, useState, useEffect, useCallback } from 'react';
import NoteNode from './NoteNode';
import NodeTypeMenu from './NodeTypeMenu';
import BinIcon from './BinIcon';
import {
  TOP_BAR_HEIGHT,
  MIN_ZOOM,
  MAX_ZOOM,
  bezierPath,
  connectedNodePositionAtSocket,
  normalizeOrientation,
  nodeLayoutRect,
  nodeSizeForLayout,
  nodeWidthForTitle,
  rectsIntersect,
  socketWorld,
} from '@/lib/canvasConstants';
import { emitTutorial } from '@/lib/tutorialEvents';
import useSpacePan from '@/hooks/useSpacePan';

function clampZoom(z) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

const PAN_DRAG_THRESHOLD = 3;

function isPointerOverEdge(edgeId, clientX, clientY) {
  const el = document.elementFromPoint(clientX, clientY);
  const hit = el?.closest?.('[data-edge-hit]');
  return hit?.getAttribute('data-edge-id') === edgeId;
}

export default function CanvasBoard({
  nodes,
  edges,
  onAddNode,
  onUpdateNode,
  onDeleteEdge,
  onAddEdge,
  onAddConnectedNode,
  onBringToFront,
  onOpenEdit,
  onDeleteNode,
  onDeleteNodes,
  selectedNodeIds = [],
  onSelectionChange,
  selectionArmed = false,
  onSelectionArmConsumed,
  darkNodes,
  zoom,
  setZoom,
  pan,
  setPan,
  orientation,
  heldConnection = null,
  nodePicker = null,
  onPickerClose,
  onPickerSelect,
  mathResults = null,
  onSelectionMenu,
  ghostSelections = null,
  mathInputBlockedIds = null,
  socketHint = null,
}) {
  const graphOrientation = normalizeOrientation(orientation);
  const [layoutEpoch, setLayoutEpoch] = useState(0);
  const boardRef = useRef(null);
  const pointers = useRef(new Map());
  const panState = useRef({
    panning: false,
    candidate: false,
    marquee: false,
    marqueing: false,
    button: 0,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    moved: false,
    suppressContextMenu: false,
  });
  const pinch = useRef({ active: false, startDist: 0, startZoom: 1, midX: 0, midY: 0 });
  const suppressNextMouseAction = useRef(false);
  const postContextMenuSuppression = useRef(false);
  const suppressPrimaryUp = useRef(false);
  const suppressNextClick = useRef(false);
  const suppressionTimerRef = useRef(0);
  const desktopSelection = useRef(false);
  const selectionArmedRef = useRef(selectionArmed);
  selectionArmedRef.current = selectionArmed;
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  selectedNodeIdsRef.current = selectedNodeIds;
  const pickerOpenRef = useRef(false);
  pickerOpenRef.current = !!nodePicker;
  const nodeDragMovedRef = useRef(false);
  const dragReleaseRef = useRef(null);
  const draggingNodeRef = useRef(null);

  const [marqueeRect, setMarqueeRect] = useState(null);
  const edgeClickRef = useRef(null);
  const edgeClickListenersRef = useRef(null);

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panRef = useRef(pan);
  panRef.current = pan;
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  // Only bump the layout epoch so edges redraw when Math nodes resize.
  // Clearance / placement sorting runs once at selection-op creation (Canvas.jsx),
  // not continuously as equation width changes.
  const notifyLayoutChange = useCallback(() => {
    setLayoutEpoch((n) => n + 1);
  }, []);

  const [pending, setPending] = useState(null);
  const pendingRef = useRef(null);
  const [draggingNode, setDraggingNode] = useState(null);
  const [overBin, setOverBin] = useState(false);
  const overBinRef = useRef(false);
  const binRef = useRef(null);
  const binRectRef = useRef(null);
  const dragVisual = useRef({ raf: 0, ids: [], dx: 0, dy: 0, positions: {} });
  const readViewportSize = () => {
    const styles = getComputedStyle(document.documentElement);
    const frameH = Number.parseFloat(styles.getPropertyValue('--app-frame-height'));
    const frameW = Number.parseFloat(styles.getPropertyValue('--app-frame-width'));
    // Prefer locked frame size so the soft keyboard does not resize the board/chrome.
    const w = Math.round(
      Number.isFinite(frameW) && frameW >= 80 ? frameW : window.innerWidth
    );
    const h = Math.round(
      Number.isFinite(frameH) && frameH >= 80 ? frameH : window.innerHeight
    );
    return { w, h };
  };
  const [vp, setVp] = useState(() => readViewportSize());
  const [tutorialBinVisible, setTutorialBinVisible] = useState(false);

  useEffect(() => {
    const sync = () => {
      setTutorialBinVisible(document.body.dataset.tutorialHighlight === 'delete-bin');
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { attributes: true, attributeFilter: ['data-tutorial-highlight'] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia?.('(hover: hover) and (pointer: fine)');
    const update = () => {
      desktopSelection.current = mq?.matches || false;
    };
    update();
    if (!mq?.addEventListener) return undefined;
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const isPrimaryPointerStart = (e) => {
    if (e.pointerType === 'mouse') return e.button === 0;
    return e.button === 0 || e.button === -1;
  };

  // Pan gestures: touch / primary (when not marquee), middle-mouse, or Space-to-pan (hook).
  // Right-click is reserved for context menus — it must not pan.
  const isCanvasPanPointerStart = (e) => {
    if (e.pointerType !== 'mouse') return e.button === 0 || e.button === -1;
    return e.button === 0 || e.button === 1;
  };

  const { spacePanCursor, isSpacePanArmed } = useSpacePan({
    boardRef,
    setPan,
    onPanGesture: () => emitTutorial('canvas.pan.space'),
  });

  /** Desktop always marquees on primary mouse; mobile only when Selection Mode is armed. */
  const shouldUseMarquee = (e) => {
    if (selectionArmedRef.current) {
      return e.pointerType !== 'mouse' ? e.button === 0 || e.button === -1 : e.button === 0;
    }
    return e.pointerType === 'mouse' && e.button === 0 && desktopSelection.current;
  };

  const clearSuppressionTimer = () => {
    if (suppressionTimerRef.current) {
      window.clearTimeout(suppressionTimerRef.current);
      suppressionTimerRef.current = 0;
    }
  };

  const armPostContextMenuSuppression = useCallback(() => {
    postContextMenuSuppression.current = true;
    suppressPrimaryUp.current = false;
    clearSuppressionTimer();
    suppressionTimerRef.current = window.setTimeout(() => {
      postContextMenuSuppression.current = false;
      suppressPrimaryUp.current = false;
      suppressionTimerRef.current = 0;
    }, 4000);
  }, []);

  const isBoardEvent = (e) => boardRef.current?.contains(e.target);

  const clearEdgeClickListeners = useCallback(() => {
    const listeners = edgeClickListenersRef.current;
    if (!listeners) return;
    window.removeEventListener('pointermove', listeners.onMove);
    window.removeEventListener('pointerup', listeners.onFinish);
    window.removeEventListener('pointercancel', listeners.onFinish);
    edgeClickListenersRef.current = null;
  }, []);

  const updateMarqueeRect = useCallback((startX, startY, clientX, clientY) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMarqueeRect({
      left: Math.min(startX, clientX) - rect.left,
      top: Math.min(startY, clientY) - rect.top,
      width: Math.abs(clientX - startX),
      height: Math.abs(clientY - startY),
    });
  }, []);

  const shouldSuppressPrimaryPointer = (e, phase) => {
    if (!e || e.pointerType !== 'mouse' || e.button !== 0) return false;

    if (phase === 'up' && suppressPrimaryUp.current) {
      suppressPrimaryUp.current = false;
      suppressNextClick.current = true;
      if (postContextMenuSuppression.current) {
        postContextMenuSuppression.current = false;
        clearSuppressionTimer();
      }
      return true;
    }

    if (phase === 'down') {
      if (postContextMenuSuppression.current && !isBoardEvent(e)) {
        postContextMenuSuppression.current = false;
        clearSuppressionTimer();
        return false;
      }

      if (suppressNextMouseAction.current) {
        suppressNextMouseAction.current = false;
        suppressPrimaryUp.current = true;
        return true;
      }

      if (postContextMenuSuppression.current) {
        suppressPrimaryUp.current = true;
        return true;
      }
    }

    return false;
  };

  const cancelCanvasInteraction = useCallback(() => {
    pointers.current.clear();
    panState.current = {
      panning: false,
      candidate: false,
      marquee: false,
      marqueing: false,
      button: 0,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      moved: false,
      suppressContextMenu: false,
    };
    pinch.current.active = false;
    pendingRef.current = null;
    setPending(null);
    setMarqueeRect(null);
    clearEdgeClickListeners();
    edgeClickRef.current = null;
    setDraggingNode(null);
    overBinRef.current = false;
    setOverBin(false);
  }, [clearEdgeClickListeners]);

  // Center origin on mount
  useEffect(() => {
    setPan({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track viewport size (visualViewport is accurate in mobile PWAs)
  useEffect(() => {
    const onResize = () => setVp(readViewportSize());
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    const onBlur = () => {
      suppressNextMouseAction.current = true;
      cancelCanvasInteraction();
    };
    const onFocus = () => {
      suppressNextMouseAction.current = true;
      cancelCanvasInteraction();
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        suppressNextMouseAction.current = true;
        cancelCanvasInteraction();
      }
    };

    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [cancelCanvasInteraction]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return undefined;

    const blockGhostClick = (e) => {
      if (e.button !== 0 || !suppressNextClick.current) return;
      suppressNextClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    };

    board.addEventListener('click', blockGhostClick, true);
    return () => {
      board.removeEventListener('click', blockGhostClick, true);
      clearSuppressionTimer();
    };
  }, []);

  const screenToWorld = useCallback((clientX, clientY) => {
    const rect = boardRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panRef.current.x) / zoomRef.current,
      y: (clientY - rect.top - panRef.current.y) / zoomRef.current,
    };
  }, []);

  const socketScreen = (node, type, overrides, inputSlot = null) => {
    const override = overrides?.get?.(node.id);
    const x = override ? override.x : node.x;
    const y = override ? override.y : node.y;
    const overridden = { ...node, x, y };
    const point = socketWorld(overridden, type, graphOrientation, nodeSizeForLayout(overridden), {
      inputSlot,
    });
    return { x: point.x * zoom + pan.x, y: point.y * zoom + pan.y };
  };

  const updateDraggedEdges = useCallback(
    (overrides) => {
      const overrideMap = overrides instanceof Map ? overrides : new Map([[overrides.id, overrides]]);
      edgesRef.current.forEach((edge) => {
        if (!overrideMap.has(edge.fromNode) && !overrideMap.has(edge.toNode)) return;
        const from = nodesRef.current.find((n) => n.id === edge.fromNode);
        const to = nodesRef.current.find((n) => n.id === edge.toNode);
        if (!from || !to) return;
        let out, inp;
        if (edge.fromType === 'output') {
          out = socketScreen(from, 'output', overrideMap);
          inp = socketScreen(to, 'input', overrideMap, edge.inputSlot || null);
        } else {
          out = socketScreen(to, 'output', overrideMap);
          inp = socketScreen(from, 'input', overrideMap, edge.inputSlot || null);
        }
        const d = bezierPath(out.x, out.y, inp.x, inp.y, false, graphOrientation);
        boardRef.current
          ?.querySelectorAll(`[data-edge-id="${edge.id}"]`)
          .forEach((path) => path.setAttribute('d', d));
      });
    },
    [graphOrientation, pan.x, pan.y, zoom]
  );

  const scheduleDragVisual = useCallback(
    (drag) => {
      dragVisual.current = { ...dragVisual.current, ...drag };
      if (dragVisual.current.raf) return;
      dragVisual.current.raf = requestAnimationFrame(() => {
        dragVisual.current.raf = 0;
        const { ids, dx, dy, positions } = dragVisual.current;
        const overrideMap = new Map();
        ids.forEach((id) => {
          const el = boardRef.current?.querySelector(`[data-note-node="${id}"]`);
          if (el) {
            el.style.transition = 'none';
            el.style.transform = `translate(${dx}px, ${dy}px)`;
          }
          const pos = positions[id];
          if (pos) overrideMap.set(id, { id, x: pos.finalX, y: pos.finalY });
        });
        updateDraggedEdges(overrideMap);
      });
    },
    [updateDraggedEdges]
  );

  const transferToCanvasInteraction = useCallback(
    (startX, startY, e) => {
      pointers.current.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        button: 0,
        pointerType: e.pointerType,
      });
      const useMarquee = shouldUseMarquee(e);
      const totalDx = e.clientX - startX;
      const totalDy = e.clientY - startY;
      const crossedThreshold = Math.abs(totalDx) + Math.abs(totalDy) > PAN_DRAG_THRESHOLD;
      panState.current = {
        panning: !useMarquee,
        candidate: useMarquee && !crossedThreshold,
        marquee: useMarquee,
        marqueing: useMarquee && crossedThreshold,
        button: 0,
        startX,
        startY,
        lastX: e.clientX,
        lastY: e.clientY,
        moved: crossedThreshold,
        suppressContextMenu: false,
      };
      try {
        boardRef.current?.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
      if (useMarquee && crossedThreshold) {
        updateMarqueeRect(startX, startY, e.clientX, e.clientY);
      }
    },
    [updateMarqueeRect]
  );

  const finishEdgeClick = useCallback(
    (e) => {
      const click = edgeClickRef.current;
      if (!click || e.pointerId !== click.pointerId) return;

      clearEdgeClickListeners();
      edgeClickRef.current = null;

      if (shouldSuppressPrimaryPointer(e, 'up')) return;
      if (click.transferredToCanvas) return;

      if (click.hadSelection) {
        onSelectionChange?.([]);
        return;
      }

      const dist =
        Math.abs(e.clientX - click.startX) + Math.abs(e.clientY - click.startY);
      const overEdge = isPointerOverEdge(click.edgeId, e.clientX, e.clientY);
      if (overEdge || dist <= PAN_DRAG_THRESHOLD) {
        onDeleteEdge(click.edgeId);
        emitTutorial('canvas.edge.delete');
      }
    },
    [clearEdgeClickListeners, onDeleteEdge, onSelectionChange]
  );

  const transferEdgeClickToCanvas = useCallback(
    (e) => {
      const click = edgeClickRef.current;
      if (!click || click.transferredToCanvas || e.pointerId !== click.pointerId) return;

      click.transferredToCanvas = true;
      clearEdgeClickListeners();
      edgeClickRef.current = null;
      transferToCanvasInteraction(click.startX, click.startY, e);
    },
    [clearEdgeClickListeners, transferToCanvasInteraction]
  );

  const startEdgeClick = useCallback(
    (edgeId, e) => {
      if (!isPrimaryPointerStart(e) || shouldSuppressPrimaryPointer(e, 'down')) return;
      e.stopPropagation();

      clearEdgeClickListeners();
      edgeClickRef.current = {
        edgeId,
        startX: e.clientX,
        startY: e.clientY,
        pointerId: e.pointerId,
        hadSelection: selectedNodeIdsRef.current.length > 0,
        transferredToCanvas: false,
      };

      const onMove = (moveEvent) => {
        const active = edgeClickRef.current;
        if (!active || active.transferredToCanvas || moveEvent.pointerId !== active.pointerId) return;

        const dist =
          Math.abs(moveEvent.clientX - active.startX) + Math.abs(moveEvent.clientY - active.startY);
        const overEdge = isPointerOverEdge(active.edgeId, moveEvent.clientX, moveEvent.clientY);
        if (!overEdge && dist > PAN_DRAG_THRESHOLD) {
          transferEdgeClickToCanvas(moveEvent);
        }
      };

      const onFinish = (upEvent) => {
        finishEdgeClick(upEvent);
      };

      edgeClickListenersRef.current = { onMove, onFinish };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onFinish);
      window.addEventListener('pointercancel', onFinish);
    },
    [clearEdgeClickListeners, finishEdgeClick, transferEdgeClickToCanvas]
  );

  // --- Background pan / click-to-add / pinch ---
  const onPointerDown = (e) => {
    // Space-to-pan owns primary-button interaction while armed (see useSpacePan).
    if (isSpacePanArmed()) {
      cancelCanvasInteraction();
      return;
    }
    if (!isCanvasPanPointerStart(e) || (e.button === 0 && shouldSuppressPrimaryPointer(e, 'down'))) {
      cancelCanvasInteraction();
      return;
    }
    if (e.pointerType === 'mouse' && e.button === 1) e.preventDefault();
    try {
      boardRef.current.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button, pointerType: e.pointerType });

    if (pointers.current.size === 1) {
      const useMarquee = shouldUseMarquee(e);
      const delayedMousePan = e.pointerType === 'mouse' && e.button === 1;
      panState.current = {
        panning: !delayedMousePan && !useMarquee,
        candidate: delayedMousePan || useMarquee,
        marquee: useMarquee,
        marqueing: false,
        button: e.button,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        moved: false,
        suppressContextMenu: false,
        tutorialPanEmitted: false,
      };
      if (useMarquee) setMarqueeRect(null);
    } else if (pointers.current.size === 2) {
      // Multi-touch zoom: freeze any in-progress node drag so positions stay pinned.
      cancelNodeDrag();
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinch.current = {
        active: true,
        startDist: dist,
        startZoom: zoomRef.current,
        midX: (pts[0].x + pts[1].x) / 2,
        midY: (pts[0].y + pts[1].y) / 2,
      };
      panState.current.panning = false;
      panState.current.candidate = false;
    }
  };

  const onPointerMove = (e) => {
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pinch.current.active) {
      // Capture-phase touch handler owns pinch zoom (works with a finger on a node).
      return;
    }

    if ((panState.current.panning || panState.current.candidate) && pointers.current.size === 1) {
      const dx = e.clientX - panState.current.lastX;
      const dy = e.clientY - panState.current.lastY;
      const totalDx = e.clientX - panState.current.startX;
      const totalDy = e.clientY - panState.current.startY;
      const crossedThreshold = Math.abs(totalDx) + Math.abs(totalDy) > PAN_DRAG_THRESHOLD;

      if (panState.current.candidate && crossedThreshold) {
        if (panState.current.marquee) {
          panState.current.marqueing = true;
          panState.current.moved = true;
        } else {
          panState.current.candidate = false;
          panState.current.panning = true;
          panState.current.moved = true;
        }
      }

      if (panState.current.marqueing) {
        updateMarqueeRect(panState.current.startX, panState.current.startY, e.clientX, e.clientY);
      } else if (panState.current.panning) {
        if (Math.abs(dx) + Math.abs(dy) > PAN_DRAG_THRESHOLD) panState.current.moved = true;
        if (panState.current.button === 1) e.preventDefault();
        setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
        if (!panState.current.tutorialPanEmitted && (Math.abs(dx) > 0 || Math.abs(dy) > 0)) {
          panState.current.tutorialPanEmitted = true;
          if (panState.current.button === 1) emitTutorial('canvas.pan.middle');
          else emitTutorial('canvas.pan.touch');
        }
      }

      panState.current.lastX = e.clientX;
      panState.current.lastY = e.clientY;
    }
  };

  const onPointerUp = (e) => {
    if (shouldSuppressPrimaryPointer(e, 'up')) {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size === 0) {
        panState.current.panning = false;
        panState.current.candidate = false;
        panState.current.marqueing = false;
        setMarqueeRect(null);
      }
      try {
        boardRef.current.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
      return;
    }
    if (!pointers.current.has(e.pointerId)) return;
    const moved = panState.current.moved;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current.active = false;

    if (pointers.current.size === 1) {
      const rem = [...pointers.current.values()][0];
      panState.current = {
        panning: true,
        candidate: false,
        marquee: false,
        marqueing: false,
        button: rem.button,
        startX: rem.x,
        startY: rem.y,
        lastX: rem.x,
        lastY: rem.y,
        moved: true,
        suppressContextMenu: false,
      };
      setMarqueeRect(null);
    } else if (pointers.current.size === 0) {
      const wasMarquee = panState.current.marqueing;
      if (wasMarquee && onSelectionChange) {
        const rect = boardRef.current.getBoundingClientRect();
        const x1 = (Math.min(panState.current.startX, e.clientX) - rect.left - panRef.current.x) / zoomRef.current;
        const y1 = (Math.min(panState.current.startY, e.clientY) - rect.top - panRef.current.y) / zoomRef.current;
        const x2 = (Math.max(panState.current.startX, e.clientX) - rect.left - panRef.current.x) / zoomRef.current;
        const y2 = (Math.max(panState.current.startY, e.clientY) - rect.top - panRef.current.y) / zoomRef.current;
        const worldRect = { minX: x1, minY: y1, maxX: x2, maxY: y2 };
        const hits = nodesRef.current
          .filter((node) => rectsIntersect(nodeLayoutRect(node), worldRect))
          .map((node) => node.id);
        const prior = selectedNodeIdsRef.current;
        const additive = e.shiftKey || selectionArmedRef.current;
        if (additive) {
          onSelectionChange([...new Set([...prior, ...hits])]);
        } else {
          onSelectionChange(hits);
        }
        if (selectionArmedRef.current) onSelectionArmConsumed?.();
        if (additive && prior.length > 0 && hits.some((id) => !prior.includes(id))) {
          emitTutorial('canvas.select.marquee-add');
        }
        emitTutorial('canvas.select.marquee');
      } else if (panState.current.button === 0 && !moved && !pinch.current.active) {
        const hasSelection = selectedNodeIdsRef.current.length > 0;
        if (hasSelection) {
          onSelectionChange?.([]);
        } else {
          onSelectionChange?.([]);
          if (!pickerOpenRef.current) {
            const w = screenToWorld(e.clientX, e.clientY);
            onAddNode(w.x - nodeWidthForTitle('') / 2, w.y - TOP_BAR_HEIGHT / 2, {
              clientX: e.clientX,
              clientY: e.clientY,
              worldX: w.x,
              worldY: w.y,
            });
          }
        }
      }
      panState.current.panning = false;
      panState.current.candidate = false;
      panState.current.marqueing = false;
      setMarqueeRect(null);
      if (panState.current.suppressContextMenu) {
        window.setTimeout(() => {
          panState.current.suppressContextMenu = false;
        }, 500);
      }
    }
    try {
      boardRef.current.releasePointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
  };

  const onPointerCancel = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) cancelCanvasInteraction();
  };

  const onContextMenu = () => {
    // Right-click no longer pans — allow context menus / future features.
    armPostContextMenuSuppression();
    cancelCanvasInteraction();
  };

  // --- Wheel zoom (non-passive) ---
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const handler = (e) => {
      if (e.target?.closest?.('[data-graph-plot]')) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const delta = -e.deltaY * 0.0015;
      const prevZoom = zoomRef.current;
      const newZoom = clampZoom(prevZoom * (1 + delta));
      const wx = (cx - panRef.current.x) / prevZoom;
      const wy = (cy - panRef.current.y) / prevZoom;
      setPan({ x: cx - wx * newZoom, y: cy - wy * newZoom });
      setZoom(newZoom);
      if (newZoom !== prevZoom) emitTutorial('canvas.zoom');
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [setPan, setZoom]);

  // --- Node dragging ---
  const selectNode = useCallback(
    (nodeId, e) => {
      if (e && !isPrimaryPointerStart(e)) return;
      const shiftKey = e?.shiftKey;
      const currentSelection = selectedNodeIdsRef.current;
      // Selection mode (mobile) toggles membership like Shift on desktop.
      const toggle = shiftKey || selectionArmedRef.current;

      if (toggle) {
        if (currentSelection.includes(nodeId)) {
          onSelectionChange?.(currentSelection.filter((id) => id !== nodeId));
          emitTutorial('canvas.select.shift-remove');
          emitTutorial('canvas.select.modify');
        } else {
          onSelectionChange?.([...currentSelection, nodeId]);
          emitTutorial('canvas.select.shift-add');
          emitTutorial('canvas.select.modify');
        }
      } else {
        onSelectionChange?.([nodeId]);
        emitTutorial('canvas.node.select');
      }
      onBringToFront(nodeId);
    },
    [onBringToFront, onSelectionChange]
  );

  const startNodeDrag = useCallback(
    (nodeId, e, { armed = false, onRelease = null } = {}) => {
      if (!isPrimaryPointerStart(e) || shouldSuppressPrimaryPointer(e, 'down')) return;
      // Space-to-pan temporarily owns the primary pointer.
      if (isSpacePanArmed()) return;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const shiftKey = e.shiftKey;
      const currentSelection = selectedNodeIdsRef.current;
      let dragIds;
      let shiftToggleOff = false;
      // Title taps use an armed drag + click release. If Shift-add already
      // applied selection on pointerdown, skip the release toggle or it undoes the add.
      let releaseHandler = armed ? onRelease : null;

      const toggle = shiftKey || selectionArmedRef.current;
      if (toggle) {
        if (currentSelection.includes(nodeId)) {
          shiftToggleOff = true;
          dragIds = currentSelection.filter((id) => nodes.some((n) => n.id === id));
        } else {
          dragIds = [...currentSelection, nodeId];
          onSelectionChange?.(dragIds);
          emitTutorial('canvas.select.shift-add');
          emitTutorial('canvas.select.modify');
          releaseHandler = null;
        }
      } else if (currentSelection.includes(nodeId) && currentSelection.length > 1) {
        dragIds = currentSelection.filter((id) => nodes.some((n) => n.id === id));
      } else {
        onSelectionChange?.([nodeId]);
        dragIds = [nodeId];
        emitTutorial('canvas.node.select');
      }

      const origins = {};
      dragIds.forEach((id) => {
        const n = nodes.find((item) => item.id === id);
        if (n) origins[id] = { x: n.x, y: n.y };
      });

      dragIds.forEach((id) => onBringToFront(id));

      const positions = {};
      dragIds.forEach((id) => {
        positions[id] = { finalX: origins[id].x, finalY: origins[id].y };
      });

      nodeDragMovedRef.current = false;
      dragReleaseRef.current = releaseHandler;
      dragVisual.current = {
        raf: 0,
        ids: dragIds,
        dx: 0,
        dy: 0,
        positions,
      };
      binRectRef.current = null;
      const nextDrag = {
        ids: dragIds,
        nodeId,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origins,
        shiftToggleOff,
        armed,
      };
      draggingNodeRef.current = nextDrag;
      setDraggingNode(nextDrag);
    },
    [nodes, onBringToFront, onSelectionChange, isSpacePanArmed]
  );

  const armNodeDrag = useCallback(
    (nodeId, e, onRelease) => {
      startNodeDrag(nodeId, e, { armed: true, onRelease });
    },
    [startNodeDrag]
  );

  const cancelNodeDrag = useCallback(() => {
    const { ids } = dragVisual.current;
    dragReleaseRef.current = null;
    draggingNodeRef.current = null;
    if (dragVisual.current.raf) {
      cancelAnimationFrame(dragVisual.current.raf);
      dragVisual.current.raf = 0;
    }
    dragVisual.current = { raf: 0, ids: [], dx: 0, dy: 0, positions: {} };
    ids?.forEach((id) => {
      const el = boardRef.current?.querySelector(`[data-note-node="${id}"]`);
      if (el) {
        el.style.transform = '';
        el.style.transition = '';
      }
    });
    overBinRef.current = false;
    binRectRef.current = null;
    setOverBin(false);
    setDraggingNode(null);
  }, []);

  // Capture-phase multi-touch: pinch must work even when the first finger is on a node
  // (node handlers stopPropagation, so bubble pan/pinch never sees that pointer).
  const touchPointers = useRef(new Map());
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return undefined;

    const beginPinch = () => {
      if (touchPointers.current.size < 2) return;
      cancelNodeDrag();
      const pts = [...touchPointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinch.current = {
        active: true,
        startDist: dist || 1,
        startZoom: zoomRef.current,
        midX: (pts[0].x + pts[1].x) / 2,
        midY: (pts[0].y + pts[1].y) / 2,
      };
      panState.current.panning = false;
      panState.current.candidate = false;
      panState.current.marqueing = false;
      setMarqueeRect(null);
    };

    const onDown = (e) => {
      if (e.pointerType === 'mouse') return;
      // Graph plot owns pinch/pan when the gesture is on the plot canvas.
      if (e.target?.closest?.('[data-graph-plot]')) return;
      touchPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touchPointers.current.size >= 2) beginPinch();
    };

    const onMove = (e) => {
      if (!touchPointers.current.has(e.pointerId)) return;
      touchPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!pinch.current.active || touchPointers.current.size < 2) return;
      const pts = [...touchPointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const ratio = dist / (pinch.current.startDist || 1);
      const prevZoom = zoomRef.current;
      const newZoom = clampZoom(pinch.current.startZoom * ratio);
      const rect = board.getBoundingClientRect();
      const cx = pinch.current.midX - rect.left;
      const cy = pinch.current.midY - rect.top;
      const wx = (cx - panRef.current.x) / prevZoom;
      const wy = (cy - panRef.current.y) / prevZoom;
      setPan({ x: cx - wx * newZoom, y: cy - wy * newZoom });
      setZoom(newZoom);
      if (newZoom !== prevZoom) emitTutorial('canvas.zoom.pinch');
      if (e.cancelable) e.preventDefault();
    };

    const onUp = (e) => {
      touchPointers.current.delete(e.pointerId);
      if (touchPointers.current.size < 2) pinch.current.active = false;
    };

    board.addEventListener('pointerdown', onDown, true);
    board.addEventListener('pointermove', onMove, true);
    board.addEventListener('pointerup', onUp, true);
    board.addEventListener('pointercancel', onUp, true);
    return () => {
      board.removeEventListener('pointerdown', onDown, true);
      board.removeEventListener('pointermove', onMove, true);
      board.removeEventListener('pointerup', onUp, true);
      board.removeEventListener('pointercancel', onUp, true);
      touchPointers.current.clear();
    };
  }, [cancelNodeDrag, setPan, setZoom]);

  useEffect(() => {
    if (!draggingNode) {
      draggingNodeRef.current = null;
      overBinRef.current = false;
      setOverBin(false);
      binRectRef.current = null;
      return;
    }
    draggingNodeRef.current = draggingNode;

    const restoreDragOrigins = () => {
      const drag = draggingNodeRef.current;
      if (!drag) return;
      drag.ids.forEach((id) => {
        const el = boardRef.current?.querySelector(`[data-note-node="${id}"]`);
        if (el) {
          el.style.transform = '';
          el.style.transition = '';
        }
      });
    };

    const pinAndCancelDrag = () => {
      if (!draggingNodeRef.current) return;
      restoreDragOrigins();
      dragReleaseRef.current = null;
      draggingNodeRef.current = null;
      if (dragVisual.current.raf) {
        cancelAnimationFrame(dragVisual.current.raf);
        dragVisual.current.raf = 0;
      }
      dragVisual.current = { raf: 0, ids: [], dx: 0, dy: 0, positions: {} };
      overBinRef.current = false;
      binRectRef.current = null;
      setOverBin(false);
      setDraggingNode(null);
    };

    const onMove = (e) => {
      let drag = draggingNodeRef.current;
      if (!drag) return;

      // Zoom / multi-touch owns the gesture — keep node world positions pinned.
      if (pinch.current.active) {
        pinAndCancelDrag();
        return;
      }

      const dist =
        Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY);

      if (drag.armed) {
        if (dist <= PAN_DRAG_THRESHOLD) return;
        nodeDragMovedRef.current = true;
        drag = { ...drag, armed: false };
        draggingNodeRef.current = drag;
        setDraggingNode(drag);
      } else if (dist > PAN_DRAG_THRESHOLD) {
        nodeDragMovedRef.current = true;
      }

      const dx = (e.clientX - drag.startX) / zoomRef.current;
      const dy = (e.clientY - drag.startY) / zoomRef.current;
      const positions = {};
      drag.ids.forEach((id) => {
        const origin = drag.origins[id];
        if (origin) positions[id] = { finalX: origin.x + dx, finalY: origin.y + dy };
      });
      scheduleDragVisual({ ids: drag.ids, dx, dy, positions });
      const el = binRef.current;
      if (el) {
        const r = binRectRef.current || el.getBoundingClientRect();
        binRectRef.current = r;
        const hit = 28;
        const inside =
          e.clientX >= r.left - hit &&
          e.clientX <= r.right + hit &&
          e.clientY >= r.top - hit &&
          e.clientY <= r.bottom + hit;
        overBinRef.current = inside;
        setOverBin((prev) => (prev === inside ? prev : inside));
      }
    };
    const onUp = (e) => {
      const drag = draggingNodeRef.current;
      if (dragVisual.current.raf) {
        cancelAnimationFrame(dragVisual.current.raf);
        dragVisual.current.raf = 0;
      }

      if (drag?.armed && !nodeDragMovedRef.current) {
        dragReleaseRef.current?.(e);
        dragReleaseRef.current = null;
        overBinRef.current = false;
        binRectRef.current = null;
        setOverBin(false);
        draggingNodeRef.current = null;
        setDraggingNode(null);
        return;
      }

      if (drag?.shiftToggleOff && !nodeDragMovedRef.current) {
        onSelectionChange?.(selectedNodeIdsRef.current.filter((id) => id !== drag.nodeId));
        emitTutorial('canvas.select.shift-remove');
        emitTutorial('canvas.select.modify');
        overBinRef.current = false;
        binRectRef.current = null;
        setOverBin(false);
        draggingNodeRef.current = null;
        setDraggingNode(null);
        return;
      }

      const { ids, positions } = dragVisual.current;
      if (overBinRef.current) {
        if (onDeleteNodes) onDeleteNodes(drag.ids);
        else drag.ids.forEach((id) => onDeleteNode(id));
        emitTutorial('canvas.node.delete-bin');
      } else if (nodeDragMovedRef.current) {
        drag.ids.forEach((id) => {
          const pos = positions[id];
          if (pos) onUpdateNode(id, { x: pos.finalX, y: pos.finalY });
        });
        emitTutorial('canvas.node.move');
      } else {
        drag.ids.forEach((id) => {
          const pos = positions[id];
          if (pos) onUpdateNode(id, { x: pos.finalX, y: pos.finalY });
        });
      }
      overBinRef.current = false;
      binRectRef.current = null;
      setOverBin(false);
      draggingNodeRef.current = null;
      dragReleaseRef.current = null;
      setDraggingNode(null);
      requestAnimationFrame(() => {
        ids.forEach((id) => {
          const el = boardRef.current?.querySelector(`[data-note-node="${id}"]`);
          if (el) {
            el.style.transform = '';
            el.style.transition = '';
          }
        });
      });
    };

    // Extra finger during a node drag means zoom/pan — cancel without committing.
    const onExtraPointerDown = (e) => {
      const drag = draggingNodeRef.current;
      if (!drag) return;
      if (e.pointerId === drag.pointerId) return;
      pinAndCancelDrag();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('pointerdown', onExtraPointerDown, true);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('pointerdown', onExtraPointerDown, true);
    };
  }, [draggingNode, onUpdateNode, onDeleteNode, onDeleteNodes, onSelectionChange, scheduleDragVisual]);

  // --- Socket connection drag ---
  const startConnect = useCallback(
    (nodeId, type, e, inputSlot = null) => {
      if (e && (!isPrimaryPointerStart(e) || shouldSuppressPrimaryPointer(e, 'down'))) return;
      if (isSpacePanArmed()) return;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const point = socketWorld(node, type, graphOrientation, nodeSizeForLayout(node), {
        inputSlot,
      });
      const fx = point.x * zoomRef.current + panRef.current.x;
      const fy = point.y * zoomRef.current + panRef.current.y;
      const p = { fromNode: nodeId, fromType: type, inputSlot: inputSlot || null, toX: fx, toY: fy };
      pendingRef.current = p;
      setPending(p);
    },
    [graphOrientation, nodes, isSpacePanArmed]
  );

  useEffect(() => {
    if (!pending) return;
    const onMove = (e) => {
      const rect = boardRef.current.getBoundingClientRect();
      const p = {
        ...pendingRef.current,
        toX: e.clientX - rect.left,
        toY: e.clientY - rect.top,
      };
      pendingRef.current = p;
      setPending(p);
    };
    const onUp = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const socketEl = el && el.closest && el.closest('[data-socket]');
      const overNode = el && el.closest && el.closest('[data-note-node]');
      const cur = pendingRef.current;
      if (cur) {
        if (socketEl) {
          const toNode = socketEl.getAttribute('data-node-id');
          const toType = socketEl.getAttribute('data-socket-type');
          const toSlot = socketEl.getAttribute('data-socket-slot') || null;
          if (toNode && toType && toNode !== cur.fromNode && toType !== cur.fromType) {
            onAddEdge(cur.fromNode, cur.fromType, toNode, toType, {
              fromSlot: cur.inputSlot || null,
              toSlot,
            });
            emitTutorial('canvas.edge.create');
          }
        } else if (!overNode && !pickerOpenRef.current) {
          const w = screenToWorld(e.clientX, e.clientY);
          const fromNodeObj = nodesRef.current.find((n) => n.id === cur.fromNode);
          const pos = connectedNodePositionAtSocket(
            w,
            cur.fromType,
            graphOrientation,
            '',
            fromNodeObj || null
          );
          onAddConnectedNode(pos.x, pos.y, cur.fromNode, cur.fromType, {
            clientX: e.clientX,
            clientY: e.clientY,
            worldX: w.x,
            worldY: w.y,
            inputSlot: cur.inputSlot || null,
          });
        }
      }
      pendingRef.current = null;
      setPending(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending !== null]);

  const selectedSet = new Set(selectedNodeIds);
  const draggingSet = draggingNode ? new Set(draggingNode.ids) : null;
  const cursor =
    spacePanCursor ||
    (marqueeRect ? 'crosshair' : panState.current.panning ? 'grabbing' : 'grab');

  return (
    <div
      ref={boardRef}
      data-canvas-board
      data-onboarding="canvas"
      className="absolute inset-0 overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={onContextMenu}
      onAuxClick={(e) => {
        if (e.button === 1) e.preventDefault();
      }}
      style={{
        touchAction: 'none',
        cursor,
        backgroundColor: 'var(--nm-canvas)',
        backgroundImage:
          'radial-gradient(circle, var(--nm-canvas-dot) 1px, transparent 1px)',
        backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
    >
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-6">
          <p className="text-nm-text-subtle text-center text-sm sm:text-base max-w-md leading-relaxed select-none">
            Tap empty canvas to add a node · drag sockets to connect · tap a line to delete
          </p>
        </div>
      )}
      {/* Edges layer (screen-space) */}
      <svg
        className="absolute inset-0"
        width={vp.w}
        height={vp.h}
        style={{ pointerEvents: 'none' }}
      >
        {edges.map((edge) => {
          // layoutEpoch: recompute paths when Math nodes resize to fit equations
          void layoutEpoch;
          const from = nodes.find((n) => n.id === edge.fromNode);
          const to = nodes.find((n) => n.id === edge.toNode);
          if (!from || !to) return null;
          let out, inp;
          if (edge.fromType === 'output') {
            out = socketScreen(from, 'output');
            inp = socketScreen(to, 'input', null, edge.inputSlot || null);
          } else {
            out = socketScreen(to, 'output');
            inp = socketScreen(from, 'input', null, edge.inputSlot || null);
          }
          const d = bezierPath(out.x, out.y, inp.x, inp.y, false, graphOrientation);
          return (
            <g key={edge.id}>
              <path data-edge-id={edge.id} d={d} fill="none" stroke="var(--nm-edge)" strokeWidth={2.5} strokeLinecap="round" />
              <path
                data-edge-hit
                data-edge-id={edge.id}
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={16}
                style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                onPointerDown={(e) => startEdgeClick(edge.id, e)}
              />
            </g>
          );
        })}
        {(() => {
          const live = pending;
          const held = !live ? heldConnection : null;
          const source = live || held;
          if (!source) return null;
          const fn = nodes.find((n) => n.id === source.fromNode);
          if (!fn) return null;
          const from = socketScreen(fn, source.fromType, null, source.inputSlot || null);
          const toX = live ? live.toX : held.toWorldX * zoom + pan.x;
          const toY = live ? live.toY : held.toWorldY * zoom + pan.y;
          if (!Number.isFinite(toX) || !Number.isFinite(toY)) return null;
          return (
            <path
              d={bezierPath(from.x, from.y, toX, toY, source.fromType === 'input', graphOrientation)}
              fill="none"
              stroke="#818cf8"
              strokeWidth={2.5}
              strokeDasharray="6 6"
              strokeLinecap="round"
            />
          );
        })()}
      </svg>

      {/* Nodes layer (world-space, transformed) */}
      <div
        className="absolute top-0 left-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {nodes.map((node) => (
          <NoteNode
            key={node.id}
            node={node}
            pending={pending || heldConnection}
            orientation={graphOrientation}
            darkNodes={darkNodes}
            selected={selectedSet.has(node.id)}
            ghost={overBin && draggingSet?.has(node.id)}
            mathResult={mathResults?.get?.(node.id) || null}
            onUpdate={(patch) => onUpdateNode(node.id, patch)}
            onSelectNode={selectNode}
            onArmNodeDrag={armNodeDrag}
            onCancelNodeDrag={cancelNodeDrag}
            onStartNodeDrag={startNodeDrag}
            onStartConnect={startConnect}
            onOpenEdit={onOpenEdit}
            onLayoutChange={notifyLayoutChange}
            onSelectionMenu={
              onSelectionMenu
                ? (payload) => onSelectionMenu(node.id, payload)
                : undefined
            }
            ghostSelection={ghostSelections?.get?.(node.id) || null}
            inputBlocked={Boolean(mathInputBlockedIds?.has?.(node.id))}
            socketHint={socketHint?.nodeId === node.id ? socketHint : null}
            zoom={zoom}
            edges={edges}
          />
        ))}
        <NodeTypeMenu
          key={nodePicker ? `${nodePicker.source}-${nodePicker.worldX}-${nodePicker.worldY}` : 'closed'}
          open={!!nodePicker}
          x={nodePicker?.worldX ?? 0}
          y={nodePicker?.worldY ?? 0}
          onClose={onPickerClose}
          onSelect={onPickerSelect}
          allowedMathKinds={nodePicker?.allowedMathKinds ?? null}
          initialCategory={nodePicker?.initialCategory ?? 'text'}
          hideValueSources={!!nodePicker?.hideValueSources}
          valuesOnly={!!nodePicker?.valuesOnly}
        />
      </div>

      {marqueeRect && (
        <div
          className="absolute pointer-events-none border border-indigo-400 bg-indigo-400/10 z-40"
          style={{
            left: marqueeRect.left,
            top: marqueeRect.top,
            width: marqueeRect.width,
            height: marqueeRect.height,
          }}
        />
      )}

      {(draggingNode || tutorialBinVisible) && (
        <div
          ref={binRef}
          data-onboarding="delete-bin"
          className="absolute z-50 rounded-2xl border bg-nm-bin backdrop-blur-md p-2 shadow-xl transition-all"
          style={{
            pointerEvents: 'none',
            right: 'calc(1rem + var(--safe-right))',
            bottom: 'calc(1rem + var(--safe-bottom))',
            borderColor: overBin ? '#ef4444' : 'var(--nm-border)',
            backgroundColor: overBin ? 'rgba(239,68,68,0.2)' : 'var(--nm-bin)',
            color: overBin ? '#ef4444' : 'var(--nm-text-secondary)',
            transform: overBin ? 'scale(1.08)' : 'none',
          }}
        >
          <span className="flex items-center justify-center" style={{ width: 38, height: 38 }}>
            <BinIcon open={overBin} size={18} />
          </span>
        </div>
      )}
    </div>
  );
}