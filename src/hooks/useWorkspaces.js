import { useReducer, useEffect } from 'react';
import {
  migrateWorkspaceNodeIds,
  nextNumericNodeId,
  normalizeLayoutOnOrientationChange,
  normalizeLayoutSettings,
  normalizeOrientation,
} from '@/lib/canvasConstants';
import {
  connectionInputSlot,
  connectionInputTarget,
  hasInboundEdge,
} from '@/lib/graphEdges';
import {
  allowsMultipleInputs,
  fieldsForKind,
  isGraphNode,
  isMathNode,
  isSubstituteNode,
  usesInputSlots,
} from '@/lib/nodeTypes';
import {
  ensureSubstituteSlotCapacity,
  hasInboundEdgeOnSlot,
} from '@/lib/substituteSlots';
import { ensureGraphSlotCapacity } from '@/lib/graphSlots';

function ensureSlottedCapacity(host, inputSlot) {
  if (isSubstituteNode(host)) return ensureSubstituteSlotCapacity(host, inputSlot);
  if (isGraphNode(host)) return ensureGraphSlotCapacity(host, inputSlot);
  return null;
}

const STORAGE_KEY = 'thoughts-canvas-workspaces-v2';
const LEGACY_KEY = 'thoughts-canvas-graph-v1';

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeTerminal(terminal) {
  const t = terminal && typeof terminal === 'object' ? terminal : {};
  return {
    lines: Array.isArray(t.lines) ? t.lines.map((line) => String(line)).slice(-500) : [],
    history: Array.isArray(t.history) ? t.history.map((line) => String(line)).slice(-80) : [],
    cwdId: typeof t.cwdId === 'string' && t.cwdId ? t.cwdId : null,
    welcomeHidden: Boolean(t.welcomeHidden),
  };
}

