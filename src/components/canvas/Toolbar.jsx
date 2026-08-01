import React, { useEffect, useRef, useState } from 'react';
import { Download, Upload, Trash2, Plus, ZoomIn, ZoomOut, Maximize, Minimize, Copy, Terminal, Search, Share2, Wrench, Settings, Home } from 'lucide-react';

function ToolbarButton({ children, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-2 sm:p-3 rounded-xl text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition"
    >
      {children}
    </button>
  );
}

function ToolbarGroup({ icon: Icon, title, options }) {
  const [hoverOpen, setHoverOpen] = useState(false);
  const [clickedOpen, setClickedOpen] = useState(false);
  const groupRef = useRef(null);
  const canHover = useRef(false);
  const open = hoverOpen || clickedOpen;

  useEffect(() => {
    canHover.current = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches || false;
    const close = (e) => {
      if (!open || groupRef.current?.contains(e.target)) return;

      setHoverOpen(false);
      setClickedOpen(false);

      const interactive = e.target.closest?.(
        'button, input, textarea, select, [role="button"], [contenteditable="true"], [data-note-node]'
      );

      if (!interactive) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [open]);

  const run = (action) => {
    action();
    setHoverOpen(false);
    setClickedOpen(false);
  };

  return (
    <div
      ref={groupRef}
      className="relative"
      onMouseEnter={() => canHover.current && setHoverOpen(true)}
      onMouseLeave={() => canHover.current && setHoverOpen(false)}
    >
      <ToolbarButton title={title} onClick={() => setClickedOpen((value) => !value)}>
        <Icon size={16} />
      </ToolbarButton>
      <div
        aria-hidden={!open}
        className={`absolute top-full left-1/2 w-44 -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/95 backdrop-blur-md shadow-xl transition-all duration-200 ease-out ${
          open
            ? 'visible max-h-64 opacity-100 translate-y-0 pointer-events-auto'
            : 'invisible max-h-0 opacity-0 -translate-y-1 pointer-events-none'
        }`}
      >
        <div className="flex flex-col gap-1 p-2">
          {options.map(({ label, icon: OptionIcon, action }) => (
            <button
              key={label}
              onClick={() => run(action)}
              tabIndex={open ? 0 : -1}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-white/80 hover:text-white hover:bg-white/10 active:scale-[0.98] transition"
            >
              <OptionIcon size={15} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Toolbar({ onExport, onImport, onClear, onTextExport, onOpenTerminal, onAutoOrganise, zoom, onZoom, onRecenter, isFullscreen, onToggleFullscreen, onAddNodeCenter, onOpenSettings }) {
  const fileRef = useRef(null);

  return (
    <>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 sm:gap-2 rounded-2xl border border-white/10 bg-zinc-900/80 backdrop-blur-md px-2 sm:px-3 py-2 sm:py-2.5 shadow-xl max-w-[96vw]">
        <ToolbarButton onClick={onAddNodeCenter} title="Add note"><Plus size={16} /></ToolbarButton>
        <div className="w-px h-6 bg-white/10 mx-1" />
        <ToolbarGroup
          icon={Search}
          title="View controls"
          options={[
            { label: 'Zoom In', icon: ZoomIn, action: () => onZoom(zoom * 1.2) },
            { label: 'Zoom Out', icon: ZoomOut, action: () => onZoom(zoom / 1.2) },
            { label: 'Recenter', icon: Home, action: onRecenter },
            { label: isFullscreen ? 'Exit Full Screen' : 'Full Screen', icon: isFullscreen ? Minimize : Maximize, action: onToggleFullscreen },
          ]}
        />
        <span className="hidden sm:inline text-xs text-white/50 w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <div className="w-px h-6 bg-white/10 mx-1" />
        <ToolbarGroup
          icon={Wrench}
          title="Tools"
          options={[
            { label: 'Auto Organise', icon: Wrench, action: onAutoOrganise },
          ]}
        />
        <ToolbarButton onClick={onOpenTerminal} title="Terminal"><Terminal size={16} /></ToolbarButton>
        <ToolbarGroup
          icon={Share2}
          title="Import and export"
          options={[
            { label: 'Copy', icon: Copy, action: onTextExport },
            { label: 'Import', icon: Upload, action: () => fileRef.current && fileRef.current.click() },
            { label: 'Export', icon: Download, action: onExport },
          ]}
        />
        <ToolbarButton onClick={onClear} title="Clear all"><Trash2 size={16} /></ToolbarButton>
        <div className="w-px h-6 bg-white/10 mx-1" />
        <ToolbarButton onClick={onOpenSettings} title="Settings"><Settings size={16} /></ToolbarButton>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onImport} />
      </div>

    </>
  );
}