import React, { useEffect, useRef, useState } from 'react';
import { Download, Upload, Trash2, Plus, ZoomIn, ZoomOut, Maximize, Minimize, Copy, Terminal, Search, Share2, Wrench, Settings, Home, SquareDashed } from 'lucide-react';

function AutoOrganiseAllIcon({ size = 15 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function AutoOrganiseSelectedIcon({ size = 15 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="2" />
      <rect x="7" y="7" width="4" height="4" rx="0.75" />
      <rect x="13" y="7" width="4" height="4" rx="0.75" />
      <rect x="7" y="13" width="4" height="4" rx="0.75" />
      <rect x="13" y="13" width="4" height="4" rx="0.75" />
    </svg>
  );
}

function ToolbarButton({
  children,
  onClick,
  title,
  disabled = false,
  active = false,
  className = '',
  'data-selection-arm-button': selectionArmButton,
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      title={title}
      disabled={disabled}
      data-selection-arm-button={selectionArmButton ? '' : undefined}
      className={`p-2 sm:p-3 rounded-xl transition active:scale-95 ${
        disabled
          ? 'text-nm-text-subtle cursor-not-allowed'
          : active
            ? 'text-indigo-100 bg-indigo-500/35 shadow-[0_0_0_1px_rgba(165,180,252,0.55),0_0_18px_rgba(99,102,241,0.55)]'
            : 'text-nm-text-secondary hover:text-nm-text hover:bg-nm-hover'
      } ${className}`}
    >
      {children}
    </button>
  );
}

function ToolbarGroup({ icon: Icon, title, options, dataOnboarding }) {
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
      data-onboarding={dataOnboarding}
      onMouseEnter={() => canHover.current && setHoverOpen(true)}
      onMouseLeave={() => canHover.current && setHoverOpen(false)}
    >
      <ToolbarButton title={title} onClick={() => setClickedOpen((value) => !value)}>
        <Icon size={16} />
      </ToolbarButton>
      <div
        aria-hidden={!open}
        className={`absolute top-full left-1/2 w-56 -translate-x-1/2 overflow-hidden rounded-2xl border border-nm-border bg-nm-chrome backdrop-blur-md shadow-xl transition-all duration-200 ease-out ${
          open
            ? 'visible max-h-64 opacity-100 translate-y-0 pointer-events-auto'
            : 'invisible max-h-0 opacity-0 -translate-y-1 pointer-events-none'
        }`}
      >
        <div className="flex flex-col gap-1 p-2">
          {options.map(({ label, icon: OptionIcon, action, disabled = false, title: optionTitle }) => (
            <button
              key={label}
              onClick={() => !disabled && run(action)}
              disabled={disabled}
              title={optionTitle || label}
              tabIndex={open && !disabled ? 0 : -1}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition active:scale-[0.98] ${
                disabled
                  ? 'text-nm-text-subtle cursor-not-allowed'
                  : 'text-nm-text-secondary hover:text-nm-text hover:bg-nm-hover'
              }`}
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

export default function Toolbar({
  onExport,
  onImport,
  onClear,
  onTextExport,
  onOpenTerminal,
  onAutoOrganise,
  onOrganiseSelected,
  selectedCount = 0,
  selectionArmed = false,
  onToggleSelectionArm,
  zoom,
  onZoom,
  onRecenter,
  isFullscreen,
  onToggleFullscreen,
  onAddNodeCenter,
  onOpenSettings,
}) {
  const fileRef = useRef(null);
  const canOrganiseSelected = selectedCount >= 2;
  const [showMobileSelection, setShowMobileSelection] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.('(hover: hover) and (pointer: fine)');
    const update = () => setShowMobileSelection(!(mq?.matches));
    update();
    if (!mq?.addEventListener) return undefined;
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return (
    <>
      <div
        data-onboarding="toolbar"
        className="absolute left-1/2 z-50 flex max-w-[min(96vw,calc(100%-2rem-var(--safe-left)-var(--safe-right)))] -translate-x-1/2 items-center gap-1 rounded-2xl border border-nm-border bg-nm-chrome px-2 py-2 shadow-xl backdrop-blur-md sm:gap-2 sm:px-3 sm:py-2.5"
        style={{ top: 'calc(1rem + var(--safe-top))' }}
      >
        <span data-onboarding="toolbar-add" className="inline-flex">
          <ToolbarButton onClick={onAddNodeCenter} title="Add note"><Plus size={16} /></ToolbarButton>
        </span>
        <div className="w-px h-6 bg-nm-divider mx-1" />
        <ToolbarGroup
          icon={Search}
          title="View controls"
          dataOnboarding="toolbar-view"
          options={[
            { label: 'Zoom In', icon: ZoomIn, action: () => onZoom(zoom * 1.2) },
            { label: 'Zoom Out', icon: ZoomOut, action: () => onZoom(zoom / 1.2) },
            { label: 'Recenter', icon: Home, action: onRecenter },
            // Full screen is desktop-only — mobile Safari has no reliable Fullscreen API.
            ...(!showMobileSelection
              ? [
                  {
                    label: isFullscreen ? 'Exit Full Screen' : 'Full Screen',
                    icon: isFullscreen ? Minimize : Maximize,
                    action: onToggleFullscreen,
                  },
                ]
              : []),
          ]}
        />
        <span className="hidden sm:inline text-xs text-nm-text-muted w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        {showMobileSelection && (
          <span data-onboarding="toolbar-selection" className="inline-flex">
            <ToolbarButton
              data-selection-arm-button
              active={selectionArmed}
              onClick={onToggleSelectionArm}
              title={selectionArmed ? 'Selection Mode armed — drag on canvas' : 'Selection Mode'}
            >
              <SquareDashed size={16} />
            </ToolbarButton>
          </span>
        )}
        <div className="w-px h-6 bg-nm-divider mx-1" />
        <ToolbarGroup
          icon={Wrench}
          title="Tools"
          dataOnboarding="toolbar-tools"
          options={[
            { label: 'Auto Organise All', icon: AutoOrganiseAllIcon, action: onAutoOrganise },
            {
              label: 'Auto Organise Selected',
              icon: AutoOrganiseSelectedIcon,
              action: onOrganiseSelected,
              disabled: !canOrganiseSelected,
              title: canOrganiseSelected
                ? 'Auto Organise Selected'
                : 'Select two or more nodes to organise',
            },
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
        <div className="w-px h-6 bg-nm-divider mx-1" />
        <span data-onboarding="toolbar-settings" className="inline-flex">
          <ToolbarButton onClick={onOpenSettings} title="Settings"><Settings size={16} /></ToolbarButton>
        </span>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onImport} />
      </div>

    </>
  );
}
