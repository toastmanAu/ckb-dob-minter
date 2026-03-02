/**
 * hooks/useNodeFinder.js — React hook wrapping node-finder logic
 */
import { useState, useEffect, useCallback } from 'react';
import { discoverNode, tryCustomURL, getPublicFallback, forgetNode } from '../lib/node-finder.js';

export function useNodeFinder(network) {
  const [status,   setStatus]   = useState('scanning'); // scanning | connected | prompt | error
  const [nodeInfo, setNodeInfo] = useState(null);
  const [error,    setError]    = useState('');

  const discover = useCallback(async () => {
    setStatus('scanning');
    setError('');
    const info = await discoverNode();
    if (info) {
      setNodeInfo(info);
      setStatus('connected');
    } else {
      setStatus('prompt');
    }
  }, []);

  const connectCustom = useCallback(async (url) => {
    setStatus('scanning');
    setError('');
    const info = await tryCustomURL(url);
    if (info) {
      setNodeInfo(info);
      setStatus('connected');
    } else {
      setStatus('error');
      setError(`Could not connect to ${url}`);
    }
  }, []);

  const usePublic = useCallback(() => {
    const url  = getPublicFallback(network);
    const info = { url, tipBlock: 0, isLocal: false };
    setNodeInfo(info);
    setStatus('connected');
  }, [network]);

  const forget = useCallback(() => {
    forgetNode();
    setNodeInfo(null);
    setStatus('prompt');
  }, []);

  useEffect(() => { discover(); }, [discover]);

  return { status, nodeInfo, error, connectCustom, usePublic, forget };
}
