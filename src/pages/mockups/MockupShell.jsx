import React from 'react';
import './mockupThemes.css';

const THEMES = {
  1: {
    id: 'lens',
    label: 'Apple-like lens',
    short: 'Lens',
    blurb: 'Clear refractive glass — strong specular rim, thin edge, lens blur.',
    panelTitle: 'Lens material',
    panelBody: 'Ultra-clear stack: specular highlight, hairline rim, deep blur of what’s behind.',
  },
  2: {
    id: 'acrylic',
    label: 'Frosted acrylic',
    short: 'Acrylic',
    blurb: 'Denser vibrancy frost — tinted wash, colour bloom, softer edges.',
    panelTitle: 'Acrylic material',
    panelBody: 'Heavier tinted sheets that pick up scene colour — closer to desktop acrylic / Fluent.',
  },
  3: {
    id: 'gel',
    label: 'Soft gel',
    short: 'Gel',
    blurb: 'Organic liquid blobs — wet highlights, irregular radii, ploppy controls.',
    panelTitle: 'Gel material',
    panelBody: 'Soft continuous shapes with wet speculars; buttons squash like liquid on hover.',
  },
};

const NODES = [
  {
    title: 'Roots of thought',
    body: 'Capture ideas as connected cards on an infinite desk.',
    color: '#6366f1',
    left: '14%',
    top: '28%',
  },
  {
    title: 'y = a·x + b',
    body: 'Math nodes stay live — tweak a parameter, watch the graph breathe.',
    color: '#10b981',
    left: '44%',
    top: '34%',
  },
  {
    title: 'Next steps',
    body: 'Branch, rearrange, and export when the map is ready.',
    color: '#f59e0b',
    left: '28%',
    top: '56%',
  },
];

const ICONS = ['+', '⌂', '100%', '⚙', '›', '⇪', '⌫', '⚙'];

function appHref(path) {
  const base = String(import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return `${base}${path === '/' ? '/' : path}`;
}

export default function MockupShell({ n }) {
  const theme = THEMES[n] || THEMES[1];
  const others = [1, 2, 3].filter((i) => i !== n);

  return (
    <div className={`nm-mock nm-mock--${theme.id}`}>
      <div className="nm-mock__badge">
        <a href={appHref('/')}>App</a>
        <span className="nm-mock__badge-sep">·</span>
        <span>
          Mockup {n}: {theme.label}
        </span>
        <span className="nm-mock__badge-sep">·</span>
        {others.map((i, idx) => (
          <React.Fragment key={i}>
            {idx > 0 && <span className="nm-mock__badge-sep">/</span>}
            <a href={appHref(`/mockup${i}`)}>{THEMES[i].short}</a>
          </React.Fragment>
        ))}
      </div>

      <div className="nm-mock__scene" aria-hidden="true">
        <div className="nm-mock__dots" />
        <div
          className="nm-mock__glow"
          style={{
            width: 440,
            height: 340,
            left: '6%',
            top: '10%',
            background: 'rgba(99, 102, 241, 0.24)',
          }}
        />
        <div
          className="nm-mock__glow"
          style={{
            width: 400,
            height: 320,
            right: '4%',
            bottom: '16%',
            background: 'rgba(56, 189, 248, 0.18)',
          }}
        />
        <div
          className="nm-mock__glow"
          style={{
            width: 320,
            height: 260,
            left: '42%',
            bottom: '6%',
            background: 'rgba(244, 114, 182, 0.14)',
          }}
        />
      </div>

      <div className="nm-mock__chrome nm-mock__toolbar" aria-hidden="true">
        {ICONS.map((label, i) => (
          <span
            key={`${label}-${i}`}
            className={`nm-mock__btn ${i === 0 ? 'nm-mock__btn--active' : ''}`}
          >
            {label}
          </span>
        ))}
      </div>

      <aside className="nm-mock__panel" aria-hidden="true">
        <p className="nm-mock__panel-title">{theme.panelTitle}</p>
        <p className="nm-mock__panel-body">{theme.panelBody}</p>
      </aside>

      <svg className="nm-mock__edge" aria-hidden="true">
        <path
          d="M 340 210 C 420 210, 470 255, 540 265"
          fill="none"
          stroke="rgba(186, 200, 230, 0.42)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M 400 410 C 450 370, 500 330, 560 295"
          fill="none"
          stroke="rgba(186, 200, 230, 0.32)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>

      {NODES.map((node) => (
        <article
          key={node.title}
          className="nm-mock__node"
          style={{
            left: node.left,
            top: node.top,
            '--mk-accent': node.color,
          }}
        >
          <span className="nm-mock__socket nm-mock__socket--in" />
          <span className="nm-mock__socket nm-mock__socket--out" />
          <div className="nm-mock__node-bar">{node.title}</div>
          <div className="nm-mock__node-body">{node.body}</div>
        </article>
      ))}

      <div className="nm-mock__chrome nm-mock__workspaces" aria-hidden="true">
        {['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#38bdf8'].map((c, i) => (
          <span
            key={c}
            className={`nm-mock__tab ${i === 0 ? 'nm-mock__tab--on' : ''}`}
            style={{ backgroundColor: i === 0 ? c : `${c}33`, color: c }}
          />
        ))}
      </div>

      <div className="nm-mock__bin" aria-hidden="true" title="Bin">
        ⌫
      </div>

      <p className="nm-mock__blurb">{theme.blurb}</p>
    </div>
  );
}
