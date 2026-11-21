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
import { emitTutorial } from '@/lib/tutorialEvents';
import { normalizeBackgroundArt } from '@/lib/backgroundArt';
import {
  LiquidGlassButton,
  LiquidGlassIos26Button,
  LiquidGlassSheet,
} from '@/lib/liquid-glass';
import './mobileChrome.css';

function LgOrb({ title, active = false, className = '', onClick, disabled, icon, children, ...rest }) {
  return (
    <LiquidGlassIos26Button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      size="sm"
      icon={icon ?? children}
      className={`nm-mobile__btn nm-mobile__orb !min-h-0 !min-w-0 !p-0 !shadow-none ${
        active ? 'nm-mobile__btn--active' : ''
      } ${className}`}
      {...rest}
    />
  );
}

function SplitChromeButton({ title, icon, onClick }) {
  return (
    <LiquidGlassIos26Button
      type="button"
      title={title}
      aria-label={title}
      size="sm"
      onClick={onClick}
      icon={icon}
      className="nm-mobile__split-btn !min-h-0 !min-w-0 !rounded-none !border-0 !p-0 !shadow-none"
    />
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
  return (
    <LiquidGlassSheet
      isOpen={open}
      onClose={onClose}
      variant="compact"
      className="nm-mobile__sheet nm-mobile__chrome !max-w-none"
      header={
        <div className="nm-mobile__sheet-head">
          <p className="nm-mobile__sheet-title">{title}</p>
          <LiquidGlassIos26Button
            type="button"
            title="Close"
            aria-label="Close"
            size="sm"
            onClick={onClose}
            icon={<X size={16} />}
            className="nm-mobile__sheet-close !min-h-0 !min-w-0 !p-2 !shadow-none"
          />
        </div>
      }
    >
      <div className="nm-mobile__sheet-grid !px-0 !pb-0">{children}</div>
    </LiquidGlassSheet>
  );
}

function SheetItem({ icon: Icon, label, onClick, disabled = false, dataOnboarding }) {
  return (
    <LiquidGlassButton
      type="button"
      variant="ghost"
      fullWidth
      disabled={disabled}
      onClick={onClick}
      data-onboarding={dataOnboarding}
      icon={<Icon size={18} />}
      className="nm-mobile__sheet-item !justify-start !rounded-2xl"
    >
      {label}
    </LiquidGlassButton>
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

  const iconBtnClass =
    'nm-mobile__btn !min-h-0 !min-w-0 !p-2.5 !rounded-2xl !shadow-none';

  return (
    <>
      <div className="nm-mobile__top" data-mobile-chrome data-onboarding="mobile-top">
        <div className="nm-mobile__cluster">
          <LgOrb
            title="Menu"
            className="nm-mobile__chrome"
            onClick={() => onOpenSidebar?.()}
            data-mobile-chrome
            data-onboarding="workspace-bar"
            icon={<PanelLeft size={18} strokeWidth={1.75} />}
          />

          <div className="nm-mobile__split nm-mobile__chrome" role="group" aria-label="Save and share">
            <SplitChromeButton
              title="Save"
              icon={<Save size={16} strokeWidth={1.75} />}
              onClick={() => onOpenSave?.()}
            />
            <span className="nm-mobile__split-div" aria-hidden="true" />
            <SplitChromeButton
              title="Share"
              icon={<Share2 size={16} strokeWidth={1.75} />}
              onClick={() => onOpenShare?.()}
            />
          </div>
        </div>

        <div className="nm-mobile__top-end" data-onboarding="toolbar-recenter">
          <LgOrb
            title="Recenter"
            className="nm-mobile__chrome"
            onClick={() => {
              onRecenter();
              emitTutorial('toolbar.recenter');
            }}
            icon={<Home size={18} strokeWidth={1.75} />}
          />
        </div>
      </div>

      <div data-onboarding="toolbar" data-mobile-chrome className="nm-mobile__dock">
        <div className="nm-mobile__composer nm-mobile__chrome">
          <LiquidGlassIos26Button
            type="button"
            title="Add node"
            aria-label="Add node"
            size="sm"
            onClick={() => {
              setMoreSheetOpen(false);
              onAddNodeCenter();
            }}
            data-onboarding="toolbar-add"
            icon={<Plus size={20} strokeWidth={2.25} />}
            className="nm-mobile__composer-add nm-mobile__btn nm-mobile__btn--primary !min-h-0 !min-w-0 !p-0 !shadow-none"
          />

          <div className="nm-mobile__composer-tools">
            <LiquidGlassIos26Button
              type="button"
              title="Draw"
              size="sm"
              onClick={() => {
                if (!drawMode) patchBg({ tool: 'pen' });
                if (selectionArmed) onToggleSelectionArm?.();
                onToggleDrawMode?.();
                setMoreSheetOpen(false);
              }}
              icon={<Paintbrush size={18} strokeWidth={1.75} />}
              className={`${iconBtnClass} ${drawMode ? 'nm-mobile__btn--active' : ''}`}
            />
            <LiquidGlassIos26Button
              type="button"
              title="Tools"
              size="sm"
              data-onboarding="toolbar-tools"
              onClick={() => {
                if (moreSheetOpen) closeMoreSheet();
                else openMoreSheet({ fromTools: true });
              }}
              icon={<Wrench size={18} strokeWidth={1.75} />}
              className={`${iconBtnClass} ${moreSheetOpen ? 'nm-mobile__btn--active' : ''}`}
            />
            <LiquidGlassIos26Button
              type="button"
              title="Terminal"
              size="sm"
              onClick={() => {
                onOpenTerminal();
                setMoreSheetOpen(false);
              }}
              icon={<Terminal size={18} strokeWidth={1.75} />}
              className={iconBtnClass}
            />
            <LiquidGlassIos26Button
              type="button"
              data-selection-arm-button
              data-onboarding="toolbar-selection"
              title={selectionArmed ? 'Selection Mode armed — drag on canvas' : 'Selection Mode'}
              size="sm"
              onClick={() => {
                const next = !selectionArmed;
                onToggleSelectionArm();
                if (next) emitTutorial('toolbar.selection.arm');
              }}
              icon={<SquareDashed size={18} />}
              className={`${iconBtnClass} ${selectionArmed ? 'nm-mobile__btn--active' : ''}`}
            />
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