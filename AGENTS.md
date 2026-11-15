# NodeMind — project index

Local-first mind map canvas (React + Vite). All state lives in the browser (`localStorage`). Built by Windshifter.

**User setup / deploy:** [`README.md`](./README.md)  
**Versioning:** only touch [`version.json`](./version.json) via `node scripts/version.mjs` — see [`docs/VERSIONING.md`](./docs/VERSIONING.md).

## Stack

| Layer | Choice |
|--------|--------|
| UI | React 18, JSX, Tailwind CSS, lucide-react |
| Build | Vite 6, `@` → `src/` |
| Base path | `/NodeMind/` (`vite.config.js`) — must match GitHub Pages repo name |
| Lint / types | ESLint 9, `jsconfig.json` + `npm run typecheck` |
| PWA | `generate-sw.mjs` after build; `registerServiceWorker.js` |

## Directory map

```
NodeMind/
├── index.html, src/main.jsx     # Entry; theme + SW registration
├── src/App.jsx                  # Shell; offline badge
├── src/pages/Canvas.jsx         # Main screen: pan/zoom, dialogs, onboarding boot
├── src/hooks/
│   ├── useWorkspaces.js         # Workspace reducer + localStorage persistence
│   ├── useSpacePan.js           # Canvas pan (space + drag)
│   └── useTutorialHighlight.js  # Onboarding highlight targets
├── src/components/canvas/       # Toolbar, board, nodes, workspace bar, dialogs, terminal UI
├── src/components/onboarding/   # First-run tour
├── src/lib/
│   ├── canvasConstants.js       # Node geometry, zoom, auto-layout wrappers, sockets/edges
│   ├── layout/                  # Graph auto-organise (tree, radial, layered, organic, …)
│   ├── terminal/                # In-app terminal help + tutorial steps
│   ├── theme.js, onboarding.js, workspaceIcons.js, tutorialEvents.js
│   └── appVersion.js            # Reads version.json + injected git defines
├── scripts/                     # version.mjs, hooks, layout test
├── public/                      # manifest, favicon
├── version.json                 # Single source of truth for app version/build
└── .github/workflows/deploy.yml # GitHub Pages from `dev`
```

## Runtime architecture

```
main.jsx → App.jsx → Canvas.jsx
                          ├── useWorkspaces()  (state.workspaces, activeId, dispatch)
                          ├── CanvasBoard      (nodes, edges, interaction)
                          ├── WorkspaceBar / Toolbar / dialogs
                          └── OnboardingTour (optional)
```

**State:** `useWorkspaces` holds `{ workspaces[], activeId }`. Each workspace has metadata (name, colour, icon, orientation, layout settings), `nodes[]`, `edges[]`, `nextZ`, and `terminal` (per-workspace CLI buffer).

**Persistence:** `localStorage` key `thoughts-canvas-workspaces-v2` (legacy `thoughts-canvas-graph-v1` migrated on load). No server API.

## Workspace reducer actions

Defined in `src/hooks/useWorkspaces.js`:

- `ADD_WORKSPACE`, `IMPORT_AS_WORKSPACE`, `DELETE_WORKSPACE`, `UPDATE_WORKSPACE_META`, `SET_ACTIVE`, `REPLACE_ACTIVE_WORKSPACE`
- `ADD_NODE`, `ADD_CONNECTED_NODE`, `UPDATE_NODE`, `DELETE_NODE`, `DELETE_NODES`, `BRING_TO_FRONT`
- `ADD_EDGE`, `DELETE_EDGE`, `CLEAR_CONTENT`
- `SET_WORKSPACE_TERMINAL`

Prefer new graph changes through these actions so persistence and invariants stay consistent.

## Layout engine

Entry: `autoOrganiseGraph` in `src/lib/layout/index.js` (also exposed via `autoOrganiseNodes` in `canvasConstants.js`).

| Module | Role |
|--------|------|
| `graphModel.js` | Build adjacency model from nodes/edges |
| `analysis.js` | Components, roots, strategy hints |
| `strategies.js` | Pick tree / radial / layered / floating / organic |
| `treeLayout.js`, `radialLayout.js`, `layeredLayout.js`, `floatingLayout.js`, `organicLayout.js` | Placement |
| `optimise.js` | Collision resolution, component optimise |
| `routing.js` | Edge path style (straight, orthogonal, bundles) |

CLI smoke test: `node scripts/test-layout.mjs`.

## In-app terminal

`TerminalDialog.jsx` implements a workspace-scoped command shell (nodes, edges, workspaces, layout, export, `version`, `help`, tutorials). Command reference: `src/lib/terminal/help.js`. Interactive tutorial: `src/lib/terminal/tutorial.js` + `TerminalTutorial.jsx`.

## Key UI files

| File | Responsibility |
|------|------------------|
| `CanvasBoard.jsx` | Infinite canvas, selection, connections, bin delete |
| `NoteNode.jsx` | Node chrome, edit affordances |
| `Toolbar.jsx` | Zoom, organise, export, terminal, settings |
| `WorkspaceBar.jsx` | Tabs, create/edit workspace |
| `NodeEditDialog.jsx`, `WorkspaceEditDialog.jsx` | Metadata editors |
| `TextExportDialog.jsx` | Plain-text export |
| `SettingsDialog.jsx` | Light/dark node theme |

## Build & tooling

```bash
npm install
npm run dev          # http://localhost:5173/NodeMind/
npm run build        # dist/ + service worker
npm run lint
npm run typecheck
npm run version:info
```

Git commit/branch are injected at build time in `vite.config.js` as `__NODEMIND_GIT_*__` for version reporting in the terminal.

## Conventions for contributors

- Use `@/` imports for `src/`.
- Keep components functional; workspace graph logic belongs in the reducer or `canvasConstants` / `layout`, not duplicated in UI.
- Do not hardcode version or build strings; use `version.json` and `appVersion.js`.
- Match existing Tailwind tokens (e.g. `bg-nm-canvas`) and dialog patterns when adding UI.
- `npm run lint` before commit; pre-commit hook bumps build in `version.json`.

## Where to start for common tasks

| Task | Start here |
|------|------------|
| New toolbar action | `Toolbar.jsx` → handlers in `Canvas.jsx` → `dispatch` in `useWorkspaces.js` if state changes |
| Node appearance / hit targets | `NoteNode.jsx`, constants in `canvasConstants.js` |
| Auto-layout behaviour | `src/lib/layout/*`, then wire from `Canvas.jsx` / terminal commands |
| New terminal command | `TerminalDialog.jsx` + document in `lib/terminal/help.js` |
| Storage / migration | `useWorkspaces.js` (`loadInitial`, `migrateWorkspaceNodeIds`) |
| Deploy issues | `README.md` (GitHub Actions source, base path, asset URLs) |