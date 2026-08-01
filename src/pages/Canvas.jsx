import React, { useState, useEffect, useRef, useCallback } from 'react';
import CanvasBoard from '@/components/canvas/CanvasBoard';
import Toolbar from '@/components/canvas/Toolbar';
import NodeEditDialog from '@/components/canvas/NodeEditDialog';
import WorkspaceBar from '@/components/canvas/WorkspaceBar';
import WorkspaceEditDialog from '@/components/canvas/WorkspaceEditDialog';
import TextExportDialog from '@/components/canvas/TextExportDialog';
import TerminalDialog from '@/components/canvas/TerminalDialog';
import SettingsDialog from '@/components/canvas/SettingsDialog';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import {
  LAYOUT_ON_ORIENTATION_CHANGE,
  MIN_ZOOM,
  MAX_ZOOM,
  autoOrganiseNodes,
  autoOrganiseSelectedNodes,
  nodeWidthForTitle,
  TOP_BAR_HEIGHT,
  workspaceNodesBounds,
  zoomToFrameBounds,
} from '@/lib/canvasConstants';

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
  const [nodeTheme, setNodeTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('thoughts-canvas-node-theme-v2');
      return stored === 'light' ? 'light' : 'dark';
    } catch (e) {
      return 'dark';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('thoughts-canvas-node-theme-v2', nodeTheme);
    } catch (e) {
      /* ignore */
    }
  }, [nodeTheme]);

  const addNode = (x, y) => dispatch({ type: 'ADD_NODE', x, y });
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
  const addConnectedNode = (x, y, fromNode, fromType) =>
    dispatch({ type: 'ADD_CONNECTED_NODE', x, y, fromNode, fromType });

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
  }, [state.activeId]);

  useEffect(() => {
    setSelectedNodeIds((ids) => ids.filter((id) => active.nodes.some((n) => n.id === id)));
  }, [active.nodes]);

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
    if (window.confirm('Clear all notes and connections in this workspace? The workspace itself is kept.')) {
      dispatch({ type: 'CLEAR_CONTENT' });
    }
  };

  const zoomToCenter = (newZoom) => {
    const z = clampZoom(newZoom);
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const wx = (cx - pan.x) / zoom;
    const wy = (cy - pan.y) / zoom;
    setPan({ x: cx - wx * z, y: cy - wy * z });
    setZoom(z);
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

  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    } catch (e) {
      /* ignore */
    }
  };

  const editingNode = active.nodes.find((n) => n.id === editingNodeId) || null;

  return (
    <div className="fixed inset-0 bg-zinc-950 overflow-hidden">
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
        darkNodes={nodeTheme === 'dark'}
        zoom={zoom}
        setZoom={setZoom}
        pan={pan}
        setPan={setPan}
        orientation={active.orientation}
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
        zoom={zoom}
        onZoom={zoomToCenter}
        onRecenter={recenterView}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onOpenSettings={() => setSettingsOpen(true)}
        onAddNodeCenter={() => addNode(-nodeWidthForTitle('') / 2, -TOP_BAR_HEIGHT / 2)}
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

      <TerminalDialog
        open={terminalOpen}
        onClose={() => setTerminalOpen(false)}
        workspace={active}
        dispatch={dispatch}
        orientation={active.orientation}
        onArrange={autoOrganise}
        onExport={handleExport}
        onImport={() => {
          const input = document.querySelector('input[type="file"][accept="application/json"]');
          input?.click();
        }}
      />
    </div>
  );
}