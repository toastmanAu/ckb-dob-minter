/**
 * useCkbfs.js — React hook for CKBFS file publishing
 *
 * Usage:
 *   const { publish, estimateCost, status, result, error } = useCkbfs(signer, { mainnet: false });
 *
 *   const cost = estimateCost(fileBytes);
 *   await publish({ fileBytes, contentType: 'image/jpeg', filename: 'art.jpg' });
 */

import { useState, useCallback } from 'react';
import { ckbfsPublish, ckbfsEstimateCost } from './ckbfs';

export function useCkbfs(signer, { mainnet = false } = {}) {
  const [status, setStatus]   = useState('idle'); // idle | publishing | done | error
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);

  const publish = useCallback(async ({ fileBytes, contentType, filename }) => {
    if (!signer) throw new Error('No signer — connect wallet first');
    setStatus('publishing');
    setResult(null);
    setError(null);
    try {
      const res = await ckbfsPublish({ signer, fileBytes, contentType, filename, mainnet });
      setResult(res);
      setStatus('done');
      return res;
    } catch (e) {
      setError(e.message);
      setStatus('error');
      throw e;
    }
  }, [signer, mainnet]);

  const estimateCost = useCallback((fileBytes) => {
    return ckbfsEstimateCost(fileBytes);
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
  }, []);

  return { publish, estimateCost, status, result, error, reset };
}
