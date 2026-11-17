import React, { useEffect, useState } from 'react';
import {
  Plus,
  Home,
  SquareDashed,
  Terminal,
  Share2,
  Save,
  Trash2,
  Wrench,
  PanelLeft,
  Paintbrush,
  X,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { emitTutorial } from '@/lib/tutorialEvents';
import { normalizeBackgroundArt } from '@/lib/backgroundArt';
import { useSheetDragDismiss } from '@/hooks/useSheetDragDismiss';
import './mobileChrome.css';

function ChromeButton({
  children,
  title,
  active = false,
  primary = false,
  className = '',
  onClick,
  disabled = false,
  'data-onboarding': dataOnboarding,
  'data-mobile-chrome': dataMobileChrome,
  'data-selection-arm-button': selectionArmButton,
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      data-onboarding={dataOnboarding}
      data-mobile-chrome={dataMobileChrome != null ? '' : undefined}
      data-selection-arm-button={selectionArmButton ? '' : undefined}
      className={[
        'nm-mobile__btn',
        active ? 'nm-mobile__btn--active' : '',
        primary ? 'nm-mobile__btn--primary' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  );
}

function AutoOrganiseAllIcon({ size = 18 }) {
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

function AutoOrganiseSelectedIcon({ size = 18 }) {
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

function MoreSheet({ open, onClose, title, children }) {
  const { sheetRef, backdropRef, handleProps } = useSheetDragDismiss(onClose, { open });
  if (!open) return null;
  const sheetUi = (
    <>
      <button
        ref={backdropRef}
        type="button"
        className="nm-mobile__sheet-backdrop"
        aria-label="Close sheet"
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className="nm-mobile__sheet nm-mobile__chrome"
        role="dialog"
        aria-label={title}
      >
        <div className="nm-mobile__sheet-handle-hit" {...handleProps}>
          <div className="nm-mobile__sheet-handle" />
        </div>
        <div className="nm-mobile__sheet-head">
          <p className="nm-mobile__sheet-title">{title}</p>
          <ChromeButton title="Close" onClick={onClose} className="nm-mobile__sheet-close">
            <X size={16} />
          </ChromeButton>
        </div>
        <div className="nm-mobile__sheet-grid">{children}</div>
      </div>
    </>
  );
  return typeof document !== 'undefined' ? createPortal(sheetUi, document.body) : sheetUi;
}

function SheetItem({ icon: Icon, label, onClick, disabled = false, dataOnboarding }) {
  return (
    <button
      type="button"
      className="nm-mobile__sheet-item"
      onClick={onClick}
      disabled={disabled}
      data-onboarding={dataOnboarding}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );
}

export default function MobileChrome({
  onOpenSidebar,
  onClear,
  onOpenTerminal,
  onAutoOrganise,
  onOrganiseSelected,
  selectedCount = 0,
  selectionArmed = false,
  onToggleSelectionArm,
  onRecenter,
  onAddNodeCenter,
  drawMode = false,
  onToggleDrawMode,
  backgroundArt,
  onBackgroundArtChange,
  onOpenShare,
  onOpenSave,
}) {
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [moreOpenedByTools, setMoreOpenedByTools] = useState(false);
  const canOrganiseSelected = selectedCount >= 2;
  const bg = normalizeBackgroundArt(backgroundArt);

  useEffect(() => {
    const syncFromTutorial = () => {
      if (document.body.dataset.tutorialActive !== 'mobile') return;
      const target = document.body.dataset.tutorialHighlight || '';
      if (target.startsWith('workspace') || target === 'toolbar-settings') {
        setMoreSheetOpen(false);
        onOpenSidebar?.();
        return;
      }
      if (target && target !== 'toolbar-tools') {
        setMoreSheetOpen(false);
      }
    };
    syncFromTutorial();
    const obs = new MutationObserver(syncFromTutorial);
    obs.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-tutorial-highlight', 'data-tutorial-active'],
    });
    return () => obs.disconnect();
  }, [onOpenSidebar]);

  const closeMoreSheet = () => {
    setMoreSheetOpen(false);
    if (moreOpenedByTools) {
      setMoreOpenedByTools(false);
      emitTutorial('toolbar.tools.close');
    }
  };

  const openMoreSheet = ({ fromTools = false } = {}) => {
    setMoreOpenedByTools(fromTools);
    setMoreSheetOpen(true);
  };

  const patchBg = (patch) => onBackgroundArtChange?.({ ...bg, ...patch });

  return (
    <>
      <div className="nm-mobile__top" data-mobile-chrome data-onboarding="mobile-top">
        <ChromeButton
          title="Menu"
          className="nm-mobile__orb nm-mobile__chrome"
          onClick={() => onOpenSidebar?.()}
          data-mobile-chrome
          data-onboarding="workspace-bar"
        >
          <PanelLeft size={18} strokeWidth={1.75} />
        </ChromeButton>

        <div className="nm-mobile__split nm-mobile__chrome" role="group" aria-label="Save and share">
          <button
            type="button"
            className="nm-mobile__split-btn"
            onClick={() => onOpenSave?.()}
          >
            <Save size={14} strokeWidth={1.75} />
            Save
          </button>
          <span className="nm-mobile__split-div" aria-hidden="true" />
          <button
            type="button"
            className="nm-mobile__split-btn"
            onClick={() => onOpenShare?.()}
          >
            <Share2 size={14} strokeWidth={1.75} />
            Share
          </button>
        </div>

        <div className="nm-mobile__top-end" data-onboarding="toolbar-recenter">
          <ChromeButton
            title="Recenter"
            className="nm-mobile__orb nm-mobile__chrome"
            onClick={() => {
              onRecenter();
              emitTutorial('toolbar.recenter');
            }}
          >
            <Home size={18} strokeWidth={1.75} />
          </ChromeButton>
        </div>
      </div>

      <div
        data-onboarding="toolbar"
        data-mobile-chrome
        className="nm-mobile__dock"
      >
        <div className="nm-mobile__composer nm-mobile__chrome">
          <ChromeButton
            title="Add node"
            primary
            className="nm-mobile__composer-add"
            data-onboarding="toolbar-add"
            onClick={() => {
              setMoreSheetOpen(false);
              onAddNodeCenter();
            }}
          >
            <Plus size={20} strokeWidth={2.25} />
          </ChromeButton>

          <div className="nm-mobile__composer-tools">
            <ChromeButton
              title="Draw"
              active={drawMode}
              onClick={() => {
                if (!drawMode) patchBg({ tool: 'pen' });
                if (selectionArmed) onToggleSelectionArm?.();
                onToggleDrawMode?.();
                setMoreSheetOpen(false);
              }}
            >
              <Paintbrush size={18} strokeWidth={1.75} />
            </ChromeButton>
            <ChromeButton
              title="Tools"
              active={moreSheetOpen}
              data-onboarding="toolbar-tools"
              onClick={() => {
                if (moreSheetOpen) closeMoreSheet();
                else openMoreSheet({ fromTools: true });
              }}
            >
              <Wrench size={18} strokeWidth={1.75} />
            </ChromeButton>
            <ChromeButton
              title="Terminal"
              onClick={() => {
                onOpenTerminal();
                setMoreSheetOpen(false);
              }}
            >
              <Terminal size={18} strokeWidth={1.75} />
            </ChromeButton>
            <ChromeButton
              data-selection-arm-button
              data-onboarding="toolbar-selection"
              title={selectionArmed ? 'Selection Mode armed — drag on canvas' : 'Selection Mode'}
              active={selectionArmed}
              onClick={() => {
                const next = !selectionArmed;
                onToggleSelectionArm();
                if (next) emitTutorial('toolbar.selection.arm');
              }}
            >
              <SquareDashed size={18} />
            </ChromeButton>
          </div>
        </div>
      </div>

      <MoreSheet open={moreSheetOpen} title="Tools" onClose={closeMoreSheet}>
        <SheetItem
          icon={AutoOrganiseAllIcon}
          label="Organise all"
          onClick={() => {
            onAutoOrganise();
            emitTutorial('toolbar.organise.all');
            closeMoreSheet();
          }}
        />
        <SheetItem
          icon={AutoOrganiseSelectedIcon}
          label="Organise sel."
          disabled={!canOrganiseSelected}
          onClick={() => {
            onOrganiseSelected();
            emitTutorial('toolbar.organise.selected');
            closeMoreSheet();
          }}
        />
        <SheetItem
          icon={Trash2}
          label="Clear"
          onClick={() => {
            onClear();
            closeMoreSheet();
          }}
        />
      </MoreSheet>
    </>
  );
}
