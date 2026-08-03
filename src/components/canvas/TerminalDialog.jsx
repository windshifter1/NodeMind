import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Terminal, X } from 'lucide-react';
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

function normalizeCommandLine(input) {
  return input.trim().replace(/^cd\.\./i, 'cd ..');
}

function commandKey(token) {
  const key = token.toLowerCase();
  if (key === 'description') return 'desc';
  if (key === 'colour') return 'color';
  return key;
}

function formatNode(nodes, node) {
  const id = displayId(nodes, node.id);
  return [
    `Title: ${normaliseTitle(node.title)}`,
    `ID: ${id}`,
    `Path: \\${nodePath(nodes, node.id).join('\\')}`,
    `Colour: ${node.color || '#6366f1'}`,
    node.content ? `Description: ${node.content}` : 'Description: (empty)',
  ];
}

function unquote(value) {
  const trimmed = (value || '').trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function isQuoted(value) {
  const trimmed = (value || '').trim();
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

const HELP_DIVIDER = '════════════════════════════════════════════';

const HELP_SECTIONS = {
  help: [
    'help [command]',
    '    Show all commands, or detailed help for a specific command.',
  ],
  cd: [
    'cd <node|..|cd..|\\|path>',
    '    Change the current hierarchy path.',
  ],
  dir: ['dir', '    List child nodes.'],
  open: ['open <node>', '    Open a child node by title or ID and make it the current node.'],
  info: [
    'info [all|/title <text>|/id <id>]',
    '    Display node information.',
    '    • info            → current node',
    '    • info all        → every node',
    '    • info /title ... → search by title',
    '    • info /id ...    → search by ID',
  ],
  find: [
    'find [/title|/desc|/description|/id|/date] <text>',
    '    Search nodes using the selected field. [/date] accepts DD/MM/YY, MM/YY, and YY formats.',
  ],
  title: ['title "Text"', '    Replace the current node title.'],
  desc: [
    'desc "Text"',
    'description "Text"',
    '    Replace the current node description.',
  ],
  append: ['append "Text"', '    Add text to the end of the description.'],
  prepend: ['prepend "Text"', '    Add text to the beginning of the description.'],
  clear: [
    'clear title',
    '    Clear the node title.',
    '',
    'clear desc',
    'clear description',
    '    Clear the node description.',
  ],
  color: [
    'color "Red"',
    'colour "Red"',
    'color #RRGGBB',
    'colour #RRGGBB',
    '    Change the current node colour.',
  ],
  new: ['new "Title"', '    Create a child node.'],
  duplicate: ['duplicate', '    Duplicate the current node and all descendants.'],
  move: ['move <path>', '    Move the current branch to another location.'],
  copy: ['copy <path>', '    Copy the current branch to another location.'],
  delete: [
    'delete',
    '    Delete the current node and its descendants.',
    '    Run the command twice to confirm.',
  ],
  link: ['link <id>', '    Create a graph link to another node.'],
  unlink: ['unlink <id>', '    Remove a graph link.'],
  links: ['links', '    Display all incoming and outgoing graph links.'],
  arrange: ['arrange', '    Auto organise the workspace using the current orientation.'],
  export: ['export', '    Download the workspace as JSON.'],
  import: ['import', '    Open the JSON import dialog.'],
  version: getVersionHelpLines(),
  terminal: [
    'terminal exit',
    '    Close Terminal Mode.',
    '',
    'terminal clear',
    '    Clear all terminal output and scroll back to the top.',
    '',
    'terminal about',
    '    Display credits.',
    '',
    'terminal date',
    '    Display the current UTC date and time (DD/MM/YYYY).',
  ],
};

const HELP_GROUPS = [
  { title: null, keys: ['help'] },
  { title: 'NAVIGATION', keys: ['cd', 'dir', 'open'] },
  { title: 'VIEW & SEARCH', keys: ['info', 'find'] },
  { title: 'EDIT', keys: ['title', 'desc', 'append', 'prepend', 'clear', 'color'] },
  { title: 'NODE MANAGEMENT', keys: ['new', 'duplicate', 'move', 'copy', 'delete'] },
  { title: 'GRAPH LINKS', keys: ['link', 'unlink', 'links'] },
  { title: 'WORKSPACE', keys: ['arrange', 'export', 'import'] },
  { title: 'VERSION', keys: ['version'] },
  { title: 'TERMINAL', keys: ['terminal'] },
];

function sectionLines(key) {
  return HELP_SECTIONS[key] || [];
}

function buildHelpAll() {
  const lines = [HELP_DIVIDER, 'HELP', HELP_DIVIDER, '', ...sectionLines('help')];
  HELP_GROUPS.slice(1).forEach(({ title, keys }) => {
    lines.push('', HELP_DIVIDER, title, HELP_DIVIDER, '');
    keys.forEach((key, index) => {
      if (index > 0) lines.push('');
      lines.push(...sectionLines(key));
    });
  });
  return lines;
}

const HELP_ALL = buildHelpAll();

function helpFor(topic) {
  const key = commandKey(topic.trim().split(/\s+/)[0]);
  return HELP_SECTIONS[key];
}

export default function TerminalDialog({ open, onClose, workspace, dispatch, onExport, onImport, onArrange, orientation }) {
  const [cwdId, setCwdId] = useState(null);
  const [input, setInput] = useState('');
  const [lines, setLines] = useState([]);
  const [welcomeHidden, setWelcomeHidden] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  const nodes = workspace.nodes || [];
  const graphOrientation = normalizeOrientation(orientation || workspace.orientation);
  const pathParts = nodePath(nodes, cwdId);
  const prompt = `${workspace.name || 'Workspace'}:\\${pathParts.join('\\')}>`;

  useEffect(() => {
    if (open) {
      setWelcomeHidden(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  useEffect(() => {
    if (cwdId && !nodes.some((node) => node.id === cwdId)) setCwdId(null);
  }, [cwdId, nodes]);

  const welcome = useMemo(
    () => [`NodeMind Terminal`, `Type help for commands.`, ''],
    []
  );

  if (!open) return null;

  const replaceWorkspace = (patch) => {
    dispatch({ type: 'REPLACE_ACTIVE_WORKSPACE', workspace: patch });
  };

  const write = (output) => {
    const values = Array.isArray(output) ? output : [output];
    setLines((prev) => [...prev, ...values]);
  };

  const run = (raw) => {
    const commandLine = normalizeCommandLine(raw);
    if (!commandLine) {
      write(`${prompt} ${commandLine}`);
      return;
    }
    const [command = '', ...args] = quoteAwareSplit(commandLine);
    const rest = commandLine.slice(command.length).trim();
    const current = nodes.find((node) => node.id === cwdId) || null;
    const cmd = commandKey(command);
    const isTerminalClear = cmd === 'terminal' && args[0]?.toLowerCase() === 'clear';

    if (!isTerminalClear) {
      write(`${prompt} ${commandLine}`);
    }

    const requireCurrent = () => {
      if (!current) {
        write('No node selected.');
        return false;
      }
      return true;
    };

    if (cmd !== 'delete') setConfirmDeleteId(null);

    switch (cmd) {
      case 'help':
        if (args[0]) write(helpFor(args[0]) || [`No help for "${args[0]}".`]);
        else write(HELP_ALL);
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
        if (target === undefined) write(`Path not found: ${rest}`);
        else setCwdId(target);
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
        else write('No node selected.');
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
        if (!requireCurrent()) break;
        const patch = { updatedAt: new Date().toISOString() };
        if (cmd === 'title') {
          if (!requireQuoted(rest, write)) break;
          patch.title = unquote(rest);
        } else if (cmd === 'desc') {
          if (!requireQuoted(rest, write)) break;
          patch.content = unquote(rest);
        } else if (cmd === 'append') {
          if (!requireQuoted(rest, write)) break;
          const text = unquote(rest);
          patch.content = `${current.content || ''}${current.content ? '\n' : ''}${text}`;
        } else if (cmd === 'prepend') {
          if (!requireQuoted(rest, write)) break;
          const text = unquote(rest);
          patch.content = `${text}${current.content ? '\n' : ''}${current.content || ''}`;
        } else if (cmd === 'clear') {
          const target = args[0]?.toLowerCase();
          patch[target === 'title' ? 'title' : 'content'] = '';
        } else if (cmd === 'color') {
          if (!requireQuotedOrHex(rest, write)) break;
          const text = unquote(rest);
          patch.color = COLORS[text.toLowerCase()] || text;
        }
        replaceWorkspace({ nodes: nodes.map((node) => (node.id === current.id ? { ...node, ...patch } : node)) });
        write('Updated.');
        break;
      }
      case 'new': {
        if (!requireQuoted(rest, write)) break;
        const title = unquote(rest) || 'Untitled';
        const pos = nextChildGraphPosition(nodes, cwdId, title, graphOrientation);
        const now = new Date().toISOString();
        const node = {
          id: nextNumericNodeId(nodes),
          x: pos.x,
          y: pos.y,
          title,
          content: '',
          color: '#6366f1',
          collapsed: false,
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
        if (!requireCurrent()) break;
        const parentId = cmd === 'copy' ? resolvePath(nodes, cwdId, rest || '\\') : current.parentId || null;
        if (parentId === undefined) {
          write(`Path not found: ${rest}`);
          break;
        }
        const pos = nextChildGraphPosition(nodes, parentId, current.title, graphOrientation);
        replaceWorkspace({ nodes: cloneBranch(nodes, current.id, parentId, pos, graphOrientation), nextZ: (workspace.nextZ || 1) + branchIds(nodes, current.id).size });
        write(cmd === 'copy' ? 'Copied branch.' : 'Duplicated branch.');
        break;
      }
      case 'move': {
        if (!requireCurrent()) break;
        const parentId = resolvePath(nodes, cwdId, rest || '\\');
        if (parentId === undefined || parentId === current.id || branchIds(nodes, current.id).has(parentId)) {
          write('Invalid target.');
          break;
        }
        const pos = nextChildGraphPosition(nodes, parentId, current.title, graphOrientation);
        const moved = nodes.map((node) => (node.id === current.id ? { ...node, parentId: parentId || null } : node));
        replaceWorkspace({ nodes: layoutBranchByOrientation(moved, current.id, pos, graphOrientation) });
        write('Moved branch.');
        break;
      }
      case 'delete': {
        if (!requireCurrent()) break;
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
        if (!requireCurrent()) break;
        const targetId = matchNodeId(nodes, args[0]);
        if (!targetId || targetId === current.id) {
          write('Invalid target.');
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
        if (!requireCurrent()) break;
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
        break;
      }
      default:
        write(`Unknown command: ${command}. Type help.`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        paddingTop: 'calc(1rem + var(--safe-top))',
        paddingRight: 'calc(1rem + var(--safe-right))',
        paddingBottom: 'calc(1rem + var(--safe-bottom))',
        paddingLeft: 'calc(1rem + var(--safe-left))',
      }}
    >
      <div className="absolute inset-0 bg-nm-overlay backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-3xl h-[78vh] rounded-2xl bg-nm-panel border border-nm-border shadow-2xl flex flex-col overflow-hidden font-mono">
        <div className="flex items-center gap-2 px-3 sm:px-4 py-3 border-b border-nm-border bg-nm-header">
          <Terminal size={16} className="text-nm-terminal-prompt" />
          <h2 className="text-sm font-semibold text-nm-text">NodeMind Terminal</h2>
          <div className="flex-1" />
          <button onClick={onClose} className="p-2 rounded-lg text-nm-text-faint hover:text-nm-text hover:bg-nm-hover transition">
            <X size={18} />
          </button>
        </div>
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto px-4 py-3 text-[13px] leading-relaxed text-nm-terminal-text bg-nm-terminal select-text cursor-text"
          onClick={() => {
            const sel = window.getSelection();
            if (sel && sel.toString().length > 0) return;
            inputRef.current?.focus();
          }}
        >
          {[...(welcomeHidden ? [] : welcome), ...lines].map((line, index) => (
            <div key={index} className="whitespace-pre-wrap break-words min-h-[1.4em]">
              {line}
            </div>
          ))}
        </div>
        <form
          className="flex items-center gap-2 border-t border-nm-border bg-nm-terminal px-4 py-3 text-[13px] text-nm-terminal-text"
          onSubmit={(e) => {
            e.preventDefault();
            const value = input;
            setInput('');
            run(value);
          }}
        >
          <span className="shrink-0 text-nm-terminal-prompt">{prompt}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-w-0 flex-1 bg-transparent outline-none text-nm-terminal-text caret-nm-terminal-prompt"
            autoComplete="off"
            spellCheck={false}
          />
        </form>
      </div>
    </div>
  );
}
