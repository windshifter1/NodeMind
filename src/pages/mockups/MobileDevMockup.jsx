import React, { useEffect, useState } from 'react';
import {
  Plus,
  Pencil,
  Home,
  SquareDashed,
  MoreHorizontal,
  Settings,
  Terminal,
  Share2,
  Copy,
  Upload,
  Download,
  Trash2,
  Wrench,
  Menu,
  X,
} from 'lucide-react';
import BinIcon from '@/components/canvas/BinIcon';
import { applyDocumentUiStyle, readStoredUiStyle } from '@/lib/uiStyle';
import './mobileDev.css';

const WORKSPACES = [
  { id: 'a', label: '1', color: '#6366f1' },
  { id: 'b', label: '2', color: '#10b981' },
  { id: 'c', label: '3', color: '#f59e0b' },
  { id: 'd', label: '4', color: '#ec4899' },
  { id: 'e', label: '5', color: '#38bdf8' },
];

const NODES = [
  {
    title: 'Roots of thought',
    body: 'Capture ideas as connected cards on an infinite desk.',
    color: '#6366f1',
    left: '10%',
    top: '26%',
  },
  {
    title: 'y = a·x + b',
    body: 'Math nodes stay live — tweak a parameter, watch the graph breathe.',
    color: '#10b981',
    left: '38%',
    top: '40%',
  },
  {
    title: 'Next steps',
    body: 'Branch, rearrange, and export when the map is ready.',
    color: '#f59e0b',
    left: '16%',
    top: '58%',
  },
];

