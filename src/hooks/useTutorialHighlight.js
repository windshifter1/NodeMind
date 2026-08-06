import { useEffect, useState } from 'react';

export function useTutorialHighlight(target) {
  const [active, setActive] = useState(
    () => typeof document !== 'undefined' && document.body.dataset.tutorialHighlight === target
  );

  useEffect(() => {
    const sync = () => setActive(document.body.dataset.tutorialHighlight === target);
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { attributes: true, attributeFilter: ['data-tutorial-highlight'] });
    return () => mo.disconnect();
  }, [target]);

  return active;
}
