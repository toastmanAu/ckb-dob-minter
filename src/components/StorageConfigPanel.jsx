/**
 * StorageConfigPanel — API key inputs for external storage providers
 * Only renders when an external provider is selected.
 */
import React from 'react';

export function StorageConfigPanel({ storageMode, config, onChange }) {
  if (!storageMode || storageMode === 'inline' || storageMode === 'ckbfs') return null;

  const set = (key, val) => onChange({ ...config, [key]: val });

  return (
    <div className="card">
      <div className="card-step">Step 2c</div>
      <div className="card-title">Storage Credentials</div>

      {storageMode === 'ipfs' && (
        <div className="fields">
          <p className="card-hint">
            <a href="https://app.pinata.cloud" target="_blank" rel="noreferrer">Pinata</a> — free tier 1 GB.
            Create an API key with <code>pinFileToIPFS</code> permission.
          </p>
          <div className="field-group">
            <label className="field-label">Pinata JWT <span className="field-required">*</span></label>
            <input
              className="input font-mono"
              type="password"
              value={config?.pinataJwt || ''}
              onChange={e => set('pinataJwt', e.target.value)}
              placeholder="eyJhbGci..."
            />
            <span className="field-hint">Recommended — use JWT (not API key pair)</span>
          </div>
          <div className="field-group">
            <label className="field-label">
              Gateway <span className="field-hint">optional — for preview URLs</span>
            </label>
            <input
              className="input"
              type="text"
              value={config?.gateway || ''}
              onChange={e => set('gateway', e.target.value)}
              placeholder="https://gateway.pinata.cloud/ipfs/"
            />
          </div>
          <p className="storage-security-note">
            🔒 Keys stay in your browser session — never sent to any server other than Pinata.
          </p>
        </div>
      )}

      {storageMode === 'arweave' && (
        <div className="fields">
          <p className="card-hint">
            <a href="https://irys.xyz" target="_blank" rel="noreferrer">Irys</a> — permanent Arweave storage.
            Files under 100 KB are free on devnet. Mainnet requires a funded account.
          </p>
          <div className="field-group">
            <label className="field-label">
              Irys Token <span className="field-hint">optional for small files</span>
            </label>
            <input
              className="input font-mono"
              type="password"
              value={config?.irysToken || ''}
              onChange={e => set('irysToken', e.target.value)}
              placeholder="Leave blank for free devnet uploads (<100 KB)"
            />
          </div>
          <div className="field-group">
            <label className="field-label">
              Irys Node <span className="field-hint">optional</span>
            </label>
            <input
              className="input"
              type="text"
              value={config?.irysNode || ''}
              onChange={e => set('irysNode', e.target.value)}
              placeholder="https://node2.irys.xyz"
            />
          </div>
          <p className="storage-security-note">
            🔒 Keys stay in your browser session — never sent anywhere except Irys.
          </p>
        </div>
      )}
    </div>
  );
}
