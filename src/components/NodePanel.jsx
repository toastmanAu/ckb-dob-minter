import { useState } from 'react';

const STATUS_DOT = {
  scanning:  { bg: '#ff8c42', anim: 'pulse 1.5s infinite' },
  connected: { bg: '#00e5a0', anim: 'none' },
  prompt:    { bg: '#64748b', anim: 'none' },
  error:     { bg: '#ff4560', anim: 'none' },
};

export function NodePanel({ status, nodeInfo, error, onCustom, onPublic, onForget }) {
  const [customURL, setCustomURL] = useState('');
  const dot = STATUS_DOT[status] || STATUS_DOT.prompt;

  return (
    <div className="card">
      <div className="card-step">Step 1</div>
      <div className="card-title">CKB Node</div>

      <div className="node-status">
        <span className="node-dot" style={{ background: dot.bg, animation: dot.anim }} />
        <span className="node-msg">
          {status === 'scanning'  && 'Scanning for local node…'}
          {status === 'connected' && <>
            <span className="text-green">{nodeInfo?.isLocal ? '⚡ Local' : '🌐 Public'}</span>
            &nbsp;·&nbsp;<code>{nodeInfo?.url}</code>
            {nodeInfo?.tipBlock > 0 && <>&nbsp;·&nbsp;block #{nodeInfo.tipBlock.toLocaleString()}</>}
          </>}
          {status === 'prompt'   && 'No local node found — enter your RPC URL'}
          {status === 'error'    && <span className="text-red">{error}</span>}
        </span>
        {status === 'connected' && (
          <button className="btn-tiny" onClick={onForget}>change</button>
        )}
      </div>

      {(status === 'prompt' || status === 'error') && (
        <div className="node-prompt">
          <div className="input-row">
            <input
              type="text"
              className="input"
              value={customURL}
              onChange={e => setCustomURL(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onCustom(customURL)}
              placeholder="http://192.168.x.x:8114"
            />
            <button className="btn-primary" onClick={() => onCustom(customURL)}>Connect</button>
          </div>
          <div className="hint">
            Common: <code>localhost:8114</code> (full node) · <code>localhost:8117</code> (light client)
          </div>
          <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button className="btn-ghost" onClick={onPublic}>Use public node</button>
            <span className="hint">rate limited, fine for testing</span>
          </div>
        </div>
      )}
    </div>
  );
}
