import React, { useEffect } from 'react';
import { PanelLeft, PanelLeftClose, Plus, Settings, SlidersHorizontal, Trash2 } from 'lucide-react';
import { PRODUCT_NAME } from '@/lib/brand';
import WorkspaceIcon from '@/components/shell/WorkspaceIcon';
import { emitTutorial } from '@/lib/tutorialEvents';

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
  open = true,
  onToggleCollapsed,
  onClose,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
  onOpenSettings,
}) {
  useEffect(() => {
    if (!overlay || !open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay, open, onClose]);

  const railCollapsed = collapsed && !overlay;

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
        className={`nm-sidebar ${railCollapsed ? 'nm-sidebar--collapsed' : ''} ${overlay ? 'nm-sidebar--overlay' : ''} ${overlay && open ? 'is-open' : ''}`}
        data-onboarding="workspace-bar"
        aria-label="Sidebar"
        aria-hidden={overlay && !open ? true : undefined}
      >
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

        <div className="nm-sidebar__label">Canvases</div>
        <nav className="nm-sidebar__nav" aria-label="Canvases">
          {workspaces.map((ws) => {
            const active = ws.id === activeId;
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
                    if (overlay) onClose?.();
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
                      if (overlay) onClose?.();
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
                      if (overlay) onClose?.();
                    }}
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="nm-sidebar__actions">
          <button
            type="button"
            className="nm-sidebar__item"
            data-onboarding="workspace-create"
            title="New canvas"
            onClick={() => {
              onCreate?.();
              if (overlay) onClose?.();
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
              if (overlay) onClose?.();
            }}
          >
            <Settings size={16} strokeWidth={1.75} />
            <span>Settings</span>
          </button>
        </div>
      </aside>
    </>
  );
}
