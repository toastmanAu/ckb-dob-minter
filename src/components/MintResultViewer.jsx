/**
 * MintResultViewer — unified content viewer for all storage modes
 *
 * Handles: inline, ckbfs, ipfs, arweave
 * - inline:  content already in memory → render immediately
 * - ckbfs:   resolve from chain via typeId (already have CkbfsConfirmPanel logic)
 * - ipfs:    fetch via public gateway
 * - arweave: fetch via arweave.net gateway
 */
import React, { useEffect, useState, useRef } from 'react';
import { resolveCKBFS } from '../lib/ckbfs-resolver';

const RPC = {
  mainnet: 'https://mainnet.ckbapp.dev',
  testnet: 'https://testnet.ckbapp.dev',
};

const POLL_MS = 6000;

async function getTxStatus(txHash, network) {
  const res = await fetch(RPC[network] || RPC.mainnet, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'get_transaction', params: [txHash] }),
  });
  const d = await res.json();
  return d?.result?.tx_status?.status;
}

function ContentPreview({ fileBytes, contentType, filename, uri }) {
  if (!fileBytes && !uri) return null;

  if (fileBytes && contentType?.startsWith('image/')) {
    let binary = '';
    for (let i = 0; i < fileBytes.length; i++) binary += String.fromCharCode(fileBytes[i]);
    const dataUrl = `data:${contentType};base64,${btoa(binary)}`;
    return (
      <div className="viewer-preview">
        <img src={dataUrl} alt={filename || 'content'} style={{maxWidth:'100%',borderRadius:6}} />
        <div className="viewer-caption">
          {filename && <span>{filename} · </span>}
          {(fileBytes.length / 1024).toFixed(1)} KB
        </div>
      </div>
    );
  }

  if (fileBytes && (contentType?.startsWith('text/') || contentType === 'application/json')) {
    const text = new TextDecoder().decode(fileBytes);
    return (
      <pre className="viewer-text">{text.slice(0, 2000)}{text.length > 2000 ? '\n…truncated' : ''}</pre>
    );
  }

  // Fallback: show URI link
  if (uri) {
    return (
      <div className="viewer-uri">
        <a href={uri} target="_blank" rel="noreferrer" style={{color:'var(--accent)',wordBreak:'break-all'}}>
          {uri}
        </a>
      </div>
    );
  }

  return (
    <div className="viewer-caption" style={{color:'var(--muted)'}}>
      {contentType} · {filename || 'file'} · {fileBytes ? `${(fileBytes.length/1024).toFixed(1)} KB` : ''}
    </div>
  );
}

// ── Inline viewer — content already in memory ─────────────────────────────────
function InlineViewer({ content, contentType, filename }) {
  return (
    <div className="viewer-wrap viewer-inline">
      <div className="viewer-badge">⛓️ On-chain inline</div>
      <ContentPreview fileBytes={content} contentType={contentType} filename={filename} />
    </div>
  );
}

// ── CKBFS viewer — resolve from chain ─────────────────────────────────────────
function CkbfsViewer({ typeId, txHash, network }) {
  const [phase, setPhase]   = useState('waiting'); // waiting | resolving | done | error
  const [content, setContent] = useState(null);
  const [msg, setMsg]       = useState('Confirming on-chain…');
  const [pct, setPct]       = useState(0);
  const resolvedRef = useRef(false);
  const pollRef     = useRef(null);

  const resolve = async () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    if (!typeId) { setPhase('done'); return; }
    setPhase('resolving');
    setPct(90);

    const MAX_ATTEMPTS = 10;
    const RETRY_DELAY  = 4000;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        setMsg(attempt > 1 ? `Waiting for indexer… (${attempt}/${MAX_ATTEMPTS})` : 'Fetching from chain…');
        const result = await resolveCKBFS(typeId, network, m => setMsg(m));
        setContent(result);
        setPhase('done');
        setPct(100);
        return;
      } catch (e) {
        const isNotFound = e.message.includes('No CKBFS cell found');
        if (isNotFound && attempt < MAX_ATTEMPTS) {
          setPct(90 + attempt);
          await new Promise(r => setTimeout(r, RETRY_DELAY));
        } else {
          setPhase('error');
          setMsg('Failed to resolve: ' + e.message);
          return;
        }
      }
    }
  };

  useEffect(() => {
    if (!typeId) return;
    // If we don't have a txHash, assume already confirmed
    if (!txHash) { resolve(); return; }

    const poll = async () => {
      try {
        const status = await getTxStatus(txHash, network);
        if (status === 'committed') {
          clearInterval(pollRef.current);
          setPct(85);
          resolve();
        } else if (status === 'rejected') {
          clearInterval(pollRef.current);
          setPhase('error');
          setMsg('Transaction rejected');
        } else {
          setPct(p => Math.min(p + 15, 80));
          setMsg(`Waiting for confirmation… (${status || 'pending'})`);
        }
      } catch (_) {}
    };

    pollRef.current = setInterval(poll, POLL_MS);
    poll();
    return () => clearInterval(pollRef.current);
  }, [typeId, txHash, network]);

  return (
    <div className="viewer-wrap viewer-ckbfs">
      <div className="viewer-badge">🗄️ CKBFS on-chain</div>
      {phase !== 'done' && (
        <div style={{marginTop:'.5rem'}}>
          <div className="viewer-progress-bar">
            <div className="viewer-progress-fill" style={{width:`${pct}%`, background: phase==='error'?'var(--danger,#ff4560)':'var(--accent,#00c8ff)'}} />
          </div>
          <div className="viewer-caption" style={{color: phase==='error'?'var(--danger)':'var(--muted)'}}>{msg}</div>
        </div>
      )}
      {phase === 'done' && content && (
        <ContentPreview
          fileBytes={content.fileBytes}
          contentType={content.contentType}
          filename={content.filename}
        />
      )}
    </div>
  );
}

