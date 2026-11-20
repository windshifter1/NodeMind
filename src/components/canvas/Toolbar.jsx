import React, { useEffect, useRef, useState } from 'react';
import {
  Trash2,
  Terminal,
  Share2,
  Save,
  Wrench,
  Home,
  SquareDashed,
  Paintbrush,
} from 'lucide-react';
import { emitTutorial } from '@/lib/tutorialEvents';
import { useTutorialHighlight } from '@/hooks/useTutorialHighlight';
import { normalizeBackgroundArt } from '@/lib/backgroundArt';
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
      className={`nm-toolbar__btn inline-flex shrink-0 items-center justify-center rounded-md p-1.5 transition ${
        disabled
          ? 'cursor-not-allowed text-nm-text-subtle'
          : active
            ? 'bg-nm-hover-strong text-nm-text'
            : 'text-nm-text-secondary hover:bg-nm-hover hover:text-nm-text'
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
      className="nm-toolbar-glide-cluster shrink-0"
      data-onboarding={dataOnboarding}
      onMouseEnter={() => canHover.current && !clickOnlyOpen && setHoverOpen(true)}
      onMouseLeave={() => canHover.current && !clickOnlyOpen && setHoverOpen(false)}
    >
      <ToolbarButton
        title={title}
        active={open}
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
      <div className={`nm-toolbar-glide ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <div className="nm-toolbar-glide__inner">
          <div className="nm-toolbar-glide__row" role="menu">
            {options.map(({ label, icon: OptionIcon, action, disabled = false, title: optionTitle, tutorialEvent }) => (
              <button
                key={label}
                type="button"
                role="menuitem"
                onClick={() => !disabled && run(action, tutorialEvent)}
                disabled={disabled}
                title={optionTitle || label}
                tabIndex={open && !disabled ? 0 : -1}
                className={`nm-toolbar__btn nm-toolbar-glide__item ${
                  disabled ? 'is-disabled' : ''
                }`}
              >
                <OptionIcon size={16} />
              </button>
            ))}
          </div>
          <div className="nm-toolbar-glide__underline" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

export default function Toolbar({
  onClear,
  onOpenTerminal,
  onAutoOrganise,
  onOrganiseSelected,
  selectedCount = 0,
  selectionArmed = false,
  onToggleSelectionArm,
  zoom,
  onRecenter,
  drawMode = false,
  onToggleDrawMode,
  backgroundArt,
  onBackgroundArtChange,
  onOpenShare,
  onOpenSave,
}) {
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
    'nm-toolbar relative z-50 flex min-w-0 flex-wrap items-center justify-end gap-0.5';

  return (
    <>
      <div
        data-onboarding="toolbar"
        className={chromeClass}
      >
        <ToolbarButton
          active={drawMode}
          onClick={() => {
            if (!drawMode) patchBg({ tool: 'pen' });
            onToggleDrawMode?.();
          }}
          title={drawMode ? 'Draw mode (tools on canvas)' : 'Draw on canvas background'}
          className="shrink-0"
          data-onboarding="toolbar-draw"
        >
          <Paintbrush size={16} strokeWidth={1.75} />
        </ToolbarButton>
        <div className="mx-0.5 h-6 w-px shrink-0 bg-nm-divider sm:mx-1" />
        <span data-onboarding="toolbar-recenter" className="inline-flex shrink-0">
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
        {showMobileSelection && (
          <span data-onboarding="toolbar-selection" className="inline-flex shrink-0">
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
        <div className="mx-0.5 hidden h-6 w-px shrink-0 bg-nm-divider sm:mx-1 sm:block" />
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
        <ToolbarButton onClick={onOpenTerminal} title="Terminal">
          <Terminal size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => onOpenShare?.()}
          title="Share"
          className="shrink-0"
        >
          <Share2 size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => onOpenSave?.()}
          title="Save"
          className="shrink-0"
        >
          <Save size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={onClear} title="Clear all">
          <Trash2 size={16} />
        </ToolbarButton>
      </div>
    </>
  );
}
