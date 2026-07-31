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

## Deploy to GitHub Pages

1. Push this repo to GitHub as **`NodeMind`** (the name must match the Vite `base` path).
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main` — the workflow builds and publishes automatically.

Live URL: `https://<your-username>.github.io/NodeMind/`

### Custom domain or different repo name

Edit `base` in `vite.config.js` to match your path (e.g. `'/'` for a user site at the root, or `'/my-repo/'` for a differently named project).

## Data storage

Workspaces are saved under the localStorage key `thoughts-canvas-workspaces-v2`. Use **Export JSON** in the toolbar to back up your data. Clearing browser storage will remove your canvases.

## License

Private — Windshifter.
