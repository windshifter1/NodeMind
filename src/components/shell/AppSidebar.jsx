import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  PanelLeft,
  PanelLeftClose,
  Pencil,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { PRODUCT_NAME } from '@/lib/brand';
import WorkspaceIcon from '@/components/shell/WorkspaceIcon';
import { emitTutorial } from '@/lib/tutorialEvents';
import {
  LiquidGlassButton,
  LiquidGlassIos26Button,
  MobileSearchBar,
} from '@/lib/liquid-glass';

const LONG_PRESS_MS = 420;

function PushSidebarSearchToggle({ searchOpen, onToggle }) {
  return (
    <button
      type="button"
      className="nm-sidebar__search-btn"
      title={searchOpen ? 'Close search' : 'Search canvases'}
      aria-label={searchOpen ? 'Close search' : 'Search canvases'}
      aria-expanded={searchOpen}
      onClick={onToggle}
    >
      {searchOpen ? <X size={18} strokeWidth={1.75} /> : <Search size={18} strokeWidth={1.75} />}
    </button>
  );
}

function PushSidebarNew({ onClick }) {
  return (
    <LiquidGlassButton
      type="button"
      variant="primary"
      size="md"
      fullWidth
      data-onboarding="workspace-create"
      title="New canvas"
      onClick={onClick}
      icon={<Plus size={18} strokeWidth={2.25} />}
      className="nm-sidebar__new nm-sidebar__new--solid !justify-center"
    >
      New canvas
    </LiquidGlassButton>
  );
}

function PushSidebarSettingsOrb({ onClick }) {
  return (
    <LiquidGlassIos26Button
      type="button"
      size="sm"
      data-onboarding="toolbar-settings"
      title="Settings"
      aria-label="Settings"
      onClick={onClick}
      icon={<Settings size={18} strokeWidth={1.75} />}
      className="nm-sidebar__settings-orb !min-h-0 !min-w-0 !p-2.5 !shadow-none"
    />
  );
}

