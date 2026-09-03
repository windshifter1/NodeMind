import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import CanvasBoard from '@/components/canvas/CanvasBoard';
import Toolbar from '@/components/canvas/Toolbar';
import NodeEditDialog from '@/components/canvas/NodeEditDialog';
import WorkspaceBar from '@/components/canvas/WorkspaceBar';
import WorkspaceEditDialog from '@/components/canvas/WorkspaceEditDialog';
import TextExportDialog from '@/components/canvas/TextExportDialog';
import TerminalDialog from '@/components/canvas/TerminalDialog';
import SettingsDialog from '@/components/canvas/SettingsDialog';
import SelectionOpMenu from '@/components/canvas/SelectionOpMenu';
import MathsCreditDialog from '@/components/canvas/MathsCreditDialog';
import OnboardingTour from '@/components/onboarding/OnboardingTour';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import {
  LAYOUT_ON_ORIENTATION_CHANGE,
  MIN_ZOOM,
  MAX_ZOOM,
  autoOrganiseNodes,
  autoOrganiseSelectedNodes,
  connectedNodePositionAtSocket,
  connectedNodePositionAvoidingOverlap,
  nodeWidthForTitle,
  TOP_BAR_HEIGHT,
  workspaceNodesBounds,
  zoomToFrameBounds,
} from '@/lib/canvasConstants';
import {
  allowsMultipleInputs,
  fieldsForKind,
  isMathNode,
  isSelectionOpNode,
  usesInputSlots,
  NODE_KIND,
} from '@/lib/nodeTypes';
import { evaluateMathGraph } from '@/lib/cas/evalGraph';
import {
  connectionInputSlot,
  connectionInputTarget,
  hasInboundEdge,
} from '@/lib/graphEdges';
import { hasInboundEdgeOnSlot } from '@/lib/substituteSlots';
import { shouldStartOnboarding } from '@/lib/onboarding';
import { readMathsCreditSeen, setMathsCreditSeen } from '@/lib/mathsCredit';
import { emitTutorial } from '@/lib/tutorialEvents';
import { applyDocumentTheme, persistTheme, readStoredTheme } from '@/lib/theme';
import {
  applyDocumentUiStyle,
  persistUiStyle,
  readStoredUiStyle,
  usesLiquidMotion,
} from '@/lib/uiStyle';
import { attachLiquidButtons } from '@/lib/liquidButtons';
import { attachPrototypeLight } from '@/lib/prototypeLight';

const MATH_SINGLE_INPUT_MESSAGE = 'This node accepts only one input';

function isCreditOpNode(node) {
  return node?.kind === NODE_KIND.MANIPULATION || node?.kind === NODE_KIND.EQUATION_OP;
}

function clampZoom(z) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

