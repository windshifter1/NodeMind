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
 * Interactive PC tutorial — sections with ordered tasks.
 * `event` must match emitTutorial(...) from the app.
 * `kind: 'continue'` uses an in-card Continue button.
 * `target` maps to `[data-onboarding="<target>"]` (null = no spotlight / centred).
 */
export const DESKTOP_TUTORIAL_SECTIONS = [
  {
    id: 'welcome',
    title: 'Welcome to NodeMind',
    body: 'A sleek mind map canvas for organising ideas visually. This quick tour will guide you through the basics — complete each task to unlock the next step.',
    target: null,
    tasks: [
      {
        id: 'continue',
        label: 'Continue to the next step.',
        event: 'tutorial.continue',
        kind: 'continue',
        target: null,
      },
    ],
  },
  {
    id: 'navigate',
    title: 'Navigate the canvas',
    body: 'Move around your workspace! Use your mouse buttons to pan and the scroll wheel to zoom.',
    target: 'canvas',
    tasks: [
      {
        id: 'pan-middle',
        label: 'Pan the canvas using the middle mouse button.',
        event: 'canvas.pan.middle',
        target: 'canvas',
      },
      {
        id: 'pan-right',
        label: 'Pan the canvas using the right mouse button.',
        event: 'canvas.pan.right',
        target: 'canvas',
      },
      {
        id: 'zoom',
        label: 'Zoom in and out using the scroll wheel.',
        event: 'canvas.zoom',
        target: 'canvas',
      },
    ],
  },
  {
    id: 'recenter',
    title: 'Recenter',
    body: 'Lost your place? Click the Home button to bring all notes back into view.',
    target: 'toolbar-recenter',
    tasks: [
      {
        id: 'home',
        label: 'Click the Home button.',
        event: 'toolbar.recenter',
        target: 'toolbar-recenter',
      },
    ],
  },
  {
    id: 'create-nodes',
    title: 'Create nodes',
    body: 'Add ideas your way! Create notes with the + button or place them directly on the canvas.',
    target: 'toolbar-add',
    tasks: [
      {
        id: 'toolbar-add',
        label: 'Click + to create a note.',
        event: 'toolbar.node.create',
        target: 'toolbar-add',
      },
      {
        id: 'canvas-add',
        label: 'Click an empty area of the canvas to create a note there.',
        event: 'canvas.node.create-click',
        target: 'canvas',
      },
    ],
  },
  {
    id: 'connect',
    title: 'Connect & disconnect',
    body: 'Link your thoughts! Drag from a coloured socket to another socket to connect notes. Create new connected notes by dragging from a socket onto empty canvas space.',
    target: 'canvas',
    tasks: [
      {
        id: 'edge-create',
        label: 'Connect two notes together.',
        event: 'canvas.edge.create',
        target: 'canvas',
      },
      {
        id: 'connected-node',
        label: 'Create a new connected note.',
        event: 'canvas.node.create-connected',
        target: 'canvas',
      },
      {
        id: 'edge-delete',
        label: 'Click a connection line to delete it.',
        event: 'canvas.edge.delete',
        target: 'canvas',
      },
    ],
  },
  {
    id: 'select-move-delete',
    title: 'Select, move & delete',
    body: 'Manage your notes by selecting, moving, editing, and removing them.',
    target: 'canvas',
    tasks: [
      {
        id: 'select',
        label: 'Click a note to select it.',
        event: 'canvas.node.select',
        target: 'canvas',
      },
      {
        id: 'move',
        label: 'Drag a selected note to move it.',
        event: 'canvas.node.move',
        target: 'canvas',
      },
      {
        id: 'rename',
        label: 'Double-click a note title to rename it.',
        event: 'node.rename',
        target: 'canvas',
      },
      {
        id: 'edit-open',
        label: 'Open note settings using the pencil icon.',
        event: 'node.edit.open',
        target: 'canvas',
      },
      {
        id: 'bin-delete',
        label: 'Drag a selected note onto the bin to delete it.',
        event: 'canvas.node.delete-bin',
        target: 'canvas',
      },
    ],
  },
  {
    id: 'multi-select',
    title: 'Multi-select',
    body: 'Work with multiple notes at once using selection boxes and keyboard shortcuts.',
    target: 'canvas',
    tasks: [
      {
        id: 'marquee',
        label: 'Drag a selection box on empty canvas space.',
        event: 'canvas.select.marquee',
        target: 'canvas',
      },
      {
        id: 'shift-add',
        label: 'Hold Shift and click a note to add it to the selection.',
        event: 'canvas.select.shift-add',
        target: 'canvas',
      },
      {
        id: 'shift-remove',
        label: 'Hold Shift and click a selected note to remove it from the selection.',
        event: 'canvas.select.shift-remove',
        target: 'canvas',
      },
    ],
  },
  {
    id: 'tools',
    title: 'Tools drawer',
    body: 'Use the Tools drawer to organise your workspace automatically.',
    target: 'toolbar-tools',
    tasks: [
      {
        id: 'tools-open',
        label: 'Open the Tools drawer.',
        event: 'toolbar.tools.open',
        target: 'toolbar-tools',
      },
      {
        id: 'organise-all',
        label: 'Run Auto Organise All.',
        event: 'toolbar.organise.all',
        target: 'toolbar-tools',
      },
      {
        id: 'organise-selected',
        label: 'Run Auto Organise Selected.',
        event: 'toolbar.organise.selected',
        target: 'toolbar-tools',
      },
    ],
  },
  {
    id: 'workspaces',
    title: 'Workspaces',
    body: 'Switch between different boards and customise each workspace.',
    target: 'workspace-bar',
    tasks: [
      {
        id: 'switch',
        label: 'Switch to another workspace.',
        event: 'workspace.switch',
        target: 'workspace-bar',
      },
      {
        id: 'create',
        label: 'Create a new workspace using +.',
        event: 'workspace.create.save',
        target: 'workspace-create',
      },
      {
        id: 'rename',
        label: 'Rename a workspace using the pencil icon.',
        event: 'workspace.rename',
        target: 'workspace-edit',
      },
      {
        id: 'settings',
        label: 'Change workspace colours or layout settings.',
        event: 'workspace.settings.save',
        target: 'workspace-edit',
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    body: 'Customise NodeMind and manage your tutorial settings.',
    target: 'toolbar-settings',
    tasks: [
      {
        id: 'open',
        label: 'Open Settings.',
        event: 'toolbar.settings.open',
        target: 'toolbar-settings',
      },
      {
        id: 'theme',
        label: 'Switch between Light and Dark themes.',
        event: 'settings.theme',
        target: 'settings-theme',
      },
      {
        id: 'replay-find',
        label: 'Find the tutorial replay option.',
        event: 'settings.replay.find',
        target: 'settings-help',
      },
    ],
  },
  {
    id: 'finish',
    title: "You're ready!",
    body: "You've learned the basics of NodeMind. Start building your ideas — everything stays on this device.",
    target: null,
    tasks: [
      {
        id: 'complete',
        label: 'Tutorial complete.',
        event: 'tutorial.complete',
        kind: 'complete',
        target: null,
      },
    ],
  },
];

/**
 * Interactive mobile tutorial — touch-oriented tasks.
 */
export const MOBILE_TUTORIAL_SECTIONS = [
  {
    id: 'welcome',
    title: 'Welcome to NodeMind',
    body: 'A sleek mind map canvas for organising ideas visually. This quick tour will guide you through the basics — complete each task to unlock the next step.',
    target: null,
    tasks: [
      {
        id: 'continue',
        label: 'Continue to the next step.',
        event: 'tutorial.continue',
        kind: 'continue',
        target: null,
      },
    ],
  },
  {
    id: 'navigate',
    title: 'Navigate the canvas',
    body: 'Move around your workspace! Use touch gestures to explore your canvas.',
    target: 'canvas',
    tasks: [
      {
        id: 'pan-touch',
        label: 'Drag with one finger to pan the canvas.',
        event: 'canvas.pan.touch',
        target: 'canvas',
      },
      {
        id: 'pinch-zoom',
        label: 'Pinch with two fingers to zoom in and out.',
        event: 'canvas.zoom.pinch',
        target: 'canvas',
      },
    ],
  },
  {
    id: 'recenter',
    title: 'Recenter',
    body: 'Lost your place? Tap the Home button to bring all notes back into view.',
    target: 'toolbar-recenter',
    tasks: [
      {
        id: 'home',
        label: 'Tap the Home button.',
        event: 'toolbar.recenter',
        target: 'toolbar-recenter',
      },
    ],
  },
  {
    id: 'create-nodes',
    title: 'Create nodes',
    body: 'Add ideas your way! Create notes with the + button or place them directly on the canvas.',
    target: 'toolbar-add',
    tasks: [
      {
        id: 'toolbar-add',
        label: 'Tap + to create a note.',
        event: 'toolbar.node.create',
        target: 'toolbar-add',
      },
      {
        id: 'canvas-add',
        label: 'Tap an empty area of the canvas to create a note there.',
        event: 'canvas.node.create-click',
        target: 'canvas',
      },
    ],
  },
  {
    id: 'connect',
    title: 'Connect & disconnect',
    body: 'Link your thoughts! Drag from a coloured socket to another socket to connect notes. Create new connected notes by dragging from a socket onto empty canvas space.',
    target: 'canvas',
    tasks: [
      {
        id: 'edge-create',
        label: 'Connect two notes together.',
        event: 'canvas.edge.create',
        target: 'canvas',
      },
      {
        id: 'connected-node',
        label: 'Create a new connected note.',
        event: 'canvas.node.create-connected',
        target: 'canvas',
      },
      {
        id: 'edge-delete',
        label: 'Tap a connection line to delete it.',
        event: 'canvas.edge.delete',
        target: 'canvas',
      },
    ],
  },
  {
    id: 'select-move-delete',
    title: 'Select, move & delete',
    body: 'Manage your notes by selecting, moving, editing, and removing them.',
    target: 'canvas',
    tasks: [
      {
        id: 'select',
        label: 'Tap a note to select it.',
        event: 'canvas.node.select',
        target: 'canvas',
      },
      {
        id: 'move',
        label: 'Drag a selected note to move it.',
        event: 'canvas.node.move',
        target: 'canvas',
      },
      {
        id: 'rename',
        label: 'Double-tap a note title to rename it.',
        event: 'node.rename',
        target: 'canvas',
      },
      {
        id: 'edit-open',
        label: 'Tap the pencil icon to open note settings.',
        event: 'node.edit.open',
        target: 'canvas',
      },
      {
        id: 'bin-delete',
        label: 'Drag a selected note onto the bin to delete it.',
        event: 'canvas.node.delete-bin',
        target: 'canvas',
      },
    ],
  },
  {
    id: 'multi-select',
    title: 'Multi-select',
    body: 'Work with multiple notes at once using the selection tool.',
    target: 'toolbar-selection',
    tasks: [
      {
        id: 'selection-arm',
        label: 'Enable selection mode.',
        event: 'toolbar.selection.arm',
        target: 'toolbar-selection',
      },
      {
        id: 'marquee',
        label: 'Drag a selection box around multiple notes.',
        event: 'canvas.select.marquee',
        target: 'canvas',
      },
      {
        id: 'select-modify',
        label: 'Add or remove notes from the selection.',
        event: 'canvas.select.modify',
        target: 'canvas',
      },
    ],
  },
  {
    id: 'tools',
    title: 'Tools drawer',
    body: 'Use the Tools drawer to organise your workspace automatically.',
    target: 'toolbar-tools',
    tasks: [
      {
        id: 'tools-open',
        label: 'Open the Tools drawer.',
        event: 'toolbar.tools.open',
        target: 'toolbar-tools',
      },
    ],
  },
  {
    id: 'workspaces',
    title: 'Workspaces',
    body: 'Switch between different boards and customise each workspace.',
    target: 'workspace-bar',
    tasks: [
      {
        id: 'switch',
        label: 'Switch to another workspace.',
        event: 'workspace.switch',
        target: 'workspace-bar',
      },
      {
        id: 'create',
        label: 'Create a new workspace using +.',
        event: 'workspace.create.save',
        target: 'workspace-create',
      },
      {
        id: 'options',
        label: 'Open workspace options.',
        event: 'workspace.edit.open',
        target: 'workspace-edit',
      },
      {
        id: 'rename',
        label: 'Rename the workspace.',
        event: 'workspace.rename',
        target: 'workspace-edit',
      },
      {
        id: 'settings',
        label: 'Change workspace colours or layout settings.',
        event: 'workspace.settings.save',
        target: 'workspace-edit',
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    body: 'Customise NodeMind and manage your tutorial settings.',
    target: 'toolbar-settings',
    tasks: [
      {
        id: 'open',
        label: 'Open Settings.',
        event: 'toolbar.settings.open',
        target: 'toolbar-settings',
      },
      {
        id: 'theme',
        label: 'Switch between Light and Dark themes.',
        event: 'settings.theme',
        target: 'settings-theme',
      },
      {
        id: 'replay-find',
        label: 'Find the tutorial replay option.',
        event: 'settings.replay.find',
        target: 'settings-help',
      },
    ],
  },
  {
    id: 'finish',
    title: "You're ready!",
    body: "You've learned the basics of NodeMind. Start building your ideas — everything stays on this device.",
    target: null,
    tasks: [
      {
        id: 'complete',
        label: 'Tutorial complete.',
        event: 'tutorial.complete',
        kind: 'complete',
        target: null,
      },
    ],
  },
];

export function getDesktopTutorialSections() {
  return DESKTOP_TUTORIAL_SECTIONS;
}

export function getMobileTutorialSections() {
  return MOBILE_TUTORIAL_SECTIONS;
}

export function getTutorialSections(platform = isDesktopPlatform() ? 'desktop' : 'mobile') {
  return platform === 'desktop' ? DESKTOP_TUTORIAL_SECTIONS : MOBILE_TUTORIAL_SECTIONS;
}

/** @deprecated Use getTutorialSections */
export function getOnboardingSteps(platform = isDesktopPlatform() ? 'desktop' : 'mobile') {
  return getTutorialSections(platform).map((s) => ({
    id: s.id,
    target: s.target,
    title: s.title,
    body: s.body,
  }));
}

/** @deprecated Use getMobileTutorialSections */
export function getMobileOnboardingSteps() {
  return MOBILE_TUTORIAL_SECTIONS;
}
