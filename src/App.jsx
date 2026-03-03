import React, { useState, useEffect, useCallback } from 'react';
import { useCcc, ccc } from '@ckb-ccc/connector-react';

import { NodePanel }   from './components/NodePanel.jsx';
import { FilesPanel }  from './components/FilesPanel.jsx';
import { ClusterPanel } from './components/ClusterPanel.jsx';
import { MetaPanel, DEFAULT_META } from './components/MetaPanel.jsx';
import { WalletPanel } from './components/WalletPanel.jsx';
import { MintPanel }   from './components/MintPanel.jsx';
import { useNodeFinder }  from './hooks/useNodeFinder.js';
import { useFilesInput }  from './hooks/useFilesInput.js';
import { mintDOBs } from './lib/minter.js';

function AppInner({ network, setNetwork }) {
  const [meta,     setMeta]     = useState(DEFAULT_META);
  const [cluster,  setCluster]  = useState(null);  // null | { id, name, txHash? }
  const [mintState, setMintState] = useState({
    status: 'idle', progress: '', current: 0, total: 0, results: [], error: '',
  });

  const { signerInfo, open, setClient, disconnect } = useCcc();
  const signer  = signerInfo?.signer;
  const [address, setAddress] = useState('');

  useEffect(() => {
    setClient(network === 'testnet'
      ? new ccc.ClientPublicTestnet()
      : new ccc.ClientPublicMainnet()
    );
  }, [network, setClient]);

  useEffect(() => {
    if (!signer) { setAddress(''); return; }
    signer.getRecommendedAddress().then(setAddress).catch(() => setAddress(''));
  }, [signer]);

  // Patch ccc-connector shadow DOM for mobile sizing
  useEffect(() => {
    const patch = () => {
      const el = document.querySelector('ccc-connector');
      if (!el?.shadowRoot) return;
      if (el.shadowRoot.querySelector('#kernel-patch')) return;
      const style = document.createElement('style');
      style.id = 'kernel-patch';
      style.textContent = `
        .main { max-width: min(22rem, 94vw) !important; width: min(22rem, 94vw) !important; font-size: 14px !important; }
        .wallet-icon { width: 3rem !important; height: 3rem !important; }
        .connecting-wallet-icon { width: 3.5rem !important; height: 3.5rem !important; }
      `;
      el.shadowRoot.appendChild(style);
    };
    const t = setInterval(patch, 300);
    return () => clearInterval(t);
  }, []);

  const { status: nodeStatus, nodeInfo, progress: nodeProgress, error: nodeError,
          connectCustom, usePublic, forget } = useNodeFinder(network);

  const { files, fileError, inputRef, onInputChange, onDrop, onDragOver,
          removeFile, clearFiles, openPicker } = useFilesInput();

  const reasons = [];
  if (!signer || !address)  reasons.push('Connect your wallet');
  if (files.length === 0)   reasons.push('Add at least one file');
  // block minting until cluster is created (if create mode selected)
  if (cluster !== null && !cluster.id) reasons.push('Create your cluster first');
  const canMint = reasons.length === 0;

  const handleMint = useCallback(async () => {
    if (!canMint) return;
    setMintState({ status: 'minting', progress: 'Starting…', current: 0, total: files.length, results: [], error: '' });
    try {
      // Resolve recipient lock (if set in meta, otherwise sender keeps DOB)
      let toLock;
      if (meta.recipient?.trim()) {
        try {
          const toAddr = await ccc.Address.fromString(meta.recipient.trim(), signer.client);
          toLock = toAddr.script;
        } catch (e) {
          throw new Error(`Invalid recipient address: ${e.message}`);
        }
      }

      const results = await mintDOBs({
        signer,
        files,
        clusterId: cluster?.id || meta.clusterId || '',
        toLock,
        onProgress: (idx, total, msg) => {
          setMintState(s => ({ ...s, progress: msg, current: idx, total }));
        },
      });
      setMintState({ status: 'success', progress: '', current: results.length, total: results.length, results, error: '' });
      clearFiles();
    } catch (err) {
      console.error(err);
      setMintState(s => ({ ...s, status: 'error', error: err.message || String(err) }));
    }
  }, [canMint, files, cluster, meta, signer, clearFiles]);

  return (
    <div className="app">
      <header>
        <div className="header-inner">
          <div className="logo">CKB <span>DOB</span> Minter</div>
          <div className="header-right">
            <div className="network-toggle">
              {['mainnet','testnet'].map(n => (
                <button key={n} className={network===n?'active':''} onClick={()=>setNetwork(n)}>{n}</button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main>
        <NodePanel
          status={nodeStatus} nodeInfo={nodeInfo} progress={nodeProgress}
          error={nodeError} network={network} onCustom={connectCustom} onPublic={usePublic} onForget={forget}
        />
        <FilesPanel
          files={files} fileError={fileError} inputRef={inputRef}
          onInputChange={onInputChange} onDrop={onDrop} onDragOver={onDragOver}
          onRemove={removeFile} onOpen={openPicker}
        />
        <ClusterPanel signer={signer} cluster={cluster} onChange={setCluster} />
        <MetaPanel meta={meta} onChange={setMeta} />
        <WalletPanel signer={signer} address={address} onDisconnect={disconnect} onOpen={open} />
        <BatchMintPanel
          canMint={canMint} reasons={reasons} files={files} cluster={cluster}
          meta={meta} nodeInfo={nodeInfo} network={network}
          mintState={mintState} onMint={handleMint}
        />

        <div className="card explainer-card">
          <div className="explainer">
            {[
              ['⛓️','Fully on-chain','Content lives inside the CKB cell — no IPFS, no URLs that break.'],
              ['💎','Intrinsic value','Backed by real CKB. Burn the DOB any time to reclaim storage deposit.'],
              ['🔒','Immutable','Once minted, content cannot be changed. Permanent by design.'],
              ['🌐','Your node','Transactions go through your own CKB node. No third-party dependency.'],
            ].map(([icon,title,desc]) => (
              <div key={title} className="explainer-item">
                <span className="explainer-icon">{icon}</span>
                <div><h4>{title}</h4><p>{desc}</p></div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * BatchMintPanel — replaces MintPanel, shows per-file progress + results list
 */
function BatchMintPanel({ canMint, reasons, files, cluster, meta, nodeInfo, network, mintState, onMint }) {
  const { status, progress, current, total, results, error } = mintState;
  const isMinting = status === 'minting';

  const clusterId = cluster?.id || meta.clusterId || '';
  const totalCKB  = files.reduce((s, f) => s + (f.costCKB || 0), 0);

  return (
    <div className="card">
      <div className="card-step">Step 5</div>
      <div className="card-title">Mint</div>

      {/* Summary */}
      {files.length > 0 && (
        <div className="mint-summary">
          <div className="summary-row"><span>Files</span><span>{files.length}</span></div>
          <div className="summary-row"><span>Est. storage cost</span><span className="text-accent">~{totalCKB} CKB</span></div>
          {clusterId && <div className="summary-row"><span>Cluster</span><span className="mono small">{clusterId.slice(0, 18)}…</span></div>}
          <div className="summary-row"><span>Network</span><span>{network}</span></div>
          {nodeInfo && <div className="summary-row"><span>Node</span><span className="text-muted small">{nodeInfo.url}</span></div>}
        </div>
      )}

      {/* Reasons not ready */}
      {!canMint && reasons.length > 0 && (
        <ul className="reasons-list">
          {reasons.map(r => <li key={r}>{r}</li>)}
        </ul>
      )}

      {/* Progress bar */}
      {isMinting && total > 0 && (
        <div className="progress-wrap">
          <div className="progress-bar" style={{ width: `${(current / total) * 100}%` }} />
          <div className="progress-label">{progress}</div>
        </div>
      )}

      {/* Mint button */}
      <button
        className="btn-primary btn-mint"
        onClick={onMint}
        disabled={!canMint || isMinting}
      >
        {isMinting
          ? `Minting ${current}/${total}…`
          : files.length > 1
            ? `Mint ${files.length} DOBs`
            : 'Mint DOB'}
      </button>

      {/* Success results */}
      {status === 'success' && results.length > 0 && (
        <div className="results-list">
          <div className="results-title">✅ {results.length} DOB{results.length > 1 ? 's' : ''} minted!</div>
          {results.map((r, i) => (
            <div key={i} className="result-row">
              <span className="result-name">{r.name}</span>
              <div className="mono small">Spore ID: {r.sporeId}</div>
              <div className="mono small">TX: {r.txHash}</div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {status === 'error' && <div className="status-error" style={{ marginTop: '0.75rem' }}>{error}</div>}
    </div>
  );
}

export default function App() {
  const [network, setNetwork] = useState('testnet');
  return (
    <ccc.Provider>
      <AppInner network={network} setNetwork={setNetwork} />
    </ccc.Provider>
  );
}
