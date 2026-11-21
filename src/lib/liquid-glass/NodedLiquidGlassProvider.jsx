import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const defaultGlass = {
  blur: 17,
  transparency: 12,
  saturation: 160,
};

const ThemeContext = createContext({
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
  isDark: true,
  mode: 'glass',
  setMode: () => {},
  toggleMode: () => {},
  glass: defaultGlass,
  setGlass: () => {},
  resetGlass: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

/** Syncs liquid-glass CSS tokens with Noded `data-theme`; never overrides theme storage. */
export function NodedLiquidGlassProvider({ children }) {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      const resolved = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      setTheme(resolved);
      root.classList.toggle('light', resolved === 'light');
      root.setAttribute('data-glass-mode', 'glass');
      root.style.setProperty('--lg-blur', String(defaultGlass.blur));
      root.style.setProperty('--lg-transparency', String(defaultGlass.transparency));
      root.style.setProperty('--lg-saturation', String(defaultGlass.saturation));
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => obs.disconnect();
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme: () => {},
      toggleTheme: () => {},
      isDark: theme === 'dark',
      mode: 'glass',
      setMode: () => {},
      toggleMode: () => {},
      glass: defaultGlass,
      setGlass: () => {},
      resetGlass: () => {},
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function ThemeProvider({ children }) {
  return <NodedLiquidGlassProvider>{children}</NodedLiquidGlassProvider>;
}