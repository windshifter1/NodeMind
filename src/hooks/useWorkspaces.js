import { useReducer, useEffect, useRef, useState, useCallback } from 'react';
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
  isSingleInputTransformNode,
  isSubstituteNode,
  usesInputSlots,
} from '@/lib/nodeTypes';
import {
  ensureSubstituteSlotCapacity,
  hasInboundEdgeOnSlot,
} from '@/lib/substituteSlots';
import { ensureGraphSlotCapacity } from '@/lib/graphSlots';
import { normalizeBackgroundArt } from '@/lib/backgroundArt';
import { collectReferencedFileIds } from '@/lib/fileRefs';
import { sweepOrphanBlobs } from '@/lib/mediaStore';
import {
  clearLegacyGraphKeys,
  emptyPersistMeta,
  loadRawDocument,
  requestPersistentStorage,
  saveWorkspaceDocument,
} from '@/lib/workspaceStore';

function ensureSlottedCapacity(host, inputSlot) {
  if (isSubstituteNode(host)) return ensureSubstituteSlotCapacity(host, inputSlot);
  if (isGraphNode(host)) return ensureGraphSlotCapacity(host, inputSlot);
  return null;
}

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
  backgroundArt,
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
    backgroundArt: normalizeBackgroundArt(backgroundArt),
  };
}

function createEmptyDocument() {
  const ws = newWorkspace({ name: 'My Canvas' });
  return { workspaces: [ws], activeId: ws.id };
}

export function normalizeDocument(raw) {
  if (raw && Array.isArray(raw.workspaces) && raw.workspaces.length) {
    const workspaces = raw.workspaces.map((ws) => ({
      ...migrateWorkspaceNodeIds(ws),
      terminal: normalizeTerminal(ws.terminal),
      backgroundArt: normalizeBackgroundArt(ws.backgroundArt),
    }));
    const activeId = workspaces.some((w) => w.id === raw.activeId)
      ? raw.activeId
      : workspaces[0].id;
    return { workspaces, activeId };
  }
  return createEmptyDocument();
}

function withActiveGraph(state, fn) {
  return {
    ...state,
    workspaces: state.workspaces.map((w) => (w.id === state.activeId ? fn(w) : w)),
  };
}

function placeholderDocument() {
  return { workspaces: [], activeId: null };
}

