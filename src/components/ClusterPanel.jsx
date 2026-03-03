/**
 * ClusterPanel — collection mode selector
 * Modes:
 *   'none'   — standalone DOB (no cluster)
 *   'create' — create a new cluster first, then mint into it
 *   'use'    — use an existing cluster (paste ID or pick from wallet)
 */
import React, { useState, useCallback } from 'react';
import { spore } from '@ckb-ccc/spore';

export function ClusterPanel({ signer, cluster, onChange }) {
  const [mode,        setMode]        = useState('none');   // 'none' | 'create' | 'use'
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [pastedId,    setPastedId]    = useState('');
  const [walletClusters, setWalletClusters] = useState([]);
  const [loadingWallet,  setLoadingWallet]  = useState(false);
  const [creating,       setCreating]       = useState(false);
  const [createError,    setCreateError]    = useState('');

  const switchMode = (m) => {
    setMode(m);
    setCreateError('');
    // clear cluster selection when switching away
    if (m === 'none') onChange(null);
    if (m === 'create') onChange(null);
    if (m === 'use' && pastedId.startsWith('0x')) onChange({ id: pastedId, name: '' });
  };

  const handlePastedId = (v) => {
    setPastedId(v);
    if (v.startsWith('0x') && v.length > 10) onChange({ id: v.trim(), name: '' });
    else onChange(null);
  };

  const loadWalletClusters = useCallback(async () => {
    if (!signer) return;
    setLoadingWallet(true);
    try {
      const found = [];
      for await (const c of spore.findSporeClustersBySigner({ signer })) {
        found.push(c);
        if (found.length >= 20) break; // cap at 20
      }
      setWalletClusters(found);
    } catch (e) {
      console.error('cluster load error', e);
    }
    setLoadingWallet(false);
  }, [signer]);

  const selectWalletCluster = (c) => {
    const id = typeof c.cell?.cellOutput?.type?.args === 'string'
      ? c.cell.cellOutput.type.args
      : c.id ?? '';
    const cname = c.data?.name ?? '';
    onChange({ id, name: cname });
  };

  const handleCreate = useCallback(async () => {
    if (!signer || !name.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const { tx, id } = await spore.createSporeCluster({
        signer,
        data: { name: name.trim(), description: description.trim() },
      });
      await tx.completeFeeBy(signer, 1000n);
      const txHash = await signer.sendTransaction(tx);
      // Wait for cluster to be confirmed before minting into it
      await signer.client.waitTransaction(txHash);
      onChange({ id, name: name.trim(), txHash });
    } catch (e) {
      setCreateError(e.message || String(e));
    }
    setCreating(false);
  }, [signer, name, description, onChange]);

  return (
    <div className="card">
      <div className="card-step">Step 2b</div>
      <div className="card-title">Collection (Cluster)</div>

      {/* Mode tabs */}
      <div className="cluster-tabs">
        {[
          ['none',   'No collection'],
          ['create', 'Create new'],
          ['use',    'Use existing'],
        ].map(([m, label]) => (
          <button
            key={m}
            className={`cluster-tab${mode === m ? ' active' : ''}`}
            onClick={() => switchMode(m)}
          >{label}</button>
        ))}
      </div>

      {/* None */}
      {mode === 'none' && (
        <p className="cluster-hint">DOB will be minted standalone — no collection.</p>
      )}

      {/* Create */}
      {mode === 'create' && (
        <div className="fields">
          <div className="field-group">
            <label className="field-label">Collection Name <span className="field-required">*</span></label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="My Collection" />
          </div>
          <div className="field-group">
            <label className="field-label">Description <span className="field-hint">optional</span></label>
            <textarea className="input" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this collection about?" />
          </div>

          {cluster?.txHash ? (
            <div className="status-success">
              ✅ Cluster created!<br />
              <span className="mono small">ID: {cluster.id}</span><br />
              <span className="mono small">TX: {cluster.txHash}</span>
            </div>
          ) : (
            <>
              <button
                className="btn-primary"
                onClick={handleCreate}
                disabled={creating || !name.trim() || !signer}
              >
                {creating ? 'Creating cluster…' : 'Create cluster on-chain'}
              </button>
              {!signer && <p className="cluster-hint">Connect wallet first.</p>}
              {createError && <div className="status-error">{createError}</div>}
            </>
          )}
        </div>
      )}

      {/* Use existing */}
      {mode === 'use' && (
        <div className="fields">
          <div className="field-group">
            <label className="field-label">Cluster ID <span className="field-hint">paste 0x... ID</span></label>
            <input
              className="input font-mono"
              value={pastedId}
              onChange={e => handlePastedId(e.target.value)}
              placeholder="0x..."
            />
          </div>

          <div className="cluster-divider">— or pick from wallet —</div>

          {walletClusters.length === 0 ? (
            <button className="btn-ghost" onClick={loadWalletClusters} disabled={loadingWallet || !signer}>
              {loadingWallet ? 'Loading…' : 'Load my clusters'}
            </button>
          ) : (
            <div className="cluster-list">
              {walletClusters.map((c, i) => {
                const cid = c.cell?.cellOutput?.type?.args ?? c.id ?? '';
                const cname = c.data?.name ?? '(unnamed)';
                const selected = cluster?.id === cid;
                return (
                  <div
                    key={i}
                    className={`cluster-item${selected ? ' selected' : ''}`}
                    onClick={() => selectWalletCluster(c)}
                  >
                    <span className="cluster-item-name">{cname}</span>
                    <span className="cluster-item-id">{cid.slice(0, 10)}…</span>
                  </div>
                );
              })}
            </div>
          )}

          {cluster?.id && (
            <div className="status-success">✅ Using cluster: {cluster.name || cluster.id.slice(0, 16) + '…'}</div>
          )}
        </div>
      )}
    </div>
  );
}
