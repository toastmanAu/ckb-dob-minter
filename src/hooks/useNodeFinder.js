import { useState, useEffect, useCallback, useRef } from 'react';
import { discoverNode, tryCustomURL, getPublicFallback, forgetNode, PUBLIC_RPC, TESTNET_RPC } from '../lib/node-finder.js';

export function useNodeFinder(network) {
  const [status,   setStatus]   = useState('scanning');
  const [nodeInfo, setNodeInfo] = useState(null);
  const [progress, setProgress] = useState('Scanning…');
  const [error,    setError]    = useState('');
  const prevNetwork = useRef(null);

  const connectPublic = useCallback((net) => {
    const url = getPublicFallback(net ?? network);
    setNodeInfo({ url, tipBlock: 0, isLocal: false, isPublic: true });
    setStatus('connected');
    setError('');
  }, [network]);

  const discover = useCallback(async () => {
    // Testnet: skip local scan, use public testnet RPC immediately
    if (network === 'testnet') {
      connectPublic('testnet');
      return;
    }
    setStatus('scanning');
    setNodeInfo(null);
    setError('');
    const result = await discoverNode(msg => setProgress(msg));
    if (result && result.url) { setNodeInfo(result); setStatus('connected'); }
    else { setStatus('prompt'); if (result?.isBrave) setError('brave'); }
  }, [network, connectPublic]);

  const connectCustom = useCallback(async (url) => {
    setStatus('scanning');
    setProgress('Connecting…');
    setError('');
    const info = await tryCustomURL(url);
    if (info) { setNodeInfo(info); setStatus('connected'); }
    else       { setStatus('error'); setError(`Could not connect to ${url}`); }
  }, []);

  const usePublic = useCallback(() => connectPublic(network), [network, connectPublic]);

  const forget = useCallback(() => {
    forgetNode();
    setNodeInfo(null);
    discover();
  }, [discover]);

  // Run on mount and network change
  useEffect(() => {
    if (prevNetwork.current === network) return;
    prevNetwork.current = network;
    discover();
  }, [network, discover]);

  // Initial mount
  useEffect(() => { discover(); }, []); // eslint-disable-line

  return { status, nodeInfo, progress, error, connectCustom, usePublic, forget };
}
