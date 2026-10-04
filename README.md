# NodeMind

A local-first mind map canvas. Open the page and start editing — all workspaces, notes, connections, and attached files stay on this device.

Built by **Windshifter**.

## Features

- Infinite pan/zoom canvas with Text notes and Math CAS nodes (expand, factor, calculus, solve)
- Multiple workspaces with custom names, colours, and icons
- Export/import workspaces as JSON
- Send the current workspace to another open NodeMind session on this network, or outside it with a 6-character code
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

Edge-aware auto-organise experiments:
- Curve-fan: `https://windshifter1.github.io/NodeMind/dev`
- Node-spread: `https://windshifter1.github.io/NodeMind/dev2`

After deploy, open the site and check the browser Network tab: requests should go to `/NodeMind/assets/index-*.js`, and the manifest should load from `/NodeMind/manifest.json`.

### Custom domain or different repo name

Edit `base` in `vite.config.js` to match your path (e.g. `'/'` for a user site at the root, or `'/my-repo/'` for a differently named project).

## Data storage

Workspaces and attached files are saved in this browser's **IndexedDB** (`nodemind-app-v1`). Theme, landing, and onboarding flags stay in localStorage.

Use **Export** in the toolbar to download the active workspace (including background art and referenced files). Use **Settings → Data → Export all workspaces** for a full backup. Import either file to add workspaces without overwriting existing ones.

Clearing site data for this origin still deletes canvases. If a save fails (for example the browser is out of space), NodeMind shows a banner with **Export backup** and **Retry**.

## License

Private — Windshifter.
