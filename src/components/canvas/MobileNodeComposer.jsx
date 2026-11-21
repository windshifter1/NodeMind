import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { SlidersHorizontal } from 'lucide-react';
import { displayNodeTitle, isNoteNode } from '@/lib/nodeTypes';
import { LiquidGlassIos26Button } from '@/lib/liquid-glass/LiquidGlassIos26Button';
import './mobileNodeComposer.css';

export default function MobileNodeComposer({
  open,
  node,
  initialField = 'content',
  onUpdate,
  onOpenEdit,
  onClose,
}) {
  const titleRef = useRef(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.toggle('nm-node-composer-open', open);
    return () => document.documentElement.classList.remove('nm-node-composer-open');
  }, [open]);

  useEffect(() => {
    if (!open || !node) return undefined;
    const id = window.setTimeout(() => {
      const focusTitle = initialField === 'title' || !isNoteNode(node);
      const el = focusTitle ? titleRef.current : bodyRef.current;
      el?.focus();
    }, 80);
    return () => window.clearTimeout(id);
  }, [open, initialField, node]);

  useEffect(() => {
    if (!open) return undefined;
    const vv = window.visualViewport;
    const onVv = () => {
      const layoutH = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--app-frame-height'),
      );
      const frameBase = layoutH || window.innerHeight;
      const keyboardLikely =
        vv && (vv.height < frameBase * 0.82 || frameBase - vv.height > 120);
      if (!keyboardLikely) {
        window.setTimeout(() => {
          if (!document.activeElement?.closest?.('.nm-mobile-node-composer')) onClose?.();
        }, 120);
      }
    };
    vv?.addEventListener('resize', onVv);
    return () => vv?.removeEventListener('resize', onVv);
  }, [open, onClose]);

  if (!open || !node) return null;

  const titleValue = node.title ?? '';

  const ui = (
    <div className="nm-mobile-node-composer" role="presentation">
      <div className="nm-mobile-node-composer__sheet nm-mobile__chrome glass-blur glass-surface-strong glass-border">
        <div className="nm-mobile-node-composer__handle" aria-hidden />
        <div className="nm-mobile-node-composer__chips">
          <input
            ref={titleRef}
            type="text"
            value={titleValue}
            onChange={(e) => onUpdate?.({ title: e.target.value })}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder={displayNodeTitle(node)}
            aria-label="Node title"
            className="nm-mobile-node-composer__title"
          />
          <LiquidGlassIos26Button
            type="button"
            size="sm"
            title="Edit node"
            aria-label="Edit node"
            onClick={() => onOpenEdit?.(node.id)}
            icon={<SlidersHorizontal size={15} strokeWidth={1.75} />}
            className="nm-mobile-node-composer__edit !min-h-0 !p-2 !px-3 !shadow-none"
            fluid={false}
            motionPress={false}
          >
            Edit
          </LiquidGlassIos26Button>
        </div>
        {isNoteNode(node) ? (
          <textarea
            ref={bodyRef}
            value={node.content ?? ''}
            onChange={(e) => onUpdate?.({ content: e.target.value })}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder="Plan, ask, build…"
            aria-label="Note content"
            rows={3}
            className="nm-mobile-node-composer__body"
          />
        ) : null}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(ui, document.body) : ui;
}