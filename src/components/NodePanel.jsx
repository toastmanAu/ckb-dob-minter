import { useState } from 'react';

const DOT_STYLE = {
  scanning:  { bg: '#ff8c42', anim: 'pulse 1.5s infinite' },
  connected: { bg: '#00e5a0', anim: 'none' },
  prompt:    { bg: '#64748b', anim: 'none' },
  error:     { bg: '#ff4560', anim: 'none' },
};

export function NodePanel({ status, nodeInfo, progress, error, onCustom, onPublic, onForget }) {
  const [customURL, setCustomURL] = useState('');
  const dot = DOT_STYLE[status] || DOT_STYLE.prompt;

  return (
    <div className="card">
      <div className="card-step">Step 1</div>
      <div className="card-title">CKB Node</div>

      <div className="node-status">
        <span className="node-dot" style={{ background: dot.bg, animation: dot.anim }} />
        <span className="node-msg">
          {status === 'scanning'  && <span className="text-muted">{progress}</span>}
          {status === 'connected' && <>
            <span className={nodeInfo?.isLocal ? 'text-green' : 'text-accent'}>
              {nodeInfo?.isLocal ? '⚡ Local' : '🌐 LAN'}
            </span>
            &nbsp;·&nbsp;<code>{nodeInfo?.url}</code>
            {nodeInfo?.tipBlock > 0 && <>&nbsp;·&nbsp;block #{nodeInfo.tipBlock.toLocaleString()}</>}
          </>}
          {status === 'prompt'    && <span className="text-muted">No node found on localhost or LAN</span>}
          {status === 'error'     && <span className="text-red">{error}</span>}
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
              placeholder="http://192.168.68.87:8114"
            />
            <button className="btn-primary" onClick={() => onCustom(customURL)}>Connect</button>
          </div>
          <div className="hint">
            Scanned: <code>localhost:8114</code>, <code>:8117</code>, and common LAN IPs (192.168.x.x, 10.0.x.x).<br/>
            Enter your node's IP directly — e.g. <code>http://192.168.68.87:8114</code>
          </div>
          <div style={{ marginTop: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button className="btn-ghost" onClick={onPublic}>Use public node</button>
            <span className="hint">rate-limited · fine for testnet / evaluation</span>
          </div>
        </div>
      )}
    </div>
  );
}
