import React from 'react';
import { Search, X } from 'lucide-react';

export function SettingsDialogFrame({ open, onClose, panelClassName = '', children }) {
  if (!open) return null;

  return (
    <div className="nm-dialog-root">
      <div className="nm-dialog-overlay" onClick={onClose} />
      <div
        className={`nm-dialog-panel nm-settings-panel ${panelClassName}`.trim()}
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button type="button" onClick={onClose} className="nm-settings-panel__close" title="Close">
          <X size={18} strokeWidth={1.75} />
        </button>
        {children}
      </div>
    </div>
  );
}

export function SettingsDialogBody({ sidebar, children }) {
  return (
    <div className="nm-settings-body">
      <aside className="nm-settings-nav">{sidebar}</aside>
      <section className="nm-settings-main">{children}</section>
    </div>
  );
}

export function SettingsNavSearch({ value, onChange, placeholder = 'Search settings' }) {
  return (
    <div className="nm-settings-nav__search">
      <Search size={15} strokeWidth={1.75} className="nm-settings-nav__search-icon" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="nm-settings-nav__search-input"
      />
    </div>
  );
}

export function SettingsNavGroup({ label, children }) {
  return (
    <div className="nm-settings-nav__group">
      {label ? <p className="nm-settings-nav__group-label">{label}</p> : null}
      <div className="nm-settings-nav__group-items">{children}</div>
    </div>
  );
}

export function SettingsNavItem({ icon: Icon, label, active, onClick, danger, 'data-onboarding': dataOnboarding }) {
  return (
    <button
      type="button"
      data-onboarding={dataOnboarding}
      onClick={onClick}
      className={`nm-settings-nav__item ${active ? 'is-active' : ''} ${danger ? 'is-danger' : ''}`}
    >
      {Icon ? <Icon size={16} strokeWidth={1.75} className="shrink-0" /> : null}
      <span>{label}</span>
    </button>
  );
}

export function SettingsPage({ title, description, children }) {
  return (
    <>
      <header className="nm-settings-page-head">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      <div className="nm-settings-page">{children}</div>
    </>
  );
}

export function SettingsSection({ title, children }) {
  return (
    <div className="nm-settings-section">
      {title ? <h3 className="nm-settings-section__title">{title}</h3> : null}
      <div className="nm-settings-section__rows">{children}</div>
    </div>
  );
}

export function SettingsRow({ label, description, children, layout = 'split' }) {
  return (
    <div className={`nm-settings-row ${layout === 'stack' ? 'nm-settings-row--stack' : ''}`}>
      <div className="nm-settings-row__meta">
        <span className="nm-settings-row__label">{label}</span>
        {description ? <span className="nm-settings-row__desc">{description}</span> : null}
      </div>
      <div className="nm-settings-row__control">{children}</div>
    </div>
  );
}

export function SettingsSegmented({ options, value, onChange, accentColour }) {
  return (
    <div className="nm-settings-segmented" role="group">
      {options.map((opt) => {
        const selected = value === opt.value;
        const accentStyle =
          selected && accentColour
            ? {
                borderColor: accentColour,
                backgroundColor: `${accentColour}18`,
              }
            : undefined;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange?.(opt.value)}
            className={`nm-settings-segmented__btn ${selected ? 'is-on' : ''}`}
            style={accentStyle}
          >
            {opt.icon ? (
              typeof opt.icon === 'function' ? (
                <opt.icon active={selected} accentColour={accentColour} />
              ) : (
                <opt.icon size={15} strokeWidth={1.75} />
              )
            ) : null}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SettingsFooter({ leading, trailing }) {
  return (
    <footer className="nm-settings-footer">
      <div className="nm-settings-footer__leading">{leading}</div>
      <div className="nm-settings-footer__trailing">{trailing}</div>
    </footer>
  );
}