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
import { glassPressClasses, glassPressState, useGlassPress } from '@/hooks/useGlassPress';

const LONG_PRESS_MS = 420;

function PushSidebarSearchToggle({ searchOpen, onToggle }) {
  const { pressed, pressProps } = useGlassPress();
  return (
    <button
      type="button"
      className={glassPressClasses(
        'nm-sidebar__search-btn',
        glassPressState({ pressed, glass: true }),
      )}
      title={searchOpen ? 'Close search' : 'Search canvases'}
      aria-label={searchOpen ? 'Close search' : 'Search canvases'}
      onClick={onToggle}
      {...pressProps}
    >
      {searchOpen ? <X size={18} strokeWidth={1.75} /> : <Search size={18} strokeWidth={1.75} />}
    </button>
  );
}

function PushSidebarNew({ onClick }) {
  const { pressed, pressProps } = useGlassPress();
  return (
    <button
      type="button"
      className={glassPressClasses(
        'nm-sidebar__new',
        glassPressState({ pressed, solid: true }),
      )}
      data-onboarding="workspace-create"
      title="New canvas"
      onClick={onClick}
      {...pressProps}
    >
      <Plus size={18} strokeWidth={2.25} />
      <span>New canvas</span>
    </button>
  );
}

function PushSidebarSettingsOrb({ onClick }) {
  const { pressed, pressProps } = useGlassPress();
  return (
    <button
      type="button"
      className={glassPressClasses(
        'nm-sidebar__settings-orb',
        glassPressState({ pressed, glass: true }),
      )}
      data-onboarding="toolbar-settings"
      title="Settings"
      aria-label="Settings"
      onClick={onClick}
      {...pressProps}
    >
      <Settings size={18} strokeWidth={1.75} />
    </button>
  );
}

function PushWorkspaceRow({ ws, active, onSelect, onEdit, onDelete, onCloseDrawer }) {
  const { pressed, pressProps } = useGlassPress();
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
        <button
          type="button"
          className={glassPressClasses(
            'nm-sidebar__item',
            active ? 'nm-sidebar__item--on' : '',
            glassPressState({ pressed }),
          )}
          title={ws.name}
          {...pressProps}
          onPointerDown={(event) => {
            pressProps.onPointerDown?.(event);
            longPressRef.current = false;
            clearTimer();
            const { clientX, clientY } = event;
            timerRef.current = window.setTimeout(() => openMenuAt(clientX, clientY), LONG_PRESS_MS);
          }}
          onPointerUp={(event) => {
            pressProps.onPointerUp?.(event);
            clearTimer();
          }}
          onPointerCancel={(event) => {
            pressProps.onPointerCancel?.(event);
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
          <WorkspaceIcon icon={ws.icon} colour={ws.colour} size={16} strokeWidth={1.75} />
          <span>{ws.name}</span>
        </button>
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
  const { pressed: renamePressed, pressProps: renamePress } = useGlassPress();
  const { pressed: deletePressed, pressProps: deletePress } = useGlassPress();

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
      <button
        type="button"
        role="menuitem"
        className={glassPressClasses('nm-sidebar__glass-menu-item', glassPressState({ pressed: renamePressed }))}
        onClick={onRename}
        {...renamePress}
      >
        <Pencil size={16} strokeWidth={1.75} />
        Rename
      </button>
      <button
        type="button"
        role="menuitem"
        className={glassPressClasses(
          'nm-sidebar__glass-menu-item nm-sidebar__glass-menu-item--danger',
          glassPressState({ pressed: deletePressed }),
        )}
        onClick={onDelete}
        {...deletePress}
      >
        <Trash2 size={16} strokeWidth={1.75} />
        Delete
      </button>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(menu, document.body) : menu;
}

function BrandMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
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
    const id = window.setTimeout(() => searchInputRef.current?.focus(), 20);
    return () => window.clearTimeout(id);
  }, [searchOpen]);

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
            <h1 className="nm-sidebar__product">{PRODUCT_NAME}</h1>
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
              <div className="nm-sidebar__search">
                <Search size={16} strokeWidth={1.75} aria-hidden />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search canvases"
                  aria-label="Search canvases"
                />
              </div>
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
