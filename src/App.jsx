import { useCallback, useEffect, useState } from 'react';
import Canvas from '@/pages/Canvas';
import LandingPage from '@/components/landing/LandingPage';
import MockupShell from '@/pages/mockups/MockupShell';
import MobileDevMockup from '@/pages/mockups/MobileDevMockup';
import { getAppPath, isDevOrganisePath, matchDevPath, matchMockupPath } from '@/lib/appPath';
import { dismissLanding, shouldShowLanding } from '@/lib/landing';
import { lockMobileViewport } from '@/lib/lockMobileViewport';

export default function App() {
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const [path, setPath] = useState(() => getAppPath());
  const [showLanding, setShowLanding] = useState(() => shouldShowLanding());
  const edgeAwareLayout = isDevOrganisePath(path);

  useEffect(() => {
    return lockMobileViewport();
  }, []);

  useEffect(() => {
    const sync = () => setPath(getAppPath());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
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

  const enterApp = useCallback(() => {
    dismissLanding();
    setShowLanding(false);
  }, []);

  const mockupN = matchMockupPath(path);
  if (mockupN) {
    return <MockupShell n={mockupN} />;
  }

  const devN = matchDevPath(path);
  if (devN) {
    return <MobileDevMockup n={devN} />;
  }

  // /dev skips landing so the edge-aware organise experiment is one URL away.
  if (showLanding && !edgeAwareLayout) {
    return <LandingPage onEnter={enterApp} />;
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-nm-canvas">
      <Canvas edgeAwareLayout={edgeAwareLayout} />
      {edgeAwareLayout && (
        <div
          className="pointer-events-none absolute z-[120] rounded-full border border-indigo-400/40 bg-indigo-500/15 px-3 py-1.5 text-xs font-medium text-indigo-200 shadow-lg backdrop-blur"
          style={{
            right: 'calc(0.75rem + var(--safe-right))',
            top: 'calc(0.75rem + var(--safe-top))',
          }}
        >
          /dev · edge-aware organise
        </div>
      )}
      {offline && (
        <div
          className="absolute z-[120] rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-700 shadow-lg backdrop-blur dark:text-amber-100"
          style={{
            right: 'calc(0.75rem + var(--safe-right))',
            bottom: 'calc(0.75rem + var(--safe-bottom))',
          }}
        >
          Offline mode
        </div>
      )}
    </div>
  );
}