function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return action.state && Array.isArray(action.state.workspaces)
        ? action.state
        : normalizeDocument(action.state);
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
        backgroundArt: action.workspace?.backgroundArt,
      });
      if (action.workspace?.id) ws.id = action.workspace.id;
      const workspaces = action.prepend ? [ws, ...state.workspaces] : [...state.workspaces, ws];
      return { workspaces, activeId: action.activate === false ? state.activeId : ws.id };
    }
    case 'IMPORT_WORKSPACES': {
      const incoming = (action.workspaces || [])
        .filter((raw) => raw && typeof raw === 'object')
        .map((raw) =>
          migrateWorkspaceNodeIds(
            newWorkspace({
              name: raw.name || 'Imported',
              colour: raw.colour,
              icon: raw.icon,
              orientation: raw.orientation,
              layoutOnOrientationChange: raw.layoutOnOrientationChange,
              layoutSettings: raw.layoutSettings,
              nodes: raw.nodes,
              edges: raw.edges,
              nextZ: raw.nextZ,
              terminal: raw.terminal,
              backgroundArt: raw.backgroundArt,
            })
          )
        );
      if (!incoming.length) return state;
      return {
        workspaces: [...state.workspaces, ...incoming],
        activeId: incoming[0].id,
      };
    }
    case 'IMPORT_AS_WORKSPACE': {
      const meta = (action.data && action.data.workspace) || {};
      return reducer(state, {
        type: 'IMPORT_WORKSPACES',
        workspaces: [
          {
            ...meta,
            nodes: action.data && action.data.nodes,
            edges: action.data && action.data.edges,
            nextZ: action.data && action.data.nextZ,
            terminal: action.data?.terminal ?? meta.terminal,
            backgroundArt: action.data?.backgroundArt ?? meta.backgroundArt,
          },
        ],
      });
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
          if (host && (isMathNode(host) || isSingleInputTransformNode(host))) {
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
        if (targetNode && (isMathNode(targetNode) || isSingleInputTransformNode(targetNode))) {
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
    case 'UPDATE_BACKGROUND_ART':
      return withActiveGraph(state, (w) => ({
        ...w,
        backgroundArt: normalizeBackgroundArt({
          ...normalizeBackgroundArt(w.backgroundArt),
          ...(action.patch || {}),
        }),
      }));
    case 'CLEAR_CONTENT':
      return withActiveGraph(state, (w) => ({
        ...w,
        nodes: [],
        edges: [],
        nextZ: 1,
        backgroundArt: normalizeBackgroundArt(null),
      }));
    default:
      return state;
  }
}

export function useWorkspaces() {
  const [state, dispatch] = useReducer(reducer, undefined, placeholderDocument);
  const [ready, setReady] = useState(false);
  const [persistStatus, setPersistStatus] = useState(() => emptyPersistMeta());
  const persistRequestedRef = useRef(false);
  const latestStateRef = useRef(state);
  const writingRef = useRef(false);
  const userMutationRef = useRef(false);
  latestStateRef.current = state;

  const persistNow = useCallback(async (nextState) => {
    if (nextState) latestStateRef.current = nextState;
    if (writingRef.current) {
      writingRef.current = 'pending';
      return { ok: true, meta: emptyPersistMeta(), skipped: true };
    }
    writingRef.current = true;
    let result = { ok: false, meta: emptyPersistMeta() };
    try {
      do {
        writingRef.current = true;
        const snapshot = latestStateRef.current;
        result = await saveWorkspaceDocument(snapshot);
        setPersistStatus(result.meta);
        if (result.ok) {
          try {
            await sweepOrphanBlobs(collectReferencedFileIds(snapshot.workspaces));
          } catch {
            /* GC must not fail a successful save */
          }
          if (!persistRequestedRef.current) {
            persistRequestedRef.current = true;
            requestPersistentStorage()
              .then((outcome) => {
                if (outcome.persisted) {
                  setPersistStatus((prev) => ({ ...prev, persisted: true }));
                }
              })
              .catch(() => {});
          }
        }
      } while (writingRef.current === 'pending');
    } finally {
      writingRef.current = false;
    }
    return result;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadRawDocument();
        if (cancelled) return;
        const document = normalizeDocument(loaded.raw);
        latestStateRef.current = document;
        userMutationRef.current = false;
        dispatch({ type: 'HYDRATE', state: document });
        const meta = loaded.meta || emptyPersistMeta();
        setPersistStatus(meta);
        if (meta.persisted) persistRequestedRef.current = true;
        else {
          requestPersistentStorage()
            .then((outcome) => {
              if (outcome.persisted) {
                persistRequestedRef.current = true;
                setPersistStatus((prev) => ({ ...prev, persisted: true }));
              }
            })
            .catch(() => {});
        }
        if (loaded.source !== 'idb') {
          userMutationRef.current = true;
          const saved = await persistNow(document);
          if (saved.ok && loaded.source === 'localStorage') {
            clearLegacyGraphKeys();
          }
        }
      } catch {
        if (cancelled) return;
        const document = normalizeDocument(null);
        latestStateRef.current = document;
        userMutationRef.current = false;
        dispatch({ type: 'HYDRATE', state: document });
        setPersistStatus({
          ...emptyPersistMeta(),
          lastError: 'Could not restore workspaces from this browser.',
        });
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [persistNow]);

  const dispatchUser = useCallback((action) => {
    if (action?.type !== 'HYDRATE') userMutationRef.current = true;
    dispatch(action);
  }, []);

  useEffect(() => {
    if (!ready || !userMutationRef.current) return undefined;
    const id = window.setTimeout(() => {
      persistNow(state);
    }, 200);
    return () => window.clearTimeout(id);
  }, [state, ready, persistNow]);

  const retrySave = useCallback(() => persistNow(latestStateRef.current), [persistNow]);

  const active =
    state.workspaces.find((w) => w.id === state.activeId) || state.workspaces[0] || null;

  return { ready, state, dispatch: dispatchUser, active, persistStatus, retrySave };
}