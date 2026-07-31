import { useReducer, useEffect } from 'react';

const STORAGE_KEY = 'thoughts-canvas-workspaces-v2';
const LEGACY_KEY = 'thoughts-canvas-graph-v1';

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function newWorkspace({ name, colour, icon, nodes, edges, nextZ } = {}) {
  return {
    id: uid('w'),
    name: name || 'Untitled',
    colour: colour || '#6366f1',
    icon: icon || 'note',
    nodes: Array.isArray(nodes) ? nodes : [],
    edges: Array.isArray(edges) ? edges : [],
    nextZ: typeof nextZ === 'number' ? nextZ : 1,
  };
}

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.workspaces) && parsed.workspaces.length) {
        return parsed;
      }
    }
  } catch (e) {
    /* ignore */
  }
  // Migrate legacy single-graph storage into a workspace.
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const g = JSON.parse(legacy);
      const ws = newWorkspace({
        name: 'My Canvas',
        nodes: g.nodes,
        edges: g.edges,
        nextZ: g.nextZ,
      });
      return { workspaces: [ws], activeId: ws.id };
    }
  } catch (e) {
    /* ignore */
  }
  const ws = newWorkspace({ name: 'My Canvas' });
  return { workspaces: [ws], activeId: ws.id };
}

function withActiveGraph(state, fn) {
  return {
    ...state,
    workspaces: state.workspaces.map((w) => (w.id === state.activeId ? fn(w) : w)),
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_WORKSPACE': {
      const ws = newWorkspace({ name: `Workspace ${state.workspaces.length + 1}` });
      return { workspaces: [...state.workspaces, ws], activeId: ws.id };
    }
    case 'IMPORT_AS_WORKSPACE': {
      const meta = (action.data && action.data.workspace) || {};
      const ws = newWorkspace({
        name: meta.name || 'Imported',
        colour: meta.colour,
        icon: meta.icon,
        nodes: action.data && action.data.nodes,
        edges: action.data && action.data.edges,
        nextZ: action.data && action.data.nextZ,
      });
      return { workspaces: [...state.workspaces, ws], activeId: ws.id };
    }
    case 'DELETE_WORKSPACE': {
      const remaining = state.workspaces.filter((w) => w.id !== action.id);
      if (remaining.length === 0) {
        const ws = newWorkspace({ name: 'My Canvas' });
        return { workspaces: [ws], activeId: ws.id };
      }
      const activeId = state.activeId === action.id ? remaining[0].id : state.activeId;
      return { workspaces: remaining, activeId };
    }
    case 'UPDATE_WORKSPACE_META':
      return {
        ...state,
        workspaces: state.workspaces.map((w) =>
          w.id === action.id ? { ...w, ...action.patch } : w
        ),
      };
    case 'SET_ACTIVE':
      return { ...state, activeId: action.id };

    case 'ADD_NODE':
      return withActiveGraph(state, (w) => ({
        ...w,
        nodes: [
          ...w.nodes,
          {
            id: uid('n'),
            x: action.x,
            y: action.y,
            title: '',
            content: '',
            color: '#6366f1',
            collapsed: false,
            z: w.nextZ,
          },
        ],
        nextZ: w.nextZ + 1,
      }));
    case 'ADD_CONNECTED_NODE':
      return withActiveGraph(state, (w) => {
        const id = uid('n');
        const node = {
          id,
          x: action.x,
          y: action.y,
          title: '',
          content: '',
          color: '#6366f1',
          collapsed: false,
          z: w.nextZ,
        };
        let edge;
        if (action.fromType === 'output') {
          edge = { id: uid('e'), fromNode: action.fromNode, fromType: 'output', toNode: id, toType: 'input' };
        } else {
          edge = { id: uid('e'), fromNode: id, fromType: 'output', toNode: action.fromNode, toType: 'input' };
        }
        return { ...w, nodes: [...w.nodes, node], edges: [...w.edges, edge], nextZ: w.nextZ + 1 };
      });
    case 'UPDATE_NODE':
      return withActiveGraph(state, (w) => ({
        ...w,
        nodes: w.nodes.map((n) => (n.id === action.id ? { ...n, ...action.patch } : n)),
      }));
    case 'DELETE_NODE':
      return withActiveGraph(state, (w) => ({
        ...w,
        nodes: w.nodes.filter((n) => n.id !== action.id),
        edges: w.edges.filter((e) => e.fromNode !== action.id && e.toNode !== action.id),
      }));
    case 'BRING_TO_FRONT':
      return withActiveGraph(state, (w) => ({
        ...w,
        nodes: w.nodes.map((n) => (n.id === action.id ? { ...n, z: w.nextZ } : n)),
        nextZ: w.nextZ + 1,
      }));
    case 'ADD_EDGE': {
      if (action.fromNode === action.toNode || action.fromType === action.toType) return state;
      return withActiveGraph(state, (w) => {
        const exists = w.edges.some(
          (e) =>
            (e.fromNode === action.fromNode &&
              e.toNode === action.toNode &&
              e.fromType === action.fromType &&
              e.toType === action.toType) ||
            (e.fromNode === action.toNode &&
              e.toNode === action.fromNode &&
              e.fromType === action.toType &&
              e.toType === action.fromType)
        );
        if (exists) return w;
        return {
          ...w,
          edges: [
            ...w.edges,
            { id: uid('e'), fromNode: action.fromNode, fromType: action.fromType, toNode: action.toNode, toType: action.toType },
          ],
        };
      });
    }
    case 'DELETE_EDGE':
      return withActiveGraph(state, (w) => ({
        ...w,
        edges: w.edges.filter((e) => e.id !== action.id),
      }));
    case 'CLEAR_CONTENT':
      return withActiveGraph(state, (w) => ({ ...w, nodes: [], edges: [], nextZ: 1 }));
    default:
      return state;
  }
}

export function useWorkspaces() {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* ignore quota errors */
    }
  }, [state]);

  const active =
    state.workspaces.find((w) => w.id === state.activeId) || state.workspaces[0];

  return { state, dispatch, active };
}