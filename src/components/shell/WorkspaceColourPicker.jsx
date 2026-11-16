import React from 'react';
import { WORKSPACE_COLORS } from '@/lib/workspaceIcons';

function normalizeHex(input) {
  const raw = String(input || '').trim();
  if (!raw) return WORKSPACE_COLORS[0];
  const withHash = raw.startsWith('#') ? raw : `#${raw}`;
  if (/^#[0-9a-fA-F]{6}$/.test(withHash)) return withHash.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(withHash)) {
    const [, r, g, b] = withHash;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return WORKSPACE_COLORS[0];
}

export default function WorkspaceColourPicker({ value, onChange, compact = false }) {
  const colour = normalizeHex(value);

  return (
    <div className={`nm-colour-field ${compact ? 'nm-colour-field--compact' : ''}`}>
      <div className="nm-colour-swatches nm-colour-swatches--row" role="listbox" aria-label="Canvas colour">
        {WORKSPACE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="option"
            aria-selected={colour === c}
            aria-label={`Colour ${c}`}
            onClick={() => onChange?.(c)}
            className={`nm-colour-swatch ${colour === c ? 'is-on' : ''}`}
            style={{ backgroundColor: c, color: c }}
          />
        ))}
      </div>
    </div>
  );
}