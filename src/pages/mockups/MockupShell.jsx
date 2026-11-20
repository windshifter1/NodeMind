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
  4: {
    id: 'clay-soft',
    label: 'Soft clay',
    short: 'Clay',
    blurb: 'Claymorphism — matte pastels, dual soft shadows, chubby rounded chrome.',
    panelTitle: 'Soft clay',
    panelBody: 'Extruded matte surfaces with light + dark soft shadows. No glass blur — pure clay.',
  },
  5: {
    id: 'clay-vivid',
    label: 'Vivid clay',
    short: 'Clay+',
    blurb: 'Bolder claymorphism — saturated pastels, deeper extrusion, toy-like controls.',
    panelTitle: 'Vivid clay',
    panelBody: 'Higher contrast clay with thicker extrusion and candy accents for a playful desk.',
  },
  6: {
    id: 'sketch',
    label: 'Sketched',
    short: 'Sketch',
    blurb: 'Hand-sketched UI — paper grain, ink outlines, imperfect edges, notebook vibe.',
    panelTitle: 'Sketch notes',
    panelBody: 'Looks like a whiteboard doodle of the app: rough strokes, dashed wires, paper wash.',
  },
  7: {
    id: 'pro',
    label: 'Professional',
    short: 'Pro',
    blurb: 'Clean professional UI — crisp panels, subtle elevation, dense restrained chrome.',
    panelTitle: 'Product chrome',
    panelBody: 'Enterprise-ready surfaces: solid fills, 1px borders, quiet shadows, clear hierarchy.',
  },
  8: {
    id: 'whiteboard',
    label: 'Whiteboard pencil',
    short: 'Board',
    blurb: 'Whiteboard sketch — pencil graphite, handwritten labels, fluid hand-drawn frames.',
    panelTitle: 'on the board',
    panelBody: 'Everything is pencilled in: smooth pencil outlines, graphite grain, and notebook handwriting.',
  },
};

const ALL = [1, 2, 3, 4, 5, 6, 7, 8];

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Architects+Daughter&family=Caveat:wght@500;600;700&family=Kalam:wght@400;700&display=swap';

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
const WB_ICONS = ['+', 'home', 'fit', 'gear', 'in', 'up', 'del', '…'];

const SMOOTH_EDGES = [
  'M 340 210 C 420 210, 470 255, 540 265',
  'M 400 410 C 450 370, 500 330, 560 295',
];

const WB_EDGE_POINTS = [
  [
    [332, 208],
    [392, 214],
    [468, 248],
    [548, 268],
  ],
  [
    [392, 418],
    [458, 362],
    [518, 312],
    [568, 298],
  ],
];

