/**
 * StoragePanel — storage mode selector
 * Controls where the file content lives.
 */
import React from 'react';

const MODES = [
  {
    id: 'inline',
    icon: '⛓️',
    label: 'On-chain (inline)',
    desc: 'Content embedded directly in the Spore cell. Permanent, no dependencies. Cost scales with file size.',
    badge: null,
  },
  {
    id: 'ckbfs',
    icon: '🗄️',
    label: 'CKBFS',
    desc: 'Content stored in CKB witnesses via CKBFS protocol. Spore cell stores a ckbfs:// URI. Native CKB.',
    badge: null,
  },
  {
    id: 'ipfs',
    icon: '📌',
    label: 'IPFS (Pinata)',
    desc: 'Upload to IPFS via Pinata. Spore cell stores an ipfs:// URI. Free tier covers 1 GB. Requires API key.',
    badge: 'coming soon',
  },
  {
    id: 'arweave',
    icon: '♾️',
    label: 'Arweave (Irys)',
    desc: 'Permanent storage via Arweave. Spore cell stores an ar:// URI. One-time fee ~$0.01/MB.',
    badge: 'coming soon',
  },
];

export function StoragePanel({ storageMode, onChange }) {
  return (
    <div className="card">
      <div className="card-step">Step 2a</div>
      <div className="card-title">Storage Mode</div>
      <p className="card-hint">Where should the file content live on-chain?</p>

      <div className="storage-grid">
        {MODES.map(m => {
          const disabled = m.badge === 'coming soon';
          const active = storageMode === m.id;
          return (
            <button
              key={m.id}
              className={`storage-option${active ? ' active' : ''}${disabled ? ' disabled' : ''}`}
              onClick={() => !disabled && onChange(m.id)}
              disabled={disabled}
              title={disabled ? 'Coming soon' : ''}
            >
              <div className="storage-option-header">
                <span className="storage-icon">{m.icon}</span>
                <span className="storage-label">{m.label}</span>
                {m.badge && <span className="storage-badge">{m.badge}</span>}
                {active && !disabled && <span className="storage-check">✓</span>}
              </div>
              <p className="storage-desc">{m.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
