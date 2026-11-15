# Noded — living product philosophy

This file is the **running source of truth** for Gen II. Update it whenever a prompt significantly changes product direction. Agents must read it before chrome, layout, or brand work.

Branch: `gen-ii`. Public name: **Noded**. Repo / storage keys stay `nodemind`.

---

## North star

Noded is a **local graph for thinking**. It should feel at home next to Linear, Notion, Cursor, and Claude: one visual grammar, not a parody of any one product.

**The canvas is the product.** Chrome is a quiet frame. Colour is a signal, not decoration.

---

## Visual grammar (locked)

| Topic | Rule |
|-------|------|
| Surfaces | Near-white (default) or near-black; grey ramps, not rainbow chrome |
| Accent | One cool Linear-class violet (`--nm-accent`); semantic red/amber/green only |
| Type | Inter for UI; JetBrains Mono for terminal |
| Radius | 6–8px chrome and dialogs — not capsules |
| Icons | 16–18px, 1.75 stroke; no filled decorative chrome |
| Motion | 150–200ms ease; no liquid / gel |
| Canvas | Neutral **dot grid**; empty canvas stays **blank** (no instructional overlay) |
| Workspace colour | Not in chrome. Optional **left rail** on nodes + sockets only |

---

## Application architecture (locked 2026-11-15, layout pass)

Learned from Linear + Notion (and Cursor’s same family). Keep the **spatial contract**, discard marketing copy, team invites, and product-specific nav.

```
┌─────────────┬──────────────────────────────────────┐
│ Sidebar     │ Top bar: current workspace + tools   │
│ (collapsible)│ (workflow only — add, draw, organise,│
│  brand      │  share/save, terminal, zoom)          │
│  workspaces │──────────────────────────────────────│
│  + / edit   │                                      │
│  settings   │              Canvas                  │
│             │                         [ Agent ▢ ]  │
└─────────────┴──────────────────────────────────────┘
```

### What each region is for

| Region | Owns | Must not own |
|--------|------|----------------|
| **Left sidebar** | Product identity, **workspace list**, new/edit workspace, **Settings**, collapse control | Canvas tools, zoom, draw, add-node |
| **Top bar** | **Current workspace name**, features used *while thinking on the graph* (add, draw, select, organise, recenter, share, save, terminal, zoom) | Settings, workspace CRUD |
| **Canvas** | The graph. Empty = quiet. | Hints, FAQs, chrome |
| **Bottom-right Agent** | Future AI chat. Until then: **Coming soon** panel. Same corner as Linear Agent / Notion help | Navigation |

### Sidebar behaviour

- Expanded ~240px; collapsed ~48px icon rail (Linear/Notion).
- Persist collapse in `localStorage` (`noded-sidebar-collapsed`).
- Mobile: overlay drawer from the left (hamburger). Same content as desktop.
- Active workspace = quiet highlight, **no colour pills**.

### Agent

- Desktop: persistent control, lower-right of the **main pane** (not over the sidebar).
- Mobile: **icon in the top bar** (right). Never a labeled chip sitting on the tab bar.
- Opens a small panel: **Coming soon** — AI chat for this workspace. No fake chat.

### Mobile (locked 2026-11-15, mobile pass)

Learned from Linear iOS/Android (custom bottom toolbar, Create in chrome, drawer for switching) and Notion mobile (edge-to-edge top title bar, persistent bottom bar, Home drawer for the sidebar). Cursor has no first-class phone IDE; treat it as: agent is a surface, not a second nav.

| Rule | Why |
|------|-----|
| **Full-bleed top + bottom bars** | Notion/Linear attach chrome to the screen edges. No floating glass islands. |
| **Bottom bar = workflow** | Add, draw, select, home, more — thumbs stay at the bottom (Linear tab bar / Notion capture bar). |
| **Drawer = places** | Workspaces + settings slide in from the left (Notion Home / Linear workspace switch). |
| **Agent is quiet** | Sparkle in the top-right, same Coming soon panel. Do not cover Add. |
| **Sheets from the bottom** | More / type pickers; 8px radius; same overlay token as dialogs. |

---

## Dialogs & submenus (cohesion rule)

Every overlay — Settings, node edit, workspace edit, share, save, nearby, terminal, type pickers, sheets — uses the **same dialog language**:

- Overlay: `--nm-overlay`, **no heavy blur**
- Panel: `--nm-panel`, 1px `--nm-border`, 8px radius, `--nm-shadow`
- Header: 48px, hairline bottom, 13px semibold title, 32px close
- Nested nav (Settings): same as sidebar items, not a second visual system
- Primary actions: `--nm-accent` or near-black on light; danger stays rose

If you add a menu, **copy an existing dialog**, do not invent a new radius/shadow/glass recipe.

---

## Locked product decisions

| Decision | Choice |
|----------|--------|
| Name / tagline | **Noded** / “A local graph for thinking.” |
| Theme | Light default; Dark + System in Settings |
| Skins | Removed |
| Entry | Direct to canvas; optional onboarding tour |
| Pages | `dev` is the allowed GitHub Pages branch unless `github-pages` environment also lists `gen-ii` |

---

## History log (append on significant prompts)

### 2026-11-15 — Brand reset

Monochrome ecosystem grammar; Noded; light default; skins deleted; dot grid; no marketing landing.

### 2026-11-15 — Mobile chrome (Linear / Notion phones)

Edge-attached bars; Agent moved to the mobile top-right; overlay drawer is `fixed` and full-height. Recenter uses the canvas pane, not the window (sidebar no longer skews the camera).

### 2026-11-15 — Shell layout (Linear / Notion)

User circled: workspace switcher + collapse in the **left rail**; **current context** in a thin top bar; **Agent** bottom-right; Notion **sidebar footer** (settings / product utilities). Applied as Noded’s shell. Discarded: team invites, Linear “Ask Linear” home, Notion breadcrumb-of-pages, “What’s new” cards.

Also: empty-canvas tutorial sentence removed; all dialogs brought onto one chrome.

---

## Agent conventions

1. Read this file first for chrome/layout/brand.
2. **Append a History log entry** when the user changes philosophy or layout.
3. Tokens only — no new hex in chrome (user node colours excepted).
4. Do not reintroduce glass, landing splash, or rainbow workspace tabs.
5. Work on `gen-ii`. GitHub Pages: merge to `dev` until `gen-ii` is allowlisted.
