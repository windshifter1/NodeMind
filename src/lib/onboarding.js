const COMPLETED_KEY = 'nodemind-onboarding-completed-v1';
const REPLAY_KEY = 'nodemind-onboarding-replay-v1';

export function isDesktopPlatform() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia?.('(hover: hover) and (pointer: fine)').matches === true;
}

export function readOnboardingCompleted() {
  try {
    return localStorage.getItem(COMPLETED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setOnboardingCompleted(completed = true) {
  try {
    if (completed) localStorage.setItem(COMPLETED_KEY, '1');
    else localStorage.removeItem(COMPLETED_KEY);
  } catch {
    /* ignore */
  }
}

export function readOnboardingReplayPending() {
  try {
    return localStorage.getItem(REPLAY_KEY) === '1';
  } catch {
    return false;
  }
}

export function setOnboardingReplayPending(pending = true) {
  try {
    if (pending) localStorage.setItem(REPLAY_KEY, '1');
    else localStorage.removeItem(REPLAY_KEY);
  } catch {
    /* ignore */
  }
}

/** Whether the tour should auto-start on this load. */
export function shouldStartOnboarding() {
  return readOnboardingReplayPending() || !readOnboardingCompleted();
}

/**
 * Call when the tour becomes visible. Clears the one-shot replay flag so
 * Settings returns to the default disabled state after this session starts.
 */
export function acknowledgeOnboardingReplay() {
  setOnboardingReplayPending(false);
}

export function completeOnboarding() {
  setOnboardingCompleted(true);
  setOnboardingReplayPending(false);
}

/**
 * Modular step list. Add / reorder freely.
 * `target` maps to `[data-onboarding="<target>"]` in the UI (null = centered card).
 * `platforms`: omit or include both to show everywhere.
 */
export const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    target: null,
    title: 'Welcome to NodeMind',
    body: {
      desktop:
        'A local-first mind map canvas. This short tour covers the essentials — you can skip anytime.',
      mobile:
        'A local-first mind map canvas. This short tour covers the essentials for touch — you can skip anytime.',
    },
  },
  {
    id: 'navigate',
    target: 'canvas',
    title: 'Navigate the canvas',
    body: {
      desktop:
        'Drag empty space to pan. Use the scroll wheel to zoom. Open View for Zoom In, Zoom Out, Recenter, and Full Screen.',
      mobile:
        'Drag with one finger to pan. Pinch to zoom. Open View for Zoom In, Zoom Out, and Recenter.',
    },
  },
  {
    id: 'view-controls',
    target: 'toolbar-view',
    title: 'View controls',
    body: {
      desktop: 'Zoom, recenter the graph, or enter full screen from this drawer.',
      mobile: 'Zoom and recenter the graph from this drawer.',
    },
  },
  {
    id: 'create-nodes',
    target: 'toolbar-add',
    title: 'Create notes',
    body: {
      desktop:
        'Click the + button to add a note at the centre, or click empty canvas to place one where you click.',
      mobile:
        'Tap + to add a note at the centre, or tap empty canvas to place one where you tap.',
    },
  },
  {
    id: 'connect',
    target: 'canvas',
    title: 'Connect & disconnect',
    body: {
      desktop:
        'Drag from a coloured socket to another to link notes. Click a connection line to delete it.',
      mobile:
        'Drag from a coloured socket to another to link notes. Tap a connection line to delete it.',
    },
  },
  {
    id: 'select-move-delete',
    target: 'canvas',
    title: 'Select, move & delete',
    body: {
      desktop:
        'Click a note to select it, then drag to move. Drag selected notes onto the bin that appears to delete them. Double-click the title (or use the pencil) to edit.',
      mobile:
        'Tap a note to select it, then drag to move. Drag selected notes onto the bin that appears to delete them. Double-tap the title (or use the pencil) to edit.',
    },
  },
  {
    id: 'multi-select-desktop',
    target: 'canvas',
    platforms: ['desktop'],
    title: 'Multi-select',
    body: {
      desktop:
        'Drag a selection box on empty canvas to select several notes. Move or delete them together, or use Auto Organise Selected in Tools.',
    },
  },
  {
    id: 'multi-select-mobile',
    target: 'toolbar-selection',
    platforms: ['mobile'],
    title: 'Selection tool',
    body: {
      mobile:
        'Tap the dashed-square button to arm Selection Mode, then drag on the canvas to multi-select. Tap it again or tap outside to cancel.',
    },
  },
  {
    id: 'tools',
    target: 'toolbar-tools',
    title: 'Tools drawer',
    body: {
      desktop:
        'Auto Organise All lays out the whole workspace. Auto Organise Selected rearranges only your current selection.',
      mobile:
        'Auto Organise All lays out the whole workspace. Auto Organise Selected rearranges only your current selection (select two or more notes first).',
    },
  },
  {
    id: 'workspaces',
    target: 'workspace-bar',
    title: 'Workspaces',
    body: {
      desktop:
        'Switch boards along the bottom bar. Use + for a new workspace. Hover a workspace, then click the pencil to rename, recolour, or change layout settings.',
      mobile:
        'Switch boards along the bottom bar. Use + for a new workspace. Press and hold a workspace to reveal edit.',
    },
  },
  {
    id: 'settings',
    target: 'toolbar-settings',
    title: 'Settings & theme',
    body: {
      desktop:
        'Open Settings to switch Light or Dark theme for notes and app chrome. You can also replay this tour from here later.',
      mobile:
        'Open Settings to switch Light or Dark theme for notes and app chrome. You can also replay this tour from here later.',
    },
  },
  {
    id: 'finish',
    target: null,
    title: "You're ready",
    body: {
      desktop: 'Explore freely — everything stays on this device. Replay the tour anytime from Settings.',
      mobile: 'Explore freely — everything stays on this device. Replay the tour anytime from Settings.',
    },
  },
];

export function getOnboardingSteps(platform = isDesktopPlatform() ? 'desktop' : 'mobile') {
  const key = platform === 'desktop' ? 'desktop' : 'mobile';
  return ONBOARDING_STEPS.filter((step) => {
    if (!step.platforms || step.platforms.length === 0) return true;
    return step.platforms.includes(key);
  }).map((step) => ({
    id: step.id,
    target: step.target,
    title: step.title,
    body: typeof step.body === 'string' ? step.body : step.body[key] || step.body.desktop || step.body.mobile || '',
  }));
}
