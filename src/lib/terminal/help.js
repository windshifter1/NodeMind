/** Shared terminal separator — shortened by 5 (44 → 39) for small screens. */
export const HELP_DIVIDER = '═══════════════════════════════════════';

/**
 * Modern, grouped terminal help.
 * Lines are plain strings; "Example:" is bolded by the terminal renderer.
 */
export const HELP_GROUPS = [
  {
    title: 'Getting started',
    entries: [
      {
        keys: ['help'],
        syntax: 'help [command]',
        summary: 'Show this guide, or details for one command.',
        example: 'help cd',
      },
      {
        keys: ['tutorial'],
        syntax: 'tutorial',
        summary: 'Start the interactive terminal tutorial.',
        example: 'tutorial',
      },
    ],
  },
  {
    title: 'Navigation',
    entries: [
      {
        keys: ['cd'],
        syntax: 'cd <node|..|\\|path>',
        summary: 'Change the current hierarchy path.',
        example: 'cd ..',
      },
      {
        keys: ['dir'],
        syntax: 'dir',
        summary: 'List child nodes under the current path.',
        example: 'dir',
      },
      {
        keys: ['open'],
        syntax: 'open <node>',
        summary: 'Open a child by title or ID and make it current.',
        example: 'open 001',
      },
    ],
  },
  {
    title: 'View & search',
    entries: [
      {
        keys: ['info'],
        syntax: 'info [all|/title <text>|/id <id>]',
        summary: 'Show details for the current node, all nodes, or a search.',
        example: 'info /title ideas',
      },
      {
        keys: ['find'],
        syntax: 'find [/title|/desc|/id|/date] <text>',
        summary: 'Search nodes. /date accepts DD/MM/YY, MM/YY, or YY.',
        example: 'find /desc backlog',
      },
    ],
  },
  {
    title: 'Edit',
    entries: [
      {
        keys: ['title'],
        syntax: 'title "Text"',
        summary: 'Replace the current node title.',
        example: 'title "Kickoff"',
      },
      {
        keys: ['desc', 'description'],
        syntax: 'desc "Text"',
        summary: 'Replace the current node description.',
        example: 'desc "Notes from standup"',
      },
      {
        keys: ['append'],
        syntax: 'append "Text"',
        summary: 'Append a line to the description.',
        example: 'append "Follow up Friday"',
      },
      {
        keys: ['prepend'],
        syntax: 'prepend "Text"',
        summary: 'Prepend a line to the description.',
        example: 'prepend "URGENT"',
      },
      {
        keys: ['clear'],
        syntax: 'clear title|desc',
        summary: 'Clear the title or description.',
        example: 'clear desc',
      },
      {
        keys: ['color', 'colour'],
        syntax: 'color "Red"|#RRGGBB',
        summary: 'Change the current node colour.',
        example: 'color "Cyan"',
      },
    ],
  },
  {
    title: 'Node management',
    entries: [
      {
        keys: ['new'],
        syntax: 'new "Title"',
        summary: 'Create a child node under the current path.',
        example: 'new "Research"',
      },
      {
        keys: ['duplicate'],
        syntax: 'duplicate',
        summary: 'Duplicate the current node and its descendants.',
        example: 'duplicate',
      },
      {
        keys: ['copy'],
        syntax: 'copy <path>',
        summary: 'Copy the current branch to another path.',
        example: 'copy \\',
      },
      {
        keys: ['move'],
        syntax: 'move <path>',
        summary: 'Move the current branch to another path.',
        example: 'move \\',
      },
      {
        keys: ['delete'],
        syntax: 'delete',
        summary: 'Delete the current branch. Run twice to confirm.',
        example: 'delete',
      },
    ],
  },
  {
    title: 'Graph links',
    entries: [
      {
        keys: ['link'],
        syntax: 'link <id>',
        summary: 'Create an outgoing link to another node.',
        example: 'link 002',
      },
      {
        keys: ['unlink'],
        syntax: 'unlink <id>',
        summary: 'Remove a link to another node.',
        example: 'unlink 002',
      },
      {
        keys: ['links'],
        syntax: 'links',
        summary: 'List incoming and outgoing links.',
        example: 'links',
      },
    ],
  },
  {
    title: 'Workspace',
    entries: [
      {
        keys: ['arrange'],
        syntax: 'arrange',
        summary: 'Auto organise the workspace.',
        example: 'arrange',
      },
      {
        keys: ['export'],
        syntax: 'export',
        summary: 'Download the workspace as JSON.',
        example: 'export',
      },
      {
        keys: ['import'],
        syntax: 'import',
        summary: 'Open the JSON import picker.',
        example: 'import',
      },
    ],
  },
  {
    title: 'Version',
    entries: [
      {
        keys: ['version'],
        syntax: 'version [help|bump …]',
        summary: 'Show app version info, or version help / bump hints.',
        example: 'version help',
      },
    ],
  },
  {
    title: 'Terminal',
    entries: [
      {
        keys: ['terminal'],
        syntax: 'terminal <exit|clear|about|date>',
        summary: 'Close, clear output, show credits, or print UTC time.',
        example: 'terminal clear',
      },
    ],
  },
];

const ENTRY_BY_KEY = (() => {
  const map = new Map();
  HELP_GROUPS.forEach((group) => {
    group.entries.forEach((entry) => {
      entry.keys.forEach((key) => map.set(key, entry));
    });
  });
  return map;
})();

export const COMMAND_NAMES = [...ENTRY_BY_KEY.keys()].sort();

function entryLines(entry) {
  const lines = [entry.syntax, `    ${entry.summary}`];
  if (entry.example) {
    lines.push('    Example:');
    lines.push(`    ${entry.example}`);
  }
  return lines;
}

export function buildHelpAll() {
  const lines = [HELP_DIVIDER, 'HELP', HELP_DIVIDER, ''];
  HELP_GROUPS.forEach((group, groupIndex) => {
    if (groupIndex > 0) lines.push('');
    lines.push(HELP_DIVIDER, group.title.toUpperCase(), HELP_DIVIDER, '');
    group.entries.forEach((entry, index) => {
      if (index > 0) lines.push('');
      lines.push(...entryLines(entry));
    });
  });
  lines.push('', 'Tip: type help <command> for a single topic.');
  return lines;
}

export function helpFor(topic) {
  const key = String(topic || '')
    .trim()
    .split(/\s+/)[0]
    .toLowerCase();
  const alias = key === 'description' ? 'desc' : key === 'colour' ? 'color' : key;
  const entry = ENTRY_BY_KEY.get(alias);
  if (!entry) return null;
  return [HELP_DIVIDER, entry.keys[0].toUpperCase(), HELP_DIVIDER, '', ...entryLines(entry)];
}

export const HELP_ALL = buildHelpAll();
