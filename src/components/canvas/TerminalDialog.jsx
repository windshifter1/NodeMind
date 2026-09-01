import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GraduationCap, Terminal, X } from 'lucide-react';
import {
  allocateNumericNodeIds,
  layoutBranchByOrientation,
  nextChildGraphPosition,
  nextNumericNodeId,
  normalizeOrientation,
} from '@/lib/canvasConstants';
import {
  getVersionBumpHintLines,
  getVersionHelpLines,
  getVersionReportLines,
} from '@/lib/appVersion';
import { isDesktopPlatform } from '@/lib/onboarding';
import { normalizeTerminal } from '@/hooks/useWorkspaces';
import { fieldsForKind, isNumberNode, nodeTypeLabel } from '@/lib/nodeTypes';
import { COMMAND_NAMES, HELP_ALL, helpFor } from '@/lib/terminal/help';
import { commandMatchesStep, getTerminalTutorialSteps } from '@/lib/terminal/tutorial';
import TerminalTutorial from './TerminalTutorial';

const COLORS = {
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#f59e0b',
  green: '#10b981',
  cyan: '#06b6d4',
  blue: '#6366f1',
  purple: '#8b5cf6',
  pink: '#ec4899',
  gray: '#64748b',
  grey: '#64748b',
};

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function quoteAwareSplit(input) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && /\s/.test(ch)) {
      if (cur) {
        out.push(cur);
        cur = '';
      }
      continue;
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function normaliseTitle(value) {
  return (value || '').trim() || 'Untitled';
}

function displayId(_nodes, id) {
  if (/^0*\d+$/.test(id)) return String(Number(id)).padStart(3, '0');
  return id;
}

function matchNodeId(nodes, token) {
  if (!token) return null;
  if (/^\d+$/.test(token)) {
    const padded = String(Number(token)).padStart(3, '0');
    const byId = nodes.find((node) => node.id === padded);
    if (byId) return byId.id;
    const index = Number(token) - 1;
    if (index >= 0 && nodes[index]) return nodes[index].id;
  }
  const exact = nodes.find((node) => node.id === token);
  if (exact) return exact.id;
  const titled = nodes.find((node) => normaliseTitle(node.title).toLowerCase() === token.toLowerCase());
  return titled ? titled.id : null;
}

function childrenOf(nodes, parentId) {
  return nodes.filter((node) => (node.parentId || null) === (parentId || null));
}

function branchIds(nodes, rootId) {
  const ids = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    nodes.forEach((node) => {
      if (!ids.has(node.id) && ids.has(node.parentId)) {
        ids.add(node.id);
        changed = true;
      }
    });
  }
  return ids;
}

function nodePath(nodes, nodeId) {
  if (!nodeId) return [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const parts = [];
  let cur = byId.get(nodeId);
  const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    parts.unshift(normaliseTitle(cur.title));
    cur = byId.get(cur.parentId);
  }
  return parts;
}

function resolvePath(nodes, cwdId, rawPath) {
  const path = (rawPath || '').trim();
  if (!path || path === '.') return cwdId;
  if (path === '\\') return null;
  let current = path.startsWith('\\') ? null : cwdId;
  const parts = path.replace(/^\\/, '').split('\\').filter(Boolean);
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      current = nodes.find((node) => node.id === current)?.parentId || null;
      continue;
    }
    const next = childrenOf(nodes, current).find(
      (node) => normaliseTitle(node.title).toLowerCase() === part.toLowerCase()
    );
    if (!next) return undefined;
    current = next.id;
  }
  return current;
}

function cloneBranch(nodes, rootId, parentId, origin, orientation) {
  const ids = branchIds(nodes, rootId);
  const newIds = allocateNumericNodeIds(nodes, ids.size);
  const idMap = new Map([...ids].map((id, index) => [id, newIds[index]]));
  const clones = nodes
    .filter((node) => ids.has(node.id))
    .map((node) => ({
      ...node,
      id: idMap.get(node.id),
      parentId: node.id === rootId ? parentId : idMap.get(node.parentId),
      x: node.x + 80,
      y: node.y + 80,
      z: node.z || 1,
    }));
  return layoutBranchByOrientation([...nodes, ...clones], idMap.get(rootId), origin, orientation);
}

