import React, { useEffect, useState } from 'react';
import {
  Plus,
  Home,
  SquareDashed,
  MoreHorizontal,
  Terminal,
  Share2,
  Save,
  Trash2,
  Wrench,
  Menu,
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

function MoreSheet({ open, onClose, title, children, layout = 'grid' }) {
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
        <div className={layout === 'stack' ? 'nm-mobile__sheet-stack' : 'nm-mobile__sheet-grid'}>
          {children}
        </div>
      </div>
    </>
  );
  // Portal like NodeTypeMenu sheets so fixed positioning is viewport-relative
  // even if shell ancestors gain transform/filter later.
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
  workspaceName,
  onOpenSidebar,
  onClear,
  onOpenTerminal,
  onAutoOrganise,
  onOrganiseSelected,
  selectedCount = 0,
  selectionArmed = false,
  onToggleSelectionArm,
  zoom,
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

  // Tutorial targets live inside the workspace sheet — open/close with the tour.
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
      <div
        className="nm-mobile__top nm-mobile__chrome"
        data-mobile-chrome
        data-onboarding="mobile-top"
      >
        <div className="nm-mobile__top-side nm-mobile__top-side--start">
          <ChromeButton
            title="Menu"
            onClick={() => onOpenSidebar?.()}
            data-mobile-chrome
            data-onboarding="workspace-bar"
          >
            <Menu size={17} />
          </ChromeButton>
        </div>
        <div className="nm-mobile__top-center">
          {drawMode ? (
            <>
              <div className="nm-mobile__ws-name">Draw</div>
              <div className="nm-mobile__zoom">{Math.round(zoom * 100)}%</div>
            </>
          ) : (
            <>
              <div className="nm-mobile__ws-name" title={workspaceName}>
                {workspaceName}
              </div>
              <div className="nm-mobile__zoom">{Math.round(zoom * 100)}%</div>
            </>
          )}
        </div>
        <div className="nm-mobile__top-side nm-mobile__top-side--end" />
      </div>

      {!drawMode ? (
        <div data-onboarding="toolbar" data-mobile-chrome className="nm-mobile__nav nm-mobile__chrome">
          <div className="nm-mobile__nav-slot" data-onboarding="toolbar-recenter">
            <ChromeButton
              title="Recenter"
              onClick={() => {
                onRecenter();
                emitTutorial('toolbar.recenter');
              }}
            >
              <Home size={17} />
            </ChromeButton>
            <span className="nm-mobile__label">Home</span>
          </div>
          <div className="nm-mobile__nav-slot">
            <ChromeButton
              title="Draw"
              active={drawMode}
              onClick={() => {
                patchBg({ tool: 'pen' });
                if (selectionArmed) onToggleSelectionArm?.();
                onToggleDrawMode?.();
                setMoreSheetOpen(false);
              }}
            >
              <Paintbrush size={17} strokeWidth={1.75} />
            </ChromeButton>
            <span className="nm-mobile__label">Draw</span>
          </div>
          <div className="nm-mobile__nav-slot" data-onboarding="toolbar-add">
            <ChromeButton
              title="Add node"
              primary
              className="nm-mobile__fab"
              onClick={() => {
                setMoreSheetOpen(false);
                onAddNodeCenter();
              }}
            >
              <Plus size={20} />
            </ChromeButton>
            <span className="nm-mobile__label">Add</span>
          </div>
          <div className="nm-mobile__nav-slot" data-onboarding="toolbar-selection">
            <ChromeButton
              data-selection-arm-button
              title={selectionArmed ? 'Selection Mode armed — drag on canvas' : 'Selection Mode'}
              active={selectionArmed}
              onClick={() => {
                const next = !selectionArmed;
                onToggleSelectionArm();
                if (next) emitTutorial('toolbar.selection.arm');
              }}
            >
              <SquareDashed size={17} />
            </ChromeButton>
            <span className="nm-mobile__label">Select</span>
          </div>
          <div className="nm-mobile__nav-slot" data-onboarding="toolbar-tools">
            <ChromeButton
              title="More"
              active={moreSheetOpen}
              onClick={() => {
                if (moreSheetOpen) closeMoreSheet();
                else openMoreSheet({ fromTools: true });
              }}
            >
              <MoreHorizontal size={18} />
            </ChromeButton>
            <span className="nm-mobile__label">More</span>
          </div>
        </div>
      ) : null}

      <MoreSheet open={moreSheetOpen} title="More actions" onClose={closeMoreSheet}>
        <SheetItem
          icon={Wrench}
          label="Organise all"
          onClick={() => {
            onAutoOrganise();
            emitTutorial('toolbar.organise.all');
            closeMoreSheet();
          }}
        />
        <SheetItem
          icon={Wrench}
          label="Organise sel."
          disabled={!canOrganiseSelected}
          onClick={() => {
            onOrganiseSelected();
            emitTutorial('toolbar.organise.selected');
            closeMoreSheet();
          }}
        />
        <SheetItem
          icon={Terminal}
          label="Terminal"
          onClick={() => {
            onOpenTerminal();
            closeMoreSheet();
          }}
        />
        <SheetItem
          icon={Share2}
          label="Share"
          onClick={() => {
            onOpenShare?.();
            closeMoreSheet();
          }}
        />
        <SheetItem
          icon={Save}
          label="Save"
          onClick={() => {
            onOpenSave?.();
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