function PushWorkspaceRow({ ws, active, onSelect, onEdit, onDelete, onCloseDrawer }) {
  const timerRef = useRef(0);
  const longPressRef = useRef(false);
  const [menu, setMenu] = useState(null);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = 0;
    }
  };

  const openMenuAt = (clientX, clientY) => {
    longPressRef.current = true;
    setMenu({ x: clientX, y: clientY });
  };

  return (
    <>
      <div className={`nm-sidebar__row ${active ? 'nm-sidebar__row--on' : ''}`}>
        <LiquidGlassButton
          type="button"
          variant="ghost"
          fullWidth
          fluid
          motionPress
          splashSize={88}
          tapScale={0.97}
          title={ws.name}
          className={`nm-sidebar__item nm-sidebar__item--liquid !justify-start !rounded-2xl ${
            active ? 'nm-sidebar__item--on' : ''
          }`}
          icon={<WorkspaceIcon icon={ws.icon} colour={ws.colour} size={16} strokeWidth={1.75} />}
          onPointerDown={(event) => {
            longPressRef.current = false;
            clearTimer();
            const { clientX, clientY } = event;
            timerRef.current = window.setTimeout(() => openMenuAt(clientX, clientY), LONG_PRESS_MS);
          }}
          onPointerUp={() => {
            clearTimer();
          }}
          onPointerCancel={() => {
            clearTimer();
          }}
          onClick={() => {
            if (longPressRef.current) {
              longPressRef.current = false;
              return;
            }
            if (!active) emitTutorial('workspace.switch');
            onSelect?.(ws.id);
            onCloseDrawer?.();
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            openMenuAt(event.clientX, event.clientY);
          }}
        >
          {ws.name}
        </LiquidGlassButton>
      </div>
      {menu ? (
        <WorkspaceGlassMenu
          x={menu.x}
          y={menu.y}
          name={ws.name}
          onRename={() => {
            onEdit?.(ws.id);
            emitTutorial('workspace.edit.open');
            onCloseDrawer?.();
            setMenu(null);
          }}
          onDelete={() => {
            onDelete?.(ws);
            onCloseDrawer?.();
            setMenu(null);
          }}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </>
  );
}

function WorkspaceGlassMenu({ x, y, name, onRename, onDelete, onClose }) {
  useEffect(() => {
    const close = (event) => {
      if (event.target instanceof Element && event.target.closest('.nm-sidebar__glass-menu')) return;
      onClose?.();
    };
    window.addEventListener('pointerdown', close, true);
    return () => window.removeEventListener('pointerdown', close, true);
  }, [onClose]);

  const left = Math.min(Math.max(12, x - 8), window.innerWidth - 220);
  const top = Math.min(Math.max(12, y - 12), window.innerHeight - 160);

  const menu = (
    <div
      className="nm-sidebar__glass-menu nm-mobile__chrome"
      role="menu"
      aria-label={`${name} actions`}
      style={{ left, top }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <LiquidGlassButton
        type="button"
        role="menuitem"
        variant="ghost"
        fullWidth
        fluid={false}
        motionPress={false}
        className="nm-sidebar__glass-menu-item !justify-start"
        onClick={onRename}
        icon={<Pencil size={16} strokeWidth={1.75} />}
      >
        Rename
      </LiquidGlassButton>
      <LiquidGlassButton
        type="button"
        role="menuitem"
        variant="danger"
        fullWidth
        fluid={false}
        motionPress={false}
        className="nm-sidebar__glass-menu-item nm-sidebar__glass-menu-item--danger !justify-start"
        onClick={onDelete}
        icon={<Trash2 size={16} strokeWidth={1.75} />}
      >
        Delete
      </LiquidGlassButton>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(menu, document.body) : menu;
}

function BrandMark({ className = '' }) {
  return (
    <svg
      className={className || undefined}
      width="20"
      height="20"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path d="M16 6v9.5M16 15.5 8 24M16 15.5l8 8.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="16" cy="5.5" r="2.25" fill="currentColor" />
      <circle cx="7.6" cy="24.6" r="2.25" fill="currentColor" />
      <circle cx="24.4" cy="24.6" r="2.25" fill="currentColor" />
    </svg>
  );
}

export default function AppSidebar({
  workspaces = [],
  activeId,
  collapsed = false,
  overlay = false,
  push = false,
  open = true,
  onToggleCollapsed,
  onClose,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
  onOpenSettings,
}) {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);
  const isDrawer = overlay || push;

  useEffect(() => {
    if (!isDrawer || !open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDrawer, open, onClose]);

  useEffect(() => {
    if (!open) {
      setSearchOpen(false);
      setQuery('');
    }
  }, [open]);

  useEffect(() => {
    if (!searchOpen) {
      searchInputRef.current?.blur();
      return undefined;
    }
    const id = window.setTimeout(() => {
      const el = searchInputRef.current;
      el?.focus();
      el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    }, 80);
    return () => window.clearTimeout(id);
  }, [searchOpen]);

  useEffect(() => {
    if (!push || !searchOpen) return undefined;
    const vv = window.visualViewport;
    const onVv = () => {
      searchInputRef.current?.scrollIntoView?.({ block: 'nearest' });
    };
    vv?.addEventListener('resize', onVv);
    vv?.addEventListener('scroll', onVv);
    return () => {
      vv?.removeEventListener('resize', onVv);
      vv?.removeEventListener('scroll', onVv);
    };
  }, [push, searchOpen]);

  const railCollapsed = collapsed && !isDrawer;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workspaces;
    return workspaces.filter((ws) => String(ws.name || '').toLowerCase().includes(q));
  }, [workspaces, query]);

  const closeIfDrawer = () => {
    if (isDrawer) onClose?.();
  };

  return (
    <>
      {overlay ? (
        <button
          type="button"
          className={`nm-sidebar-backdrop ${open ? 'is-open' : ''}`}
          aria-label="Close sidebar"
          tabIndex={open ? 0 : -1}
          onClick={onClose}
        />
      ) : null}
      <aside
        className={`nm-sidebar ${railCollapsed ? 'nm-sidebar--collapsed' : ''} ${overlay ? 'nm-sidebar--overlay' : ''} ${push ? 'nm-sidebar--push' : ''} ${isDrawer && open ? 'is-open' : ''}`}
        data-onboarding="workspace-bar"
        aria-label="Sidebar"
        aria-hidden={isDrawer && !open ? true : undefined}
      >
        {push ? (
          <div className="nm-sidebar__hero">
            <div className="nm-sidebar__product-lockup">
              <BrandMark className="nm-sidebar__brand-mark" />
              <h1 className="nm-sidebar__product" aria-label={PRODUCT_NAME}>
                Noded
              </h1>
            </div>
            <PushSidebarSearchToggle
              searchOpen={searchOpen}
              onToggle={() => {
                setSearchOpen((v) => !v);
                if (searchOpen) setQuery('');
              }}
            />
          </div>
        ) : (
          <div className="nm-sidebar__top">
            <div className="nm-sidebar__brand" title={PRODUCT_NAME}>
              <BrandMark />
              <span>{PRODUCT_NAME}</span>
            </div>
            <button
              type="button"
              className="nm-sidebar__iconbtn"
              title={overlay ? 'Close sidebar' : railCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={overlay ? onClose : onToggleCollapsed}
            >
              {overlay || !railCollapsed ? <PanelLeftClose size={16} strokeWidth={1.75} /> : <PanelLeft size={16} strokeWidth={1.75} />}
            </button>
          </div>
        )}

        {push ? (
          <div className={`nm-sidebar__search-slot ${searchOpen ? 'is-open' : ''}`}>
            <div className="nm-sidebar__search-slot-inner">
              <MobileSearchBar
                inputRef={searchInputRef}
                className="nm-sidebar__mobile-search"
                placeholder="Search canvases"
                aria-label="Search canvases"
                value={query}
                onChange={setQuery}
                showCancelButton
                autoFocus={searchOpen}
                onCancel={() => {
                  setQuery('');
                  setSearchOpen(false);
                }}
              />
            </div>
          </div>
        ) : null}

        {push ? null : <div className="nm-sidebar__label">Canvases</div>}
        <nav className="nm-sidebar__nav" aria-label="Canvases">
          {filtered.map((ws) => {
            const active = ws.id === activeId;
            if (push) {
              return (
                <PushWorkspaceRow
                  key={ws.id}
                  ws={ws}
                  active={active}
                  onSelect={onSelect}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onCloseDrawer={closeIfDrawer}
                />
              );
            }
            return (
              <div
                key={ws.id}
                className={`nm-sidebar__row ${active ? 'nm-sidebar__row--on' : ''}`}
              >
                <button
                  type="button"
                  className={`nm-sidebar__item ${active ? 'nm-sidebar__item--on' : ''}`}
                  title={ws.name}
                  onClick={() => {
                    if (ws.id !== activeId) emitTutorial('workspace.switch');
                    onSelect?.(ws.id);
                    closeIfDrawer();
                  }}
                >
                  <WorkspaceIcon icon={ws.icon} colour={ws.colour} size={16} strokeWidth={1.75} />
                  <span>{ws.name}</span>
                </button>
                <div className="nm-sidebar__tools">
                  <button
                    type="button"
                    className="nm-sidebar__edit"
                    data-onboarding={active ? 'workspace-edit' : undefined}
                    title="Edit canvas"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit?.(ws.id);
                      emitTutorial('workspace.edit.open');
                      closeIfDrawer();
                    }}
                  >
                    <SlidersHorizontal size={14} strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    className="nm-sidebar__delete"
                    title="Delete canvas"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.(ws);
                      closeIfDrawer();
                    }}
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            );
          })}
        </nav>

        {push ? (
          <div className="nm-sidebar__dock">
            <PushSidebarNew
              onClick={() => {
                onCreate?.();
                closeIfDrawer();
              }}
            />
            <PushSidebarSettingsOrb
              onClick={() => {
                onOpenSettings?.();
                emitTutorial('toolbar.settings.open');
                closeIfDrawer();
              }}
            />
          </div>
        ) : (
          <>
            <div className="nm-sidebar__actions">
              <button
                type="button"
                className="nm-sidebar__item"
                data-onboarding="workspace-create"
                title="New canvas"
                onClick={() => {
                  onCreate?.();
                  closeIfDrawer();
                }}
              >
                <Plus size={16} strokeWidth={1.75} />
                <span>New canvas</span>
              </button>
            </div>

            <div className="nm-sidebar__foot">
              <button
                type="button"
                className="nm-sidebar__item"
                data-onboarding="toolbar-settings"
                title="Settings"
                onClick={() => {
                  onOpenSettings?.();
                  emitTutorial('toolbar.settings.open');
                  closeIfDrawer();
                }}
              >
                <Settings size={16} strokeWidth={1.75} />
                <span>Settings</span>
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
