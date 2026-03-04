/**
 * CkbfsConfirmPanel — post-mint on-chain verifier + live viewer
 *
 * Shows after a successful CKBFS mint. Polls the tx every ~6s (CKB block time),
 * displays an animated progress bar, then resolves and renders the content
 * directly from the chain once confirmed.
 */
import React, { useEffect, useState, useRef } from 'react';
import { resolveCKBFS } from '../lib/ckbfs-resolver';

// How many blocks we expect to wait (for progress bar UX — actual confirmation is polled)
const EXPECTED_BLOCKS = 5;
const POLL_INTERVAL_MS = 6000; // ~1 CKB block

const RPC = {
  mainnet: 'https://mainnet.ckbapp.dev',
  testnet: 'https://testnet.ckbapp.dev',
};

async function getTxStatus(txHash, network) {
  const res = await fetch(RPC[network] || RPC.testnet, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'get_transaction', params: [txHash] }),
  });
  const data = await res.json();
  return data?.result?.tx_status?.status; // 'pending' | 'proposed' | 'committed' | 'rejected'
}

export function CkbfsConfirmPanel({ txHash, typeId, network = 'mainnet' }) {
  const [phase, setPhase]       = useState('confirming'); // confirming | resolving | done | error
  const [blocksWaited, setBlocksWaited] = useState(0);
  const [txStatus, setTxStatus] = useState('pending');
  const [content, setContent]   = useState(null); // { fileBytes, contentType, filename }
  const [errMsg, setErrMsg]     = useState('');
  const [resolveStep, setResolveStep] = useState('');
  const pollRef = useRef(null);
  const startRef = useRef(Date.now());

  const explorerBase = network === 'mainnet'
    ? 'https://explorer.nervos.org/transaction'
    : 'https://pudge.explorer.nervos.org/transaction';

  // ── Poll for confirmation ──────────────────────────────────────
  useEffect(() => {
    if (!txHash) return;

    const poll = async () => {
      const elapsed = Math.floor((Date.now() - startRef.current) / POLL_INTERVAL_MS);
      setBlocksWaited(Math.min(elapsed, EXPECTED_BLOCKS - 1));

      try {
        const status = await getTxStatus(txHash, network);
        setTxStatus(status);

        if (status === 'committed') {
          clearInterval(pollRef.current);
          setBlocksWaited(EXPECTED_BLOCKS);
          setPhase('resolving');
          resolveContent();
        } else if (status === 'rejected') {
          clearInterval(pollRef.current);
          setPhase('error');
          setErrMsg('Transaction rejected by the network.');
        }
      } catch (e) {
        // Network hiccup — keep polling
      }
    };

    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    poll(); // immediate first check

    return () => clearInterval(pollRef.current);
  }, [txHash, network]);

  // ── Resolve content from chain ─────────────────────────────────
  const resolveContent = async () => {
    if (!typeId) {
      setPhase('done');
      return;
    }
    try {
      const result = await resolveCKBFS(typeId, network, (msg) => setResolveStep(msg));
      setContent(result);
      setPhase('done');
    } catch (e) {
      setPhase('error');
      setErrMsg('Content resolved — but preview failed: ' + e.message);
    }
  };

  // ── Progress bar ───────────────────────────────────────────────
  const progressPct = phase === 'done' ? 100
    : phase === 'resolving' ? 95
    : Math.round((blocksWaited / EXPECTED_BLOCKS) * 90);

  const statusLabel = {
    pending:   'In mempool…',
    proposed:  'Proposed — almost there…',
    committed: 'Confirmed ✓',
    rejected:  'Rejected ✗',
  }[txStatus] || 'Checking…';

  // ── Render content preview ─────────────────────────────────────
  function renderPreview() {
    if (!content) return null;
    const { fileBytes, contentType, filename } = content;

    if (contentType.startsWith('image/')) {
      let binary = '';
      for (let i = 0; i < fileBytes.length; i++) binary += String.fromCharCode(fileBytes[i]);
      const dataUrl = `data:${contentType};base64,${btoa(binary)}`;
      return (
        <div className="ckbfs-preview-img">
          <img src={dataUrl} alt={filename || 'on-chain content'} />
          <div className="ckbfs-preview-caption">
            Fetched directly from CKB chain · {(fileBytes.length / 1024).toFixed(1)} KB
          </div>
        </div>
      );
    }

    if (contentType.startsWith('text/') || contentType === 'application/json') {
      const text = new TextDecoder().decode(fileBytes);
      return (
        <pre className="ckbfs-preview-text">
          {text.slice(0, 2000)}{text.length > 2000 ? '\n…truncated' : ''}
        </pre>
      );
    }

    return (
      <div className="ckbfs-preview-blob">
        <span>📦 {filename || 'file'} · {(fileBytes.length / 1024).toFixed(1)} KB</span>
        <a
          href={URL.createObjectURL(new Blob([fileBytes], { type: contentType }))}
          download={filename || 'ckbfs-content'}
          className="btn-ghost"
        >
          Download ↓
        </a>
      </div>
    );
  }

  return (
    <div className="card ckbfs-confirm-panel">
      <div className="card-title">
        {phase === 'done' ? '✅ On-chain verified' : phase === 'error' ? '❌ Error' : '🔗 Verifying on-chain…'}
      </div>

      {/* Progress bar */}
      {phase !== 'done' && phase !== 'error' && (
        <div className="ckbfs-progress-wrap">
          <div className="ckbfs-progress-header">
            <span className="ckbfs-status-label">
              {phase === 'resolving' ? `Fetching from chain… ${resolveStep}` : statusLabel}
            </span>
            <span className="ckbfs-progress-pct">{progressPct}%</span>
          </div>
          <div className="ckbfs-progress-track">
            <div
              className="ckbfs-progress-fill"
              style={{
                width: `${progressPct}%`,
                transition: progressPct > 0 ? 'width 1s ease' : 'none',
              }}
            />
          </div>
          <div className="ckbfs-progress-sub">
            ~{Math.max(0, EXPECTED_BLOCKS - blocksWaited) * 6}s remaining · CKB block time ~6s
          </div>
        </div>
      )}

      {/* Tx link */}
      <div className="ckbfs-meta-row">
        <span className="ckbfs-meta-label">Tx</span>
        <a href={`${explorerBase}/${txHash}`} target="_blank" rel="noreferrer" className="ckbfs-meta-val mono">
          {txHash?.slice(0, 20)}…{txHash?.slice(-8)} ↗
        </a>
      </div>

      {typeId && (
        <div className="ckbfs-meta-row">
          <span className="ckbfs-meta-label">TypeID</span>
          <code className="ckbfs-meta-val mono">{typeId?.slice(0, 20)}…{typeId?.slice(-8)}</code>
        </div>
      )}

      {/* Error */}
      {phase === 'error' && (
        <div className="status-error" style={{ marginTop: '0.75rem' }}>{errMsg}</div>
      )}

      {/* Content preview — appears once resolved */}
      {phase === 'done' && content && (
        <div className="ckbfs-preview-wrap">
          <div className="ckbfs-preview-label">Content fetched from CKB chain:</div>
          {renderPreview()}
        </div>
      )}

      {phase === 'done' && !content && typeId && (
        <div className="ckbfs-preview-label" style={{ color: 'var(--muted)', marginTop: '0.5rem' }}>
          Confirmed on-chain. Open the <a href="/ckbfs-viewer.html" target="_blank">CKBFS Viewer</a> to inspect.
        </div>
      )}
    </div>
  );
}
