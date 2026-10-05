import { useCallback, useEffect, useRef, useState } from 'react';
import {
  codeRoomId,
  joinNearbyRoom,
  normalizeSessionCode,
  randomSessionCode,
  SESSION_CODE_LENGTH,
  readDeviceColor,
  readDeviceName,
  resolveLanRoomId,
  writeDeviceName,
} from '@/lib/nearbyShare';

function emptyTransfer() {
  return { peerId: null, peerName: '', progress: 0, phase: 'idle', error: null };
}

export function useNearbyShare({ workspaceName, enabled = true, getPack } = {}) {
  const [deviceName, setDeviceNameState] = useState(() => readDeviceName());
  const [deviceColor] = useState(() => readDeviceColor());
  const [status, setStatus] = useState(enabled ? 'connecting' : 'idle');
  const [statusError, setStatusError] = useState(null);
  const [mode, setMode] = useState('lan');
  const [sessionCode, setSessionCode] = useState('');
  const [codeRole, setCodeRole] = useState(null);
  const [peers, setPeers] = useState([]);
  const [incoming, setIncoming] = useState(null);
  const [incomingProgress, setIncomingProgress] = useState(0);
  const [receivedPack, setReceivedPack] = useState(null);
  const [outgoing, setOutgoing] = useState(emptyTransfer);

  const sessionRef = useRef(null);
  const genRef = useRef(0);
  const deviceRef = useRef({ name: deviceName, color: deviceColor, workspaceName });
  deviceRef.current = { name: deviceName, color: deviceColor, workspaceName };
  const getPackRef = useRef(getPack);
  getPackRef.current = getPack;
  const codeRoleRef = useRef(null);
  const sendToPeerRef = useRef(null);
  const autoSendIdsRef = useRef(new Set());

  const stopSession = useCallback(async () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) {
      try {
        await session.leave();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const startSession = useCallback(async (roomId, nextMode, nextCode, nextRole = null) => {
    const gen = ++genRef.current;
    await stopSession();
    if (!roomId) {
      if (gen !== genRef.current) return;
      setStatus('error');
      setStatusError('Could not find this network. Enter a joining code instead.');
      setPeers([]);
      return;
    }
    setStatus('connecting');
    setStatusError(null);
    setPeers([]);
    setMode(nextMode);
    setSessionCode(nextCode || '');
    const role = nextMode === 'code' ? nextRole || 'host' : null;
    setCodeRole(role);
    codeRoleRef.current = role;
    autoSendIdsRef.current = new Set();
    try {
      const session = joinNearbyRoom({
        roomId,
        device: () => deviceRef.current,
        onPeers: (list) => {
          if (gen !== genRef.current) return;
          setPeers(list);
          if (role !== 'host') return;
          list.forEach((peer) => {
            if (!peer?.id || autoSendIdsRef.current.has(peer.id)) return;
            autoSendIdsRef.current.add(peer.id);
            window.setTimeout(() => {
              const send = sendToPeerRef.current;
              const pack = getPackRef.current;
              if (!send || !pack) {
                autoSendIdsRef.current.delete(peer.id);
                return;
              }
              send(peer, pack).then((result) => {
                if (!result?.ok && result?.reason !== 'declined') {
                  autoSendIdsRef.current.delete(peer.id);
                }
              });
            }, 500);
          });
        },
        onIncomingOffer: (offer) => {
          if (gen !== genRef.current) return;
          setIncomingProgress(0);
          if (codeRoleRef.current === 'join') {
            offer.accept();
            setIncoming({
              receiving: true,
              fromName: offer.fromName,
              workspaceName: offer.workspaceName,
            });
            return;
          }
          setIncoming({
            ...offer,
            accept: () => {
              offer.accept();
              setIncoming({ receiving: true });
            },
            decline: () => {
              offer.decline();
              setIncoming(null);
            },
          });
        },
        onPayload: (pack) => {
          if (gen !== genRef.current) return;
          setIncoming({
            received: true,
            workspaceName: pack?.workspace?.name || 'Workspace',
          });
          setIncomingProgress(1);
          setReceivedPack(pack);
        },
        onReceiveProgress: (percent) => {
          if (gen !== genRef.current) return;
          setIncomingProgress(percent);
        },
      });
      if (gen !== genRef.current) {
        await session.leave();
        return;
      }
      sessionRef.current = session;
      setStatus('ready');
    } catch (error) {
      if (gen !== genRef.current) return;
      setStatus('error');
      setStatusError(error?.message || 'Could not join nearby sessions.');
    }
  }, [stopSession]);

  useEffect(() => {
    if (!enabled) {
      genRef.current += 1;
      stopSession();
      setStatus('idle');
      setPeers([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const lanId = await resolveLanRoomId();
      if (cancelled) return;
      if (lanId) await startSession(lanId, 'lan', '', null);
      else {
        const code = randomSessionCode();
        await startSession(codeRoomId(code), 'code', code, 'host');
      }
    })();
    return () => {
      cancelled = true;
      genRef.current += 1;
      stopSession();
    };
  }, [enabled, startSession, stopSession]);

  useEffect(() => {
    sessionRef.current?.announce();
  }, [deviceName, workspaceName]);

  const setDeviceName = useCallback((name) => {
    setDeviceNameState(writeDeviceName(name));
  }, []);

  const hostWithCode = useCallback(async () => {
    const code = randomSessionCode();
    await startSession(codeRoomId(code), 'code', code, 'host');
    return code;
  }, [startSession]);

  const joinWithCode = useCallback(async (raw) => {
    const code = normalizeSessionCode(raw);
    if (code.length < SESSION_CODE_LENGTH) {
      throw new Error(`Enter the ${SESSION_CODE_LENGTH}-character joining code.`);
    }
    await startSession(codeRoomId(code), 'code', code, 'join');
  }, [startSession]);

  const returnToLan = useCallback(async () => {
    const lanId = await resolveLanRoomId();
    await startSession(lanId, 'lan', '', null);
  }, [startSession]);

  const sendToPeer = useCallback(async (peer, packWorkspace) => {
    const session = sessionRef.current;
    if (!session) throw new Error('Not connected to nearby sessions.');
    setOutgoing({
      peerId: peer.id,
      peerName: peer.name,
      progress: 0,
      phase: 'waiting',
      error: null,
    });
    try {
      const pack = await packWorkspace();
      const reply = await session.requestSend(peer.id, {
        workspaceName: pack?.workspace?.name || workspaceName,
      });
      if (!reply?.ok) {
        const reason = reply?.reason === 'declined' ? 'declined' : 'unavailable';
        setOutgoing({
          peerId: peer.id,
          peerName: peer.name,
          progress: 0,
          phase: reason,
          error: reason === 'declined' ? `${peer.name} declined.` : `${peer.name} did not accept in time.`,
        });
        return { ok: false, reason };
      }
      setOutgoing((prev) => ({ ...prev, phase: 'sending', progress: 0 }));
      await session.sendPack(peer.id, pack, (percent) => {
        setOutgoing((prev) => ({ ...prev, phase: 'sending', progress: percent }));
      });
      setOutgoing({
        peerId: peer.id,
        peerName: peer.name,
        progress: 1,
        phase: 'sent',
        error: null,
      });
      return { ok: true };
    } catch (error) {
      setOutgoing({
        peerId: peer.id,
        peerName: peer.name,
        progress: 0,
        phase: 'error',
        error: error?.message || 'Send failed.',
      });
      return { ok: false, reason: 'error' };
    }
  }, [workspaceName]);

  sendToPeerRef.current = sendToPeer;

  const clearOutgoing = useCallback(() => setOutgoing(emptyTransfer()), []);
  const clearReceived = useCallback(() => setReceivedPack(null), []);

  return {
    selfId: sessionRef.current?.selfId || null,
    deviceName,
    deviceColor,
    setDeviceName,
    status,
    statusError,
    mode,
    sessionCode,
    codeRole,
    peers,
    incoming,
    incomingProgress,
    receivedPack,
    outgoing,
    sendToPeer,
    hostWithCode,
    joinWithCode,
    returnToLan,
    clearOutgoing,
    clearReceived,
  };
}
