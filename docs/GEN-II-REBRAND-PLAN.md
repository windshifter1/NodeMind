# Gen II — rebrand & visual architecture plan

Branch: `gen-ii` (product codename **Gen II**; public name TBD).

This document is the execution backbone for agents implementing a full visual/brand reset. Read [`AGENTS.md`](../AGENTS.md) for codebase layout (may lag `dev`); on `gen-ii`, prefer this file for design work.

---

## North star

Join the **modern knowledge-work tool aesthetic** (Linear, Notion, Cursor, Raycast, Vercel, Claude)—not by copying layouts, but by sharing the same **visual grammar**: neutral chrome, one accent, typography-led hierarchy, density, keyboard fluency, and “the canvas is the hero.”

**Anti-goals:** glassmorphism skins, rainbow workspace colours as brand, decorative UI chrome competing with the graph, multiple parallel “UI style” themes.

---

## Phase 0 — Decisions (locked 2026-11-15)

| Decision | Choice |
|----------|--------|
| **Product name (user-facing)** | **Noded** |
| **Engineering / repo** | Keep `nodemind`, GitHub path, npm package, `localStorage` keys |
| **Branch codename** | `gen-ii` |
| **Default theme** | **Light** first paint (still ship dark + system toggle) |
| **Legacy UI skins** | **Remove** (Lens / Gel / Clay / Sketch) — single Gen II chrome |
| **Rename scope** | UI, manifest, copy, terminal strings — not repo or storage migration |

Visual & UX (locked 2026-11-15, round 2):

| Topic | Choice |
|-------|--------|
| **Accent** | Ecosystem norm: **one restrained cool accent** on neutral chrome (Linear-class desaturated violet; semantic red/amber/green for status only) |
| **Accent implementation** | Token `accent` in OKLCH — ~**#5E6AD2** family; primary actions use accent; chrome remains greyscale |
| **Logomark** | **Abstract** monochrome mark (node/graph geometry, not a letter); SVG, 16px-safe |
| **Tagline** | **“A local graph for thinking.”** |
| **Workspace colour in chrome** | **Remove** from tabs/bar — name + icon only |
| **Canvas background** | **Subtle dot grid** on neutral base |
| **Landing / entry** | **Direct to canvas** (ecosystem norm); onboarding tour for first visit; no marketing landing gate |

Still open (optional polish):

- [ ] Final abstract logomark SVG (Phase 2.1)

---

## Phase 1 — Design system foundation

**Goal:** One token system; delete or freeze legacy multi-style CSS.

| Task | Files / area | Done when |
|------|----------------|-----------|
| 1.1 Define token schema | `src/index.css`, new `src/styles/tokens.css` | 3 inputs documented: base, accent, contrast (Linear-style); all surfaces derive from CSS variables |
| 1.2 Migrate to OKLCH/LCH | `tokens.css` | Light + dark palettes; 4-step text ramp; 3 surface elevations + overlay |
| 1.3 Tailwind bridge | `tailwind.config.js` | Replace ad-hoc `nm-*` with semantic names: `surface`, `elevated`, `border`, `text-primary`… |
| 1.4 Typography | `index.html` font links, `index.css` | One sans (Inter or Geist); optional mono for terminal/IDs; display weight for rare headings only |
| 1.5 Motion | `index.css` or `motion.css` | 150–200ms ease; no gel/liquid jiggle as default |
| 1.6 Deprecate UI styles | `src/lib/uiStyle.js`, `src/styles/ui-*.css` | Settings no longer exposes 5 skins; one Gen II chrome (keep feature flag `legacyUi` only if owner requests) |
| 1.7 Iconography | lucide usage audit | 16–18px toolbar; 1.5px stroke; no filled decorative icons in chrome |

**Acceptance:** Toggle light/dark; no references to `UI_STYLE` in Settings; Storybook-like static page optional (`/dev/tokens` route) for visual QA.

---

## Phase 2 — Brand assets & copy

| Task | Files | Done when |
|------|-------|-----------|
| 2.1 Logomark SVG | `public/favicon.svg`, `public/logo-mark.svg` | Works at 16px; monochrome; clear on `#0a0a0a` and `#fafafa` |
| 2.2 PWA icons | `public/icon-*.png`, `manifest.json` | `theme_color` / `background_color` match tokens |
| 2.3 App strings | grep `NodeMind` in `src/` | Centralize in `src/lib/brand.js` (name, tagline, terminal banner) |
| 2.4 Entry / landing | `LandingPage.jsx`, `Canvas.jsx` boot | Default **direct-to-canvas**; remove marketing landing as gate; onboarding tour for first visit |
| 2.5 Meta | `index.html` title, description | Matches new name |