/** Normalize curly/smart quotes from mobile keyboards to ASCII quotes. */
function normalizeQuotes(value) {
  return String(value || '')
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
}

function normalizeCommandLine(input) {
  return normalizeQuotes(input).trim().replace(/^cd\.\./i, 'cd ..');
}

function commandKey(token) {
  const key = token.toLowerCase();
  if (key === 'description') return 'desc';
  if (key === 'colour') return 'color';
  return key;
}

function formatNode(nodes, node) {
  const id = displayId(nodes, node.id);
  const lines = [
    `Title: ${normaliseTitle(node.title)}`,
    `ID: ${id}`,
    `Type: ${nodeTypeLabel(node.kind)}`,
    `Path: \\${nodePath(nodes, node.id).join('\\')}`,
    `Colour: ${node.color || '#6366f1'}`,
  ];
  if (isNumberNode(node)) {
    lines.push(node.value === '' || node.value == null ? 'Value: (empty)' : `Value: ${node.value}`);
  } else {
    lines.push(node.content ? `Description: ${node.content}` : 'Description: (empty)');
  }
  return lines;
}

function unquote(value) {
  const trimmed = normalizeQuotes(value).trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function isQuoted(value) {
  const trimmed = normalizeQuotes(value).trim();
  return trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2;
}

function requireQuoted(rest, write) {
  if (!isQuoted(rest)) {
    write('Expected ""');
    return false;
  }
  return true;
}

function requireQuotedOrHex(rest, write) {
  const trimmed = (rest || '').trim();
  if (trimmed.startsWith('#')) return true;
  return requireQuoted(rest, write);
}

function formatUtcNow() {
  const now = new Date();
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getUTCFullYear());
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const min = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss} UTC`;
}

function nodeDates(node) {
  return [node.createdAt, node.updatedAt]
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()));
}

function formatDDMMYY(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear() % 100).padStart(2, '0');
  return `${dd}/${mm}/${yy}`;
}

function formatMMYY(date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear() % 100).padStart(2, '0');
  return `${mm}/${yy}`;
}

function formatYY(date) {
  return String(date.getFullYear() % 100).padStart(2, '0');
}

function normalizeDateToken(value) {
  return value
    .split('/')
    .map((part) => part.padStart(2, '0'))
    .join('/');
}

function matchesDateQuery(node, query) {
  const q = query.trim();
  if (!q) return false;
  const dates = nodeDates(node);
  if (!dates.length) return false;

  return dates.some((date) => {
    const ddmmyy = formatDDMMYY(date);
    const mmyy = formatMMYY(date);
    const yy = formatYY(date);

    if (/^\d{1,2}$/.test(q)) {
      return yy === q.padStart(2, '0');
    }
    if (/^\d{1,2}\/\d{1,2}$/.test(q)) {
      return mmyy === normalizeDateToken(q);
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{1,2}$/.test(q)) {
      return ddmmyy === normalizeDateToken(q);
    }
    return false;
  });
}

function renderTerminalLine(line) {
  if (typeof line !== 'string') return line;

  // Echoed command lines: "Workspace 3:\> dir" — bold the prompt for scanability.
  const promptEcho = line.match(/^(.+?:\\.*?>)(\s)(.*)$/);
  if (promptEcho) {
    return (
      <>
        <strong className="font-semibold text-nm-terminal-text">{promptEcho[1]}</strong>
        {promptEcho[2]}
        {promptEcho[3]}
      </>
    );
  }

  const marker = 'Example:';
  const idx = line.indexOf(marker);
  if (idx === -1) return line;
  return (
    <>
      {line.slice(0, idx)}
      <strong className="font-semibold text-nm-terminal-text">{marker}</strong>
      {line.slice(idx + marker.length)}
    </>
  );
}

function completeCommandToken(token) {
  if (!token) return null;
  const lower = token.toLowerCase();
  const hits = COMMAND_NAMES.filter((name) => name.startsWith(lower));
  if (!hits.length) return null;
  if (hits.length === 1) return hits[0];
  const shared = hits.reduce((prefix, name) => {
    let i = 0;
    while (i < prefix.length && i < name.length && prefix[i] === name[i]) i += 1;
    return prefix.slice(0, i);
  });
  return shared.length > lower.length ? shared : null;
}

/** Complete the first token when the line has no spaces yet. Returns next value or null. */
function autocompleteFirstToken(value) {
  const trimmed = String(value || '');
  if (!trimmed || /\s/.test(trimmed)) return null;
  const completed = completeCommandToken(trimmed);
  if (!completed) return null;
  if (completed.toLowerCase() === trimmed.toLowerCase()) return null;
  return completed;
}

function isMobileKeyboardOpen() {
  const vv = window.visualViewport;
  if (!vv) return false;
  const frameH = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--app-frame-height')
  ) || 0;
  const layoutH = Math.max(frameH, window.innerHeight || 0, document.documentElement?.clientHeight || 0);
  if (layoutH < 80) return false;
  return vv.height < layoutH * 0.82 || layoutH - vv.height > 120;
}

export default function TerminalDialog({
  open,
  onClose,
  workspace,
  dispatch,
  onExport,
  onImport,
  onArrange,
  orientation,
  onTutorialStart,
  onTutorialEnd,
}) {
  const initialTerminal = normalizeTerminal(workspace?.terminal);
  const [cwdId, setCwdId] = useState(initialTerminal.cwdId);
  const [input, setInput] = useState('');
  const [lines, setLines] = useState(initialTerminal.lines);
  const [welcomeHidden, setWelcomeHidden] = useState(initialTerminal.welcomeHidden);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [history, setHistory] = useState(initialTerminal.history);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialIndex, setTutorialIndex] = useState(0);
  const [keyboardViewport, setKeyboardViewport] = useState(null);
  const inputRef = useRef(null);
  const formRef = useRef(null);
  const scrollRef = useRef(null);
  const linesRef = useRef([]);
  const skipTerminalPersistRef = useRef(true);
  const activeWorkspaceIdRef = useRef(workspace?.id);

  const platform = useMemo(() => (isDesktopPlatform() ? 'desktop' : 'mobile'), []);
  const tutorialSteps = useMemo(() => getTerminalTutorialSteps(platform), [platform]);
  const tutorialStep = tutorialOpen ? tutorialSteps[tutorialIndex] || null : null;

  const nodes = workspace.nodes || [];
  const graphOrientation = normalizeOrientation(orientation || workspace.orientation);
  const pathParts = nodePath(nodes, cwdId);
  const prompt = `${workspace.name || 'Workspace'}:\\${pathParts.join('\\')}>`;

  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  // Hydrate this workspace's dedicated terminal session when the active board changes.
  useEffect(() => {
    const terminal = normalizeTerminal(workspace.terminal);
    const nodeIds = new Set((workspace.nodes || []).map((node) => node.id));
    skipTerminalPersistRef.current = true;
    activeWorkspaceIdRef.current = workspace.id;
    setLines(terminal.lines);
    setHistory(terminal.history);
    setCwdId(terminal.cwdId && nodeIds.has(terminal.cwdId) ? terminal.cwdId : null);
    setWelcomeHidden(terminal.welcomeHidden);
    setHistoryIndex(-1);
    setInput('');
    setConfirmDeleteId(null);
  }, [workspace.id]); // eslint-disable-line react-hooks/exhaustive-deps -- hydrate only on workspace switch

  // Persist terminal output / command history onto the active workspace.
  useEffect(() => {
    if (skipTerminalPersistRef.current) {
      skipTerminalPersistRef.current = false;
      return;
    }
    if (activeWorkspaceIdRef.current !== workspace.id) return;
    dispatch({
      type: 'SET_WORKSPACE_TERMINAL',
      terminal: { lines, history, cwdId, welcomeHidden },
    });
  }, [lines, history, cwdId, welcomeHidden, dispatch, workspace.id]);

  useEffect(() => {
    if (open) {
      setTutorialOpen(false);
      setTutorialIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setKeyboardViewport(null);
    }
  }, [open]);

  // If the dialog is closed while a tutorial is active, tear down its workspace.
  // The restored workspace's terminal is reloaded by the hydrate effect above.
  const tutorialOpenRef = useRef(false);
  useEffect(() => {
    tutorialOpenRef.current = tutorialOpen;
  }, [tutorialOpen]);

  useEffect(() => {
    if (open) return undefined;
    if (!tutorialOpenRef.current) return undefined;
    tutorialOpenRef.current = false;
    setTutorialOpen(false);
    setTutorialIndex(0);
    setConfirmDeleteId(null);
    onTutorialEnd?.();
    return undefined;
  }, [open, onTutorialEnd]);

  // Lift the dialog into the visual viewport when the soft keyboard opens (mobile).
  useEffect(() => {
    if (!open || platform !== 'mobile') {
      setKeyboardViewport(null);
      return undefined;
    }

    const sync = () => {
      const vv = window.visualViewport;
      if (!vv || !isMobileKeyboardOpen()) {
        setKeyboardViewport(null);
        return;
      }
      setKeyboardViewport({
        top: Math.round(vv.offsetTop),
        left: Math.round(vv.offsetLeft),
        width: Math.round(vv.width),
        height: Math.round(vv.height),
      });
    };

    sync();
    window.addEventListener('resize', sync);
    window.visualViewport?.addEventListener('resize', sync);
    window.visualViewport?.addEventListener('scroll', sync);
    return () => {
      window.removeEventListener('resize', sync);
      window.visualViewport?.removeEventListener('resize', sync);
      window.visualViewport?.removeEventListener('scroll', sync);
    };
  }, [open, platform]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  useEffect(() => {
    if (cwdId && !nodes.some((node) => node.id === cwdId)) setCwdId(null);
  }, [cwdId, nodes]);

  const welcome = useMemo(
    () => [`NodeMind Terminal`, `Type help for commands, or tutorial to learn by doing.`, ''],
    []
  );

  const autocompleteGhost = useMemo(() => {
    if (!input || /\s/.test(input)) return '';
    const completed = completeCommandToken(input);
    if (!completed) return '';
    if (!completed.toLowerCase().startsWith(input.toLowerCase())) return '';
    if (completed.length <= input.length) return '';
    return completed.slice(input.length);
  }, [input]);

  if (!open) return null;

  const replaceWorkspace = (patch) => {
    dispatch({ type: 'REPLACE_ACTIVE_WORKSPACE', workspace: patch });
  };

  const write = (output) => {
    const values = Array.isArray(output) ? output : [output];
    setLines((prev) => [...prev, ...values]);
  };

  const echoCommand = (commandLine) => {
    setLines((prev) => {
      const next = [...prev];
      if (next.length > 0) {
        if (next[next.length - 1] !== '') next.push('');
      } else if (!welcomeHidden) {
        /* welcome already ends with a blank line */
      } else {
        /* cleared session — no leading blank needed */
      }
      next.push(`${prompt} ${commandLine}`);
      return next;
    });
  };

  const clearTerminalSession = () => {
    setLines([]);
    setWelcomeHidden(false);
    setCwdId(null);
    setConfirmDeleteId(null);
    setInput('');
    setHistoryIndex(-1);
  };

  const endTutorialSession = () => {
    setTutorialOpen(false);
    setTutorialIndex(0);
    setConfirmDeleteId(null);
    // Deletes the Tutorial board; hydrate restores the previous workspace terminal.
    onTutorialEnd?.();
  };

  const advanceTutorial = () => {
    if (tutorialIndex >= tutorialSteps.length - 1) {
      endTutorialSession();
      return;
    }
    setTutorialIndex((i) => i + 1);
  };

  const startTutorial = () => {
    // Creates a fresh Tutorial workspace that already carries the start message.
    onTutorialStart?.();
    setTutorialOpen(true);
    setTutorialIndex(0);
    setConfirmDeleteId(null);
    setInput('');
    setHistoryIndex(-1);
  };

  const run = (raw) => {
    const commandLine = normalizeCommandLine(raw);
    if (!commandLine) {
      echoCommand(commandLine);
      return;
    }

    setHistory((prev) => {
      if (prev[prev.length - 1] === commandLine) return prev;
      return [...prev, commandLine].slice(-80);
    });
    setHistoryIndex(-1);

    const [command = '', ...args] = quoteAwareSplit(commandLine);
    const rest = commandLine.slice(command.length).trim();
    const current = nodes.find((node) => node.id === cwdId) || null;
    const cmd = commandKey(command);
    const isTerminalClear = cmd === 'terminal' && args[0]?.toLowerCase() === 'clear';

    if (!isTerminalClear) {
      echoCommand(commandLine);
    }

    const requireCurrent = () => {
      if (!current) {
        write('No node selected.');
        return false;
      }
      return true;
    };

    if (cmd !== 'delete') setConfirmDeleteId(null);

    let handled = true;

    switch (cmd) {
      case 'help':
        if (args[0]) write(helpFor(args[0]) || [`No help for "${args[0]}".`]);
        else write(HELP_ALL);
        break;
      case 'tutorial':
        startTutorial();
        break;
      case 'terminal': {
        const sub = args[0]?.toLowerCase();
        switch (sub) {
          case 'exit':
            onClose();
            break;
          case 'clear':
            setLines([]);
            setWelcomeHidden(true);
            setConfirmDeleteId(null);
            requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0 }));
            break;
          case 'about':
            write('Developed by windshifter');
            break;
          case 'date':
            write(formatUtcNow());
            break;
          default:
            write('Unknown terminal command. Type help terminal.');
            handled = false;
        }
        break;
      }
      case 'dir': {
        const kids = childrenOf(nodes, cwdId);
        write(kids.length ? kids.map((node) => `${displayId(nodes, node.id)} ${normaliseTitle(node.title)}`) : '(no child nodes)');
        break;
      }
      case 'cd':
      case 'open': {
        const target = resolvePath(nodes, cwdId, rest || '\\');
        if (target === undefined) {
          write(`Path not found: ${rest}`);
          handled = false;
        } else setCwdId(target);
        break;
      }
      case 'info': {
        const flag = args[0]?.toLowerCase();
        if (flag === 'all') {
          write(nodes.length ? nodes.flatMap((node) => [...formatNode(nodes, node), '']) : 'No nodes.');
        } else if (flag === '/title') {
          const query = args.slice(1).join(' ').toLowerCase();
          const matches = nodes.filter((node) => normaliseTitle(node.title).toLowerCase().includes(query));
          write(matches.length ? matches.flatMap((node) => [...formatNode(nodes, node), '']) : 'No matches.');
        } else if (flag === '/id') {
          const id = matchNodeId(nodes, args[1]);
          const node = nodes.find((n) => n.id === id);
          write(node ? formatNode(nodes, node) : `ID not found: ${args[1]}`);
        } else if (current) write(formatNode(nodes, current));
        else {
          write('No node selected.');
          handled = false;
        }
        break;
      }
      case 'find': {
        const flag = args[0]?.startsWith('/') ? args[0].toLowerCase() : null;
        const query = (flag ? args.slice(1) : args).join(' ').toLowerCase();
        const matches = nodes.filter((node) => {
          if (flag === '/title') return normaliseTitle(node.title).toLowerCase().includes(query);
          if (flag === '/desc' || flag === '/description') return (node.content || '').toLowerCase().includes(query);
          if (flag === '/id') return node.id.includes(query) || displayId(nodes, node.id) === query;
          if (flag === '/date') return matchesDateQuery(node, query);
          return `${node.title || ''} ${node.content || ''} ${node.id}`.toLowerCase().includes(query);
        });
        write(matches.length ? matches.map((node) => `${displayId(nodes, node.id)} ${normaliseTitle(node.title)}`) : 'No matches.');
        break;
      }
      case 'title':
      case 'desc':
      case 'append':
      case 'prepend':
      case 'clear':
      case 'color': {
        if (!requireCurrent()) {
          handled = false;
          break;
        }
        const patch = { updatedAt: new Date().toISOString() };
        if (cmd === 'title') {
          if (!requireQuoted(rest, write)) {
            handled = false;
            break;
          }
          patch.title = unquote(rest);
        } else if (cmd === 'desc') {
          if (!requireQuoted(rest, write)) {
            handled = false;
            break;
          }
          patch.content = unquote(rest);
        } else if (cmd === 'append') {
          if (!requireQuoted(rest, write)) {
            handled = false;
            break;
          }
          const text = unquote(rest);
          patch.content = `${current.content || ''}${current.content ? '\n' : ''}${text}`;
        } else if (cmd === 'prepend') {
          if (!requireQuoted(rest, write)) {
            handled = false;
            break;
          }
          const text = unquote(rest);
          patch.content = `${text}${current.content ? '\n' : ''}${current.content || ''}`;
        } else if (cmd === 'clear') {
          const target = args[0]?.toLowerCase();
          patch[target === 'title' ? 'title' : 'content'] = '';
        } else if (cmd === 'color') {
          if (!requireQuotedOrHex(rest, write)) {
            handled = false;
            break;
          }
          const text = unquote(rest);
          patch.color = COLORS[text.toLowerCase()] || text;
        }
        replaceWorkspace({ nodes: nodes.map((node) => (node.id === current.id ? { ...node, ...patch } : node)) });
        write('Updated.');
        break;
      }
      case 'new': {
        if (!requireQuoted(rest, write)) {
          handled = false;
          break;
        }
        const title = unquote(rest) || 'Untitled';
        const pos = nextChildGraphPosition(nodes, cwdId, title, graphOrientation);
        const now = new Date().toISOString();
        const node = {
          id: nextNumericNodeId(nodes),
          x: pos.x,
          y: pos.y,
          ...fieldsForKind('note'),
          title,
          color: '#6366f1',
          collapsed: false,
          pinned: false,
          parentId: cwdId || null,
          z: workspace.nextZ || 1,
          createdAt: now,
          updatedAt: now,
        };
        replaceWorkspace({ nodes: [...nodes, node], nextZ: (workspace.nextZ || 1) + 1 });
        setCwdId(node.id);
        write(`Created ${displayId([...nodes, node], node.id)} ${title}`);
        break;
      }
      case 'duplicate':
      case 'copy': {
        if (!requireCurrent()) {
          handled = false;
          break;
        }
        const parentId = cmd === 'copy' ? resolvePath(nodes, cwdId, rest || '\\') : current.parentId || null;
        if (parentId === undefined) {
          write(`Path not found: ${rest}`);
          handled = false;
          break;
        }
        const pos = nextChildGraphPosition(nodes, parentId, current.title, graphOrientation);
        replaceWorkspace({
          nodes: cloneBranch(nodes, current.id, parentId, pos, graphOrientation),
          nextZ: (workspace.nextZ || 1) + branchIds(nodes, current.id).size,
        });
        write(cmd === 'copy' ? 'Copied branch.' : 'Duplicated branch.');
        break;
      }
      case 'move': {
        if (!requireCurrent()) {
          handled = false;
          break;
        }
        const parentId = resolvePath(nodes, cwdId, rest || '\\');
        if (parentId === undefined || parentId === current.id || branchIds(nodes, current.id).has(parentId)) {
          write('Invalid target.');
          handled = false;
          break;
        }
        const pos = nextChildGraphPosition(nodes, parentId, current.title, graphOrientation);
        const moved = nodes.map((node) => (node.id === current.id ? { ...node, parentId: parentId || null } : node));
        replaceWorkspace({ nodes: layoutBranchByOrientation(moved, current.id, pos, graphOrientation) });
        write('Moved branch.');
        break;
      }
      case 'delete': {
        if (!requireCurrent()) {
          handled = false;
          break;
        }
        if (confirmDeleteId !== current.id) {
          setConfirmDeleteId(current.id);
          write('Run delete again to confirm.');
          break;
        }
        const ids = branchIds(nodes, current.id);
        replaceWorkspace({
          nodes: nodes.filter((node) => !ids.has(node.id)),
          edges: workspace.edges.filter((edge) => !ids.has(edge.fromNode) && !ids.has(edge.toNode)),
        });
        setCwdId(current.parentId || null);
        setConfirmDeleteId(null);
        write('Deleted branch.');
        break;
      }
      case 'link':
      case 'unlink': {
        if (!requireCurrent()) {
          handled = false;
          break;
        }
        const targetId = matchNodeId(nodes, args[0]);
        if (!targetId || targetId === current.id) {
          write('Invalid target.');
          handled = false;
          break;
        }
        if (cmd === 'link') {
          const exists = workspace.edges.some((edge) => edge.fromNode === current.id && edge.toNode === targetId);
          if (!exists) {
            replaceWorkspace({
              edges: [...workspace.edges, { id: uid('e'), fromNode: current.id, fromType: 'output', toNode: targetId, toType: 'input' }],
            });
          }
          write('Linked.');
        } else {
          replaceWorkspace({
            edges: workspace.edges.filter(
              (edge) =>
                !(
                  (edge.fromNode === current.id && edge.toNode === targetId) ||
                  (edge.fromNode === targetId && edge.toNode === current.id)
                )
            ),
          });
          write('Unlinked.');
        }
        break;
      }
      case 'links': {
        if (!requireCurrent()) {
          handled = false;
          break;
        }
        const outgoing = workspace.edges.filter((edge) => edge.fromNode === current.id).map((edge) => nodes.find((n) => n.id === edge.toNode));
        const incoming = workspace.edges.filter((edge) => edge.toNode === current.id).map((edge) => nodes.find((n) => n.id === edge.fromNode));
        const outgoingLines = outgoing.filter(Boolean).map((node) => `  ${displayId(nodes, node.id)} ${normaliseTitle(node.title)}`);
        const incomingLines = incoming.filter(Boolean).map((node) => `  ${displayId(nodes, node.id)} ${normaliseTitle(node.title)}`);
        write([
          'Outgoing:',
          ...(outgoingLines.length ? outgoingLines : ['  (none)']),
          'Incoming:',
          ...(incomingLines.length ? incomingLines : ['  (none)']),
        ]);
        break;
      }
      case 'arrange':
        onArrange?.();
        write('Workspace arranged.');
        break;
      case 'export':
        onExport();
        write('Export started.');
        break;
      case 'import':
        onImport();
        write('Import picker opened.');
        break;
      case 'version': {
        const sub = args[0]?.toLowerCase();
        if (!sub) {
          write(getVersionReportLines());
          break;
        }
        if (sub === 'help' || sub === '--help' || sub === '-h') {
          write(getVersionHelpLines());
          break;
        }
        if (sub === 'bump') {
          write(getVersionBumpHintLines());
          break;
        }
        write([`Unknown version command: ${sub}.`, '', ...getVersionHelpLines()]);
        handled = false;
        break;
      }
      default:
        write(`Unknown command: ${command}. Type help.`);
        handled = false;
    }

    if (tutorialOpen && tutorialStep && commandMatchesStep(tutorialStep, commandLine) && handled) {
      window.setTimeout(() => advanceTutorial(), 120);
    } else if (tutorialOpen && tutorialStep?.expect?.kind === 'command' && !commandMatchesStep(tutorialStep, commandLine)) {
      /* keep going — wrong command does not advance */
    }
  };

  const onInputKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!history.length) return;
      const next = historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(next);
      setInput(history[next] || '');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex < 0) return;
      const next = historyIndex + 1;
      if (next >= history.length) {
        setHistoryIndex(-1);
        setInput('');
      } else {
        setHistoryIndex(next);
        setInput(history[next] || '');
      }
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const completed = autocompleteFirstToken(input);
      if (completed) setInput(completed);
      return;
    }
    // Mobile keyboards rarely expose Tab — Space accepts the ghost completion instead.
    if ((e.key === ' ' || e.code === 'Space') && platform === 'mobile') {
      const completed = autocompleteFirstToken(input);
      if (completed) {
        e.preventDefault();
        setInput(completed);
      }
    }
  };

  const onInputChange = (e) => {
    const value = e.target.value;
    // Some mobile browsers insert Space before keydown preventDefault can win.
    if (platform === 'mobile' && value.endsWith(' ') && !/\s/.test(value.slice(0, -1))) {
      const completed = autocompleteFirstToken(value.slice(0, -1));
      if (completed) {
        setInput(completed);
        return;
      }
    }
    setInput(value);
  };

  const pasteIntoInput = async () => {
    try {
      const text = await navigator.clipboard?.readText?.();
      if (!text) return;
      setInput((prev) => `${prev}${text}`);
    } catch {
      /* clipboard denied */
    }
  };

  const inputHighlight = tutorialStep?.highlight === 'input';
  const outputHighlight = tutorialStep?.highlight === 'output';

  const keyboardOpen = Boolean(keyboardViewport);
  const shellStyle = keyboardOpen
    ? {
        top: keyboardViewport.top,
        left: keyboardViewport.left,
        width: keyboardViewport.width,
        height: keyboardViewport.height,
        paddingTop: '0.5rem',
        paddingRight: 'calc(0.75rem + var(--safe-right))',
        paddingBottom: '0.5rem',
        paddingLeft: 'calc(0.75rem + var(--safe-left))',
      }
    : {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        paddingTop: 'calc(1rem + var(--safe-top))',
        paddingRight: 'calc(1rem + var(--safe-right))',
        paddingBottom: 'calc(1rem + var(--safe-bottom))',
        paddingLeft: 'calc(1rem + var(--safe-left))',
      };

  return (
    <div
      className={`fixed z-[100] flex justify-center ${keyboardOpen ? 'items-end' : 'items-center'}`}
      style={shellStyle}
    >
      <div className="absolute inset-0 bg-nm-overlay backdrop-blur-md" onClick={onClose} />
      <div
        className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-nm-border bg-nm-panel font-mono shadow-2xl"
        style={{
          height: keyboardOpen ? '100%' : '78vh',
          maxHeight: '100%',
        }}
      >
        <div className="flex items-center gap-2 border-b border-nm-border bg-nm-header px-3 py-3 sm:px-4">
          <Terminal size={16} className="text-nm-terminal-prompt" />
          <h2 className="text-sm font-semibold text-nm-text">NodeMind Terminal</h2>
          <div className="flex-1" />
          <button
            type="button"
            title="Interactive tutorial"
            onClick={startTutorial}
            className={`rounded-lg p-2 transition active:scale-95 ${
              tutorialOpen
                ? 'bg-indigo-500/30 text-indigo-200'
                : 'text-nm-text-faint hover:bg-nm-hover hover:text-nm-text'
            }`}
          >
            <GraduationCap size={18} />
          </button>
          <button onClick={onClose} className="rounded-lg p-2 text-nm-text-faint transition hover:bg-nm-hover hover:text-nm-text">
            <X size={18} />
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col">
          {/* In-flow band under the header so the prompt and output stay uncovered. */}
          <TerminalTutorial
            open={tutorialOpen}
            step={tutorialStep}
            index={tutorialIndex}
            total={tutorialSteps.length}
            platform={platform}
            onContinue={advanceTutorial}
            onSkip={() => {
              endTutorialSession();
            }}
            inputRef={formRef}
            outputRef={scrollRef}
          />

          <div
            ref={scrollRef}
            data-terminal-output
            className={`nm-scrollbar min-h-0 flex-1 cursor-text select-text overflow-auto bg-nm-terminal px-4 py-3 text-[13px] leading-relaxed text-nm-terminal-text ${
              outputHighlight ? 'ring-2 ring-inset ring-indigo-400/80' : ''
            }`}
            onClick={() => {
              const sel = window.getSelection();
              if (sel && sel.toString().length > 0) return;
              inputRef.current?.focus();
            }}
          >
            {[...(welcomeHidden ? [] : welcome), ...lines].map((line, index) => (
              <div key={index} className="min-h-[1.4em] whitespace-pre-wrap break-words">
                {renderTerminalLine(line)}
              </div>
            ))}
          </div>

          <form
            ref={formRef}
            data-terminal-input
            className={`flex shrink-0 items-center gap-2 border-t border-nm-border bg-nm-terminal px-4 py-3 text-nm-terminal-text ${
              inputHighlight ? 'ring-2 ring-inset ring-indigo-400/80' : ''
            }`}
            style={{ fontSize: platform === 'mobile' ? 16 : 13 }}
            onSubmit={(e) => {
              e.preventDefault();
              const value = input;
              setInput('');
              run(value);
            }}
          >
            <span className="shrink-0 text-nm-terminal-prompt">{prompt}</span>
            <div className="relative min-w-0 flex-1">
              {autocompleteGhost ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre font-mono leading-none"
                  style={{ fontSize: 'inherit' }}
                >
                  <span className="invisible">{input}</span>
                  <span style={{ color: 'rgba(148, 163, 158, 0.38)' }}>{autocompleteGhost}</span>
                </div>
              ) : null}
              <input
                ref={inputRef}
                value={input}
                onChange={onInputChange}
                onKeyDown={onInputKeyDown}
                onContextMenu={(e) => {
                  e.preventDefault();
                  pasteIntoInput();
                }}
                className="relative w-full min-w-0 bg-transparent text-nm-terminal-text caret-nm-terminal-prompt outline-none"
                style={{ fontSize: 'inherit' }}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="go"
                inputMode="text"
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
