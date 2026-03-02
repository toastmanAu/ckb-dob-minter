import { useState, useEffect, useCallback, useRef } from 'react';
import { discoverNode, tryCustomURL, getPublicFallback, forgetNode } from '../lib/node-finder.js';

export function useNodeFinder(network) {
  const [status,   setStatus]   = useState('scanning');
  const [nodeInfo, setNodeInfo] = useState(null);
  const [progress, setProgress] = useState('Scanning…');
  const [error,    setError]    = useState('');
  const prevNetwork = useRef(network);

  const discover = useCallback(async () => {
    setStatus('scanning');
    setNodeInfo(null);
    setError('');
    const result = await discoverNode(msg => setProgress(msg));
    if (result && result.url) { setNodeInfo(result); setStatus('connected'); }
    else { setStatus('prompt'); if (result?.isBrave) setError('brave'); }
  }, []);

  const connectCustom = useCallback(async (url) => {
    setStatus('scanning');
    setProgress('Connecting…');
    setError('');
    const info = await tryCustomURL(url);
    if (info) { setNodeInfo(info); setStatus('connected'); }
    else       { setStatus('error'); setError(`Could not connect to ${url}`); }
  }, []);

  const usePublic = useCallback(() => {
    const url = getPublicFallback(network);
    setNodeInfo({ url, tipBlock: 0, isLocal: false, isPublic: true });
    setStatus('connected');
  }, [network]);

  const forget = useCallback(() => {
    forgetNode();
    setNodeInfo(null);
    setStatus('scanning');
    discover();
  }, [discover]);

  // On mount: auto-discover
  useEffect(() => { discover(); }, [discover]);

  // When network changes: if on a public node, switch its URL; if on local, warn
  useEffect(() => {
    if (prevNetwork.current === network) return;
    prevNetwork.current = network;

    if (!nodeInfo) return;

    if (nodeInfo.isPublic) {
      // Just swap the public URL
      setNodeInfo({ ...nodeInfo, url: getPublicFallback(network), tipBlock: 0 });
    } else if (nodeInfo.isLocal || !nodeInfo.isLocal) {
      // Local/LAN node is always mainnet — force public testnet if switching to testnet
      if (network === 'testnet') {
        setNodeInfo({ url: getPublicFallback('testnet'), tipBlock: 0, isLocal: false, isPublic: true });
        setStatus('connected');
      }
      // switching back to mainnet: re-discover
      if (network === 'mainnet') {
        discover();
      }
    }
  }, [network, nodeInfo, discover]);

  return { status, nodeInfo, progress, error, connectCustom, usePublic, forget };
}
