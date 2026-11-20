import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { normalizeWorkspaceIconId, searchWorkspaceIconIds } from '@/lib/workspaceIcons';
import WorkspaceIcon from '@/components/shell/WorkspaceIcon';

function formatIconLabel(iconId) {
  return String(iconId || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function LucideIconPicker({
  value,
  onChange,
  accentColour,
  fullWidth = false,
  compact = false,
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const selected = normalizeWorkspaceIconId(value);
  const accent = accentColour || '#6366f1';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    searchWorkspaceIconIds(query).then((next) => {
      if (!cancelled) {
        setOptions(next);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div
      className={`nm-icon-picker ${fullWidth ? 'nm-icon-picker--full' : ''} ${
        compact ? 'nm-icon-picker--compact' : ''
      }`}
    >
      {!compact ? (
        <div className="nm-icon-picker__current">
          <div
            className="nm-icon-picker__preview"
            style={{
              backgroundColor: `${accent}1a`,
              borderColor: accent,
              color: accent,
            }}
          >
            <WorkspaceIcon icon={selected} colour={accent} size={22} />
          </div>
          <div className="nm-icon-picker__current-meta">
            <span className="nm-icon-picker__current-name">{formatIconLabel(selected)}</span>
          </div>
        </div>
      ) : null}

      <div className="nm-icon-picker__search">
        <Search size={15} strokeWidth={1.75} className="nm-icon-picker__search-icon" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search 1,700+ Lucide icons…"
          className="nm-icon-picker__search-input"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {loading ? (
        <p className="nm-icon-picker__empty">Loading icons…</p>
      ) : (
        <div className="nm-icon-picker__grid" role="listbox" aria-label="Workspace icon">
          {options.map((name) => {
            const isOn = name === selected;
            return (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={isOn}
                title={name}
                onClick={() => onChange?.(name)}
                className={`nm-icon-picker__cell ${isOn ? 'is-on' : ''}`}
                style={
                  isOn
                    ? {
                        backgroundColor: `${accent}22`,
                        borderColor: accent,
                        color: accent,
                      }
                    : undefined
                }
              >
                <WorkspaceIcon icon={name} colour={isOn ? accent : undefined} size={18} />
              </button>
            );
          })}
        </div>
      )}
      {!loading && query.trim() && options.length === 0 ? (
        <p className="nm-icon-picker__empty">No icons match that search.</p>
      ) : null}
    </div>
  );
}