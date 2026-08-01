import React, { useRef, useState, useEffect, useCallback } from 'react';
import NoteNode from './NoteNode';
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
  darkNodes,
  zoom,
  setZoom,
  pan,
  setPan,
  orientation,
}) {
  const graphOrientation = normalizeOrientation(orientation);
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
  const desktopSelection = useRef(false);
  const [desktopSelectionEnabled, setDesktopSelectionEnabled] = useState(false);
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  selectedNodeIdsRef.current = selectedNodeIds;

  const [marqueeRect, setMarqueeRect] = useState(null);
  const [edgeClick, setEdgeClick] = useState(null);

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panRef = useRef(pan);
  panRef.current = pan;
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  const [pending, setPending] = useState(null);
  const pendingRef = useRef(null);
  const [draggingNode, setDraggingNode] = useState(null);
  const [overBin, setOverBin] = useState(false);
  const overBinRef = useRef(false);
  const binRef = useRef(null);
  const binRectRef = useRef(null);
  const dragVisual = useRef({ raf: 0, ids: [], dx: 0, dy: 0, positions: {} });
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const mq = window.matchMedia?.('(hover: hover) and (pointer: fine)');
    const update = () => {
      const enabled = mq?.matches || false;
      desktopSelection.current = enabled;
      setDesktopSelectionEnabled(enabled);
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

  const isCanvasPanPointerStart = (e) => {
    if (e.pointerType !== 'mouse') return e.button === 0 || e.button === -1;
    return e.button === 0 || e.button === 1 || e.button === 2;
  };

  const shouldIgnoreMouseFocusRestore = (e) => {
    if (e.pointerType !== 'mouse' || !suppressNextMouseAction.current) return false;
    suppressNextMouseAction.current = false;
    return true;
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
    setEdgeClick(null);
    setDraggingNode(null);
    overBinRef.current = false;
    setOverBin(false);
  }, []);

  // Center origin on mount
  useEffect(() => {
    setPan({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track viewport size
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
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

  const screenToWorld = useCallback((clientX, clientY) => {
    const rect = boardRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panRef.current.x) / zoomRef.current,
      y: (clientY - rect.top - panRef.current.y) / zoomRef.current,
    };
  }, []);

  const socketScreen = (node, type, overrides) => {
    const override = overrides?.get?.(node.id);
    const x = override ? override.x : node.x;
    const y = override ? override.y : node.y;
    const overridden = { ...node, x, y };
    const point = socketWorld(overridden, type, graphOrientation, nodeSizeForLayout(overridden));
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
          inp = socketScreen(to, 'input', overrideMap);
        } else {
          out = socketScreen(to, 'output', overrideMap);
          inp = socketScreen(from, 'input', overrideMap);
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

  const transferToCanvasInteraction = useCallback((startX, startY, e) => {
    pointers.current.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      button: 0,
      pointerType: e.pointerType,
    });
    const useMarquee = e.pointerType === 'mouse' && desktopSelection.current;
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
    if (useMarquee && crossedThreshold) {
      const rect = boardRef.current.getBoundingClientRect();
      setMarqueeRect({
        left: Math.min(startX, e.clientX) - rect.left,
        top: Math.min(startY, e.clientY) - rect.top,
        width: Math.abs(totalDx),
        height: Math.abs(totalDy),
      });
    }
  }, []);

  const startEdgeClick = useCallback(
    (edgeId, e) => {
      if (!isPrimaryPointerStart(e) || shouldIgnoreMouseFocusRestore(e)) return;
      e.stopPropagation();

      if (e.pointerType !== 'mouse') {
        onDeleteEdge(edgeId);
        return;
      }

      setEdgeClick({
        edgeId,
        startX: e.clientX,
        startY: e.clientY,
        pointerId: e.pointerId,
      });
    },
    [onDeleteEdge]
  );

  useEffect(() => {
    if (!edgeClick) return undefined;

    const finish = (e) => {
      if (e.pointerId !== edgeClick.pointerId) return;
      const dist =
        Math.abs(e.clientX - edgeClick.startX) + Math.abs(e.clientY - edgeClick.startY);
      const overEdge = isPointerOverEdge(edgeClick.edgeId, e.clientX, e.clientY);
      if (overEdge || dist <= PAN_DRAG_THRESHOLD) onDeleteEdge(edgeClick.edgeId);
      setEdgeClick(null);
    };

    const onMove = (e) => {
      if (e.pointerId !== edgeClick.pointerId) return;
      const dist =
        Math.abs(e.clientX - edgeClick.startX) + Math.abs(e.clientY - edgeClick.startY);
      const overEdge = isPointerOverEdge(edgeClick.edgeId, e.clientX, e.clientY);
      if (!overEdge && dist > PAN_DRAG_THRESHOLD) {
        const start = { x: edgeClick.startX, y: edgeClick.startY };
        setEdgeClick(null);
        transferToCanvasInteraction(start.x, start.y, e);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [edgeClick, onDeleteEdge, transferToCanvasInteraction]);

  // --- Background pan / click-to-add / pinch ---
  const onPointerDown = (e) => {
    if (!isCanvasPanPointerStart(e) || (e.button === 0 && shouldIgnoreMouseFocusRestore(e))) {
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
      const isMousePrimary = e.pointerType === 'mouse' && e.button === 0;
      const useMarquee = isMousePrimary && desktopSelection.current;
      const delayedMousePan = e.pointerType === 'mouse' && (e.button === 1 || e.button === 2);
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
      };
      if (useMarquee) setMarqueeRect(null);
    } else if (pointers.current.size === 2) {
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

    if (pinch.current.active && pointers.current.size >= 2) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const ratio = dist / (pinch.current.startDist || 1);
      const newZoom = clampZoom(pinch.current.startZoom * ratio);
      const rect = boardRef.current.getBoundingClientRect();
      const cx = pinch.current.midX - rect.left;
      const cy = pinch.current.midY - rect.top;
      const wx = (cx - panRef.current.x) / zoomRef.current;
      const wy = (cy - panRef.current.y) / zoomRef.current;
      setPan({ x: cx - wx * newZoom, y: cy - wy * newZoom });
      setZoom(newZoom);
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
          panState.current.suppressContextMenu = panState.current.button === 2;
        }
      }

      if (panState.current.marqueing) {
        const rect = boardRef.current.getBoundingClientRect();
        setMarqueeRect({
          left: Math.min(panState.current.startX, e.clientX) - rect.left,
          top: Math.min(panState.current.startY, e.clientY) - rect.top,
          width: Math.abs(totalDx),
          height: Math.abs(totalDy),
        });
      } else if (panState.current.panning) {
        if (Math.abs(dx) + Math.abs(dy) > PAN_DRAG_THRESHOLD) panState.current.moved = true;
        if (panState.current.button === 1 || panState.current.button === 2) e.preventDefault();
        setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      }

      panState.current.lastX = e.clientX;
      panState.current.lastY = e.clientY;
    }
  };

  const onPointerUp = (e) => {
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
      if (wasMarquee && desktopSelection.current && onSelectionChange) {
        const rect = boardRef.current.getBoundingClientRect();
        const x1 = (Math.min(panState.current.startX, e.clientX) - rect.left - panRef.current.x) / zoomRef.current;
        const y1 = (Math.min(panState.current.startY, e.clientY) - rect.top - panRef.current.y) / zoomRef.current;
        const x2 = (Math.max(panState.current.startX, e.clientX) - rect.left - panRef.current.x) / zoomRef.current;
        const y2 = (Math.max(panState.current.startY, e.clientY) - rect.top - panRef.current.y) / zoomRef.current;
        const worldRect = { minX: x1, minY: y1, maxX: x2, maxY: y2 };
        const hits = nodesRef.current
          .filter((node) => rectsIntersect(nodeLayoutRect(node), worldRect))
          .map((node) => node.id);
        onSelectionChange(hits);
      } else if (panState.current.button === 0 && !moved && !pinch.current.active) {
        if (desktopSelection.current && onSelectionChange) onSelectionChange([]);
        const w = screenToWorld(e.clientX, e.clientY);
        onAddNode(w.x - nodeWidthForTitle('') / 2, w.y - TOP_BAR_HEIGHT / 2);
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

  const onContextMenu = (e) => {
    if (panState.current.suppressContextMenu) {
      e.preventDefault();
      panState.current.suppressContextMenu = false;
    }
    cancelCanvasInteraction();
  };

  // --- Wheel zoom (non-passive) ---
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const handler = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const delta = -e.deltaY * 0.0015;
      const newZoom = clampZoom(zoomRef.current * (1 + delta));
      const wx = (cx - panRef.current.x) / zoomRef.current;
      const wy = (cy - panRef.current.y) / zoomRef.current;
      setPan({ x: cx - wx * newZoom, y: cy - wy * newZoom });
      setZoom(newZoom);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [setPan, setZoom]);

  // --- Node dragging ---
  const startNodeDrag = useCallback(
    (nodeId, e) => {
      if (!isPrimaryPointerStart(e) || shouldIgnoreMouseFocusRestore(e)) return;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const isDesktopMouse = e.pointerType === 'mouse' && desktopSelection.current;
      const currentSelection = selectedNodeIdsRef.current;
      let dragIds;
      if (isDesktopMouse && currentSelection.includes(nodeId) && currentSelection.length > 1) {
        dragIds = currentSelection.filter((id) => nodes.some((n) => n.id === id));
      } else {
        if (isDesktopMouse && onSelectionChange) onSelectionChange([nodeId]);
        dragIds = [nodeId];
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

      dragVisual.current = {
        raf: 0,
        ids: dragIds,
        dx: 0,
        dy: 0,
        positions,
      };
      binRectRef.current = null;
      setDraggingNode({
        ids: dragIds,
        startX: e.clientX,
        startY: e.clientY,
        origins,
      });
    },
    [nodes, onBringToFront, onSelectionChange]
  );

  useEffect(() => {
    if (!draggingNode) {
      overBinRef.current = false;
      setOverBin(false);
      binRectRef.current = null;
      return;
    }
    const onMove = (e) => {
      const dx = (e.clientX - draggingNode.startX) / zoomRef.current;
      const dy = (e.clientY - draggingNode.startY) / zoomRef.current;
      const positions = {};
      draggingNode.ids.forEach((id) => {
        const origin = draggingNode.origins[id];
        if (origin) positions[id] = { finalX: origin.x + dx, finalY: origin.y + dy };
      });
      scheduleDragVisual({ ids: draggingNode.ids, dx, dy, positions });
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
    const onUp = () => {
      if (dragVisual.current.raf) {
        cancelAnimationFrame(dragVisual.current.raf);
        dragVisual.current.raf = 0;
      }
      const { ids, positions } = dragVisual.current;
      if (overBinRef.current) {
        if (onDeleteNodes) onDeleteNodes(draggingNode.ids);
        else draggingNode.ids.forEach((id) => onDeleteNode(id));
      } else {
        draggingNode.ids.forEach((id) => {
          const pos = positions[id];
          if (pos) onUpdateNode(id, { x: pos.finalX, y: pos.finalY });
        });
      }
      overBinRef.current = false;
      binRectRef.current = null;
      setOverBin(false);
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
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [draggingNode, onUpdateNode, onDeleteNode, onDeleteNodes, scheduleDragVisual]);

  // --- Socket connection drag ---
  const startConnect = useCallback(
    (nodeId, type, e) => {
      if (e && (!isPrimaryPointerStart(e) || shouldIgnoreMouseFocusRestore(e))) return;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const point = socketWorld(node, type, graphOrientation, nodeSizeForLayout(node));
      const fx = point.x * zoomRef.current + panRef.current.x;
      const fy = point.y * zoomRef.current + panRef.current.y;
      const p = { fromNode: nodeId, fromType: type, toX: fx, toY: fy };
      pendingRef.current = p;
      setPending(p);
    },
    [graphOrientation, nodes]
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
          if (toNode && toType && toNode !== cur.fromNode && toType !== cur.fromType) {
            onAddEdge(cur.fromNode, cur.fromType, toNode, toType);
          }
        } else if (!overNode) {
          const w = screenToWorld(e.clientX, e.clientY);
          const pos = connectedNodePositionAtSocket(w, cur.fromType, graphOrientation);
          onAddConnectedNode(pos.x, pos.y, cur.fromNode, cur.fromType);
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
  const cursor = marqueeRect ? 'crosshair' : panState.current.panning ? 'grabbing' : 'grab';

  return (
    <div
      ref={boardRef}
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
        backgroundColor: '#0b0d12',
        backgroundImage:
          'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
        backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
    >
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-6">
          <p className="text-white/15 text-center text-sm sm:text-base max-w-md leading-relaxed select-none">
            Tap empty canvas to add a note · drag sockets to connect · tap a line to delete
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
          const from = nodes.find((n) => n.id === edge.fromNode);
          const to = nodes.find((n) => n.id === edge.toNode);
          if (!from || !to) return null;
          let out, inp;
          if (edge.fromType === 'output') {
            out = socketScreen(from, 'output');
            inp = socketScreen(to, 'input');
          } else {
            out = socketScreen(to, 'output');
            inp = socketScreen(from, 'input');
          }
          const d = bezierPath(out.x, out.y, inp.x, inp.y, false, graphOrientation);
          return (
            <g key={edge.id}>
              <path data-edge-id={edge.id} d={d} fill="none" stroke="#94a3b8" strokeWidth={2.5} strokeLinecap="round" />
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
        {pending &&
          (() => {
            const fn = nodes.find((n) => n.id === pending.fromNode);
            if (!fn) return null;
            const from = socketScreen(fn, pending.fromType);
            return (
              <path
                d={bezierPath(from.x, from.y, pending.toX, pending.toY, pending.fromType === 'input', graphOrientation)}
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
            pending={pending}
            orientation={graphOrientation}
            darkNodes={darkNodes}
            selected={desktopSelectionEnabled && selectedSet.has(node.id)}
            ghost={overBin && draggingSet?.has(node.id)}
            onUpdate={(patch) => onUpdateNode(node.id, patch)}
            onStartNodeDrag={startNodeDrag}
            onStartConnect={startConnect}
            onOpenEdit={onOpenEdit}
          />
        ))}
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

      {draggingNode && (
        <div
          ref={binRef}
          className="absolute z-50 right-4 bottom-4 rounded-2xl border bg-zinc-900/80 backdrop-blur-md p-2 shadow-xl transition-all"
          style={{
            pointerEvents: 'none',
            borderColor: overBin ? '#ef4444' : 'rgba(255,255,255,0.12)',
            backgroundColor: overBin ? 'rgba(239,68,68,0.25)' : 'rgba(24,24,27,0.8)',
            color: overBin ? '#ef4444' : 'rgba(255,255,255,0.75)',
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