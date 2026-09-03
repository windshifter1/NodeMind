import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronUp, Minus, Pencil, Pin, X } from 'lucide-react';
import {
  MATH_NODE_MAX_WIDTH,
  MATH_NODE_MIN_WIDTH,
  MATH_NODE_PREVIEW_PAD_X,
  nodeWidthForTitle,
  TOP_BAR_HEIGHT,
  SOCKET_RADIUS,
} from '@/lib/canvasConstants';
import { emitTutorial } from '@/lib/tutorialEvents';
import {
  displayNodeTitle,
  getMathView,
  isGraphNode,
  isMathNode,
  isNodeBodyCollapsed,
  isSubstituteNode,
  MATH_VIEW,
  mathViewLabel,
  nextMathViewPatch,
} from '@/lib/nodeTypes';
import {
  listSubstituteSlots,
  substituteSlotOffsetY,
} from '@/lib/substituteSlots';
import { listGraphSlots, graphSocketOffsetY } from '@/lib/graphSlots';
import MathNodeBody from './MathNodeBody';

const DOUBLE_TAP_MS = 450;

function selectionGlow(color) {
  return `0 0 0 3px ${color}f2, 0 0 0 7px ${color}80, 0 0 24px 6px ${color}a6, 0 12px 36px rgba(0, 0, 0, 0.45)`;
}

