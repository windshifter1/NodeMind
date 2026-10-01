import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Upload,
  Trash2,
  Plus,
  Copy,
  Terminal,
  Share2,
  Wrench,
  Settings,
  Home,
  SquareDashed,
  Pencil,
  Eraser,
  MousePointer2,
  ImagePlus,
  Hand,
  X,
} from 'lucide-react';
import { emitTutorial } from '@/lib/tutorialEvents';
import { useTutorialHighlight } from '@/hooks/useTutorialHighlight';
import { normalizeBackgroundArt } from '@/lib/backgroundArt';
import { addBackgroundImage } from './BackgroundDrawLayer';

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
  const toolsOpenedByClickRef = useRef(false);
  const toolsTutorialActive = useTutorialHighlight('toolbar-tools');
  const clickOnlyOpen = dataOnboarding === 'toolbar-tools' && toolsTutorialActive;
  const open = clickOnlyOpen ? clickedOpen : hoverOpen || clickedOpen;

  const closeTools = (emitClose = false) => {
    const wasOpen = open;
    const openedByClick = toolsOpenedByClickRef.current;
    setHoverOpen(false);
    setClickedOpen(false);
    toolsOpenedByClickRef.current = false;
    if (
      emitClose &&
      wasOpen &&
      openedByClick &&
      dataOnboarding === 'toolbar-tools'
    ) {
      emitTutorial('toolbar.tools.close');
    }
  };

  useEffect(() => {
    canHover.current = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches || false;
    const close = (e) => {
      if (!open || groupRef.current?.contains(e.target)) return;

      closeTools(true);

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
  }, [open, dataOnboarding]);

  const run = (action, eventName) => {
    action();
    if (eventName) emitTutorial(eventName);
    closeTools(true);
  };

  useEffect(() => {
    if (clickOnlyOpen) setHoverOpen(false);
  }, [clickOnlyOpen]);

  return (
    <div
      ref={groupRef}
      className="relative"
      data-onboarding={dataOnboarding}
      onMouseEnter={() => canHover.current && !clickOnlyOpen && setHoverOpen(true)}
      onMouseLeave={() => canHover.current && !clickOnlyOpen && setHoverOpen(false)}
    >
      <ToolbarButton
        title={title}
        onClick={() => {
          setClickedOpen((value) => {
            const next = !value;
            if (dataOnboarding === 'toolbar-tools') {
              if (next) toolsOpenedByClickRef.current = true;
              else if (toolsOpenedByClickRef.current) {
                toolsOpenedByClickRef.current = false;
                emitTutorial('toolbar.tools.close');
              }
            }
            return next;
          });
        }}
      >
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
          {options.map(({ label, icon: OptionIcon, action, disabled = false, title: optionTitle, tutorialEvent }) => (
            <button
              key={label}
              onClick={() => !disabled && run(action, tutorialEvent)}
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
  onRecenter,
  onAddNodeCenter,
  onOpenSettings,
  drawMode = false,
  onToggleDrawMode,
  backgroundArt,
  onBackgroundArtChange,
}) {
  const fileRef = useRef(null);
  const imageRef = useRef(null);
  const canOrganiseSelected = selectedCount >= 2;
  const [showMobileSelection, setShowMobileSelection] = useState(false);
  const bg = normalizeBackgroundArt(backgroundArt);

  useEffect(() => {
    const mq = window.matchMedia?.('(hover: hover) and (pointer: fine)');
    const update = () => setShowMobileSelection(!(mq?.matches));
    update();
    if (!mq?.addEventListener) return undefined;
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const patchBg = (patch) => onBackgroundArtChange?.({ ...bg, ...patch });

  const chromeClass =
    'absolute left-1/2 z-50 flex max-w-[min(96vw,calc(100%-2rem-var(--safe-left)-var(--safe-right)))] -translate-x-1/2 items-center gap-1 overflow-visible rounded-2xl border border-nm-border bg-nm-chrome px-2 py-2 shadow-xl backdrop-blur-md sm:gap-2 sm:px-3 sm:py-2.5';

  if (drawMode) {
    return (
      <>
        <div
          data-onboarding="toolbar"
          data-draw-toolbar
          className={chromeClass}
          style={{ top: 'calc(1rem + var(--safe-top))' }}
        >
          <ToolbarButton
            active
            onClick={() => onToggleDrawMode?.()}
            title="Done — exit draw mode"
          >
            <X size={16} />
          </ToolbarButton>
          <span className="hidden px-1 text-xs font-medium text-nm-text-muted sm:inline">Draw</span>
          <div className="w-px h-6 bg-nm-divider mx-1" />
          <ToolbarButton
            active={bg.tool === 'pan'}
            onClick={() => patchBg({ tool: 'pan' })}
            title="Pan canvas"
          >
            <Hand size={16} />
          </ToolbarButton>
          <ToolbarButton
            active={bg.tool === 'pen'}
            onClick={() => patchBg({ tool: 'pen' })}
            title="Pen"
          >
            <Pencil size={16} />
          </ToolbarButton>
          <ToolbarButton
            active={bg.tool === 'erase'}
            onClick={() => patchBg({ tool: 'erase' })}
            title="Erase"
          >
            <Eraser size={16} />
          </ToolbarButton>
          <ToolbarButton
            active={bg.tool === 'select'}
            onClick={() => patchBg({ tool: 'select' })}
            title="Select and move"
          >
            <MousePointer2 size={16} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => imageRef.current?.click()}
            title="Place image on background"
          >
            <ImagePlus size={16} />
          </ToolbarButton>
          <div className="w-px h-6 bg-nm-divider mx-1" />
          <label
            className="flex items-center gap-1.5 px-1 text-[10px] text-nm-text-muted"
            title="Pen width"
          >
            <span className="hidden sm:inline">Width</span>
            <input
              type="range"
              min={1}
              max={24}
              value={bg.penWidth}
              onChange={(e) => patchBg({ penWidth: Number(e.target.value) })}
              className="w-16 sm:w-20"
            />
          </label>
          <input
            type="color"
            value={bg.color}
            onChange={(e) => patchBg({ color: e.target.value })}
            title="Pen colour"
            className="h-8 w-8 cursor-pointer rounded-lg border border-nm-border bg-transparent p-0.5"
          />
          <label
            className="flex items-center gap-1.5 px-1 text-[10px] text-nm-text-muted"
            title="Emissiveness (glow), default 0"
          >
            <span className="hidden sm:inline">Glow</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round((bg.emissiveness || 0) * 100)}
              onChange={(e) => patchBg({ emissiveness: Number(e.target.value) / 100 })}
              className="w-14 sm:w-16"
            />
          </label>
          {bg.tool === 'erase' && (
            <select
              value={bg.eraseMode}
              onChange={(e) => patchBg({ eraseMode: e.target.value })}
              className="rounded-xl border border-nm-border bg-transparent px-2 py-1.5 text-xs text-nm-text-secondary"
              title="Erase type"
            >
              <option value="stroke">Stroke</option>
              <option value="area">Area</option>
            </select>
          )}
          <div className="w-px h-6 bg-nm-divider mx-1" />
          <ToolbarButton
            onClick={() => {
              onRecenter();
              emitTutorial('toolbar.recenter');
            }}
            title="Recenter"
          >
            <Home size={16} />
          </ToolbarButton>
          <span className="hidden sm:inline text-xs text-nm-text-muted w-10 text-center tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
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

  return (
    <>
      <div
        data-onboarding="toolbar"
        className={chromeClass}
        style={{ top: 'calc(1rem + var(--safe-top))' }}
      >
        <span data-onboarding="toolbar-add" className="inline-flex">
          <ToolbarButton
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              onAddNodeCenter({
                clientX: rect.left + rect.width / 2 - 140,
                clientY: rect.bottom + 10,
              });
            }}
            title="Add node"
          >
            <Plus size={16} />
          </ToolbarButton>
        </span>
        <div className="w-px h-6 bg-nm-divider mx-1" />
        <ToolbarButton
          onClick={() => {
            patchBg({ tool: 'pan' });
            onToggleDrawMode?.();
          }}
          title="Draw on workspace background"
        >
          <Pencil size={16} />
        </ToolbarButton>
        <div className="w-px h-6 bg-nm-divider mx-1" />
        <span data-onboarding="toolbar-recenter" className="inline-flex">
          <ToolbarButton
            onClick={() => {
              onRecenter();
              emitTutorial('toolbar.recenter');
            }}
            title="Recenter"
          >
            <Home size={16} />
          </ToolbarButton>
        </span>
        <span className="hidden sm:inline text-xs text-nm-text-muted w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        {showMobileSelection && (
          <span data-onboarding="toolbar-selection" className="inline-flex">
            <ToolbarButton
              data-selection-arm-button
              active={selectionArmed}
              onClick={() => {
                const next = !selectionArmed;
                onToggleSelectionArm();
                if (next) emitTutorial('toolbar.selection.arm');
              }}
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
            {
              label: 'Auto Organise All',
              icon: AutoOrganiseAllIcon,
              action: onAutoOrganise,
              tutorialEvent: 'toolbar.organise.all',
            },
            {
              label: 'Auto Organise Selected',
              icon: AutoOrganiseSelectedIcon,
              action: onOrganiseSelected,
              disabled: !canOrganiseSelected,
              title: canOrganiseSelected
                ? 'Auto Organise Selected'
                : 'Select two or more nodes to organise',
              tutorialEvent: 'toolbar.organise.selected',
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
          <ToolbarButton
            onClick={() => {
              onOpenSettings();
              emitTutorial('toolbar.settings.open');
            }}
            title="Settings"
          >
            <Settings size={16} />
          </ToolbarButton>
        </span>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onImport} />
      </div>
    </>
  );
}
