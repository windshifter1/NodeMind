import React, { useEffect } from 'react';
import './fontSpecimen.css';

const SPECIMENS = {
  syne: {
    id: 'syne',
    family: 'Syne',
    route: '/syne',
    specimenUrl: 'https://fonts.google.com/specimen/Syne',
    cssHref:
      'https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&display=swap',
    stack: '"Syne", ui-sans-serif, system-ui, sans-serif',
    blurb:
      'Geometric display face with condensed energy — check titles, chrome labels, and UI density at reading size.',
    weights: [
      { label: '400', value: 400 },
      { label: '500', value: 500 },
      { label: '600', value: 600 },
      { label: '700', value: 700 },
      { label: '800', value: 800 },
    ],
  },
  space: {
    id: 'space',
    family: 'Space Grotesk',
    route: '/space',
    specimenUrl: 'https://fonts.google.com/specimen/Space+Grotesk',
    cssHref:
      'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap',
    stack: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
    blurb:
      'Proportional grotesque with technical clarity — judge body copy, toolbar labels, and compact controls.',
    weights: [
      { label: '300', value: 300 },
      { label: '400', value: 400 },
      { label: '500', value: 500 },
      { label: '600', value: 600 },
      { label: '700', value: 700 },
    ],
  },
};

function appHref(path) {
  const base = String(import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return `${base}${path === '/' ? '/' : path}`;
}

function ensureFontStylesheet(id, href) {
  if (typeof document === 'undefined') return;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

export default function FontSpecimen({ kind }) {
  const specimen = SPECIMENS[kind] || SPECIMENS.syne;
  const other = kind === 'space' ? SPECIMENS.syne : SPECIMENS.space;

  useEffect(() => {
    ensureFontStylesheet(`nm-font-${specimen.id}`, specimen.cssHref);
  }, [specimen.cssHref, specimen.id]);

  return (
    <div
      className={`nm-font-spec nm-font-spec--${specimen.id}`}
      style={{ '--fs-font': specimen.stack }}
    >
      <link rel="stylesheet" href={specimen.cssHref} />
      <div className="nm-font-spec__inner">
        <div className="nm-font-spec__badge">
          <a href={appHref('/')}>App</a>
          <span className="nm-font-spec__badge-sep">·</span>
          <span>
            Font test: {specimen.family}
          </span>
          <span className="nm-font-spec__badge-sep">·</span>
          <a href={appHref(other.route)}>{other.family}</a>
          <span className="nm-font-spec__badge-sep">·</span>
          <a href={specimen.specimenUrl} target="_blank" rel="noreferrer">
            Google Fonts
          </a>
        </div>

        <header className="nm-font-spec__hero">
          <p className="nm-font-spec__kicker">{specimen.route} · type specimen</p>
          <h1 className="nm-font-spec__title">{specimen.family}</h1>
          <p className="nm-font-spec__lede">{specimen.blurb}</p>
        </header>

        <div className="nm-font-spec__grid">
          <section className="nm-font-spec__panel" aria-label="Type scale">
            <h2 className="nm-font-spec__panel-title">Display &amp; reading scale</h2>
            <div className="nm-font-spec__scale">
              <div className="nm-font-spec__scale-row">
                <span className="nm-font-spec__scale-meta">Display</span>
                <p className="nm-font-spec__scale-sample nm-font-spec__scale-sample--display">
                  Map the thought
                </p>
              </div>
              <div className="nm-font-spec__scale-row">
                <span className="nm-font-spec__scale-meta">Title</span>
                <p className="nm-font-spec__scale-sample nm-font-spec__scale-sample--title">
                  Workspace · Ideas
                </p>
              </div>
              <div className="nm-font-spec__scale-row">
                <span className="nm-font-spec__scale-meta">UI</span>
                <p className="nm-font-spec__scale-sample nm-font-spec__scale-sample--ui">
                  Organise · Export · Settings · Terminal
                </p>
              </div>
              <div className="nm-font-spec__scale-row">
                <span className="nm-font-spec__scale-meta">Body</span>
                <p className="nm-font-spec__scale-sample nm-font-spec__scale-sample--body">
                  Capture notes as connected cards on an infinite desk. Link ideas, rearrange the
                  graph, and keep every workspace local to this device.
                </p>
              </div>
              <div className="nm-font-spec__scale-row">
                <span className="nm-font-spec__scale-meta">Caption</span>
                <p className="nm-font-spec__scale-sample nm-font-spec__scale-sample--caption">
                  Saved offline · v build · pinch to zoom · drag from a socket
                </p>
              </div>
            </div>
          </section>

          <section className="nm-font-spec__panel" aria-label="UI chrome samples">
            <h2 className="nm-font-spec__panel-title">UI chrome</h2>
            <div className="nm-font-spec__chrome">
              <div className="nm-font-spec__toolbar" aria-hidden="true">
                <button type="button" className="nm-font-spec__btn nm-font-spec__btn--primary">
                  New note
                </button>
                <button type="button" className="nm-font-spec__btn">
                  Organise
                </button>
                <button type="button" className="nm-font-spec__btn nm-font-spec__btn--ghost">
                  Export
                </button>
              </div>

              <label className="nm-font-spec__field">
                <span className="nm-font-spec__label">Workspace name</span>
                <input
                  className="nm-font-spec__input"
                  defaultValue="Roots of thought"
                  readOnly
                />
              </label>

              <article className="nm-font-spec__node">
                <h3>Next steps</h3>
                <p>
                  Branch, rearrange, and export when the map is ready. Judge how labels and body
                  sit together in a compact card.
                </p>
              </article>

              <div className="nm-font-spec__weights" aria-label="Weight samples">
                {specimen.weights.map((weight) => (
                  <div
                    key={weight.value}
                    className="nm-font-spec__weight"
                    style={{ fontWeight: weight.value }}
                  >
                    <span>Ag</span>
                    <small>{weight.label}</small>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <section className="nm-font-spec__alphabet" aria-label="Character set">
          <h2 className="nm-font-spec__panel-title">Characters</h2>
          <p>ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
          <p>abcdefghijklmnopqrstuvwxyz</p>
          <p>0123456789 · — – / \ | @ # $ % &amp; * () [] {'{}'} &lt;&gt; ? !</p>
          <p>
            The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.
          </p>
        </section>
      </div>
    </div>
  );
}
