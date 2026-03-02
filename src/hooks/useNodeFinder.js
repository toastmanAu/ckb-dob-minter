import { useState, useEffect, useCallback } from 'react';
import { discoverNode, tryCustomURL, getPublicFallback, forgetNode } from '../lib/node-finder.js';

export function useNodeFinder(network) {
  const [status,   setStatus]   = useState('scanning');
  const [nodeInfo, setNodeInfo] = useState(null);
  const [progress, setProgress] = useState('Scanning…');
  const [error,    setError]    = useState('');

  const discover = useCallback(async () => {
    setStatus('scanning');
    setError('');
    const result = await discoverNode(msg => setProgress(msg));
    // result is null (not found) or { isBrave } (Brave, skip LAN) or a full node info object
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
    const url  = getPublicFallback(network);
    setNodeInfo({ url, tipBlock: 0, isLocal: false });
    setStatus('connected');
  }, [network]);

  const forget = useCallback(() => {
    forgetNode();
    setNodeInfo(null);
    setStatus('scanning');
    discover();
  }, [discover]);

  useEffect(() => { discover(); }, [discover]);

  return { status, nodeInfo, progress, error, connectCustom, usePublic, forget };
}
