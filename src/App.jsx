/**
 * App.jsx — root component
 *
 * Owns all state. Child components are pure UI — they receive
 * props and fire callbacks. No hidden state anywhere.
 */
import { useState, useEffect, useCallback } from 'react';
import { useCcc } from '@ckb-ccc/connector-react';

import { NodePanel }   from './components/NodePanel.jsx';
import { FilePanel }   from './components/FilePanel.jsx';
import { MetaPanel, DEFAULT_META } from './components/MetaPanel.jsx';
import { WalletPanel } from './components/WalletPanel.jsx';
import { MintPanel }   from './components/MintPanel.jsx';
import { useNodeFinder } from './hooks/useNodeFinder.js';
import { useFileInput }  from './hooks/useFileInput.js';
import { mintDOB, buildSporeConfig } from './lib/minter.js';

const EXPLORER = {
  mainnet: 'https://explorer.nervos.org',
  testnet: 'https://pudge.explorer.nervos.org',
};

export default function App() {
  const [network, setNetwork] = useState('mainnet');
  const [meta,    setMeta]    = useState(DEFAULT_META);
  const [contentType, setContentType] = useState('');
  const [mintState, setMintState] = useState({
    status: 'idle', // idle | minting | success | error
    progress: '',
    txHash: '',
    sporeId: '',
    error: '',
  });

  // CKB-CCC wallet
  const { signer } = useCcc();
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (!signer) { setAddress(''); return; }
    signer.getRecommendedAddress().then(setAddress).catch(() => setAddress(''));
  }, [signer]);

  // Node discovery
  const { status: nodeStatus, nodeInfo, error: nodeError, connectCustom, usePublic, forget } = useNodeFinder(network);

  // File input
  const { file, fileError, inputRef, onInputChange, onDrop, onDragOver, clearFile, openPicker } = useFileInput();

  // Sync content-type from file
  useEffect(() => {
    if (file) setContentType(file.type);
  }, [file]);

  // Can we mint?
  const reasons = [];
  if (!nodeInfo)   reasons.push('Connect a CKB node');
  if (!file)       reasons.push('Select a file to mint');
  if (!signer)     reasons.push('Connect your wallet');
  if (!contentType.trim()) reasons.push('Content-Type is required');
  const canMint = reasons.length === 0;

  const handleMint = useCallback(async () => {
    if (!canMint) return;
    setMintState({ status: 'minting', progress: 'Starting…', txHash: '', sporeId: '', error: '' });

    try {
      // Resolve recipient: custom address or signer's own address
      const fromAddress = address;
      const toAddress   = meta.recipient.trim() || address;

      // Resolve toLock from address string
      // @ckb-ccc/core Address.fromString gives us the lock script
      const { Address } = await import('@ckb-ccc/core');
      const sporeConfig = buildSporeConfig(
        meta.indexerURL.trim() || nodeInfo.url,
        network
      );
      const toLock = (await Address.fromString(toAddress, signer.client)).script;

      const { txHash, outputIndex } = await mintDOB({
        rpcURL:      nodeInfo.url,
        network,
        contentType: contentType.trim(),
        content:     file.content,
        clusterId:   meta.clusterId,
        toLock,
        fromAddress,
        signer,
        onProgress:  msg => setMintState(s => ({ ...s, progress: msg })),
      });

      const sporeId = `${txHash}:${outputIndex}`;
      setMintState({ status: 'success', progress: '', txHash, sporeId, error: '' });

    } catch (err) {
      console.error(err);
      setMintState({ status: 'error', progress: '', txHash: '', sporeId: '', error: err.message });
    }
  }, [canMint, nodeInfo, file, contentType, meta, network, signer, address]);

  return (
    <div className="app">
      {/* Header */}
      <header>
        <div className="header-inner">
          <div className="logo">CKB <span>DOB</span> Minter</div>
          <div className="network-toggle">
            {['mainnet', 'testnet'].map(n => (
              <button
                key={n}
                className={network === n ? 'active' : ''}
                onClick={() => setNetwork(n)}
                data-network={n}
              >{n}</button>
            ))}
          </div>
        </div>
      </header>

      <main>
        <NodePanel
          status={nodeStatus}
          nodeInfo={nodeInfo}
          error={nodeError}
          onCustom={connectCustom}
          onPublic={usePublic}
          onForget={forget}
        />

        <FilePanel
          file={file}
          fileError={fileError}
          inputRef={inputRef}
          onInputChange={onInputChange}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onClear={clearFile}
          onOpen={openPicker}
          contentType={contentType}
          onContentTypeChange={setContentType}
        />

        <MetaPanel meta={meta} onChange={setMeta} />

        <WalletPanel
          signer={signer}
          address={address}
          onDisconnect={() => signer?.disconnect?.()}
        />

        <MintPanel
          canMint={canMint}
          reasons={reasons}
          file={file}
          meta={meta}
          nodeInfo={nodeInfo}
          network={network}
          mintState={mintState}
          onMint={handleMint}
        />

        {/* Explainer */}
        <div className="card explainer-card">
          <div className="explainer">
            {[
              ['⛓️', 'Fully on-chain', 'Content lives inside the CKB cell — no IPFS, no URLs that can break.'],
              ['💎', 'Intrinsic value', 'Backed by real CKB. Burn the DOB any time to reclaim the storage deposit.'],
              ['🔒', 'Immutable', 'Once minted, content cannot be changed. Permanent by design.'],
              ['🌐', 'Your node', 'Transactions go through your own CKB node. No third-party dependency.'],
            ].map(([icon, title, desc]) => (
              <div key={title} className="explainer-item">
                <span className="explainer-icon">{icon}</span>
                <div>
                  <h4>{title}</h4>
                  <p>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
