import { useEffect, useState } from 'react';
import Canvas from '@/pages/Canvas';
import { lockMobileViewport } from '@/lib/lockMobileViewport';

export default function App() {
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);

  useEffect(() => {
    return lockMobileViewport();
  }, []);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-nm-page">
      <Canvas />
      {offline && (
        <div
          className="absolute z-[120] rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-700 shadow-lg backdrop-blur dark:text-amber-100"
          style={{
            right: 'calc(var(--app-bleed-x, 0px) + 0.75rem + var(--safe-right))',
            bottom: 'calc(var(--app-bleed-y, 0px) + 0.75rem + var(--safe-bottom))',
          }}
        >
          Offline mode
        </div>
      )}
    </div>
  );
}
