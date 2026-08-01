# NodeMind versioning

Single source of truth: **`version.json`** at the repository root.

```json
{
  "version": "0.5.0",
  "build": 25
}
```

| Field | Meaning |
| --- | --- |
| `version` | Semantic version (`major.minor.patch`) |
| `build` | Monotonic build counter (increments on every Git commit via pre-commit) |

Nothing else should be edited by hand for release numbers. `package.json` → `version` is intentionally left as a non-authoritative placeholder (`0.0.0`) so there is no second copy of the app version to drift out of sync.

## Why this shape

- **JSON file in-repo** — readable by Vite/React (import), Node scripts, and Git hooks without a database or private registry.
- **Separate build number** — lets every commit get a unique build while semver only moves on intentional bumps.
- **CLI + in-app terminal** — developers bump from Command Prompt; users can inspect version inside the app terminal.
- **`core.hooksPath = hooks`** — the `pre-commit` hook lives in the repo and works from Cursor, CMD, PowerShell, VS Code, GitHub Desktop, etc., once installed for the clone.

Git commit/branch are **not** stored in `version.json`. The CLI queries Git live; the web app receives values injected when Vite starts (`npm run dev` / `npm run build`).

## Commands (Windows CMD / PowerShell / any shell)

From the project root:

```bat
node scripts/version.mjs
node scripts/version.mjs help
node scripts/version.mjs bump
node scripts/version.mjs bump patch
node scripts/version.mjs bump minor
node scripts/version.mjs bump major
```

npm shortcuts:

```bat
npm run version:info
npm run version:bump
npm run version:bump -- patch
npm run version:bump -- minor
npm run version:bump -- major
npm run hooks:install
```

### `version` / `version:info`

Prints:

```text
NodeMind
Version : 0.5.0
Build   : 25
Commit  : <short hash or unavailable>
Branch  : <branch or unavailable>
```

### `version bump`

Interactive prompt:

```text
1. Patch
2. Minor
3. Major
4. Revert patch
5. Revert minor
6. Revert major
7. None (esc)
```

Semver changes (or cancel); **build is unchanged**.

### `version bump patch|minor|major|revert-*`

Non-interactive semver change. Build unchanged.

### Automatic build increment

`hooks/pre-commit` runs before every commit:

```text
node scripts/version.mjs bump-build
git add version.json
```

That increments `build` by 1, leaves `version` alone, and stages `version.json` so the new build is included in the commit being created.

Install / repair hooks:

```bat
npm run hooks:install
```

`npm install` / `npm prepare` also attempts this when Git is available.

## In-app terminal

| Command | Behaviour |
| --- | --- |
| `version` | Shows version report (from `version.json` + Vite-injected Git meta) |
| `version help` | Shows version command help |
| `version bump …` | Explains how to run the CLI bump (browser cannot write `version.json`) |

## Module map

| Path | Role |
| --- | --- |
| `version.json` | Source of truth |
| `src/lib/versioning/messages.js` | Shared help / report formatting |
| `src/lib/appVersion.js` | App-facing API |
| `scripts/lib/version-core.mjs` | Read/write, Git, bump logic |
| `scripts/version.mjs` | CLI entry |
| `scripts/install-hooks.mjs` | Sets `core.hooksPath` |
| `hooks/pre-commit` | Build increment before commit (staged into that commit) |
| `vite.config.js` | Injects `__NODEMIND_GIT_*` at startup |

## Extending

- New display fields: add to `formatVersionReport` in `messages.js`, then wire CLI/app readers.
- New bump policies: extend `bumpSemver` / `bumpVersion` in `version-core.mjs`.
- CI version stamps: run `node scripts/version.mjs` or import `version.json` in the pipeline; do not hardcode numbers.
