import { joinRoom, selfId } from 'trystero';

export const NEARBY_APP_ID = 'windshifter.nodemind.nearby.v1';
export const DEVICE_NAME_KEY = 'nodemind-device-name-v1';
export const DEVICE_COLOR_KEY = 'nodemind-device-color-v1';

const ADJECTIVES = [
  'Amber', 'Cedar', 'Indigo', 'Maple', 'Quartz', 'River', 'Solar', 'Willow',
];
const NOUNS = [
  'Atlas', 'Comet', 'Forge', 'Heron', 'Lumen', 'Pine', 'Sparrow', 'Wren',
];
const COLORS = [
  '#6366f1', '#ef4444', '#f59e0b', '#10b981', '#06b6d4',
  '#ec4899', '#8b5cf6', '#14b8a6',
];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const SESSION_CODE_LENGTH = 6;

/** Public STUN only — ICE discovery, not a file relay. */
export const NEARBY_ICE_SERVERS = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:global.stun.twilio.com:3478',
      'stun:stun.cloudflare.com:3478',
    ],
  },
];

export function getSelfPeerId() {
  return selfId;
}

export function randomDeviceName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj} ${noun}`;
}

export function readDeviceName() {
  try {
    const stored = localStorage.getItem(DEVICE_NAME_KEY);
    if (stored && stored.trim()) return stored.trim().slice(0, 32);
  } catch {
    /* ignore */
  }
  const name = randomDeviceName();
  writeDeviceName(name);
  return name;
}

export function writeDeviceName(name) {
  const next = String(name || '').trim().slice(0, 32) || randomDeviceName();
  try {
    localStorage.setItem(DEVICE_NAME_KEY, next);
  } catch {
    /* ignore */
  }
  return next;
}

export function readDeviceColor() {
  try {
    const stored = localStorage.getItem(DEVICE_COLOR_KEY);
    if (stored) return stored;
  } catch {
    /* ignore */
  }
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  try {
    localStorage.setItem(DEVICE_COLOR_KEY, color);
  } catch {
    /* ignore */
  }
  return color;
}

export function normalizeSessionCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, '')
    .slice(0, SESSION_CODE_LENGTH);
}

export function formatSessionCode(value) {
  const code = normalizeSessionCode(value);
  if (code.length <= 3) return code;
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

export function randomSessionCode() {
  return Array.from({ length: SESSION_CODE_LENGTH }, () => (
    CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  )).join('');
}

export function codeRoomId(code) {
  return `nm-code-${normalizeSessionCode(code)}`;
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function fetchPublicIp() {
  const urls = [
    'https://api.ipify.org?format=json',
    'https://api64.ipify.org?format=json',
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.ip) return String(data.ip);
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function resolveLanRoomId() {
  const ip = await fetchPublicIp();
  if (!ip) return null;
  const hash = await sha256Hex(ip);
  return `nm-lan-${hash.slice(0, 16)}`;
}

function snapshotPeers(map) {
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function roomPeerIds(room) {
  const raw = room.getPeers?.();
  if (!raw) return [];
  if (typeof raw.keys === 'function' && typeof raw.get === 'function') {
    return [...raw.keys()];
  }
  return Object.keys(raw);
}

function readDevice(deviceOrFn) {
  return typeof deviceOrFn === 'function' ? deviceOrFn() : deviceOrFn;
}

/**
 * Join a Trystero room and run the AirDrop-style offer / accept / payload protocol.
 * Workspace bytes travel on the WebRTC data channel, not the signaling relays.
 */
export function joinNearbyRoom({
  roomId,
  device,
  onPeers,
  onIncomingOffer,
  onPayload,
  onReceiveProgress,
} = {}) {
  const room = joinRoom(
    {
      appId: NEARBY_APP_ID,
      rtcConfig: { iceServers: NEARBY_ICE_SERVERS },
    },
    roomId
  );
  const peers = new Map();
  const hello = room.makeAction('hello');
  const payload = room.makeAction('pack');
  let pendingReceiveFrom = null;
  let offerWaiter = null;
  const announceRetries = new Map();

  const emitPeers = () => onPeers?.(snapshotPeers(peers));

  const upsertPeer = (peerId, patch = {}) => {
    const prev = peers.get(peerId) || {
      id: peerId,
      name: 'Nearby device',
      color: '#6366f1',
      workspaceName: 'Untitled',
    };
    peers.set(peerId, { ...prev, ...patch, id: peerId });
    emitPeers();
  };

  const announce = (target) => {
    const current = readDevice(device) || {};
    const body = {
      name: current.name,
      color: current.color,
      workspaceName: current.workspaceName || 'Untitled',
    };
    hello.send(body, target ? { target } : undefined).catch(() => {});
  };

  const greet = (peerId) => {
    upsertPeer(peerId);
    announce(peerId);
    if (announceRetries.has(peerId)) return;
    const delays = [400, 1200, 3000];
    const timers = delays.map((ms) => setTimeout(() => announce(peerId), ms));
    announceRetries.set(peerId, timers);
  };

  hello.onMessage = (data, { peerId }) => {
    if (!data || typeof data !== 'object') return;
    upsertPeer(peerId, {
      name: String(data.name || 'Nearby device').slice(0, 32),
      color: typeof data.color === 'string' ? data.color : '#6366f1',
      workspaceName: String(data.workspaceName || 'Untitled').slice(0, 80),
    });
  };

  room.onPeerJoin = (peerId) => {
    greet(peerId);
  };

  room.onPeerLeave = (peerId) => {
    const timers = announceRetries.get(peerId);
    timers?.forEach((id) => clearTimeout(id));
    announceRetries.delete(peerId);
    peers.delete(peerId);
    emitPeers();
    if (pendingReceiveFrom === peerId) pendingReceiveFrom = null;
    if (offerWaiter?.peerId === peerId) {
      offerWaiter.resolve({ ok: false, reason: 'left' });
      offerWaiter = null;
    }
  };

  const offer = room.makeAction('offer', {
    kind: 'request',
    onRequest: (data, { peerId, signal }) =>
      new Promise((resolve) => {
        if (offerWaiter) {
          resolve({ ok: false, reason: 'busy' });
          return;
        }
        const finish = (result) => {
          if (offerWaiter?.peerId !== peerId) return;
          offerWaiter = null;
          if (result.ok) pendingReceiveFrom = peerId;
          resolve(result);
        };
        offerWaiter = { peerId, resolve: finish };
        const abort = () => finish({ ok: false, reason: 'cancelled' });
        signal?.addEventListener?.('abort', abort, { once: true });
        onIncomingOffer?.({
          peerId,
          fromName: String(data?.fromName || 'Nearby device').slice(0, 32),
          workspaceName: String(data?.workspaceName || 'Untitled').slice(0, 80),
          accept: () => finish({ ok: true }),
          decline: () => finish({ ok: false, reason: 'declined' }),
        });
      }),
  });

  payload.onMessage = (data, { peerId }) => {
    if (pendingReceiveFrom !== peerId) return;
    pendingReceiveFrom = null;
    onPayload?.(data, peerId);
  };
  payload.onReceiveProgress = (percent, context) => {
    onReceiveProgress?.(percent, context);
  };

  announce();
  roomPeerIds(room).forEach((peerId) => greet(peerId));
  const syncTimer = setInterval(() => {
    roomPeerIds(room).forEach((peerId) => {
      if (!peers.has(peerId)) greet(peerId);
    });
    if (peers.size) announce();
  }, 2500);

  return {
    roomId,
    selfId,
    announce,
    getPeers: () => snapshotPeers(peers),
    requestSend(peerId, meta) {
      const current = readDevice(device) || {};
      return offer.request(
        {
          fromName: current.name,
          workspaceName: meta?.workspaceName || current.workspaceName || 'Untitled',
        },
        { target: peerId, timeoutMs: 90_000 }
      );
    },
    sendPack(peerId, pack, onProgress) {
      return payload.send(pack, {
        target: peerId,
        onProgress: (percent) => onProgress?.(percent),
      });
    },
    leave() {
      clearInterval(syncTimer);
      announceRetries.forEach((timers) => timers.forEach((id) => clearTimeout(id)));
      announceRetries.clear();
      if (offerWaiter) {
        offerWaiter.resolve({ ok: false, reason: 'left' });
        offerWaiter = null;
      }
      pendingReceiveFrom = null;
      return room.leave();
    },
  };
}
