import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Terminal, X } from 'lucide-react';
import { nodeWidthForTitle, TOP_BAR_HEIGHT } from '@/lib/canvasConstants';

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

function displayId(nodes, id) {
  const index = nodes.findIndex((node) => node.id === id);
  return index >= 0 ? String(index + 1).padStart(3, '0') : id;
}

function matchNodeId(nodes, token) {
  if (!token) return null;
  const numeric = token.match(/^\d+$/) ? Number(token) - 1 : -1;
  if (numeric >= 0 && nodes[numeric]) return nodes[numeric].id;
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

function nextChildPosition(nodes, parentId, title = '') {
  const parent = nodes.find((node) => node.id === parentId);
  const siblings = childrenOf(nodes, parentId);
  const baseX = parent ? parent.x + nodeWidthForTitle(parent.title) + 120 : 0;
  const baseY = parent ? parent.y : 0;
  let y = baseY + Math.max(0, siblings.length) * 96;
  const width = nodeWidthForTitle(title);
  while (
    nodes.some(
      (node) =>
        Math.abs(node.x - baseX) < Math.max(width, nodeWidthForTitle(node.title)) + 24 &&
        Math.abs(node.y - y) < TOP_BAR_HEIGHT + 64
    )
  ) {
    y += 96;
  }
  return { x: baseX, y };
}

function layoutBranch(nodes, rootId, origin) {
  const byParent = new Map();
  nodes.forEach((node) => {
    const key = node.parentId || '';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(node);
  });

  const updates = new Map([[rootId, origin]]);
  const walk = (id, depth, yStart) => {
    const kids = byParent.get(id) || [];
    kids.forEach((child, index) => {
      const parentPos = updates.get(id) || origin;
      const pos = {
        x: parentPos.x + nodeWidthForTitle(nodes.find((n) => n.id === id)?.title) + 120,
        y: yStart + index * 96,
      };
      updates.set(child.id, pos);
      walk(child.id, depth + 1, pos.y);
    });
  };
  walk(rootId, 0, origin.y);
  return nodes.map((node) => (updates.has(node.id) ? { ...node, ...updates.get(node.id) } : node));
}

function cloneBranch(nodes, rootId, parentId, origin) {
  const ids = branchIds(nodes, rootId);
  const idMap = new Map([...ids].map((id) => [id, uid('n')]));
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
  return layoutBranch([...nodes, ...clones], idMap.get(rootId), origin);
}

function formatNode(nodes, node) {
  return [
    `${displayId(nodes, node.id)} ${normaliseTitle(node.title)}`,
    `ID: ${node.id}`,
    `Path: \\${nodePath(nodes, node.id).join('\\')}`,
    `Colour: ${node.color || '#6366f1'}`,
    node.content ? `Description: ${node.content}` : 'Description: (empty)',
  ];
}

const HELP = {
  help: 'help [command] - Show command reference.',
  cd: 'cd <node|..|\\|path> - Change current hierarchy path.',
  dir: 'dir - List child nodes.',
  open: 'open <node> - Open a child/title/id as the current node.',
  info: 'info [/title text|/id id] - Show node information.',
  find: 'find [/title|/desc|/id|/date] <text> - Search nodes.',
  title: 'title "Text" - Replace the current node title.',
  desc: 'desc "Text" - Replace the current node description.',
  append: 'append "Text" - Append to the current node description.',
  prepend: 'prepend "Text" - Prepend to the current node description.',
  clear: 'clear title|desc - Clear title or description.',
  color: 'color "Red"|#hex - Change current node colour.',
  new: 'new "Title" - Create a child beneath the current path.',
  duplicate: 'duplicate - Duplicate the current node and its children.',
  move: 'move <path> - Move current branch beneath another node/root.',
  copy: 'copy <path> - Copy current branch beneath another node/root.',
  delete: 'delete - Delete current node and children. Run twice to confirm.',
  link: 'link <id> - Add graph link from current node to target.',
  unlink: 'unlink <id> - Remove graph link to/from target.',
  links: 'links - Show incoming and outgoing graph links.',
  export: 'export - Download this workspace as JSON.',
  import: 'import - Open the existing JSON import picker.',
  exit: 'exit - Close Terminal Mode.',
};

export default function TerminalDialog({ open, onClose, workspace, dispatch, onExport, onImport }) {
  const [cwdId, setCwdId] = useState(null);
  const [input, setInput] = useState('');
  const [lines, setLines] = useState([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  const nodes = workspace.nodes || [];
  const pathParts = nodePath(nodes, cwdId);
  const prompt = `${workspace.name || 'Workspace'}:\\${pathParts.join('\\')}>`;

  useEffect(() => {
    if (open) {
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
    () => [`NodeMind Terminal`, `Type "help" for commands.`, ''],
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
    const commandLine = raw.trim();
    write(`${prompt} ${commandLine}`);
    if (!commandLine) return;
    const [command = '', ...args] = quoteAwareSplit(commandLine);
    const rest = commandLine.slice(command.length).trim();
    const current = nodes.find((node) => node.id === cwdId) || null;
    const cmd = command.toLowerCase();

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
        if (args[0]) write(HELP[args[0].toLowerCase()] || `No help for "${args[0]}".`);
        else write(Object.values(HELP));
        break;
      case 'exit':
        onClose();
        break;
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
        if (args[0] === '/title') {
          const query = args.slice(1).join(' ').toLowerCase();
          const matches = nodes.filter((node) => normaliseTitle(node.title).toLowerCase().includes(query));
          write(matches.length ? matches.flatMap((node) => [...formatNode(nodes, node), '']) : 'No matches.');
        } else if (args[0] === '/id') {
          const id = matchNodeId(nodes, args[1]);
          const node = nodes.find((n) => n.id === id);
          write(node ? formatNode(nodes, node) : `ID not found: ${args[1]}`);
        } else if (current) write(formatNode(nodes, current));
        else write('No node selected.');
        break;
      }
      case 'find': {
        const flag = args[0]?.startsWith('/') ? args[0] : null;
        const query = (flag ? args.slice(1) : args).join(' ').toLowerCase();
        const matches = nodes.filter((node) => {
          if (flag === '/title') return normaliseTitle(node.title).toLowerCase().includes(query);
          if (flag === '/desc') return (node.content || '').toLowerCase().includes(query);
          if (flag === '/id') return node.id.includes(query) || displayId(nodes, node.id) === query;
          if (flag === '/date') return (node.createdAt || node.updatedAt || '').includes(query);
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
        const patch = {};
        if (cmd === 'title') patch.title = rest;
        if (cmd === 'desc') patch.content = rest;
        if (cmd === 'append') patch.content = `${current.content || ''}${current.content ? '\n' : ''}${rest}`;
        if (cmd === 'prepend') patch.content = `${rest}${current.content ? '\n' : ''}${current.content || ''}`;
        if (cmd === 'clear') patch[args[0] === 'title' ? 'title' : 'content'] = '';
        if (cmd === 'color') patch.color = COLORS[rest.toLowerCase()] || rest;
        replaceWorkspace({ nodes: nodes.map((node) => (node.id === current.id ? { ...node, ...patch } : node)) });
        write('Updated.');
        break;
      }
      case 'new': {
        const title = rest || 'Untitled';
        const pos = nextChildPosition(nodes, cwdId, title);
        const node = {
          id: uid('n'),
          x: pos.x,
          y: pos.y,
          title,
          content: '',
          color: '#6366f1',
          collapsed: false,
          parentId: cwdId || null,
          z: workspace.nextZ || 1,
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
        const pos = nextChildPosition(nodes, parentId, current.title);
        replaceWorkspace({ nodes: cloneBranch(nodes, current.id, parentId, pos), nextZ: (workspace.nextZ || 1) + branchIds(nodes, current.id).size });
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
        const pos = nextChildPosition(nodes, parentId, current.title);
        const moved = nodes.map((node) => (node.id === current.id ? { ...node, parentId: parentId || null } : node));
        replaceWorkspace({ nodes: layoutBranch(moved, current.id, pos) });
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
      case 'export':
        onExport();
        write('Export started.');
        break;
      case 'import':
        onImport();
        write('Import picker opened.');
        break;
      default:
        write(`Unknown command: ${command}. Type "help".`);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-3xl h-[78vh] rounded-2xl bg-zinc-950 border border-white/10 shadow-2xl flex flex-col overflow-hidden font-mono">
        <div className="flex items-center gap-2 px-3 sm:px-4 py-3 border-b border-white/10 bg-white/5">
          <Terminal size={16} className="text-emerald-300" />
          <h2 className="text-sm font-semibold text-zinc-100">NodeMind Terminal</h2>
          <div className="flex-1" />
          <button onClick={onClose} className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition">
            <X size={18} />
          </button>
        </div>
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto px-4 py-3 text-[13px] leading-relaxed text-emerald-100 bg-[#050806]"
          onClick={() => inputRef.current?.focus()}
        >
          {[...welcome, ...lines].map((line, index) => (
            <div key={index} className="whitespace-pre-wrap break-words min-h-[1.4em]">
              {line}
            </div>
          ))}
        </div>
        <form
          className="flex items-center gap-2 border-t border-white/10 bg-[#050806] px-4 py-3 text-[13px] text-emerald-100"
          onSubmit={(e) => {
            e.preventDefault();
            const value = input;
            setInput('');
            run(value);
          }}
        >
          <span className="shrink-0 text-emerald-300">{prompt}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-w-0 flex-1 bg-transparent outline-none text-emerald-100 caret-emerald-300"
            autoComplete="off"
            spellCheck={false}
          />
        </form>
      </div>
    </div>
  );
}
