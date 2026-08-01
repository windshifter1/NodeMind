import React, { useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { nodeWidthForTitle, TOP_BAR_HEIGHT, SOCKET_RADIUS } from '@/lib/canvasConstants';

function Socket({ type, color, nodeId, pending, orientation, onStartConnect }) {
  const isTarget = pending && pending.fromNode !== nodeId && pending.fromType !== type;
  // Generous, mostly-outward invisible hitbox; visible circle stays half-in/half-out.
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
  ghost,
  onUpdate,
  onStartNodeDrag,
  onStartConnect,
  onOpenEdit,
}) {
  const textareaRef = useRef(null);

  const autoResize = () => {
    const ta = textareaRef.current;
    if (ta && !node.collapsed) {
      ta.style.height = 'auto';
      ta.style.height = Math.max(64, ta.scrollHeight) + 'px';
    }
  };

  useEffect(autoResize, [node.content, node.collapsed]);

  const startDrag = (e) => {
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
        width: nodeWidthForTitle(node.title),
        zIndex: node.z,
        borderWidth: 2,
        borderStyle: 'solid',
        borderColor: node.color,
        backgroundColor: darkNodes ? '#424448' : '#ffffff',
        opacity: ghost ? 0.3 : 1,
        transition: 'left 250ms ease, top 250ms ease, opacity 180ms ease, width 250ms ease',
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

      {/* Top bar */}
      <div
        className="relative flex items-center gap-1 px-2"
        style={{
          height: TOP_BAR_HEIGHT,
          cursor: 'grab',
          backgroundColor: node.color + '22',
          borderBottom: `1px solid ${node.color}33`,
        }}
        onPointerDown={startDrag}
      >
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onUpdate({ collapsed: !node.collapsed })}
          className={`relative z-[21] p-1 rounded-md active:scale-95 transition ${darkNodes ? 'text-zinc-300 hover:bg-white/10' : 'text-slate-600 hover:bg-black/10'}`}
          title={node.collapsed ? 'Expand' : 'Collapse'}
        >
          {node.collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        <span
          className={`flex-1 truncate text-sm font-medium px-1 ${darkNodes ? 'text-zinc-100' : 'text-slate-800'}`}
          onPointerDown={startDrag}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onOpenEdit(node.id);
          }}
        >
          {node.title || 'Untitled'}
        </span>

        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onOpenEdit(node.id)}
          className={`relative z-[21] p-1 rounded-md active:scale-95 transition ${darkNodes ? 'text-zinc-300 hover:bg-white/10' : 'text-slate-600 hover:bg-black/10'}`}
          title="Edit title & colour"
        >
          <Pencil size={14} />
        </button>

      </div>

      {/* Adaptive text field */}
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