import { useState } from 'react';

const DOT_STYLE = {
  scanning:  { bg: '#ff8c42', anim: 'pulse 1.5s infinite' },
  connected: { bg: '#00e5a0', anim: 'none' },
  prompt:    { bg: '#64748b', anim: 'none' },
  error:     { bg: '#ff4560', anim: 'none' },
};

export function NodePanel({ status, nodeInfo, progress, error, network, onCustom, onPublic, onForget }) {
  const [customURL, setCustomURL] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const dot = DOT_STYLE[status] || DOT_STYLE.prompt;

  const nodeLabel = () => {
    if (nodeInfo?.isPublic) return `🌐 Public (${network})`;
    if (nodeInfo?.isLocal)  return '⚡ Local';
    return '🌐 LAN';
  };

  const handleChange = () => {
    // Show custom input immediately instead of re-scanning
    setShowCustom(true);
    setCustomURL('');
  };

  const handleConnect = () => {
    if (customURL.trim()) {
      setShowCustom(false);
      onCustom(customURL.trim());
    }
  };

  const handleCancel = () => {
    setShowCustom(false);
  };

  return (
    <div className="card">
      <div className="card-step">Step 1</div>
      <div className="card-title">CKB Node</div>

      <div className="node-status">
        <span className="node-dot" style={{ background: dot.bg, animation: dot.anim }} />
        <span className="node-msg">
          {status === 'scanning'  && <span className="text-muted">{progress}</span>}
          {status === 'connected' && !showCustom && <>
            <span className={nodeInfo?.isLocal ? 'text-green' : 'text-accent'}>{nodeLabel()}</span>
            &nbsp;·&nbsp;<code style={{fontSize:'.78rem',wordBreak:'break-all'}}>{nodeInfo?.url}</code>
            {nodeInfo?.tipBlock > 0 && <>&nbsp;·&nbsp;block #{nodeInfo.tipBlock.toLocaleString()}</>}
          </>}
          {status === 'prompt'    && !showCustom && <span className="text-muted">No node found</span>}
          {status === 'error'     && !showCustom && <span className="text-red">{error}</span>}
        </span>
        {status === 'connected' && !showCustom && (
          <button className="btn-tiny" onClick={handleChange}>change</button>
        )}
      </div>

      {/* Custom URL input — shown when: change clicked, or prompt/error state */}
      {(showCustom || status === 'prompt' || status === 'error') && (
        <div className="node-prompt">
          {status === 'error' && error === 'brave' && !showCustom && (
            <div style={{background:'rgba(255,140,66,.08)',border:'1px solid rgba(255,140,66,.3)',
              borderRadius:'8px',padding:'8px 12px',fontSize:'.82rem',color:'#ff8c42',marginBottom:'8px'}}>
              🦁 <strong>Brave blocks LAN scanning</strong> — enter your node IP below, or use a public node.
            </div>
          )}
          <div className="input-row">
            <input
              type="text" className="input" value={customURL}
              onChange={e => setCustomURL(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConnect()}
              placeholder="http://192.168.68.87:8114"
              autoFocus
            />
            <button className="btn-primary" onClick={handleConnect}>Connect</button>
          </div>
          <div className="hint" style={{marginTop:'.35rem'}}>
            Enter your node RPC URL — e.g. <code>http://192.168.68.87:8114</code>
          </div>
          <div style={{ marginTop: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap:'wrap' }}>
            <button className="btn-ghost" onClick={onPublic}>Use public {network} node</button>
            {showCustom && (
              <button className="btn-ghost" onClick={handleCancel}>Cancel</button>
            )}
            <span className="hint">public node is rate-limited · fine for testing</span>
          </div>
        </div>
      )}

      {/* When connected and not editing: show public node toggle */}
      {status === 'connected' && !showCustom && !nodeInfo?.isPublic && (
        <div style={{ marginTop: '0.6rem', fontSize: '.8rem', color: '#64748b' }}>
          <button className="btn-ghost" style={{fontSize:'.78rem'}} onClick={onPublic}>
            Switch to public {network} node
          </button>
        </div>
      )}
    </div>
  );
}