function newWorkspace({
  name,
  colour,
  icon,
  orientation,
  layoutOnOrientationChange,
  layoutSettings,
  nodes,
  edges,
  nextZ,
  terminal,
} = {}) {
  return {
    id: uid('w'),
    name: name || 'Untitled',
    colour: colour || '#6366f1',
    icon: icon || 'note',
    orientation: normalizeOrientation(orientation),
    layoutOnOrientationChange: normalizeLayoutOnOrientationChange(layoutOnOrientationChange),
    layoutSettings: normalizeLayoutSettings(layoutSettings),
    nodes: Array.isArray(nodes) ? nodes : [],
    edges: Array.isArray(edges) ? edges : [],
    nextZ: typeof nextZ === 'number' ? nextZ : 1,
    terminal: normalizeTerminal(terminal),
  };
}

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.workspaces) && parsed.workspaces.length) {
        return {
          ...parsed,
          workspaces: parsed.workspaces.map((ws) => ({
            ...migrateWorkspaceNodeIds(ws),
            terminal: normalizeTerminal(ws.terminal),
          })),
        };
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
      const ws = migrateWorkspaceNodeIds(
        newWorkspace({
          name: 'My Canvas',
          nodes: g.nodes,
          edges: g.edges,
          nextZ: g.nextZ,
        })
      );
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
      const ws = newWorkspace({
        name: action.workspace?.name || `Workspace ${state.workspaces.length + 1}`,
        colour: action.workspace?.colour,
        icon: action.workspace?.icon,
        orientation: action.workspace?.orientation,
        layoutOnOrientationChange: action.workspace?.layoutOnOrientationChange,
        layoutSettings: action.workspace?.layoutSettings,
        nodes: action.workspace?.nodes,
        edges: action.workspace?.edges,
        nextZ: action.workspace?.nextZ,
        terminal: action.workspace?.terminal,
      });
      if (action.workspace?.id) ws.id = action.workspace.id;
      const workspaces = action.prepend ? [ws, ...state.workspaces] : [...state.workspaces, ws];
      return { workspaces, activeId: action.activate === false ? state.activeId : ws.id };
    }
    case 'IMPORT_AS_WORKSPACE': {
      const meta = (action.data && action.data.workspace) || {};
      const ws = migrateWorkspaceNodeIds(
        newWorkspace({
          name: meta.name || 'Imported',
          colour: meta.colour,
          icon: meta.icon,
          orientation: meta.orientation,
          layoutOnOrientationChange: meta.layoutOnOrientationChange,
          layoutSettings: meta.layoutSettings,
          nodes: action.data && action.data.nodes,
          edges: action.data && action.data.edges,
          nextZ: action.data && action.data.nextZ,
          terminal: action.data?.terminal ?? meta.terminal,
        })
      );
      return { workspaces: [...state.workspaces, ws], activeId: ws.id };
    }
    case 'SET_WORKSPACE_TERMINAL':
      return withActiveGraph(state, (w) => ({
        ...w,
        terminal: normalizeTerminal(action.terminal),
      }));
    case 'DELETE_WORKSPACE': {
      const remaining = state.workspaces.filter((w) => w.id !== action.id);
      if (remaining.length === 0) {
        const ws = newWorkspace({ name: 'My Canvas' });
        return { workspaces: [ws], activeId: ws.id };
      }
      const activeId = state.activeId === action.id ? remaining[0].id : state.activeId;
      return { workspaces: remaining, activeId };
    }
    case 'DELETE_WORKSPACES_BY_PREFIX': {
      const prefix = String(action.prefix || '');
      if (!prefix) return state;
      const remaining = state.workspaces.filter((w) => !String(w.id).startsWith(prefix));
      if (remaining.length === state.workspaces.length) return state;
      if (remaining.length === 0) {
        const ws = newWorkspace({ name: 'My Canvas' });
        return { workspaces: [ws], activeId: ws.id };
      }
      const activeId = remaining.some((w) => w.id === state.activeId)
        ? state.activeId
        : remaining[0].id;
      return { workspaces: remaining, activeId };
    }
    case 'RESET_ALL_WORKSPACES': {
      const ws = newWorkspace({ name: 'My Canvas' });
      return { workspaces: [ws], activeId: ws.id };
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

    case 'REPLACE_ACTIVE_WORKSPACE':
      return withActiveGraph(state, (w) => ({
        ...w,
        ...action.workspace,
        id: w.id,
      }));

    case 'ADD_NODE':
      return withActiveGraph(state, (w) => {
        const now = new Date().toISOString();
        return {
          ...w,
          nodes: [
            ...w.nodes,
            {
              id: nextNumericNodeId(w.nodes),
              x: action.x,
              y: action.y,
              ...fieldsForKind(action.kind),
              ...(action.mode ? { mode: action.mode } : {}),
              color: '#6366f1',
              collapsed: false,
              pinned: false,
              parentId: action.parentId || null,
              z: w.nextZ,
              createdAt: now,
              updatedAt: now,
            },
          ],
          nextZ: w.nextZ + 1,
        };
      });
    case 'ADD_CONNECTED_NODE':
      return withActiveGraph(state, (w) => {
        // Dragging from an input socket onto empty canvas would feed a new node
        // into that input — most Math nodes only accept one inbound edge.
        const inputSlot = action.inputSlot || null;
        if (action.fromType === 'input') {
          const host = w.nodes.find((n) => n.id === action.fromNode);
          if (host && isMathNode(host)) {
            if (usesInputSlots(host)) {
              if (inputSlot && hasInboundEdgeOnSlot(w.edges, host.id, inputSlot)) return w;
            } else if (!allowsMultipleInputs(host) && hasInboundEdge(w.edges, host.id)) {
              return w;
            }
          }
        }
        const now = new Date().toISOString();
        const id = nextNumericNodeId(w.nodes);
        const node = {
          id,
          x: action.x,
          y: action.y,
          ...fieldsForKind(action.kind),
          ...(action.mode ? { mode: action.mode } : {}),
          ...(action.fields || {}),
          color: '#6366f1',
          collapsed: false,
          pinned: false,
          parentId: action.fromNode || null,
          z: w.nextZ,
          createdAt: now,
          updatedAt: now,
        };
        // New slotted nodes receive the first inbound edge on slot A.
        const newNodeSlot =
          action.fromType === 'output' && usesInputSlots(node) ? 'A' : null;
        const edgeSlot = action.fromType === 'input' ? inputSlot : newNodeSlot;
        let edge;
        if (action.fromType === 'output') {
          edge = {
            id: uid('e'),
            fromNode: action.fromNode,
            fromType: 'output',
            toNode: id,
            toType: 'input',
            ...(edgeSlot ? { inputSlot: edgeSlot } : {}),
          };
        } else {
          edge = {
            id: uid('e'),
            fromNode: id,
            fromType: 'output',
            toNode: action.fromNode,
            toType: 'input',
            ...(edgeSlot ? { inputSlot: edgeSlot } : {}),
          };
        }
        let nodes = [...w.nodes, node];
        if (action.fromType === 'input' && inputSlot) {
          const host = w.nodes.find((n) => n.id === action.fromNode);
          const cap = ensureSlottedCapacity(host, inputSlot);
          if (cap) {
            nodes = nodes.map((n) =>
              n.id === host.id ? { ...n, ...cap, updatedAt: now } : n
            );
          }
        }
        return { ...w, nodes, edges: [...w.edges, edge], nextZ: w.nextZ + 1 };
      });
    case 'UPDATE_NODE':
      return withActiveGraph(state, (w) => ({
        ...w,
        nodes: w.nodes.map((n) =>
          n.id === action.id ? { ...n, ...action.patch, updatedAt: new Date().toISOString() } : n
        ),
      }));
    case 'DELETE_NODE':
      return withActiveGraph(state, (w) => ({
        ...w,
        nodes: w.nodes.filter((n) => n.id !== action.id),
        edges: w.edges.filter((e) => e.fromNode !== action.id && e.toNode !== action.id),
      }));
    case 'DELETE_NODES': {
      const ids = new Set(action.ids || []);
      if (!ids.size) return state;
      return withActiveGraph(state, (w) => ({
        ...w,
        nodes: w.nodes.filter((n) => !ids.has(n.id)),
        edges: w.edges.filter((e) => !ids.has(e.fromNode) && !ids.has(e.toNode)),
      }));
    }
    case 'BRING_TO_FRONT':
      return withActiveGraph(state, (w) => ({
        ...w,
        nodes: w.nodes.map((n) => (n.id === action.id ? { ...n, z: w.nextZ } : n)),
        nextZ: w.nextZ + 1,
      }));
    case 'ADD_EDGE': {
      if (action.fromNode === action.toNode || action.fromType === action.toType) return state;
      return withActiveGraph(state, (w) => {
        const inputSlot = connectionInputSlot(
          action.fromType,
          action.toType,
          action.fromSlot,
          action.toSlot
        );
        const exists = w.edges.some((e) => {
          const sameEndpoints =
            (e.fromNode === action.fromNode &&
              e.toNode === action.toNode &&
              e.fromType === action.fromType &&
              e.toType === action.toType) ||
            (e.fromNode === action.toNode &&
              e.toNode === action.fromNode &&
              e.fromType === action.toType &&
              e.toType === action.fromType);
          if (!sameEndpoints) return false;
          // Slotted edges only collide when they share the same slot.
          if (inputSlot || e.inputSlot) return (e.inputSlot || null) === (inputSlot || null);
          return true;
        });
        if (exists) return w;
        const inputTarget = connectionInputTarget(
          action.fromNode,
          action.fromType,
          action.toNode,
          action.toType
        );
        const targetNode = inputTarget ? w.nodes.find((n) => n.id === inputTarget) : null;
        if (targetNode && isMathNode(targetNode)) {
          if (usesInputSlots(targetNode)) {
            if (!inputSlot || hasInboundEdgeOnSlot(w.edges, inputTarget, inputSlot)) return w;
          } else if (!allowsMultipleInputs(targetNode) && hasInboundEdge(w.edges, inputTarget)) {
            return w;
          }
        }
        let nodes = w.nodes;
        if (targetNode && usesInputSlots(targetNode) && inputSlot) {
          const cap = ensureSlottedCapacity(targetNode, inputSlot);
          if (cap) {
            const now = new Date().toISOString();
            nodes = nodes.map((n) =>
              n.id === targetNode.id ? { ...n, ...cap, updatedAt: now } : n
            );
          }
        }
        return {
          ...w,
          nodes,
          edges: [
            ...w.edges,
            {
              id: uid('e'),
              fromNode: action.fromNode,
              fromType: action.fromType,
              toNode: action.toNode,
              toType: action.toType,
              ...(inputSlot ? { inputSlot } : {}),
            },
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