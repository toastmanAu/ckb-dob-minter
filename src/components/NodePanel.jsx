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
  const [connecting, setConnecting] = useState(false);
  const dot = DOT_STYLE[status] || DOT_STYLE.prompt;

  const nodeLabel = () => {
    if (nodeInfo?.isPublic) return `🌐 Public (${network})`;
    if (nodeInfo?.isLocal)  return '⚡ Local';
    return '🌐 LAN';
  };

  const handleChange = () => {
    setShowCustom(true);
    setCustomURL(nodeInfo?.url || '');
  };

  const handleConnect = async () => {
    if (!customURL.trim()) return;
    setConnecting(true);
    setShowCustom(false);
    await onCustom(customURL.trim());
    setConnecting(false);
  };

  const handleCancel = () => {
    setShowCustom(false);
    setCustomURL('');
  };

  return (
    <div className="card">
      <div className="card-step">Step 1</div>
      <div className="card-title">CKB Node</div>

      <div className="node-status">
        <span className="node-dot" style={{ background: dot.bg, animation: dot.anim }} />
        <span className="node-msg">
          {(status === 'scanning' || connecting) && (
            <span className="text-muted">{connecting ? 'Connecting…' : progress}</span>
          )}
          {status === 'connected' && !showCustom && !connecting && <>
            <span className={nodeInfo?.isLocal ? 'text-green' : 'text-accent'}>{nodeLabel()}</span>
            {nodeInfo?.tipBlock > 0 && <>&nbsp;·&nbsp;<span style={{fontSize:'.78rem',color:'#64748b'}}>block #{nodeInfo.tipBlock.toLocaleString()}</span></>}
          </>}
          {status === 'prompt' && !showCustom && !connecting && (
            <span className="text-muted">No node found automatically</span>
          )}
          {status === 'error' && !showCustom && !connecting && (
            <span className="text-red">{error}</span>
          )}
        </span>
        {status === 'connected' && !showCustom && !connecting && (
          <button className="btn-tiny" onClick={handleChange}>change</button>
        )}
      </div>

      {/* Connected URL shown on its own line for readability */}
      {status === 'connected' && !showCustom && !connecting && nodeInfo?.url && (
        <div style={{
          marginTop: '0.4rem', padding: '0.4rem 0.6rem',
          background: 'rgba(255,255,255,0.04)', borderRadius: '6px',
          fontSize: '.75rem', color: '#64748b', wordBreak: 'break-all', fontFamily: 'monospace'
        }}>
          {nodeInfo.url}
        </div>
      )}

      {/* Custom URL input */}
      {(showCustom || status === 'prompt' || status === 'error') && !connecting && (
        <div className="node-prompt">
          {status === 'error' && error === 'brave' && !showCustom && (
            <div style={{background:'rgba(255,140,66,.08)',border:'1px solid rgba(255,140,66,.3)',
              borderRadius:'8px',padding:'8px 12px',fontSize:'.82rem',color:'#ff8c42',marginBottom:'8px'}}>
              🦁 <strong>Brave blocks LAN scanning</strong> — enter your node IP below, or use a public node.
            </div>
          )}

          {/* URL on its own line */}
          <input
            type="url" className="input" value={customURL}
            onChange={e => setCustomURL(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleConnect()}
            placeholder="http://192.168.68.87:8114"
            autoFocus
            style={{ marginBottom: '0.5rem', width: '100%', boxSizing: 'border-box' }}
          />
          {/* Buttons on next line */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={handleConnect}
              disabled={!customURL.trim()}>
              Connect
            </button>
            <button className="btn-ghost" onClick={onPublic}>
              Use public {network} node
            </button>
            {showCustom && (
              <button className="btn-ghost" onClick={handleCancel}>Cancel</button>
            )}
          </div>
          <div className="hint" style={{marginTop:'.4rem'}}>
            e.g. <code>http://192.168.68.87:8114</code> · public node is rate-limited but works for testing
          </div>
        </div>
      )}

      {/* Switch to public node when connected to local */}
      {status === 'connected' && !showCustom && !connecting && !nodeInfo?.isPublic && (
        <div style={{ marginTop: '0.6rem' }}>
          <button className="btn-ghost" style={{fontSize:'.78rem'}} onClick={onPublic}>
            Switch to public {network} node
          </button>
        </div>
      )}
    </div>
  );
}
