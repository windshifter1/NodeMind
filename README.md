# NodeMind

A local-first mind map canvas. Open the page and start editing — all workspaces, notes, and connections are stored in your browser's localStorage.

Built by **Windshifter**.

## Features

- Infinite pan/zoom canvas with connected note nodes
- Multiple workspaces with custom names, colours, and icons
- Export/import workspaces as JSON
- Copy workspace contents as plain text
- Dark/light note themes
- No login, no server — works fully offline after first load

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:5173/NodeMind/](http://localhost:5173/NodeMind/) (Vite uses `/NodeMind/` as the base path to match GitHub Pages).

## Build

```bash
npm run build
npm run preview
```

Output is written to `dist/`.

## Versioning

Application version and build number live in a single source of truth: [`version.json`](./version.json).

```bat
node scripts/version.mjs
node scripts/version.mjs help
node scripts/version.mjs bump
node scripts/version.mjs bump patch
```

Or via npm: `npm run version:info`, `npm run version:bump`.

A Git `pre-commit` hook increments the build number before every commit (and stages `version.json` into that commit). Run `npm run hooks:install` once per clone if hooks are not configured (also attempted by `npm install`).

Full details: [`docs/VERSIONING.md`](./docs/VERSIONING.md).

In the app terminal: `version`, `version help`.

## Deploy to GitHub Pages

1. Run `npm install` locally and commit `package-lock.json` (required for `npm ci` in CI).
2. Push this repo to GitHub as **`NodeMind`** (must match the Vite `base` path).
3. **Critical:** In the repo go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions** — not "Deploy from a branch". If branch deploy is enabled, GitHub serves the raw source files instead of Vite's built `dist/` output and the page stays blank.
4. Push to `dev` — the workflow builds `dist/` and publishes that folder only. GitHub Pages tracks the `dev` branch.

Live URL: `https://windshifter1.github.io/NodeMind/`

After deploy, open the site and check the browser Network tab: requests should go to `/NodeMind/assets/index-*.js`, and the manifest should load from `/NodeMind/manifest.json`.

### Custom domain or different repo name

Edit `base` in `vite.config.js` to match your path (e.g. `'/'` for a user site at the root, or `'/my-repo/'` for a differently named project).

## Data storage

Workspaces are saved under the localStorage key `thoughts-canvas-workspaces-v2`. Use **Export JSON** in the toolbar to back up your data. Clearing browser storage will remove your canvases.

## License

Private — Windshifter.
