import React, { useRef, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Pin } from 'lucide-react';
import { nodeWidthForTitle, TOP_BAR_HEIGHT, SOCKET_RADIUS } from '@/lib/canvasConstants';

const DOUBLE_TAP_MS = 450;

function selectionGlow(color) {
  return `0 0 0 3px ${color}f2, 0 0 0 7px ${color}80, 0 0 24px 6px ${color}a6, 0 12px 36px rgba(0, 0, 0, 0.45)`;
}

function Socket({ type, color, nodeId, pending, orientation, onStartConnect }) {
  const isTarget = pending && pending.fromNode !== nodeId && pending.fromType !== type;
  const HIT = 36;
  const OUT = 28;
  const vertical = orientation === 'vertical';
  const hitStyle = vertical
    ? {
        width: HIT,
        height: HIT,
        left: '50%',
        top: type === 'input' ? -OUT : 'auto',
        bottom: type === 'output' ? -OUT : 'auto',
        transform: 'translateX(-50%)',
      }
    : {
        width: HIT,
        height: HIT,
        left: type === 'input' ? -OUT : 'auto',
        right: type === 'output' ? -OUT : 'auto',
        top: TOP_BAR_HEIGHT / 2,
        transform: 'translateY(-50%)',
      };
  const visibleStyle = vertical
    ? {
        width: SOCKET_RADIUS * 2,
        height: SOCKET_RADIUS * 2,
        left: '50%',
        top: type === 'input' ? -SOCKET_RADIUS : 'auto',
        bottom: type === 'output' ? -SOCKET_RADIUS : 'auto',
        transform: 'translateX(-50%)',
      }
    : {
        width: SOCKET_RADIUS * 2,
        height: SOCKET_RADIUS * 2,
        left: type === 'input' ? -SOCKET_RADIUS : 'auto',
        right: type === 'output' ? -SOCKET_RADIUS : 'auto',
        top: TOP_BAR_HEIGHT / 2,
        transform: 'translateY(-50%)',
      };
  return (
    <>
      <div
        data-socket
        data-node-id={nodeId}
        data-socket-type={type}
        onPointerDown={(e) => {
          e.stopPropagation();
          onStartConnect(nodeId, type, e);
        }}
        className="absolute"
        style={{
          ...hitStyle,
          cursor: 'crosshair',
          zIndex: 20,
        }}
      />
      <div
        className="absolute rounded-full border-2 border-white transition-all"
        style={{
          ...visibleStyle,
          backgroundColor: color,
          boxShadow: isTarget ? `0 0 0 5px ${color}66` : '0 1px 3px rgba(0,0,0,0.3)',
          pointerEvents: 'none',
          zIndex: 21,
        }}
      />
    </>
  );
}