export default function Canvas() {
  const { state, dispatch, active } = useWorkspaces();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [editingWorkspace, setEditingWorkspace] = useState(false);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [textExportOpen, setTextExportOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [selectionArmed, setSelectionArmed] = useState(false);
  const [nodeTheme, setNodeTheme] = useState(() => readStoredTheme());
  const [uiStyle, setUiStyle] = useState(() => readStoredUiStyle());
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [mathsCreditOpen, setMathsCreditOpen] = useState(false);
  const [nodePicker, setNodePicker] = useState(null);
  const [selectionMenu, setSelectionMenu] = useState(null);
  const [socketHint, setSocketHint] = useState(null);
  const [spawnNodeIds, setSpawnNodeIds] = useState(() => new Set());
  const [spawnRipples, setSpawnRipples] = useState([]);
  const socketHintTimerRef = useRef(null);
  const hadCreditOpRef = useRef(null);
  const knownNodeIdsRef = useRef(null);
  const spawnTimerRef = useRef([]);
  useEffect(() => {
    applyDocumentTheme(nodeTheme);
    persistTheme(nodeTheme);
  }, [nodeTheme]);

  useEffect(() => {
    applyDocumentUiStyle(uiStyle);
    persistUiStyle(uiStyle);
  }, [uiStyle]);

  useEffect(() => {
    if (!usesLiquidMotion(uiStyle)) return undefined;
    return attachLiquidButtons();
  }, [uiStyle]);

  useEffect(() => {
    if (uiStyle !== 'prototype') return undefined;
    return attachPrototypeLight();
  }, [uiStyle]);

  // Liquid styles: plop animation + subtle ripples when nodes appear.
  useEffect(() => {
    const ids = (active.nodes || []).map((n) => n.id);
    const next = new Set(ids);
    const tracked = knownNodeIdsRef.current;
    if (!tracked || tracked.workspaceId !== state.activeId) {
      knownNodeIdsRef.current = { workspaceId: state.activeId, ids: next };
      return;
    }
    const added = ids.filter((id) => !tracked.ids.has(id));
    knownNodeIdsRef.current = { workspaceId: state.activeId, ids: next };
    if (!added.length || !usesLiquidMotion(uiStyle) || added.length > 12) return;

    setSpawnNodeIds((prev) => {
      const merged = new Set(prev);
      added.forEach((id) => merged.add(id));
      return merged;
    });
    const ripples = added
      .map((id) => {
        const node = active.nodes.find((n) => n.id === id);
        if (!node) return null;
        return {
          key: `${id}-${Date.now()}`,
          x: node.x + nodeWidthForTitle(node.title || '') / 2,
          y: node.y + TOP_BAR_HEIGHT / 2,
        };
      })
      .filter(Boolean);
    if (ripples.length) {
      setSpawnRipples((prev) => [...prev, ...ripples]);
    }
    const t = window.setTimeout(() => {
      spawnTimerRef.current = spawnTimerRef.current.filter((id) => id !== t);
      setSpawnNodeIds((prev) => {
        const cleaned = new Set(prev);
        added.forEach((id) => cleaned.delete(id));
        return cleaned;
      });
    }, 820);
    spawnTimerRef.current.push(t);
  }, [active.nodes, uiStyle, state.activeId]);

  useEffect(() => {
    const timers = spawnTimerRef.current;
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, []);

  const clearSpawnRipple = useCallback((key) => {
    setSpawnRipples((prev) => prev.filter((r) => r.key !== key));
  }, []);

  // One-time credit popup after the first Manipulation / Solve node is added.
  // Scan every workspace so switching boards (or loading existing graphs) never retriggers it.
  useEffect(() => {
    const hasOp = (state.workspaces || []).some((ws) => (ws.nodes || []).some(isCreditOpNode));
    if (hadCreditOpRef.current === null) {
      hadCreditOpRef.current = hasOp;
      return;
    }
    if (!hadCreditOpRef.current && hasOp && !readMathsCreditSeen()) {
      setMathsCreditSeen(true);
      setMathsCreditOpen(true);
    }
    hadCreditOpRef.current = hasOp;
  }, [state.workspaces]);

  const closeMathsCredit = useCallback(() => {
    setMathsCreditSeen(true);
    setMathsCreditOpen(false);
  }, []);

  const showSocketHint = useCallback((nodeId, message = MATH_SINGLE_INPUT_MESSAGE) => {
    if (!nodeId) return;
    if (socketHintTimerRef.current) window.clearTimeout(socketHintTimerRef.current);
    setSocketHint({ nodeId, message, key: Date.now() });
    socketHintTimerRef.current = window.setTimeout(() => {
      setSocketHint(null);
      socketHintTimerRef.current = null;
    }, 2200);
  }, []);

  useEffect(
    () => () => {
      if (socketHintTimerRef.current) window.clearTimeout(socketHintTimerRef.current);
    },
    []
  );

  const mathInputBlockedIds = useMemo(() => {
    const blocked = new Set();
    (active.nodes || []).forEach((node) => {
      if (
        isMathNode(node) &&
        !allowsMultipleInputs(node) &&
        hasInboundEdge(active.edges, node.id)
      ) {
        blocked.add(node.id);
      }
    });
    return blocked;
  }, [active.nodes, active.edges]);

  useEffect(() => {
    if (!shouldStartOnboarding()) return undefined;
    // Wait a tick so toolbar / workspace targets are mounted and measured.
    const t = window.setTimeout(() => setOnboardingOpen(true), 450);
    return () => window.clearTimeout(t);
  }, []);

  // Tutorial starts on a fresh blank "Tutorial" board at the front of the bar.
  const tutorialWsBootRef = useRef(false);
  const tutorialWorkspaceIdRef = useRef(null);
  useEffect(() => {
    if (!onboardingOpen) {
      tutorialWsBootRef.current = false;
      return;
    }
    if (tutorialWsBootRef.current) return;
    tutorialWsBootRef.current = true;
    const tutorialId = `w_tutorial_${Date.now().toString(36)}`;
    tutorialWorkspaceIdRef.current = tutorialId;
    dispatch({
      type: 'ADD_WORKSPACE',
      prepend: true,
      workspace: {
        id: tutorialId,
        name: 'Tutorial',
        colour: '#6366f1',
        icon: 'note',
        orientation: 'horizontal',
        nodes: [],
        edges: [],
        nextZ: 1,
      },
    });
    // Keep the Tutorial tab visible at the start of the scroll strip.
    window.requestAnimationFrame(() => {
      const scroller = document.querySelector('.nm-workspace-scroll-viewport');
      if (scroller) scroller.scrollLeft = 0;
    });
  }, [onboardingOpen, dispatch]);

  const finishOnboarding = useCallback(() => {
    setOnboardingOpen(false);
    setSettingsOpen(false);
    const tutorialId = tutorialWorkspaceIdRef.current;
    tutorialWorkspaceIdRef.current = null;
    if (tutorialId) {
      dispatch({ type: 'DELETE_WORKSPACE', id: tutorialId });
    }
  }, [dispatch]);

  const terminalTutorialWsIdRef = useRef(null);

  const beginTerminalTutorialWorkspace = useCallback(() => {
    // Replace any prior terminal-tutorial board so replay stays clean.
    const prior = terminalTutorialWsIdRef.current;
    if (prior) {
      terminalTutorialWsIdRef.current = null;
      dispatch({ type: 'DELETE_WORKSPACE', id: prior });
    }
    const tutorialId = `w_term_tutorial_${Date.now().toString(36)}`;
    terminalTutorialWsIdRef.current = tutorialId;
    dispatch({
      type: 'ADD_WORKSPACE',
      prepend: true,
      workspace: {
        id: tutorialId,
        name: 'Tutorial',
        colour: '#6366f1',
        icon: 'note',
        orientation: 'horizontal',
        nodes: [],
        edges: [],
        nextZ: 1,
        terminal: {
          lines: ['Tutorial started — follow the card below.'],
          history: [],
          cwdId: null,
          welcomeHidden: true,
        },
      },
    });
    window.requestAnimationFrame(() => {
      const scroller = document.querySelector('.nm-workspace-scroll-viewport');
      if (scroller) scroller.scrollLeft = 0;
    });
  }, [dispatch]);

  const endTerminalTutorialWorkspace = useCallback(() => {
    const tutorialId = terminalTutorialWsIdRef.current;
    terminalTutorialWsIdRef.current = null;
    if (tutorialId) {
      dispatch({ type: 'DELETE_WORKSPACE', id: tutorialId });
    }
  }, [dispatch]);

  const closeTerminal = useCallback(() => {
    setTerminalOpen(false);
  }, []);

  const mathResults = useMemo(
    () => evaluateMathGraph(active.nodes, active.edges),
    [active.nodes, active.edges]
  );

  /** When an operation node is selected, highlight its stored selection on the upstream preview. */
  const ghostSelections = useMemo(() => {
    const map = new Map();
    if (!selectedNodeIds.length) return map;
    const byId = new Map(active.nodes.map((node) => [node.id, node]));
    selectedNodeIds.forEach((id) => {
      const node = byId.get(id);
      if (!isSelectionOpNode(node) || !node.selection) return;
      const edge = (active.edges || []).find((item) => {
        const target = item.fromType === 'output' ? item.toNode : item.fromNode;
        return target === id;
      });
      if (!edge) return;
      const sourceId = edge.fromType === 'output' ? edge.fromNode : edge.toNode;
      if (!sourceId || !byId.has(sourceId)) return;
      const sourceNode = byId.get(sourceId);
      // Prefer the most recently selected operation when several share a source.
      // Tint the upstream highlight with the previous node's outline colour.
      map.set(sourceId, {
        ...node.selection,
        color: sourceNode?.color || node.color || '#6366f1',
      });
    });
    return map;
  }, [selectedNodeIds, active.nodes, active.edges]);

  const closeNodePicker = useCallback(() => setNodePicker(null), []);

  const openNodePicker = useCallback((request) => {
    setNodePicker(request);
  }, []);

  const pickNodeType = useCallback(
    (kind) => {
      if (!nodePicker) return;
      const { source, x, y, fromNode, fromType, inputSlot, worldX, worldY, preferredModes } =
        nodePicker;
      const preferredMode = preferredModes?.[kind]?.[0];
      if (source === 'connected') {
        const dropX = Number.isFinite(worldX) ? worldX : x;
        const dropY = Number.isFinite(worldY) ? worldY : y;
        const sourceNode = active.nodes.find((node) => node.id === fromNode) || null;
        const pos = connectedNodePositionAtSocket(
          { x: dropX, y: dropY },
          fromType,
          active.orientation,
          fieldsForKind(kind),
          sourceNode
        );
        dispatch({
          type: 'ADD_CONNECTED_NODE',
          x: pos.x,
          y: pos.y,
          fromNode,
          fromType,
          inputSlot: inputSlot || null,
          kind,
          mode: preferredMode,
        });
        emitTutorial('canvas.node.create-connected');
      } else {
        dispatch({ type: 'ADD_NODE', x, y, kind, mode: preferredMode });
        emitTutorial(source === 'toolbar' ? 'toolbar.node.create' : 'canvas.node.create-click');
      }
      setNodePicker(null);
    },
    [active.nodes, active.orientation, dispatch, nodePicker]
  );

  const addNode = (x, y, anchor) =>
    openNodePicker({
      source: 'canvas',
      x,
      y,
      worldX: Number.isFinite(anchor?.worldX) ? anchor.worldX : x,
      worldY: Number.isFinite(anchor?.worldY) ? anchor.worldY : y,
      clientX: anchor?.clientX ?? window.innerWidth / 2,
      clientY: anchor?.clientY ?? window.innerHeight / 2,
    });
  const updateNode = (id, patch) => dispatch({ type: 'UPDATE_NODE', id, patch });
  const deleteNode = (id) => dispatch({ type: 'DELETE_NODE', id });
  const deleteNodes = (ids) => {
    if (!ids?.length) return;
    dispatch({ type: 'DELETE_NODES', ids });
    setSelectedNodeIds((prev) => prev.filter((id) => !ids.includes(id)));
  };
  const addEdge = (fromNode, fromType, toNode, toType, slots = null) => {
    const fromSlot = slots?.fromSlot || null;
    const toSlot = slots?.toSlot || null;
    const inputTarget = connectionInputTarget(fromNode, fromType, toNode, toType);
    const targetNode = inputTarget
      ? active.nodes.find((node) => node.id === inputTarget)
      : null;
    const inputSlot = connectionInputSlot(fromType, toType, fromSlot, toSlot);
    if (targetNode && isMathNode(targetNode)) {
      if (usesInputSlots(targetNode)) {
        if (!inputSlot || hasInboundEdgeOnSlot(active.edges, inputTarget, inputSlot)) {
          showSocketHint(inputTarget, 'This socket already has an input');
          return;
        }
      } else if (!allowsMultipleInputs(targetNode) && hasInboundEdge(active.edges, inputTarget)) {
        showSocketHint(inputTarget);
        return;
      }
    }
    dispatch({
      type: 'ADD_EDGE',
      fromNode,
      fromType,
      toNode,
      toType,
      fromSlot,
      toSlot,
    });
  };
  const deleteEdge = (id) => dispatch({ type: 'DELETE_EDGE', id });
  const bringToFront = (id) => dispatch({ type: 'BRING_TO_FRONT', id });
  const addConnectedNode = (x, y, fromNode, fromType, anchor) => {
    const from = active.nodes.find((node) => node.id === fromNode);
    const fromMath = from && isMathNode(from);
    const inputSlot = anchor?.inputSlot || null;
    if (fromMath && fromType === 'input') {
      if (usesInputSlots(from)) {
        if (inputSlot && hasInboundEdgeOnSlot(active.edges, fromNode, inputSlot)) {
          showSocketHint(fromNode, 'This socket already has an input');
          return;
        }
      } else if (!allowsMultipleInputs(from) && hasInboundEdge(active.edges, fromNode)) {
        showSocketHint(fromNode);
        return;
      }
    }
    let initialCategory = 'text';
    let valuesOnly = false;

    if (fromMath && fromType === 'input') {
      initialCategory = 'math';
      valuesOnly = true;
    } else if (fromMath && fromType === 'output') {
      initialCategory = 'math';
    }

    openNodePicker({
      source: 'connected',
      x,
      y,
      fromNode,
      fromType,
      inputSlot,
      worldX: anchor?.worldX,
      worldY: anchor?.worldY,
      clientX: anchor?.clientX ?? window.innerWidth / 2,
      clientY: anchor?.clientY ?? window.innerHeight / 2,
      initialCategory,
      valuesOnly,
    });
  };

  const closeSelectionMenu = useCallback(() => {
    setSelectionMenu((prev) => {
      try {
        prev?.clearSelection?.();
      } catch {
        /* ignore */
      }
      return null;
    });
  }, []);

  const handleSelectionMenu = useCallback((nodeId, payload) => {
    if (!payload || !payload.ops) {
      // Closing because a new selection is starting — leave highlight to the new drag.
      setSelectionMenu(null);
      return;
    }
    setSelectionMenu({ nodeId, ...payload });
  }, []);

  const pickSelectionOp = useCallback(
    (op, field) => {
      if (!selectionMenu || !op?.method) return;
      const sourceNode = active.nodes.find((node) => node.id === selectionMenu.nodeId);
      const clearSelection = selectionMenu.clearSelection;
      if (!sourceNode) {
        try {
          clearSelection?.();
        } catch {
          /* ignore */
        }
        setSelectionMenu(null);
        return;
      }
      const extra = { ...(op.extra || {}) };
      delete extra.needsField;
      delete extra.fieldPlaceholder;
      const isEquation = op.method === 'solveui';
      const kind = isEquation ? NODE_KIND.EQUATION_OP : NODE_KIND.MANIPULATION;
      const title = isEquation ? 'Solve' : 'Manipulation';
      const opId = op.id || `${op.method}:${op.label}`;
      const pos = connectedNodePositionAvoidingOverlap(
        active.nodes,
        sourceNode,
        'output',
        active.orientation,
        { kind, title }
      );
      dispatch({
        type: 'ADD_CONNECTED_NODE',
        x: pos.x,
        y: pos.y,
        fromNode: sourceNode.id,
        fromType: 'output',
        kind,
        fields: {
          title,
          method: op.method,
          opId,
          selection: {
            path: selectionMenu.selection?.path || [],
            issel: selectionMenu.selection?.issel || null,
            ...extra,
          },
          field: field || (isEquation && extra.arg != null ? String(extra.arg) : ''),
        },
      });
      try {
        clearSelection?.();
      } catch {
        /* ignore */
      }
      setSelectionMenu(null);
    },
    [active.nodes, active.orientation, dispatch, selectionMenu]
  );

  const createWorkspace = (workspace) => dispatch({ type: 'ADD_WORKSPACE', workspace });
  const selectWorkspace = (id) => dispatch({ type: 'SET_ACTIVE', id });
  const viewportCenterWorld = () => ({
    x: (window.innerWidth / 2 - pan.x) / zoom,
    y: (window.innerHeight / 2 - pan.y) / zoom,
  });
  const organiseWorkspaceNodes = (workspace, orientation = workspace.orientation, settings = workspace.layoutSettings) =>
    autoOrganiseNodes(workspace.nodes || [], workspace.edges || [], orientation, settings, viewportCenterWorld());
  const updateWorkspaceMeta = (id, patch) => {
    const shouldOrganise =
      patch.orientation &&
      patch.orientation !== active.orientation &&
      (patch.layoutOnOrientationChange || active.layoutOnOrientationChange) === LAYOUT_ON_ORIENTATION_CHANGE.AUTO;

    if (shouldOrganise) {
      dispatch({
        type: 'REPLACE_ACTIVE_WORKSPACE',
        workspace: {
          ...patch,
          nodes: organiseWorkspaceNodes(active, patch.orientation, patch.layoutSettings || active.layoutSettings),
        },
      });
      return;
    }

    dispatch({ type: 'UPDATE_WORKSPACE_META', id, patch });
  };
  const deleteWorkspace = (id) => dispatch({ type: 'DELETE_WORKSPACE', id });
  const autoOrganise = () => {
    dispatch({
      type: 'REPLACE_ACTIVE_WORKSPACE',
      workspace: { nodes: organiseWorkspaceNodes(active) },
    });
  };
  const organiseSelected = () => {
    if (selectedNodeIds.length < 2) return;
    const selectedNodes = active.nodes.filter((n) => selectedNodeIds.includes(n.id));
    const bounds = workspaceNodesBounds(selectedNodes);
    const centre = bounds?.centroid || viewportCenterWorld();
    dispatch({
      type: 'REPLACE_ACTIVE_WORKSPACE',
      workspace: {
        nodes: autoOrganiseSelectedNodes(
          active.nodes,
          active.edges,
          selectedNodeIds,
          active.orientation,
          active.layoutSettings,
          centre
        ),
      },
    });
  };

  useEffect(() => {
    setSelectedNodeIds([]);
    setSelectionArmed(false);
    setNodePicker(null);
    closeSelectionMenu();
  }, [state.activeId, closeSelectionMenu]);

  useEffect(() => {
    setSelectedNodeIds((ids) => ids.filter((id) => active.nodes.some((n) => n.id === id)));
  }, [active.nodes]);

  useEffect(() => {
    if (!selectionArmed) return undefined;
    const onPointerDown = (e) => {
      if (e.target.closest?.('[data-selection-arm-button]')) return;
      if (e.target.closest?.('[data-canvas-board]')) return;
      const ui = e.target.closest?.(
        'button, a, input, textarea, select, [role="button"], label, summary'
      );
      if (ui) setSelectionArmed(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [selectionArmed]);

  const handleExport = () => {
    const data = JSON.stringify(
      {
        workspace: {
          name: active.name,
          colour: active.colour,
          icon: active.icon,
          orientation: active.orientation,
          layoutOnOrientationChange: active.layoutOnOrientationChange,
          layoutSettings: active.layoutSettings,
        },
        nodes: active.nodes,
        edges: active.edges,
        nextZ: active.nextZ,
        terminal: active.terminal,
      },
      null,
      2
    );
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(active.name || 'workspace').replace(/[^a-z0-9]+/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        dispatch({ type: 'IMPORT_AS_WORKSPACE', data: JSON.parse(reader.result) });
      } catch (err) {
        alert('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClear = () => {
    if (window.confirm('Clear all nodes and connections in this workspace? The workspace itself is kept.')) {
      dispatch({ type: 'CLEAR_CONTENT' });
    }
  };

  const panRef = useRef(pan);
  panRef.current = pan;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const cameraAnimRef = useRef(0);

  useEffect(() => () => {
    if (cameraAnimRef.current) cancelAnimationFrame(cameraAnimRef.current);
  }, []);

  const animateCamera = useCallback((toPan, toZoom, duration = 250) => {
    if (cameraAnimRef.current) cancelAnimationFrame(cameraAnimRef.current);
    const fromPan = { ...panRef.current };
    const fromZoom = zoomRef.current;
    const start = performance.now();
    const easeOut = (t) => 1 - (1 - t) ** 3;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const e = easeOut(t);
      setPan({
        x: fromPan.x + (toPan.x - fromPan.x) * e,
        y: fromPan.y + (toPan.y - fromPan.y) * e,
      });
      setZoom(fromZoom + (toZoom - fromZoom) * e);
      if (t < 1) cameraAnimRef.current = requestAnimationFrame(tick);
      else cameraAnimRef.current = 0;
    };
    cameraAnimRef.current = requestAnimationFrame(tick);
  }, []);

  const recenterView = useCallback(() => {
    const nodes = active.nodes || [];
    if (!nodes.length) {
      animateCamera(panRef.current, 1);
      return;
    }
    const bounds = workspaceNodesBounds(nodes);
    const fitZoom = clampZoom(zoomToFrameBounds(bounds, window.innerWidth, window.innerHeight));
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    animateCamera(
      { x: cx - bounds.centroid.x * fitZoom, y: cy - bounds.centroid.y * fitZoom },
      fitZoom
    );
  }, [active.nodes, animateCamera]);

  const editingNode = active.nodes.find((n) => n.id === editingNodeId) || null;

  return (
    <div className="absolute inset-0 overflow-hidden bg-nm-canvas">
      <CanvasBoard
        nodes={active.nodes}
        edges={active.edges}
        onAddNode={addNode}
        onUpdateNode={updateNode}
        onDeleteEdge={deleteEdge}
        onAddEdge={addEdge}
        onAddConnectedNode={addConnectedNode}
        onBringToFront={bringToFront}
        onOpenEdit={setEditingNodeId}
        onDeleteNode={deleteNode}
        onDeleteNodes={deleteNodes}
        selectedNodeIds={selectedNodeIds}
        onSelectionChange={setSelectedNodeIds}
        selectionArmed={selectionArmed}
        onSelectionArmConsumed={() => setSelectionArmed(false)}
        darkNodes={nodeTheme === 'dark'}
        uiStyle={uiStyle}
        spawnNodeIds={spawnNodeIds}
        spawnRipples={spawnRipples}
        onSpawnRippleEnd={clearSpawnRipple}
        zoom={zoom}
        setZoom={setZoom}
        pan={pan}
        setPan={setPan}
        orientation={active.orientation}
        heldConnection={
          nodePicker?.source === 'connected'
            ? {
                fromNode: nodePicker.fromNode,
                fromType: nodePicker.fromType,
                inputSlot: nodePicker.inputSlot || null,
                toWorldX: nodePicker.worldX,
                toWorldY: nodePicker.worldY,
              }
            : null
        }
        nodePicker={nodePicker}
        onPickerClose={closeNodePicker}
        onPickerSelect={pickNodeType}
        mathResults={mathResults}
        onSelectionMenu={handleSelectionMenu}
        ghostSelections={ghostSelections}
        mathInputBlockedIds={mathInputBlockedIds}
        socketHint={socketHint}
      />
      <SelectionOpMenu
        open={!!selectionMenu}
        x={selectionMenu?.clientX ?? 0}
        y={selectionMenu?.clientY ?? 0}
        ops={selectionMenu?.ops || []}
        onClose={closeSelectionMenu}
        onPick={pickSelectionOp}
      />

      <Toolbar
        onExport={handleExport}
        onImport={handleImport}
        onClear={handleClear}
        onTextExport={() => setTextExportOpen(true)}
        onOpenTerminal={() => setTerminalOpen(true)}
        onAutoOrganise={autoOrganise}
        onOrganiseSelected={organiseSelected}
        selectedCount={selectedNodeIds.length}
        selectionArmed={selectionArmed}
        onToggleSelectionArm={() => setSelectionArmed((armed) => !armed)}
        zoom={zoom}
        onRecenter={recenterView}
        onOpenSettings={() => setSettingsOpen(true)}
        onAddNodeCenter={(anchor) => {
          const clientX = anchor?.clientX ?? window.innerWidth / 2;
          const clientY = anchor?.clientY ?? 72;
          const rect = document.querySelector('[data-canvas-board]')?.getBoundingClientRect();
          const left = rect?.left ?? 0;
          const top = rect?.top ?? 0;
          openNodePicker({
            source: 'toolbar',
            x: -nodeWidthForTitle('') / 2,
            y: -TOP_BAR_HEIGHT / 2,
            worldX: (clientX - left - pan.x) / zoom,
            worldY: (clientY - top - pan.y) / zoom,
            clientX,
            clientY,
          });
        }}
      />

      <WorkspaceBar
        workspaces={state.workspaces}
        activeId={state.activeId}
        onSelect={selectWorkspace}
        onCreate={() => setCreatingWorkspace(true)}
        onEdit={() => setEditingWorkspace(true)}
      />

      <NodeEditDialog
        node={editingNode}
        open={!!editingNode}
        onClose={() => setEditingNodeId(null)}
        onSave={updateNode}
        onDelete={deleteNode}
      />

      <WorkspaceEditDialog
        workspace={active}
        open={editingWorkspace}
        mode="edit"
        onClose={() => setEditingWorkspace(false)}
        onSave={updateWorkspaceMeta}
        onDelete={deleteWorkspace}
      />

      <WorkspaceEditDialog
        workspace={{
          id: 'new',
          name: `Workspace ${state.workspaces.length + 1}`,
          colour: '#6366f1',
          icon: 'note',
          orientation: 'horizontal',
          layoutOnOrientationChange: 'preserve',
        }}
        open={creatingWorkspace}
        mode="create"
        onClose={() => setCreatingWorkspace(false)}
        onSave={(_, patch) => createWorkspace(patch)}
      />

      <TextExportDialog
        open={textExportOpen}
        onClose={() => setTextExportOpen(false)}
        workspaceName={active.name}
        nodes={active.nodes}
        edges={active.edges}
      />

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        nodeTheme={nodeTheme}
        onThemeChange={setNodeTheme}
        uiStyle={uiStyle}
        onUiStyleChange={setUiStyle}
      />

      <OnboardingTour open={onboardingOpen} onClose={finishOnboarding} />

      <MathsCreditDialog open={mathsCreditOpen} onClose={closeMathsCredit} />

      <TerminalDialog
        open={terminalOpen}
        onClose={closeTerminal}
        workspace={active}
        dispatch={dispatch}
        orientation={active.orientation}
        onArrange={autoOrganise}
        onExport={handleExport}
        onImport={() => {
          const input = document.querySelector('input[type="file"][accept="application/json"]');
          input?.click();
        }}
        onTutorialStart={beginTerminalTutorialWorkspace}
        onTutorialEnd={endTerminalTutorialWorkspace}
      />
    </div>
  );
}