const MORE_ACTIONS = [
  { id: 'organise', label: 'Organise', icon: Wrench },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'copy', label: 'Copy', icon: Copy },
  { id: 'import', label: 'Import', icon: Upload },
  { id: 'export', label: 'Export', icon: Download },
  { id: 'share', label: 'Share', icon: Share2 },
  { id: 'clear', label: 'Clear', icon: Trash2 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function appHref(path) {
  const base = String(import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return `${base}${path === '/' ? '/' : path}`;
}

function ChromeButton({
  children,
  title,
  active = false,
  primary = false,
  danger = false,
  className = '',
  onClick,
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={[
        'nm-mdev__btn',
        active ? 'nm-mdev__btn--active' : '',
        primary ? 'nm-mdev__btn--primary' : '',
        danger ? 'nm-mdev__btn--danger' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  );
}

function SceneNodes() {
  return (
    <>
      <svg className="nm-mdev__edge" viewBox="0 0 390 760" preserveAspectRatio="none" aria-hidden="true">
        <path className="nm-mdev__edge-path" d="M 140 250 C 190 250, 220 300, 260 330" />
        <path className="nm-mdev__edge-path" d="M 170 480 C 210 430, 240 390, 270 360" />
      </svg>
      {NODES.map((node) => (
        <article
          key={node.title}
          className="nm-mdev__node"
          style={{
            left: node.left,
            top: node.top,
            '--mk-accent': node.color,
          }}
        >
          <span className="nm-mdev__socket nm-mdev__socket--in" />
          <span className="nm-mdev__socket nm-mdev__socket--out" />
          <div className="nm-mdev__node-bar">{node.title}</div>
          <div className="nm-mdev__node-body">{node.body}</div>
        </article>
      ))}
    </>
  );
}

function MoreSheet({ open, onClose, title, onAction }) {
  if (!open) return null;
  return (
    <>
      <button type="button" className="nm-mdev__sheet-backdrop" aria-label="Close sheet" onClick={onClose} />
      <div className="nm-mdev__sheet nm-mdev__chrome" role="dialog" aria-label={title}>
        <div className="nm-mdev__sheet-handle" />
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="nm-mdev__sheet-title">{title}</p>
          <ChromeButton title="Close" onClick={onClose} className="!min-h-9 !min-w-9 !p-2">
            <X size={16} />
          </ChromeButton>
        </div>
        <div className="nm-mdev__sheet-grid">
          {MORE_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                className="nm-mdev__sheet-item"
                onClick={() => onAction(action.id)}
              >
                <Icon size={18} />
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function DockMockup() {
  const [activeWs, setActiveWs] = useState('a');
  const [drawOn, setDrawOn] = useState(false);
  const [selectOn, setSelectOn] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [hint, setHint] = useState('Thumb dock — primary tools stay in reach');

  const flash = (msg) => {
    setHint(msg);
    window.setTimeout(() => setHint('Thumb dock — primary tools stay in reach'), 1600);
  };

  return (
    <div className="nm-mdev nm-mdev--dock">
      <div className="nm-mdev__scene" aria-hidden="true">
        <div className="nm-mdev__dots" />
        <div className="nm-mdev__glow nm-mdev__glow--a" />
        <div className="nm-mdev__glow nm-mdev__glow--b" />
      </div>

      <div className="nm-mdev__badge">
        <a href={appHref('/')}>App</a>
        <span className="nm-mdev__badge-sep">·</span>
        <span>Dev1 · Bottom dock</span>
        <span className="nm-mdev__badge-sep">·</span>
        <a href={appHref('/dev2')}>Dev2</a>
      </div>

      <div className="nm-mdev__canvas" aria-hidden="true">
        <SceneNodes />
      </div>

      <div className="nm-mdev__top nm-mdev__chrome">
        <span className="nm-mdev__ws-name">Ideas</span>
        <span className="nm-mdev__divider" />
        <span className="nm-mdev__zoom">100%</span>
        <ChromeButton
          title="Settings"
          onClick={() => {
            setSheetOpen(true);
            flash('Settings via More sheet');
          }}
          className="!min-h-9 !min-w-9 !p-2"
        >
          <Settings size={16} />
        </ChromeButton>
      </div>

      <p className="nm-mdev__hint">{hint}</p>

      <div className="nm-mdev__bin nm-mdev__chrome" title="Bin">
        <BinIcon open={false} size={18} />
      </div>

      <div className="nm-mdev__dock nm-mdev__chrome">
        <div className="nm-mdev__ws-strip" data-allow-scroll>
          {WORKSPACES.map((ws) => (
            <button
              key={ws.id}
              type="button"
              title={`Workspace ${ws.label}`}
              className={`nm-mdev__ws-tab ${activeWs === ws.id ? 'nm-mdev__ws-tab--on' : ''}`}
              style={{ '--mk-tab': ws.color }}
              onClick={() => {
                setActiveWs(ws.id);
                flash(`Workspace ${ws.label}`);
              }}
            />
          ))}
          <ChromeButton
            title="New workspace"
            className="nm-mdev__ws-add !min-h-[38px] !min-w-[38px] !p-2"
            onClick={() => flash('New workspace')}
          >
            <Plus size={16} />
          </ChromeButton>
        </div>

        <div className="nm-mdev__actions">
          <div className="nm-mdev__action">
            <ChromeButton title="Add node" primary onClick={() => flash('Add node')}>
              <Plus size={18} />
            </ChromeButton>
            <span className="nm-mdev__label">Add</span>
          </div>
          <div className="nm-mdev__action">
            <ChromeButton
              title="Draw"
              active={drawOn}
              onClick={() => {
                setDrawOn((v) => !v);
                setSelectOn(false);
                flash(drawOn ? 'Draw off' : 'Draw mode');
              }}
            >
              <Pencil size={17} />
            </ChromeButton>
            <span className="nm-mdev__label">Draw</span>
          </div>
          <div className="nm-mdev__action">
            <ChromeButton title="Recenter" onClick={() => flash('Recenter')}>
              <Home size={17} />
            </ChromeButton>
            <span className="nm-mdev__label">Home</span>
          </div>
          <div className="nm-mdev__action">
            <ChromeButton
              title="Selection"
              active={selectOn}
              onClick={() => {
                setSelectOn((v) => !v);
                setDrawOn(false);
                flash(selectOn ? 'Select off' : 'Selection armed');
              }}
            >
              <SquareDashed size={17} />
            </ChromeButton>
            <span className="nm-mdev__label">Select</span>
          </div>
          <div className="nm-mdev__action">
            <ChromeButton
              title="More tools"
              active={sheetOpen}
              onClick={() => setSheetOpen(true)}
            >
              <MoreHorizontal size={18} />
            </ChromeButton>
            <span className="nm-mdev__label">More</span>
          </div>
        </div>
      </div>

      <MoreSheet
        open={sheetOpen}
        title="Tools & share"
        onClose={() => setSheetOpen(false)}
        onAction={(id) => {
          setSheetOpen(false);
          flash(MORE_ACTIONS.find((a) => a.id === id)?.label || id);
        }}
      />
    </div>
  );
}

function FabMockup() {
  const [activeWs, setActiveWs] = useState('a');
  const [drawOn, setDrawOn] = useState(false);
  const [selectOn, setSelectOn] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [hint, setHint] = useState('FAB nav — Add stays under the thumb');

  const flash = (msg) => {
    setHint(msg);
    window.setTimeout(() => setHint('FAB nav — Add stays under the thumb'), 1600);
  };

  return (
    <div className="nm-mdev nm-mdev--fab">
      <div className="nm-mdev__scene" aria-hidden="true">
        <div className="nm-mdev__dots" />
        <div className="nm-mdev__glow nm-mdev__glow--a" />
        <div className="nm-mdev__glow nm-mdev__glow--b" />
      </div>

      <div className="nm-mdev__badge">
        <a href={appHref('/')}>App</a>
        <span className="nm-mdev__badge-sep">·</span>
        <span>Dev2 · FAB + rail</span>
        <span className="nm-mdev__badge-sep">·</span>
        <a href={appHref('/dev1')}>Dev1</a>
      </div>

      <div className="nm-mdev__canvas" aria-hidden="true">
        <SceneNodes />
      </div>

      <div className="nm-mdev__top nm-mdev__chrome">
        <ChromeButton title="Menu" onClick={() => setSheetOpen(true)} className="!min-h-10 !min-w-10">
          <Menu size={17} />
        </ChromeButton>
        <div className="nm-mdev__top-center">
          <div className="nm-mdev__ws-name">Ideas</div>
          <div className="nm-mdev__zoom">100%</div>
        </div>
        <ChromeButton
          title="Settings"
          onClick={() => {
            setSheetOpen(true);
            flash('Settings');
          }}
          className="!min-h-10 !min-w-10"
        >
          <Settings size={17} />
        </ChromeButton>
      </div>

      <div className="nm-mdev__rail nm-mdev__chrome" aria-label="Workspaces">
        {WORKSPACES.map((ws) => (
          <button
            key={ws.id}
            type="button"
            title={`Workspace ${ws.label}`}
            className={`nm-mdev__ws-tab ${activeWs === ws.id ? 'nm-mdev__ws-tab--on' : ''}`}
            style={{ '--mk-tab': ws.color }}
            onClick={() => {
              setActiveWs(ws.id);
              flash(`Workspace ${ws.label}`);
            }}
          />
        ))}
        <ChromeButton
          title="New workspace"
          className="!min-h-[34px] !min-w-[34px] !p-1.5"
          onClick={() => flash('New workspace')}
        >
          <Plus size={15} />
        </ChromeButton>
      </div>

      <div className="nm-mdev__quick">
        <ChromeButton
          title="Terminal"
          className="nm-mdev__chrome"
          onClick={() => flash('Terminal')}
        >
          <Terminal size={16} />
        </ChromeButton>
        <ChromeButton
          title="Share"
          className="nm-mdev__chrome"
          onClick={() => flash('Share')}
        >
          <Share2 size={16} />
        </ChromeButton>
      </div>

      <div className="nm-mdev__bin nm-mdev__chrome" title="Bin">
        <BinIcon open={false} size={17} />
      </div>

      <p className="nm-mdev__hint">{hint}</p>

      <div className="nm-mdev__nav nm-mdev__chrome">
        <div className="nm-mdev__nav-slot">
          <ChromeButton title="Recenter" onClick={() => flash('Recenter')}>
            <Home size={17} />
          </ChromeButton>
          <span className="nm-mdev__label">Home</span>
        </div>
        <div className="nm-mdev__nav-slot">
          <ChromeButton
            title="Draw"
            active={drawOn}
            onClick={() => {
              setDrawOn((v) => !v);
              setSelectOn(false);
              flash(drawOn ? 'Draw off' : 'Draw mode');
            }}
          >
            <Pencil size={17} />
          </ChromeButton>
          <span className="nm-mdev__label">Draw</span>
        </div>
        <div className="nm-mdev__nav-slot">
          <ChromeButton
            title="Add node"
            primary
            className="nm-mdev__fab"
            onClick={() => flash('Add node')}
          >
            <Plus size={22} />
          </ChromeButton>
          <span className="nm-mdev__label">Add</span>
        </div>
        <div className="nm-mdev__nav-slot">
          <ChromeButton
            title="Selection"
            active={selectOn}
            onClick={() => {
              setSelectOn((v) => !v);
              setDrawOn(false);
              flash(selectOn ? 'Select off' : 'Selection armed');
            }}
          >
            <SquareDashed size={17} />
          </ChromeButton>
          <span className="nm-mdev__label">Select</span>
        </div>
        <div className="nm-mdev__nav-slot">
          <ChromeButton
            title="More"
            active={sheetOpen}
            onClick={() => setSheetOpen(true)}
          >
            <MoreHorizontal size={18} />
          </ChromeButton>
          <span className="nm-mdev__label">More</span>
        </div>
      </div>

      <MoreSheet
        open={sheetOpen}
        title="More actions"
        onClose={() => setSheetOpen(false)}
        onAction={(id) => {
          setSheetOpen(false);
          flash(MORE_ACTIONS.find((a) => a.id === id)?.label || id);
        }}
      />
    </div>
  );
}

export default function MobileDevMockup({ n }) {
  useEffect(() => {
    applyDocumentUiStyle(readStoredUiStyle());
  }, []);

  if (n === 2) return <FabMockup />;
  return <DockMockup />;
}