export default function NoteNode({
  node,
  pending,
  orientation,
  darkNodes,
  selected,
  ghost,
  onUpdate,
  onSelectNode,
  onArmNodeDrag,
  onCancelNodeDrag,
  onStartNodeDrag,
  onStartConnect,
  onOpenEdit,
}) {
  const textareaRef = useRef(null);
  const titleInputRef = useRef(null);
  const lastTitleTapRef = useRef(0);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(node.title || '');

  const autoResize = () => {
    const ta = textareaRef.current;
    if (ta && !node.collapsed) {
      ta.style.height = 'auto';
      ta.style.height = Math.max(64, ta.scrollHeight) + 'px';
    }
  };

  useEffect(autoResize, [node.content, node.collapsed]);

  useEffect(() => {
    if (!editingTitle) setTitleDraft(node.title || '');
  }, [node.title, editingTitle]);

  useEffect(() => {
    if (!editingTitle) return undefined;
    const input = titleInputRef.current;
    if (!input) return undefined;
    input.focus();
    input.select();
    return undefined;
  }, [editingTitle]);

  const cancelTitleEdit = () => {
    setTitleDraft(node.title || '');
    setEditingTitle(false);
  };

  const commitTitle = () => {
    if (!editingTitle) return;
    const next = titleDraft.trim();
    setEditingTitle(false);
    if (next !== (node.title || '')) onUpdate({ title: next });
  };

  const beginTitleEdit = () => {
    lastTitleTapRef.current = 0;
    onCancelNodeDrag?.();
    setTitleDraft(node.title || '');
    setEditingTitle(true);
  };

  const handleTitlePointerDown = (e) => {
    if (editingTitle) return;
    e.stopPropagation();
    onArmNodeDrag?.(node.id, e, (ev) => {
      const now = Date.now();
      if (now - lastTitleTapRef.current < DOUBLE_TAP_MS) {
        lastTitleTapRef.current = 0;
        beginTitleEdit();
        return;
      }
      lastTitleTapRef.current = now;
      onSelectNode?.(node.id, ev);
    });
  };

  const handleTitleDoubleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    beginTitleEdit();
  };

  const startDrag = (e) => {
    if (editingTitle) return;
    e.stopPropagation();
    onStartNodeDrag(node.id, e);
  };

  return (
    <div
      data-note-node={node.id}
      className="absolute rounded-xl shadow-2xl select-none"
      style={{
        left: node.x,
        top: node.y,
        width: nodeWidthForTitle(editingTitle ? titleDraft : node.title),
        zIndex: node.z,
        borderWidth: selected ? 3 : 2,
        borderStyle: 'solid',
        borderColor: node.color,
        backgroundColor: darkNodes ? '#424448' : '#f8fafc',
        opacity: ghost ? 0.3 : 1,
        boxShadow: selected ? selectionGlow(node.color) : undefined,
        transition:
          'left 250ms ease, top 250ms ease, opacity 180ms ease, width 250ms ease, box-shadow 180ms ease, border-color 180ms ease, border-width 180ms ease',
      }}
    >
      <Socket
        type="input"
        color={node.color}
        nodeId={node.id}
        pending={pending}
        orientation={orientation}
        onStartConnect={onStartConnect}
      />

      <Socket
        type="output"
        color={node.color}
        nodeId={node.id}
        pending={pending}
        orientation={orientation}
        onStartConnect={onStartConnect}
      />

      <div
        className="relative flex items-center gap-1 px-2"
        style={{
          height: TOP_BAR_HEIGHT,
          cursor: editingTitle ? 'text' : 'grab',
          backgroundColor: node.color + '22',
          borderBottom: `1px solid ${node.color}33`,
        }}
        onPointerDown={startDrag}
      >
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onUpdate({ collapsed: !node.collapsed })}
          className={`relative z-[21] p-1 rounded-md active:scale-95 transition ${darkNodes ? 'text-zinc-300 hover:bg-white/10' : 'text-slate-600 hover:bg-black/10'}`}
          title={node.collapsed ? 'Expand' : 'Collapse'}
        >
          {node.collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {editingTitle ? (
          <input
            ref={titleInputRef}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitTitle();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelTitleEdit();
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder="Untitled"
            className={`relative z-[21] flex-1 min-w-0 rounded border bg-white/90 px-1.5 py-0.5 text-sm font-medium outline-none dark:bg-black/20 ${darkNodes ? 'text-zinc-100 placeholder:text-zinc-500' : 'text-slate-800 placeholder:text-slate-400'}`}
            style={{ fontSize: 14, borderColor: node.color }}
          />
        ) : (
          <span
            className={`flex-1 truncate text-sm font-medium px-1 ${darkNodes ? 'text-zinc-100' : 'text-slate-800'}`}
            onPointerDown={handleTitlePointerDown}
            onDoubleClick={handleTitleDoubleClick}
          >
            {node.title || 'Untitled'}
          </span>
        )}

        {node.pinned && (
          <span
            className={`relative z-[21] p-1 ${darkNodes ? 'text-zinc-400' : 'text-slate-500'}`}
            title="Position pinned"
          >
            <Pin size={14} />
          </span>
        )}

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onOpenEdit(node.id)}
          className={`relative z-[21] p-1 rounded-md active:scale-95 transition ${darkNodes ? 'text-zinc-300 hover:bg-white/10' : 'text-slate-600 hover:bg-black/10'}`}
          title="Edit colour & pin"
        >
          <Pencil size={14} />
        </button>

      </div>

      {!node.collapsed && (
        <textarea
          ref={textareaRef}
          value={node.content}
          onChange={(e) => onUpdate({ content: e.target.value })}
          onInput={autoResize}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="Write your thoughts…"
          className={`w-full resize-none outline-none bg-transparent text-sm p-3 leading-relaxed ${darkNodes ? 'text-zinc-200 placeholder:text-zinc-500' : 'text-slate-700 placeholder:text-slate-400'}`}
          style={{ minHeight: 64 }}
        />
      )}
    </div>
  );
}