// ── IPFS viewer — fetch via gateway ───────────────────────────────────────────
function IpfsViewer({ uri }) {
  const [state, setState] = useState('loading');
  const [blobUrl, setBlobUrl] = useState(null);
  const [contentType, setContentType] = useState('');

  // Extract CID from ipfs:// or https://... URI
  const cid = uri?.replace('ipfs://', '').split('/')[0];
  const gatewayUrl = cid ? `https://cloudflare-ipfs.com/ipfs/${cid}` : uri;

  useEffect(() => {
    if (!gatewayUrl) return;
    fetch(gatewayUrl)
      .then(r => { setContentType(r.headers.get('content-type') || ''); return r.blob(); })
      .then(b => { setBlobUrl(URL.createObjectURL(b)); setState('done'); })
      .catch(() => setState('error'));
  }, [gatewayUrl]);

  return (
    <div className="viewer-wrap viewer-ipfs">
      <div className="viewer-badge">📌 IPFS</div>
      {state === 'loading' && <div className="viewer-caption" style={{color:'var(--muted)'}}>Fetching from IPFS gateway…</div>}
      {state === 'error'   && <div className="viewer-caption" style={{color:'var(--danger)'}}>Gateway fetch failed · <a href={gatewayUrl} target="_blank" rel="noreferrer" style={{color:'var(--accent)'}}>open directly</a></div>}
      {state === 'done' && blobUrl && (
        contentType.startsWith('image/')
          ? <div className="viewer-preview"><img src={blobUrl} alt="ipfs content" style={{maxWidth:'100%',borderRadius:6}} /></div>
          : <div className="viewer-uri"><a href={blobUrl} target="_blank" rel="noreferrer" style={{color:'var(--accent)'}}>Download file</a></div>
      )}
    </div>
  );
}

// ── Arweave viewer — fetch via arweave.net ────────────────────────────────────
function ArweaveViewer({ uri }) {
  const [state, setState] = useState('loading');
  const [blobUrl, setBlobUrl] = useState(null);
  const [contentType, setContentType] = useState('');

  const txId = uri?.replace('ar://', '');
  const gatewayUrl = txId ? `https://arweave.net/${txId}` : uri;

  useEffect(() => {
    if (!gatewayUrl) return;
    fetch(gatewayUrl)
      .then(r => { setContentType(r.headers.get('content-type') || ''); return r.blob(); })
      .then(b => { setBlobUrl(URL.createObjectURL(b)); setState('done'); })
      .catch(() => setState('error'));
  }, [gatewayUrl]);

  return (
    <div className="viewer-wrap viewer-arweave">
      <div className="viewer-badge">♾️ Arweave</div>
      {state === 'loading' && <div className="viewer-caption" style={{color:'var(--muted)'}}>Fetching from Arweave…</div>}
      {state === 'error'   && <div className="viewer-caption" style={{color:'var(--danger)'}}>Fetch failed · <a href={gatewayUrl} target="_blank" rel="noreferrer" style={{color:'var(--accent)'}}>open directly</a></div>}
      {state === 'done' && blobUrl && (
        contentType.startsWith('image/')
          ? <div className="viewer-preview"><img src={blobUrl} alt="arweave content" style={{maxWidth:'100%',borderRadius:6}} /></div>
          : <div className="viewer-uri"><a href={blobUrl} target="_blank" rel="noreferrer" style={{color:'var(--accent)'}}>Download file</a></div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function MintResultViewer({ result, storageMode: storageModeFromProp, network = 'mainnet' }) {
  if (!result) return null;

  // Use storageMode baked into result at mint time — prop may change after mint
  const storageMode = result.storageMode || storageModeFromProp;

  console.log('[MintResultViewer] result:', {
    storageMode,
    ckbfsTypeId: result.ckbfsTypeId,
    ckbfsTxHash: result.ckbfsTxHash,
    sporeUri:    result.sporeUri,
    hasInline:   !!result.inlineContent,
  });

  switch (storageMode) {
    case 'inline':
      return (
        <InlineViewer
          content={result.inlineContent}
          contentType={result.inlineContentType}
          filename={result.name}
        />
      );
    case 'ckbfs':
      if (!result.ckbfsTypeId) return null;
      return (
        <CkbfsViewer
          typeId={result.ckbfsTypeId}
          txHash={result.ckbfsTxHash}
          network={network}
        />
      );
    case 'ipfs':
      if (!result.sporeUri) return null;
      return <IpfsViewer uri={result.sporeUri} />;
    case 'arweave':
      if (!result.sporeUri) return null;
      return <ArweaveViewer uri={result.sporeUri} />;
    default:
      return null;
  }
}
