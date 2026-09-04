import { useEffect, useState } from 'react';
import { readStoredUiStyle } from '@/lib/uiStyle';

export function useUiStyle() {
  const [style, setStyle] = useState(() =>
    typeof document === 'undefined'
      ? readStoredUiStyle()
      : document.documentElement.getAttribute('data-ui-style') || readStoredUiStyle(),
  );

  useEffect(() => {
    const sync = () => {
      setStyle(document.documentElement.getAttribute('data-ui-style') || readStoredUiStyle());
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ui-style'] });
    return () => mo.disconnect();
  }, []);

  return style;
}
