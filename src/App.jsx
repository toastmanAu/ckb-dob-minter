import React, { useState, useEffect, useCallback } from 'react';
import { useCcc, ccc } from '@ckb-ccc/connector-react';

import { NodePanel }   from './components/NodePanel.jsx';
import { FilePanel }   from './components/FilePanel.jsx';
import { MetaPanel, DEFAULT_META } from './components/MetaPanel.jsx';
import { WalletPanel } from './components/WalletPanel.jsx';
import { MintPanel }   from './components/MintPanel.jsx';
import { useNodeFinder } from './hooks/useNodeFinder.js';
import { useFileInput }  from './hooks/useFileInput.js';
import { mintDOB } from './lib/minter.js';

function AppInner({ network, setNetwork }) {
  const [meta,        setMeta]        = useState(DEFAULT_META);
  const [contentType, setContentType] = useState('');
  const [mintState,   setMintState]   = useState({
    status: 'idle', progress: '', txHash: '', sporeId: '', error: '',
  });

  const { signerInfo, open, setClient, disconnect } = useCcc();
  const signer  = signerInfo?.signer;
  const [address, setAddress] = useState('');

  // Switch network by swapping the CCC client
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

  const { file, fileError, inputRef, onInputChange, onDrop, onDragOver,
          clearFile, openPicker } = useFileInput();

  useEffect(() => { if (file) setContentType(file.type); }, [file]);

  const reasons = [];
  if (!signer || !address)  reasons.push('Connect your wallet');
  if (!file)                reasons.push('Select a file to mint');
  if (!contentType?.trim()) reasons.push('Content-Type is required');
  const canMint = reasons.length === 0;

  const handleMint = useCallback(async () => {
    if (!canMint) return;
    setMintState({ status: 'minting', progress: 'Starting…', txHash: '', sporeId: '', error: '' });
    try {
      const { txHash, sporeId } = await mintDOB({
        signer,
        contentType: contentType.trim(),
        content:     file.content,
        clusterId:   meta.clusterId,
        onProgress:  msg => setMintState(s => ({ ...s, progress: msg })),
      });
      setMintState({ status: 'success', progress: '', txHash, sporeId, error: '' });
    } catch (err) {
      console.error(err);
      setMintState({ status: 'error', progress: '', txHash: '', sporeId: '',
        error: err.message || String(err) });
    }
  }, [canMint, file, contentType, meta, signer]);

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
        <FilePanel
          file={file} fileError={fileError} inputRef={inputRef}
          onInputChange={onInputChange} onDrop={onDrop} onDragOver={onDragOver}
          onClear={clearFile} onOpen={openPicker}
          contentType={contentType} onContentTypeChange={setContentType}
        />
        <MetaPanel meta={meta} onChange={setMeta} />
        <WalletPanel signer={signer} address={address} onDisconnect={disconnect} onOpen={open} />
        <MintPanel
          canMint={canMint} reasons={reasons} file={file} meta={meta}
          nodeInfo={nodeInfo} network={network} mintState={mintState} onMint={handleMint}
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

export default function App() {
  const [network, setNetwork] = useState('testnet');
  return (
    <ccc.Provider>
      <AppInner network={network} setNetwork={setNetwork} />
    </ccc.Provider>
  );
}