function Socket({
  type,
  color,
  nodeId,
  pending,
  orientation,
  onStartConnect,
  inputBlocked = false,
  inputSlot = null,
  top = null,
  dimmed = false,
}) {
  const pendingSlot = pending?.inputSlot || null;
  const slotConflict =
    type === 'input' &&
    inputSlot &&
    pending &&
    pending.fromType === 'input' &&
    pending.fromNode === nodeId &&
    pendingSlot === inputSlot;
  const isTarget =
    pending &&
    pending.fromNode !== nodeId &&
    pending.fromType !== type &&
    !(type === 'input' && inputBlocked) &&
    !slotConflict;
  const HIT = 36;
  const OUT = 28;
  const vertical = orientation === 'vertical' && top == null;
  const topPx = top != null ? top : TOP_BAR_HEIGHT / 2;
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
        top: topPx,
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
        top: topPx,
        transform: 'translateY(-50%)',
      };
  return (
    <>
      <div
        data-socket
        data-node-id={nodeId}
        data-socket-type={type}
        data-socket-slot={inputSlot || undefined}
        onPointerDown={(e) => {
          e.stopPropagation();
          onStartConnect(nodeId, type, e, inputSlot);
        }}
        className="absolute"
        style={{
          ...hitStyle,
          cursor: 'crosshair',
          zIndex: 20,
          opacity: dimmed ? 0.45 : 1,
        }}
      />
      <div
        className="absolute rounded-full border-2 border-white transition-all"
        style={{
          ...visibleStyle,
          backgroundColor: color,
          boxShadow: isTarget
            ? `0 0 0 5px ${color}66`
            : `0 0 10px ${color}66, 0 1px 3px rgba(0,0,0,0.3)`,
          pointerEvents: 'none',
          zIndex: 21,
          opacity: dimmed ? 0.45 : 1,
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
  uiStyle = 'modern',
  liquidSpawn = false,
  selected,
  ghost,
  mathResult = null,
  onUpdate,
  onSelectNode,
  onArmNodeDrag,
  onCancelNodeDrag,
  onStartNodeDrag,
  onStartConnect,
  onOpenEdit,
  onLayoutChange,
  onSelectionMenu,
  ghostSelection = null,
  inputBlocked = false,
  socketHint = null,
  zoom = 1,
  edges = [],
}) {
  const mathView = isMathNode(node) ? getMathView(node) : null;
  const bodyCollapsed = isNodeBodyCollapsed(node);
  const bodySlots = useMemo(() => {
    if (mathView !== MATH_VIEW.FULL) return [];
    if (isSubstituteNode(node)) return listSubstituteSlots(node, edges);
    if (isGraphNode(node)) return listGraphSlots(node, edges);
    return [];
  }, [node, edges, mathView]);
  const slotOffsetY = (index) =>
    isGraphNode(node) ? graphSocketOffsetY(node, index) : substituteSlotOffsetY(index);
  const textareaRef = useRef(null);
  const titleInputRef = useRef(null);
  const lastTitleTapRef = useRef(0);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(() => displayNodeTitle(node));
  const [mathPreviewWidth, setMathPreviewWidth] = useState(0);

  const handleMathPreviewMetrics = useCallback(({ width }) => {
    const next = Math.max(0, Number(width) || 0);
    setMathPreviewWidth((prev) => (prev === next ? prev : next));
  }, []);

  const nodeWidth = useMemo(() => {
    const titleWidth = nodeWidthForTitle(editingTitle ? titleDraft : displayNodeTitle(node));
    if (!isMathNode(node) || bodyCollapsed) return titleWidth;
    // Graph nodes are fixed at the 2× Math width.
    if (isGraphNode(node)) return MATH_NODE_MAX_WIDTH;
    const needed = mathPreviewWidth > 0 ? mathPreviewWidth + MATH_NODE_PREVIEW_PAD_X : 0;
    return Math.min(
      MATH_NODE_MAX_WIDTH,
      Math.max(MATH_NODE_MIN_WIDTH, titleWidth, needed)
    );
  }, [editingTitle, titleDraft, node, mathPreviewWidth, bodyCollapsed]);

  useEffect(() => {
    if (!isMathNode(node)) return undefined;
    onLayoutChange?.();
    return undefined;
  }, [
    nodeWidth,
    node.kind,
    mathView,
    bodySlots.length,
    node.graphSlotOpts,
    node.graphExprs,
    onLayoutChange,
  ]);

  const autoResize = () => {
    const ta = textareaRef.current;
    if (ta && !bodyCollapsed) {
      ta.style.height = 'auto';
      ta.style.height = Math.max(64, ta.scrollHeight) + 'px';
    }
  };

  useEffect(autoResize, [node.content, bodyCollapsed]);

  useEffect(() => {
    if (!editingTitle) setTitleDraft(displayNodeTitle(node));
  }, [node.title, node.kind, editingTitle]);

  useEffect(() => {
    if (!isMathNode(node) || bodyCollapsed) setMathPreviewWidth(0);
  }, [node.kind, bodyCollapsed]);

  useEffect(() => {
    if (!editingTitle) return undefined;
    const input = titleInputRef.current;
    if (!input) return undefined;
    input.focus();
    input.select();
    return undefined;
  }, [editingTitle]);

  const cancelTitleEdit = () => {
    setTitleDraft(displayNodeTitle(node));
    setEditingTitle(false);
  };

  const commitTitle = () => {
    if (!editingTitle) return;
    const next = titleDraft.trim();
    setEditingTitle(false);
    if (next !== (node.title || '').trim()) onUpdate({ title: next });
    emitTutorial('node.rename');
  };

  const beginTitleEdit = () => {
    lastTitleTapRef.current = 0;
    onCancelNodeDrag?.();
    setTitleDraft(displayNodeTitle(node));
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

  const modernUi = uiStyle === 'modern';
  const prototypeUi = uiStyle === 'prototype';
  const glassUi = modernUi || prototypeUi;
  const nodeRadius = prototypeUi ? '1.45rem' : modernUi ? '1.1rem' : '0.75rem';
  const borderW = selected ? 3 : glassUi ? 1 : 2;
  const innerRadius = `calc(${nodeRadius} - ${borderW}px)`;

  return (
    <div
      data-note-node={node.id}
      data-liquid-spawn={liquidSpawn ? '1' : undefined}
      data-selected={selected ? '1' : undefined}
      className={`absolute select-none ${
        prototypeUi
          ? 'nm-proto-node'
          : modernUi
            ? 'rounded-[1.1rem]'
            : 'rounded-xl shadow-2xl'
      }`}
      style={{
        left: node.x,
        top: node.y,
        width: nodeWidth,
        zIndex: node.z,
        borderWidth: borderW,
        borderStyle: 'solid',
        borderColor: glassUi && !selected ? 'var(--nm-border)' : node.color,
        backgroundColor: prototypeUi
          ? undefined
          : modernUi
            ? 'var(--nm-node-bg)'
            : darkNodes
              ? '#424448'
              : '#f8fafc',
        opacity: ghost ? 0.3 : 1,
        boxShadow: selected
          ? prototypeUi
            ? undefined
            : selectionGlow(node.color)
          : modernUi
            ? 'var(--nm-glass-shadow)'
            : undefined,
        backdropFilter: modernUi ? 'blur(28px) saturate(1.75) brightness(1.05)' : undefined,
        WebkitBackdropFilter: modernUi ? 'blur(28px) saturate(1.75) brightness(1.05)' : undefined,
        '--node-tint': node.color,
        transition:
          'left 250ms ease, top 250ms ease, opacity 180ms ease, width 250ms ease, box-shadow 180ms ease, border-color 180ms ease, border-width 180ms ease',
      }}
    >
      {bodySlots.length > 0 ? (
        bodySlots.map((slot, index) => (
          <Socket
            key={slot.id}
            type="input"
            color={node.color}
            nodeId={node.id}
            pending={pending}
            orientation={orientation}
            onStartConnect={onStartConnect}
            inputBlocked={slot.connected}
            inputSlot={slot.id}
            top={TOP_BAR_HEIGHT + slotOffsetY(index)}
            dimmed={slot.greyed}
          />
        ))
      ) : (
        <Socket
          type="input"
          color={node.color}
          nodeId={node.id}
          pending={pending}
          orientation={orientation}
          onStartConnect={onStartConnect}
          inputBlocked={inputBlocked}
        />
      )}

      <Socket
        type="output"
        color={node.color}
        nodeId={node.id}
        pending={pending}
        orientation={orientation}
        onStartConnect={onStartConnect}
      />

      {socketHint?.message && (
        <div
          key={socketHint.key || socketHint.message}
          role="status"
          className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium shadow-lg ${
            darkNodes
              ? 'bg-rose-500/95 text-white'
              : 'bg-rose-600 text-white'
          }`}
          style={{
            left: orientation === 'vertical' ? '50%' : -8,
            top: orientation === 'vertical' ? -36 : TOP_BAR_HEIGHT / 2,
            transform:
              orientation === 'vertical' ? 'translate(-50%, -100%)' : 'translate(-100%, -50%)',
            animation: 'nm-socket-hint 2.2s ease-out forwards',
          }}
        >
          {socketHint.message}
        </div>
      )}

      <div
        className={`relative flex items-center gap-1 px-2 ${prototypeUi ? 'nm-proto-node-bar' : ''}`}
        style={{
          height: TOP_BAR_HEIGHT,
          cursor: editingTitle ? 'text' : 'grab',
          backgroundColor: prototypeUi
            ? undefined
            : glassUi
              ? `${node.color}33`
              : node.color + '22',
          borderBottom: bodyCollapsed
            ? 'none'
            : prototypeUi
              ? undefined
              : glassUi
                ? '1px solid var(--nm-border)'
                : `1px solid ${node.color}33`,
          // Match the card radius so the bar doesn’t square-poke rounded corners.
          borderTopLeftRadius: innerRadius,
          borderTopRightRadius: innerRadius,
          borderBottomLeftRadius: bodyCollapsed ? innerRadius : 0,
          borderBottomRightRadius: bodyCollapsed ? innerRadius : 0,
        }}
        onPointerDown={startDrag}
      >
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            if (isMathNode(node)) {
              onUpdate(nextMathViewPatch(node));
              return;
            }
            onUpdate({ collapsed: !node.collapsed });
          }}
          className={`relative z-[21] p-1 rounded-md active:scale-95 transition ${darkNodes ? 'text-zinc-300 hover:bg-white/10' : 'text-slate-600 hover:bg-black/10'}`}
          title={
            isMathNode(node)
              ? `View: ${mathViewLabel(mathView)} — click for ${mathViewLabel(
                  nextMathViewPatch(node).mathView
                )}`
              : node.collapsed
                ? 'Expand'
                : 'Collapse'
          }
        >
          {isMathNode(node) ? (
            mathView === MATH_VIEW.COLLAPSED ? (
              <ChevronUp size={16} />
            ) : mathView === MATH_VIEW.BASIC ? (
              <Minus size={16} />
            ) : (
              <ChevronDown size={16} />
            )
          ) : node.collapsed ? (
            <ChevronUp size={16} />
          ) : (
            <ChevronDown size={16} />
          )}
        </button>

        {editingTitle ? (
          <>
            <input
              ref={titleInputRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={(e) => {
                if (e.relatedTarget?.closest?.('[data-title-cancel]')) return;
                commitTitle();
              }}
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
              placeholder={displayNodeTitle(node)}
              className={`relative z-[21] flex-1 min-w-0 rounded border bg-white/90 px-1.5 py-0.5 text-sm font-medium outline-none dark:bg-black/20 ${darkNodes ? 'text-zinc-100 placeholder:text-zinc-500' : 'text-slate-800 placeholder:text-slate-400'}`}
              style={{ fontSize: 14, borderColor: node.color }}
            />
            <button
              type="button"
              data-title-cancel
              title="Cancel rename"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                cancelTitleEdit();
              }}
              className={`relative z-[21] p-1 rounded-md active:scale-95 transition ${darkNodes ? 'text-zinc-300 hover:bg-white/10' : 'text-slate-600 hover:bg-black/10'}`}
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <span
            className={`flex-1 truncate text-sm font-medium px-1 ${darkNodes ? 'text-zinc-100' : 'text-slate-800'}`}
            onPointerDown={handleTitlePointerDown}
            onDoubleClick={handleTitleDoubleClick}
          >
            {displayNodeTitle(node)}
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
          onClick={() => {
            onOpenEdit(node.id);
          }}
          className={`relative z-[21] p-1 rounded-md active:scale-95 transition ${darkNodes ? 'text-zinc-300 hover:bg-white/10' : 'text-slate-600 hover:bg-black/10'}`}
          title="Edit colour & pin"
        >
          <Pencil size={14} />
        </button>

      </div>

      {!bodyCollapsed && isMathNode(node) && (
        <MathNodeBody
          node={node}
          darkNodes={darkNodes}
          result={mathResult}
          onUpdate={onUpdate}
          applicableModes={mathResult?.applicableModes}
          applicableSelectionOps={mathResult?.applicableSelectionOps}
          onPreviewMetrics={handleMathPreviewMetrics}
          onSelectionMenu={onSelectionMenu}
          ghostSelection={ghostSelection}
          onSelectNode={onSelectNode}
          zoom={zoom}
          uiStyle={uiStyle}
          bodySlots={bodySlots}
          basicView={mathView === MATH_VIEW.BASIC}
        />
      )}

      {!bodyCollapsed && !isMathNode(node) && (
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
