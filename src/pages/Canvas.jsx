import React, { useState, useEffect } from 'react';
import CanvasBoard from '@/components/canvas/CanvasBoard';
import Toolbar from '@/components/canvas/Toolbar';
import NodeEditDialog from '@/components/canvas/NodeEditDialog';
import WorkspaceBar from '@/components/canvas/WorkspaceBar';
import WorkspaceEditDialog from '@/components/canvas/WorkspaceEditDialog';
import TextExportDialog from '@/components/canvas/TextExportDialog';
import TerminalDialog from '@/components/canvas/TerminalDialog';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { MIN_ZOOM, MAX_ZOOM, nodeWidthForTitle, TOP_BAR_HEIGHT } from '@/lib/canvasConstants';

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
  const toggleTheme = () => setNodeTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const addNode = (x, y) => dispatch({ type: 'ADD_NODE', x, y });
  const updateNode = (id, patch) => dispatch({ type: 'UPDATE_NODE', id, patch });
  const deleteNode = (id) => dispatch({ type: 'DELETE_NODE', id });
  const addEdge = (fromNode, fromType, toNode, toType) =>
    dispatch({ type: 'ADD_EDGE', fromNode, fromType, toNode, toType });
  const deleteEdge = (id) => dispatch({ type: 'DELETE_EDGE', id });
  const bringToFront = (id) => dispatch({ type: 'BRING_TO_FRONT', id });
  const addConnectedNode = (x, y, fromNode, fromType) =>
    dispatch({ type: 'ADD_CONNECTED_NODE', x, y, fromNode, fromType });

  const createWorkspace = (workspace) => dispatch({ type: 'ADD_WORKSPACE', workspace });
  const selectWorkspace = (id) => dispatch({ type: 'SET_ACTIVE', id });
  const updateWorkspaceMeta = (id, patch) => dispatch({ type: 'UPDATE_WORKSPACE_META', id, patch });
  const deleteWorkspace = (id) => dispatch({ type: 'DELETE_WORKSPACE', id });

  const handleExport = () => {
    const data = JSON.stringify(
      {
        workspace: { name: active.name, colour: active.colour, icon: active.icon, orientation: active.orientation },
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
        zoom={zoom}
        onZoom={zoomToCenter}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        nodeTheme={nodeTheme}
        onToggleTheme={toggleTheme}
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

      <TerminalDialog
        open={terminalOpen}
        onClose={() => setTerminalOpen(false)}
        workspace={active}
        dispatch={dispatch}
        orientation={active.orientation}
        onExport={handleExport}
        onImport={() => {
          const input = document.querySelector('input[type="file"][accept="application/json"]');
          input?.click();
        }}
      />
    </div>
  );
}