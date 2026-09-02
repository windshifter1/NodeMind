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
import { fieldsForKind, isMathNode, NODE_KIND } from '@/lib/nodeTypes';
import { evaluateMathGraph } from '@/lib/cas/evalGraph';
import { shouldStartOnboarding } from '@/lib/onboarding';
import { emitTutorial } from '@/lib/tutorialEvents';
import { applyDocumentTheme, persistTheme, readStoredTheme } from '@/lib/theme';

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
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [nodePicker, setNodePicker] = useState(null);
  const [selectionMenu, setSelectionMenu] = useState(null);
  useEffect(() => {
    applyDocumentTheme(nodeTheme);
    persistTheme(nodeTheme);
  }, [nodeTheme]);

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

  const closeNodePicker = useCallback(() => setNodePicker(null), []);

  const openNodePicker = useCallback((request) => {
    setNodePicker(request);
  }, []);

  const pickNodeType = useCallback(
    (kind) => {
      if (!nodePicker) return;
      const { source, x, y, fromNode, fromType, worldX, worldY, preferredModes } = nodePicker;
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
  const addEdge = (fromNode, fromType, toNode, toType) =>
    dispatch({ type: 'ADD_EDGE', fromNode, fromType, toNode, toType });
  const deleteEdge = (id) => dispatch({ type: 'DELETE_EDGE', id });
  const bringToFront = (id) => dispatch({ type: 'BRING_TO_FRONT', id });
  const addConnectedNode = (x, y, fromNode, fromType, anchor) => {
    const from = active.nodes.find((node) => node.id === fromNode);
    const fromMath = from && isMathNode(from);
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
      worldX: anchor?.worldX,
      worldY: anchor?.worldY,
      clientX: anchor?.clientX ?? window.innerWidth / 2,
      clientY: anchor?.clientY ?? window.innerHeight / 2,
      initialCategory,
      valuesOnly,
    });
  };

  const closeSelectionMenu = useCallback(() => setSelectionMenu(null), []);

  const handleSelectionMenu = useCallback((nodeId, payload) => {
    if (!payload || !payload.ops) {
      setSelectionMenu(null);
      return;
    }
    setSelectionMenu({ nodeId, ...payload });
  }, []);

  const pickSelectionOp = useCallback(
    (op, field) => {
      if (!selectionMenu || !op?.method) return;
      const sourceNode = active.nodes.find((node) => node.id === selectionMenu.nodeId);
      if (!sourceNode) {
        setSelectionMenu(null);
        return;
      }
      const extra = { ...(op.extra || {}) };
      delete extra.needsField;
      delete extra.fieldPlaceholder;
      const pos = connectedNodePositionAvoidingOverlap(
        active.nodes,
        sourceNode,
        'output',
        active.orientation,
        { kind: NODE_KIND.CAS_OP, title: op.label }
      );
      dispatch({
        type: 'ADD_CONNECTED_NODE',
        x: pos.x,
        y: pos.y,
        fromNode: sourceNode.id,
        fromType: 'output',
        kind: NODE_KIND.CAS_OP,
        fields: {
          title: op.label,
          method: op.method,
          selection: {
            path: selectionMenu.selection?.path || [],
            issel: selectionMenu.selection?.issel || null,
            ...extra,
          },
          field: field || '',
        },
      });
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
    setSelectionMenu(null);
  }, [state.activeId]);

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
      />

      <OnboardingTour open={onboardingOpen} onClose={finishOnboarding} />

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