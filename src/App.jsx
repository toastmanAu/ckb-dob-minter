import React, { useState, useEffect, useCallback } from 'react';
import { useCcc, ccc } from '@ckb-ccc/connector-react';
import { helpers } from '@ckb-lumos/lumos';
import { initializeConfig } from '@ckb-lumos/lumos/config';

import { NodePanel }   from './components/NodePanel.jsx';
import { FilePanel }   from './components/FilePanel.jsx';
import { MetaPanel, DEFAULT_META } from './components/MetaPanel.jsx';
import { WalletPanel } from './components/WalletPanel.jsx';
import { MintPanel }   from './components/MintPanel.jsx';
import { useNodeFinder } from './hooks/useNodeFinder.js';
import { useFileInput }  from './hooks/useFileInput.js';
import { mintDOB, buildSporeConfig } from './lib/minter.js';

// AppInner lives INSIDE Provider — useCcc() works here
function AppInner({ network, setNetwork }) {
  const [meta,        setMeta]        = useState(DEFAULT_META);
  const [contentType, setContentType] = useState('');
  const [mintState,   setMintState]   = useState({
    status: 'idle', progress: '', txHash: '', sporeId: '', error: '',
  });

  // 1.x API: signerInfo?.signer, open, setClient
  const { signerInfo, open, setClient, disconnect } = useCcc();
  const signer  = signerInfo?.signer;
  const [address, setAddress] = useState('');

  // Switch network by swapping the client
  useEffect(() => {
    if (network === 'testnet') {
      setClient(new ccc.ClientPublicTestnet());
    } else {
      setClient(new ccc.ClientPublicMainnet());
    }
  }, [network, setClient]);

  useEffect(() => {
    if (!signer) { setAddress(''); return; }
    signer.getRecommendedAddress().then(setAddress).catch(() => setAddress(''));
  }, [signer]);

  const { status: nodeStatus, nodeInfo, progress: nodeProgress, error: nodeError,
          connectCustom, usePublic, forget } = useNodeFinder(network);

  const { file, fileError, inputRef, onInputChange, onDrop, onDragOver,
          clearFile, openPicker } = useFileInput();

  useEffect(() => { if (file) setContentType(file.type); }, [file]);

  const reasons = [];
  if (!nodeInfo)            reasons.push('Connect a CKB node');
  if (!file)                reasons.push('Select a file to mint');
  if (!signer || !address)  reasons.push('Connect your wallet');
  if (!contentType?.trim()) reasons.push('Content-Type is required');
  const canMint = reasons.length === 0;

  const handleMint = useCallback(async () => {
    if (!canMint) return;
    setMintState({ status: 'minting', progress: 'Starting…', txHash: '', sporeId: '', error: '' });
    try {
      const sporeConfig = buildSporeConfig(meta.indexerURL?.trim() || nodeInfo.url, network);
      initializeConfig(sporeConfig.lumos);
      const toAddress = meta.recipient?.trim() || address;
      const toLock    = helpers.parseAddress(toAddress, { config: sporeConfig.lumos });
      const { txHash, sporeId } = await mintDOB({
        rpcURL: nodeInfo.url, network,
        contentType: contentType.trim(),
        content: file.content,
        clusterId: meta.clusterId,
        toLock, fromAddress: address,
        feeRate: parseInt(meta.feeRate) || 1000,
        signer,
        onProgress: msg => setMintState(s => ({ ...s, progress: msg })),
      });
      setMintState({ status: 'success', progress: '', txHash, sporeId, error: '' });
    } catch (err) {
      console.error(err);
      setMintState({ status: 'error', progress: '', txHash: '', sporeId: '',
        error: err.message || String(err) });
    }
  }, [canMint, nodeInfo, file, contentType, meta, network, signer, address]);

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

// Outer shell: owns network state, wraps with Provider
export default function App() {
  const [network, setNetwork] = useState('testnet');
  return (
    <ccc.Provider>
      <AppInner network={network} setNetwork={setNetwork} />
    </ccc.Provider>
  );
}
