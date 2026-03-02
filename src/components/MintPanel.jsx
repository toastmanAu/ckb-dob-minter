/**
 * MintPanel — pre-flight summary + mint button + result display
 */
export function MintPanel({ canMint, reasons, file, meta, nodeInfo, network, mintState, onMint }) {
  const { status, progress, txHash, sporeId, error } = mintState;
  const explorerBase = network === 'testnet'
    ? 'https://pudge.explorer.nervos.org'
    : 'https://explorer.nervos.org';

  return (
    <div className="card">
      <div className="card-step">Step 5</div>
      <div className="card-title">Review & Mint</div>

      {/* Pre-flight checklist */}
      <div className="preflight">
        <PreflightRow ok={!!nodeInfo}   label="CKB node connected"          detail={nodeInfo?.url} />
        <PreflightRow ok={!!file}       label="Content selected"            detail={file ? `${file.name} · ~${file.costCKB} CKB` : ''} />
        <PreflightRow ok={canMint}      label="Wallet connected"            detail="" />
        {meta.clusterId && <PreflightRow ok detail={`Cluster: ${meta.clusterId.slice(0,18)}…`} label="Collection linked" />}
        {meta.immortal  && <PreflightRow warn label="Immortal — cannot melt" detail="CKB locked forever" />}
      </div>

      {/* Not ready reasons */}
      {reasons.length > 0 && (
        <ul className="reasons">
          {reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}

      {/* Mint button */}
      {status !== 'success' && (
        <button
          className="btn-mint"
          disabled={!canMint || status === 'minting'}
          onClick={onMint}
        >
          {status === 'minting' ? progress || 'Minting…' : 'Mint DOB'}
        </button>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="status-error" style={{ marginTop: '0.8rem' }}>{error}</div>
      )}

      {/* Success */}
      {status === 'success' && (
        <div className="result-box">
          <div className="result-header">🎉 Minted successfully</div>
          <div className="result-row">
            <span className="result-label">Transaction</span>
            <a
              className="result-value"
              href={`${explorerBase}/transaction/${txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              {txHash}
            </a>
          </div>
          <div className="result-row">
            <span className="result-label">Spore ID</span>
            <code className="result-value">{sporeId}</code>
          </div>
          <button className="btn-ghost" style={{ marginTop: '1rem' }} onClick={() => window.location.reload()}>
            Mint another
          </button>
        </div>
      )}
    </div>
  );
}

function PreflightRow({ ok, warn, label, detail }) {
  const icon = warn ? '⚠️' : ok ? '✓' : '○';
  const cls  = warn ? 'pf-warn' : ok ? 'pf-ok' : 'pf-pending';
  return (
    <div className={`pf-row ${cls}`}>
      <span className="pf-icon">{icon}</span>
      <span className="pf-label">{label}</span>
      {detail && <span className="pf-detail">{detail}</span>}
    </div>
  );
}