---

## Phase 3 — Application shell (desktop)

| Task | Files | Done when |
|------|-------|-----------|
| 3.1 Top bar | `Toolbar.jsx`, `WorkspaceBar.jsx`, `ui-chrome-layout.css` | Single height; hairline border; no workspace rainbow pills as primary nav |
| 3.2 Workspace switcher | `WorkspaceBar.jsx` | Icon + name only — **no workspace colour** in chrome |
| 3.3 Menus / sheets | mobile chrome components | Grayscale; accent = focus ring + primary button only |
| 3.4 Settings | `SettingsDialog.jsx` | Theme: light / dark / system; density compact/default; remove UI style picker |
| 3.5 Command affordance | optional `Cmd+K` palette | Aligns with ecosystem; can ship post-MVP |

---

## Phase 4 — Canvas & nodes

| Task | Files | Done when |
|------|-------|-----------|
| 4.1 Canvas background | `CanvasBoard.jsx`, tokens | **Dot grid** on neutral token `--canvas`; no warm sketch paper default |
| 4.2 Node chrome | `NoteNode.jsx`, math/graph node components | Flat surface + 1px border; workspace colour = subtle left rail or socket ring only |
| 4.3 Edges | `canvasConstants.js`, board render | Muted grey edges; accent for selection only |
| 4.4 Selection / focus | board | High contrast focus consistent with tokens |
| 4.5 Draw layer | draw tools | Tools match shell; no separate “draw mode” aesthetic universe |

---

## Phase 5 — Dialogs, terminal, onboarding

| Task | Files | Done when |
|------|-------|-----------|
| 5.1 Modal system | all `*Dialog.jsx` | Shared header, padding, border-radius 8px |
| 5.2 Terminal | `TerminalDialog.jsx`, `terminal/help.js` | Monospace; prompt uses accent sparingly; banner uses `brand.js` |
| 5.3 Onboarding | `OnboardingTour.jsx` | Shorter copy; neutral coach marks; no purple gradients |

---

## Phase 6 — Mobile

| Task | Files | Done when |
|------|-------|-----------|
| 6.1 FAB / rails | mobile chrome in `src/components/` | Same tokens as desktop; safe-area preserved |
| 6.2 Touch targets | 44px min | No visual style divergence |

---

## Phase 7 — Quality & rollout

| Task | Done when |
|------|-----------|
| 7.1 WCAG contrast on text ramp | AA minimum; optional high-contrast token preset |
| 7.2 `npm run lint` + `typecheck` | Clean |
| 7.3 Visual regression checklist | See appendix |
| 7.4 Update `README.md`, `CLAUDE.md`, `AGENTS.md` | Brand + token rules |
| 7.5 Version bump | `node scripts/version.mjs bump minor` when Gen II ships |

---

## Appendix A — Visual regression checklist

- [ ] Landing → enter app
- [ ] Create workspace, add note + math node, connect edge
- [ ] Auto-organise, pan/zoom extremes
- [ ] Export / share flows
- [ ] Terminal `help`, `version`
- [ ] Mobile width 390px: toolbar, sheets, draw
- [ ] Light + dark + system preference

---

## Appendix B — Agent conventions

1. **One PR per phase** (or sub-phase), targeting `gen-ii`.
2. Do not reintroduce `ui-glass.css` / gel classes in new code.
3. Use design tokens only—no hardcoded hex in components (except canvas user colours).
4. Keep behaviour identical unless task explicitly changes UX.
5. Reference this plan’s task IDs in commit messages (`gen-ii: 3.1 top bar tokens`).

---

## Appendix C — Current baseline (pre–Gen II)

- **Name:** NodeMind; indigo manifest (`#4f46e5`).
- **UI:** Five interchangeable skins via `uiStyle.js` (lens, acrylic, gel, clay, sketch).
- **Brand feel:** Glass / liquid / playful; multiple saturated workspace colours in chrome.

Gen II removes skin-swapping as a first-class feature and replaces it with one neutral system.