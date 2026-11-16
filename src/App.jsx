import { useEffect, useState } from 'react';
import Canvas from '@/pages/Canvas';
import FontSpecimen from '@/pages/fonts/FontSpecimen';
import MockupShell from '@/pages/mockups/MockupShell';
import MobileDevMockup from '@/pages/mockups/MobileDevMockup';
import {
  getAppPath,
  matchDevOrganisePath,
  matchDevPath,
  matchFontSpecimenPath,
  matchMockupPath,
} from '@/lib/appPath';
import { lockMobileViewport } from '@/lib/lockMobileViewport';
import TooltipLayer from '@/components/shell/TooltipLayer';

export default function App() {
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const [path, setPath] = useState(() => getAppPath());
  const edgeAwareMode = matchDevOrganisePath(path);
  const edgeAwareLayout = edgeAwareMode != null;
  const edgeCurveFan = edgeAwareMode === 'curve-fan';

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

  const mockupN = matchMockupPath(path);
  const fontSpecimen = matchFontSpecimenPath(path);
  const frame = (node) => (
    <>
      {node}
      <TooltipLayer />
    </>
  );

  if (fontSpecimen) {
    return frame(<FontSpecimen kind={fontSpecimen} />);
  }

  if (mockupN) {
    return frame(<MockupShell n={mockupN} />);
  }

  // /dev and /dev2 are organise experiments (must win over old /dev2 mockup route).
  if (edgeAwareLayout) {
    const label =
      edgeAwareMode === 'node-spread'
        ? '/dev2 · node-spread organise'
        : '/dev · curve-fan organise';
    return frame(
      <div className="relative h-full w-full overflow-hidden bg-nm-canvas">
        <Canvas
          edgeAwareLayout
          edgeAwareMode={edgeAwareMode}
          edgeCurveFan={edgeCurveFan}
          smoothStrokes
        />
        <div
          className="pointer-events-none absolute z-[120] rounded-full border border-indigo-400/40 bg-indigo-500/15 px-3 py-1.5 text-xs font-medium text-indigo-200 shadow-lg backdrop-blur"
          style={{
            right: 'calc(0.75rem + var(--safe-right))',
            top: 'calc(0.75rem + var(--safe-top))',
          }}
        >
          {label}
        </div>
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

  const devN = matchDevPath(path);
  if (devN) {
    return frame(<MobileDevMockup n={devN} />);
  }

  return frame(
    <div className="relative h-full w-full overflow-hidden bg-nm-canvas">
      <Canvas smoothStrokes />
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
