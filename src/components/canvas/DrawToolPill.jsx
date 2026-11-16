import React, { useRef } from 'react';
import {
  Eraser,
  Hand,
  ImagePlus,
  MousePointer2,
  PenLine,
  X,
} from 'lucide-react';
import { normalizeBackgroundArt, PEN_WIDTH_PRESETS } from '@/lib/backgroundArt';
import { addBackgroundImage } from '@/components/canvas/BackgroundDrawLayer';

function PillButton({ active, title, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={`nm-draw-pill__btn ${active ? 'is-on' : ''}`}
    >
      {children}
    </button>
  );
}

export default function DrawToolPill({ backgroundArt, onBackgroundArtChange, onExit }) {
  const imageRef = useRef(null);
  const colorRef = useRef(null);
  const bg = normalizeBackgroundArt(backgroundArt);
  const patchBg = (patch) => onBackgroundArtChange?.({ ...bg, ...patch });

  return (
    <>
      <div
        className="nm-draw-pill"
        data-draw-toolbar
        role="toolbar"
        aria-label="Draw tools"
      >
        <PillButton active title="Done — exit draw mode" onClick={onExit}>
          <X size={18} strokeWidth={1.75} />
        </PillButton>

        <div className="nm-draw-pill__divider" />

        <PillButton
          active={bg.tool === 'pan'}
          title="Pan canvas"
          onClick={() => patchBg({ tool: 'pan' })}
        >
          <Hand size={18} strokeWidth={1.75} />
        </PillButton>
        <PillButton
          active={bg.tool === 'pen'}
          title="Pen"
          onClick={() => patchBg({ tool: 'pen' })}
        >
          <PenLine size={18} strokeWidth={1.75} />
        </PillButton>
        <PillButton
          active={bg.tool === 'erase'}
          title="Erase"
          onClick={() => patchBg({ tool: 'erase' })}
        >
          <Eraser size={18} strokeWidth={1.75} />
        </PillButton>
        <PillButton
          active={bg.tool === 'select'}
          title="Select and move"
          onClick={() => patchBg({ tool: 'select' })}
        >
          <MousePointer2 size={18} strokeWidth={1.75} />
        </PillButton>
        <PillButton title="Place image on background" onClick={() => imageRef.current?.click()}>
          <ImagePlus size={18} strokeWidth={1.75} />
        </PillButton>

        <div className="nm-draw-pill__divider" />

        <div className="nm-draw-pill__color-wrap">
          <button
            type="button"
            title="Pen colour"
            aria-label="Pen colour"
            className="nm-draw-pill__color"
            style={{ backgroundColor: bg.color }}
            onClick={() => colorRef.current?.click()}
          />
          <input
            ref={colorRef}
            type="color"
            value={bg.color}
            onChange={(e) => patchBg({ color: e.target.value })}
            className="nm-draw-pill__color-input"
            tabIndex={-1}
            aria-hidden
          />
        </div>

        <select
          value={bg.penWidth}
          onChange={(e) => patchBg({ penWidth: Number(e.target.value) })}
          className="nm-draw-pill__select nm-draw-pill__select--width"
          title="Pen width"
          aria-label="Pen width"
        >
          {PEN_WIDTH_PRESETS.map((w) => (
            <option key={w} value={w}>
              {w}px
            </option>
          ))}
        </select>

        {bg.tool === 'erase' ? (
          <select
            value={bg.eraseMode}
            onChange={(e) => patchBg({ eraseMode: e.target.value })}
            className="nm-draw-pill__select"
            title="Erase type"
            aria-label="Erase type"
          >
            <option value="stroke">Stroke</option>
            <option value="area">Area</option>
          </select>
        ) : null}
      </div>

      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try {
            const next = await addBackgroundImage(bg, file);
            onBackgroundArtChange?.(next);
          } catch {
            /* ignore */
          }
        }}
      />
    </>
  );
}