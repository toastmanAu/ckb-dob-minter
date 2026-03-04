import { useState, useEffect, useRef } from 'react';
import * as spore from '@ckb-ccc/spore';

const CONFIRM_WORD = 'BURN';
const COUNTDOWN_SECS = 5;

export function BurnPanel({ signer, network }) {
  const [sporeId,    setSporeId]    = useState('');
  const [status,     setStatus]     = useState('idle'); // idle | confirming | burning | done | error
  const [txHash,     setTxHash]     = useState('');
  const [error,      setError]      = useState('');
  const [ckbBack,    setCkbBack]    = useState(null);
  const [typed,      setTyped]      = useState('');
  const [countdown,  setCountdown]  = useState(COUNTDOWN_SECS);
  const timerRef = useRef(null);

  const explorerBase = network === 'mainnet'
    ? 'https://explorer.nervos.org/transaction'
    : 'https://pudge.explorer.nervos.org/transaction';

  const reset = () => {
    setStatus('idle'); setTxHash(''); setError('');
    setCkbBack(null); setTyped(''); setCountdown(COUNTDOWN_SECS);
    clearInterval(timerRef.current);
  };

  // Start countdown when confirming screen appears
  useEffect(() => {
    if (status === 'confirming') {
      setCountdown(COUNTDOWN_SECS);
      timerRef.current = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) { clearInterval(timerRef.current); return 0; }
          return c - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [status]);

  const startConfirm = () => {
    if (!signer) { setError('Connect your wallet first.'); return; }
    const id = sporeId.trim();
    if (!id || !id.startsWith('0x') || id.length !== 66) {
      setError('Invalid Spore ID — must be 0x followed by 64 hex chars.');
      return;
    }
    setError('');
    setTyped('');
    setStatus('confirming');
  };

  const doBurn = async () => {
    if (typed !== CONFIRM_WORD) return;
    if (countdown > 0) return;

    setStatus('burning');
    setError('');
    try {
      const { tx } = await spore.meltSpore({ signer, id: sporeId.trim() });

      // CKB unlocked = spore cell capacity (inputs) minus any outputs
      const inputCap  = tx.inputs.reduce((s, inp) => s + BigInt(inp.cellOutput?.capacity ?? 0), 0n);
      const outputCap = tx.outputs.reduce((s, o)  => s + BigInt(o.capacity ?? 0), 0n);
      setCkbBack(Number(inputCap - outputCap) / 1e8);

      const hash = await signer.sendTransaction(tx);
      setTxHash(hash);
      setStatus('done');
    } catch (e) {
      console.error('[BurnPanel]', e);
      setError(e.message || String(e));
      setStatus('error');
    }
  };

  const canConfirm = typed === CONFIRM_WORD && countdown === 0;

  return (
    <div className="card">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <div className="card-title" style={{ color: '#ff4560', margin: 0 }}>🔥 Burn DOB</div>
        {network === 'mainnet' && (
          <span style={{
            fontSize: '0.7rem', background: 'rgba(255,69,96,0.15)',
            border: '1px solid rgba(255,69,96,0.4)', color: '#ff4560',
            borderRadius: '99px', padding: '0.1rem 0.5rem', fontWeight: 700,
          }}>MAINNET</span>
        )}
      </div>

      {/* Always-visible caution */}
      <div style={{
        background: 'rgba(255,69,96,0.06)',
        border: '1px solid rgba(255,69,96,0.25)',
        borderRadius: '10px',
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
        fontSize: '0.83rem',
        lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 700, color: '#ff4560', marginBottom: '0.3rem' }}>
          ☠️ Destruction is permanent and irreversible
        </div>
        <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#e2e8f0' }}>
          <li>The DOB will be gone from the chain forever</li>
          <li>No undo, no recovery, no support can help you</li>
          <li>The CKB locked in the cell <em>will</em> be returned to your wallet</li>
          <li>CKBFS index cells are <strong>not</strong> recovered by burning the DOB</li>
        </ul>
      </div>

      {status === 'done' ? (
        <div style={{
          background: 'rgba(0,229,160,0.06)',
          border: '1px solid rgba(0,229,160,0.25)',
          borderRadius: '10px',
          padding: '1rem',
        }}>
          <div style={{ color: '#00e5a0', fontWeight: 700, marginBottom: '0.4rem' }}>✅ DOB burned</div>
          {ckbBack !== null && (
            <div style={{ fontSize: '0.85rem', color: '#e2e8f0', marginBottom: '0.4rem' }}>
              ~{ckbBack.toFixed(2)} CKB returned to your wallet
            </div>
          )}
          <div style={{ fontSize: '0.78rem' }}>
            TX:{' '}
            <a href={`${explorerBase}/${txHash}`} target="_blank" rel="noreferrer"
              style={{ color: '#00c8ff', fontFamily: 'monospace' }}>
              {txHash.slice(0,12)}…{txHash.slice(-8)} ↗
            </a>
          </div>
          <button className="btn-ghost" style={{ marginTop: '0.75rem', fontSize: '0.82rem' }}
            onClick={() => { reset(); setSporeId(''); }}>
            Burn another
          </button>
        </div>

      ) : status === 'burning' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#ff4560', fontSize: '0.85rem', padding: '0.5rem 0' }}>
          <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2, borderTopColor: '#ff4560' }} />
          Burning… waiting for wallet signature
        </div>

      ) : status === 'confirming' ? (
        <>
          {/* Show the ID being burned */}
          <div style={{
            background: '#0a0c0f', border: '1px solid rgba(255,69,96,0.3)',
            borderRadius: '8px', padding: '0.6rem 0.8rem', marginBottom: '1rem',
            fontSize: '0.75rem', fontFamily: 'monospace', wordBreak: 'break-all', color: '#ff8c42',
          }}>
            {sporeId}
          </div>

          {/* Type to confirm */}
          <p style={{ fontSize: '0.84rem', color: '#e2e8f0', marginBottom: '0.4rem' }}>
            Type <strong style={{ color: '#ff4560' }}>{CONFIRM_WORD}</strong> to confirm:
          </p>
          <input
            type="text"
            className="input"
            placeholder={CONFIRM_WORD}
            value={typed}
            onChange={e => setTyped(e.target.value.toUpperCase())}
            autoFocus
            style={{
              marginBottom: '0.75rem', width: '100%',
              borderColor: typed === CONFIRM_WORD ? '#ff4560' : undefined,
              color: typed === CONFIRM_WORD ? '#ff4560' : undefined,
              fontWeight: typed === CONFIRM_WORD ? 700 : undefined,
            }}
          />

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={doBurn}
              disabled={!canConfirm}
              style={{
                background: canConfirm ? '#ff4560' : 'rgba(255,69,96,0.15)',
                border: '1px solid rgba(255,69,96,0.5)',
                color: canConfirm ? '#fff' : 'rgba(255,69,96,0.5)',
                fontWeight: 700, fontSize: '0.88rem',
                padding: '0.55rem 1.2rem', borderRadius: '8px',
                cursor: canConfirm ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                minWidth: '140px',
              }}
            >
              {countdown > 0
                ? `Wait ${countdown}s…`
                : typed !== CONFIRM_WORD
                  ? `Type ${CONFIRM_WORD}`
                  : '🔥 Confirm Burn'}
            </button>
            <button className="btn-ghost" onClick={reset}>Cancel</button>
          </div>

          {error && (
            <div className="error-msg" style={{ marginTop: '0.75rem' }}>{error}</div>
          )}
        </>

      ) : (
        <>
          <input
            type="text"
            className="input font-mono"
            placeholder="Spore ID (0x…64 hex chars)"
            value={sporeId}
            onChange={e => { setSporeId(e.target.value); setError(''); }}
            style={{ marginBottom: '0.75rem', width: '100%' }}
          />

          {error && (
            <div className="error-msg" style={{ marginBottom: '0.75rem' }}>{error}</div>
          )}

          <button
            onClick={startConfirm}
            disabled={!signer || !sporeId.trim()}
            style={{
              background: 'rgba(255,69,96,0.12)',
              border: '1px solid rgba(255,69,96,0.4)',
              color: '#ff4560', fontWeight: 600,
              fontSize: '0.88rem', padding: '0.55rem 1.2rem',
              borderRadius: '8px',
              cursor: (!signer || !sporeId.trim()) ? 'not-allowed' : 'pointer',
              opacity: (!signer || !sporeId.trim()) ? 0.5 : 1,
            }}
          >
            🔥 Burn DOB…
          </button>

          {!signer && (
            <p className="hint" style={{ marginTop: '0.5rem' }}>Connect your wallet above to burn.</p>
          )}
        </>
      )}
    </div>
  );
}
