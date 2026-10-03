import { useCallback, useEffect, useRef, useState } from 'react';
import {
  codeRoomId,
  joinNearbyRoom,
  normalizeSessionCode,
  randomSessionCode,
  readDeviceColor,
  readDeviceName,
  resolveLanRoomId,
  writeDeviceName,
} from '@/lib/nearbyShare';

function emptyTransfer() {
  return { peerId: null, peerName: '', progress: 0, phase: 'idle', error: null };
}

export function useNearbyShare({ workspaceName, enabled = true } = {}) {
  const [deviceName, setDeviceNameState] = useState(() => readDeviceName());
  const [deviceColor] = useState(() => readDeviceColor());
  const [status, setStatus] = useState(enabled ? 'connecting' : 'idle');
  const [statusError, setStatusError] = useState(null);
  const [mode, setMode] = useState('lan');
  const [sessionCode, setSessionCode] = useState('');
  const [peers, setPeers] = useState([]);
  const [incoming, setIncoming] = useState(null);
  const [incomingProgress, setIncomingProgress] = useState(0);
  const [receivedPack, setReceivedPack] = useState(null);
  const [outgoing, setOutgoing] = useState(emptyTransfer);

  const sessionRef = useRef(null);
  const genRef = useRef(0);
  const deviceRef = useRef({ name: deviceName, color: deviceColor, workspaceName });
  deviceRef.current = { name: deviceName, color: deviceColor, workspaceName };

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

  const startSession = useCallback(async (roomId, nextMode, nextCode) => {
    const gen = ++genRef.current;
    await stopSession();
    if (!roomId) {
      if (gen !== genRef.current) return;
      setStatus('error');
      setStatusError('Could not find this network. Use a session code instead.');
      setPeers([]);
      return;
    }
    setStatus('connecting');
    setStatusError(null);
    setPeers([]);
    try {
      const session = joinNearbyRoom({
        roomId,
        device: deviceRef.current,
        onPeers: (list) => {
          if (gen !== genRef.current) return;
          setPeers(list);
        },
        onIncomingOffer: (offer) => {
          if (gen !== genRef.current) return;
          setIncomingProgress(0);
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
          setIncoming(null);
          setIncomingProgress(0);
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
      setMode(nextMode);
      setSessionCode(nextCode || '');
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
      if (lanId) await startSession(lanId, 'lan', '');
      else {
        const code = randomSessionCode();
        await startSession(codeRoomId(code), 'code', code);
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
    await startSession(codeRoomId(code), 'code', code);
    return code;
  }, [startSession]);

  const joinWithCode = useCallback(async (raw) => {
    const code = normalizeSessionCode(raw);
    if (code.length < 4) throw new Error('Enter the 4-character session code.');
    await startSession(codeRoomId(code), 'code', code);
  }, [startSession]);

  const returnToLan = useCallback(async () => {
    const lanId = await resolveLanRoomId();
    await startSession(lanId, 'lan', '');
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
