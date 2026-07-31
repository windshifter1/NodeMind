import React, { useRef } from 'react';
import { Download, Upload, Trash2, Plus, ZoomIn, ZoomOut, Maximize, Minimize, Sun, Moon, Copy } from 'lucide-react';

export default function Toolbar({ onExport, onImport, onClear, onTextExport, zoom, onZoom, isFullscreen, onToggleFullscreen, onAddNodeCenter, nodeTheme, onToggleTheme }) {
  const fileRef = useRef(null);

  const Btn = ({ children, onClick, title }) => (
    <button
      onClick={onClick}
      title={title}
      className="p-2 sm:p-3 rounded-xl text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition"
    >
      {children}
    </button>
  );

  return (
    <>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 sm:gap-2 rounded-2xl border border-white/10 bg-zinc-900/80 backdrop-blur-md px-2 sm:px-3 py-2 sm:py-2.5 shadow-xl max-w-[96vw]">
        <Btn onClick={onAddNodeCenter} title="Add note"><Plus size={16} /></Btn>
        <div className="w-px h-6 bg-white/10 mx-1" />
        <Btn onClick={() => onZoom(zoom * 1.2)} title="Zoom in"><ZoomIn size={16} /></Btn>
        <span className="hidden sm:inline text-xs text-white/50 w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <Btn onClick={() => onZoom(zoom / 1.2)} title="Zoom out"><ZoomOut size={16} /></Btn>
        <Btn onClick={onToggleFullscreen} title={isFullscreen ? 'Exit full screen' : 'Full screen'}>
          {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </Btn>
        <div className="w-px h-6 bg-white/10 mx-1" />
        <Btn onClick={onTextExport} title="Copy as text"><Copy size={16} /></Btn>
        <Btn onClick={onExport} title="Export JSON"><Download size={16} /></Btn>
        <Btn onClick={() => fileRef.current && fileRef.current.click()} title="Import JSON"><Upload size={16} /></Btn>
        <Btn onClick={onClear} title="Clear all"><Trash2 size={16} /></Btn>
        <div className="w-px h-6 bg-white/10 mx-1" />
        <Btn onClick={onToggleTheme} title={nodeTheme === 'dark' ? 'Light notes' : 'Dark notes'}>
          {nodeTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </Btn>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onImport} />
      </div>

    </>
  );
}