function irand(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function fmt(n) {
  return n.toFixed(2);
}

function bow(seed, amp) {
  return (irand(seed) - 0.5) * 2 * amp;
}

function smoothPath(pts, { closed = false } = {}) {
  if (pts.length < 2) return '';
  const first = pts[0];
  const last = pts[pts.length - 1];
  const ring = closed
    ? [last, ...pts, first, pts[1]]
    : [first, ...pts, last];
  const count = closed ? pts.length : pts.length - 1;
  let d = `M ${fmt(first[0])} ${fmt(first[1])}`;
  for (let i = 0; i < count; i += 1) {
    const p0 = ring[i];
    const p1 = ring[i + 1];
    const p2 = ring[i + 2];
    const p3 = ring[i + 3];
    d += ` C ${fmt(p1[0] + (p2[0] - p0[0]) / 6)} ${fmt(p1[1] + (p2[1] - p0[1]) / 6)}, ${fmt(
      p2[0] - (p3[0] - p1[0]) / 6,
    )} ${fmt(p2[1] - (p3[1] - p1[1]) / 6)}, ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return d;
}

function wobbleRect(seed, w, h, { pad = 5, amp = 2.2 } = {}) {
  const x0 = pad;
  const y0 = pad;
  const x1 = w - pad;
  const y1 = h - pad;
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const pts = [
    [x0 + bow(seed, amp * 0.35), y0 + bow(seed + 1, amp * 0.35)],
    [mx + bow(seed + 2, amp * 0.4), y0 + bow(seed + 3, amp)],
    [x1 + bow(seed + 4, amp * 0.35), y0 + bow(seed + 5, amp * 0.35)],
    [x1 + bow(seed + 6, amp), my + bow(seed + 7, amp * 0.4)],
    [x1 + bow(seed + 8, amp * 0.35), y1 + bow(seed + 9, amp * 0.35)],
    [mx + bow(seed + 10, amp * 0.4), y1 + bow(seed + 11, amp)],
    [x0 + bow(seed + 12, amp * 0.35), y1 + bow(seed + 13, amp * 0.35)],
    [x0 + bow(seed + 14, amp), my + bow(seed + 15, amp * 0.4)],
  ];
  return smoothPath(pts, { closed: true });
}

function wobbleCircle(seed, cx, cy, r, n = 6) {
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const rr = r * (0.94 + irand(seed + i) * 0.12);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return smoothPath(pts, { closed: true });
}

function scribbleLine(seed, points, amp = 2) {
  const pts = [];
  points.forEach((p, i) => {
    pts.push([p[0] + bow(seed + i * 4, amp * 0.45), p[1] + bow(seed + i * 4 + 1, amp * 0.45)]);
    if (i < points.length - 1) {
      const n = points[i + 1];
      pts.push([
        (p[0] + n[0]) / 2 + bow(seed + i * 4 + 2, amp),
        (p[1] + n[1]) / 2 + bow(seed + i * 4 + 3, amp),
      ]);
    }
  });
  return smoothPath(pts, { closed: false });
}

function arrowHead(seed, from, to) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const size = 10 + irand(seed) * 2;
  const left = [to[0] - ux * size + -uy * size * 0.5, to[1] - uy * size + ux * size * 0.5];
  const right = [to[0] - ux * size + uy * size * 0.5, to[1] - uy * size + -ux * size * 0.5];
  return `${scribbleLine(seed + 3, [left, to], 0.7)} ${scribbleLine(seed + 9, [right, to], 0.7)}`;
}

function PencilOutline({ seed = 1, w = 100, h = 100, amp = 2.2, className = '' }) {
  const lead = wobbleRect(seed, w, h, { amp, pad: 5 });
  const ghost = wobbleRect(seed + 53, w, h, { amp: amp * 0.7, pad: 5.6 });
  return (
    <svg
      className={`nm-wb__outline ${className}`}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path className="nm-wb__ghost" d={ghost} vectorEffect="nonScalingStroke" />
      <path className="nm-wb__lead" d={lead} vectorEffect="nonScalingStroke" />
    </svg>
  );
}

function HatchFill({ seed, color, w = 248, h = 168 }) {
  const lines = [];
  const gap = 14;
  const count = Math.ceil((w + h) / gap) + 2;
  for (let i = 0; i < count; i += 1) {
    const x = -24 + i * gap;
    lines.push(scribbleLine(seed + i * 3, [[x, h + 16], [x + h + 28, -14]], 1.8));
  }
  return (
    <svg className="nm-wb__hatch" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      {lines.map((d, i) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={0.85}
          opacity={0.22 + irand(seed + i) * 0.12}
          vectorEffect="nonScalingStroke"
        />
      ))}
    </svg>
  );
}

function PencilSocket({ seed, side }) {
  return (
    <svg
      className={`nm-wb__socket nm-wb__socket--${side}`}
      viewBox="0 0 18 18"
      aria-hidden="true"
    >
      <path className="nm-wb__ghost" d={wobbleCircle(seed + 4, 9, 9, 7.2, 9)} vectorEffect="nonScalingStroke" />
      <path className="nm-wb__lead" d={wobbleCircle(seed, 9, 9, 6.4, 11)} vectorEffect="nonScalingStroke" />
    </svg>
  );
}

function appHref(path) {
  const base = String(import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return `${base}${path === '/' ? '/' : path}`;
}

export default function MockupShell({ n }) {
  const theme = THEMES[n] || THEMES[1];
  const others = ALL.filter((i) => i !== n);
  const wb = theme.id === 'whiteboard';

  React.useEffect(() => {
    if (!wb) return undefined;
    const id = 'nm-wb-fonts';
    if (document.getElementById(id)) return undefined;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = FONT_HREF;
    document.head.appendChild(link);
    return undefined;
  }, [wb]);

  return (
    <div className={`nm-mock nm-mock--${theme.id}`}>
      {wb && (
        <svg className="nm-wb__defs" aria-hidden="true">
          <defs>
            <filter id="nm-wb-grain" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="1" seed="4" result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="0.35" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>
      )}
      {wb && <link rel="stylesheet" href={FONT_HREF} />}

      <div className="nm-mock__badge">
        {wb && <PencilOutline seed={11} w={520} h={42} amp={1.8} />}
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
          className="nm-mock__glow nm-mock__glow--a"
          style={{
            width: 440,
            height: 340,
            left: '6%',
            top: '10%',
          }}
        />
        <div
          className="nm-mock__glow nm-mock__glow--b"
          style={{
            width: 400,
            height: 320,
            right: '4%',
            bottom: '16%',
          }}
        />
        <div
          className="nm-mock__glow nm-mock__glow--c"
          style={{
            width: 320,
            height: 260,
            left: '42%',
            bottom: '6%',
          }}
        />
        {wb && (
          <>
            <p className="nm-wb__board-title">the map — pencil pass</p>
            <span className="nm-wb__smudge nm-wb__smudge--a" />
            <span className="nm-wb__smudge nm-wb__smudge--b" />
            <span className="nm-wb__smudge nm-wb__smudge--c" />
          </>
        )}
      </div>

      <div className="nm-mock__chrome nm-mock__toolbar" aria-hidden="true">
        {wb && <PencilOutline seed={21} w={460} h={52} amp={2.1} />}
        {(wb ? WB_ICONS : ICONS).map((label, i) => (
          <span
            key={`${label}-${i}`}
            className={`nm-mock__btn ${i === 0 ? 'nm-mock__btn--active' : ''}`}
          >
            {wb && <PencilOutline seed={30 + i * 7} w={40} h={40} amp={1.7} />}
            {label}
          </span>
        ))}
      </div>

      <aside className="nm-mock__panel" aria-hidden="true">
        {wb && <PencilOutline seed={88} w={200} h={150} amp={2.4} />}
        <p className="nm-mock__panel-title">{theme.panelTitle}</p>
        <p className="nm-mock__panel-body">{theme.panelBody}</p>
      </aside>

      <svg
        className={`nm-mock__edge ${wb ? 'nm-mock__edge--wb' : ''}`}
        viewBox={wb ? '0 0 900 700' : undefined}
        preserveAspectRatio={wb ? 'none' : undefined}
        aria-hidden="true"
      >
        {wb
          ? WB_EDGE_POINTS.flatMap((pts, ei) => {
              const end = pts[pts.length - 1];
              const prev = pts[pts.length - 2];
              return [
                <path
                  key={`g-${ei}`}
                  className="nm-mock__edge-path nm-wb__ghost"
                  d={scribbleLine(120 + ei * 17, pts, 4.5)}
                  fill="none"
                  vectorEffect="nonScalingStroke"
                />,
                <path
                  key={`l-${ei}`}
                  className="nm-mock__edge-path nm-wb__lead"
                  d={scribbleLine(140 + ei * 17, pts, 2.8)}
                  fill="none"
                  vectorEffect="nonScalingStroke"
                />,
                <path
                  key={`a-${ei}`}
                  className="nm-mock__edge-path nm-wb__lead"
                  d={arrowHead(160 + ei, prev, end)}
                  fill="none"
                  vectorEffect="nonScalingStroke"
                />,
              ];
            })
          : SMOOTH_EDGES.map((d) => (
              <path key={d} className="nm-mock__edge-path" d={d} fill="none" strokeWidth={2.2} strokeLinecap="round" />
            ))}
      </svg>

      {NODES.map((node, ni) => (
        <article
          key={node.title}
          className="nm-mock__node"
          style={{
            left: node.left,
            top: node.top,
            '--mk-accent': node.color,
          }}
        >
          {wb && <HatchFill seed={180 + ni * 11} color={node.color} />}
          {wb && <PencilOutline seed={200 + ni * 19} w={248} h={168} amp={2.6} />}
          {wb ? (
            <>
              <PencilSocket seed={260 + ni} side="in" />
              <PencilSocket seed={270 + ni} side="out" />
            </>
          ) : (
            <>
              <span className="nm-mock__socket nm-mock__socket--in" />
              <span className="nm-mock__socket nm-mock__socket--out" />
            </>
          )}
          <div className="nm-mock__node-bar">
            {node.title}
            {wb && (
              <svg className="nm-wb__underline" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
                <path
                  className="nm-wb__lead"
                  d={scribbleLine(300 + ni, [[3, 5], [97, 4]], 1.1)}
                  fill="none"
                  vectorEffect="nonScalingStroke"
                />
              </svg>
            )}
          </div>
          <div className="nm-mock__node-body">{node.body}</div>
        </article>
      ))}

      <div className="nm-mock__chrome nm-mock__workspaces" aria-hidden="true">
        {wb && <PencilOutline seed={44} w={280} h={52} amp={1.9} />}
        {['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#38bdf8'].map((c, i) => (
          <span
            key={c}
            className={`nm-mock__tab ${i === 0 ? 'nm-mock__tab--on' : ''}`}
            style={{
              backgroundColor: i === 0 && !wb ? c : undefined,
              ['--mk-tab']: c,
              color: c,
            }}
          >
            {wb ? (
              <>
                <HatchFill seed={90 + i} color={c} w={40} h={40} />
                <PencilOutline seed={50 + i * 5} w={40} h={40} amp={1.6} />
                <span className="nm-wb__tab-mark">{i + 1}</span>
              </>
            ) : null}
          </span>
        ))}
      </div>

      <div className="nm-mock__bin" aria-hidden="true" title="Bin">
        {wb && <PencilOutline seed={77} w={52} h={52} amp={1.8} />}
        {wb ? 'bin' : '⌫'}
      </div>

      <p className="nm-mock__blurb">
        {wb && <PencilOutline seed={99} w={420} h={48} amp={1.8} />}
        {theme.blurb}
      </p>
    </div>
  );
}
