import { useState } from 'react';
import * as ccc from '@ckb-ccc/core';
import * as spore from '@ckb-ccc/spore';

export function BurnPanel({ signer, network }) {
  const [sporeId, setSporeId]     = useState('');
  const [status,  setStatus]      = useState('idle'); // idle | confirming | burning | done | error
  const [txHash,  setTxHash]      = useState('');
  const [error,   setError]       = useState('');
  const [ckbBack, setCkbBack]     = useState(null);

  const explorerBase = network === 'mainnet'
    ? 'https://explorer.nervos.org/transaction'
    : 'https://pudge.explorer.nervos.org/transaction';

  const reset = () => { setStatus('idle'); setTxHash(''); setError(''); setCkbBack(null); };

  const handleBurn = async () => {
    if (status === 'confirming') {
      // User confirmed — proceed
      await doBurn();
    } else {
      // Ask for confirmation first
      setStatus('confirming');
    }
  };

  const doBurn = async () => {
    if (!signer) { setError('Connect your wallet first.'); setStatus('error'); return; }
    const id = sporeId.trim();
    if (!id || !id.startsWith('0x') || id.length !== 66) {
      setError('Invalid Spore ID — must be 0x followed by 64 hex chars.');
      setStatus('error');
      return;
    }

    setStatus('burning');
    setError('');
    try {
      // Build melt transaction
      const { tx } = await spore.meltSpore({ signer, id });

      // Calculate how much CKB is being unlocked
      const inputCap  = tx.inputs.reduce((s, inp) => s + BigInt(inp.cellOutput?.capacity ?? 0), 0n);
      const outputCap = tx.outputs.reduce((s, o)  => s + BigInt(o.capacity ?? 0), 0n);
      const unlocked  = inputCap - outputCap;
      setCkbBack(Number(unlocked) / 1e8);

      const hash = await signer.sendTransaction(tx);
      setTxHash(hash);
      setStatus('done');
    } catch (e) {
      console.error('[BurnPanel]', e);
      setError(e.message || String(e));
      setStatus('error');
    }
  };

  return (
    <div className="card">
      <div className="card-title" style={{ color: '#ff4560' }}>🔥 Burn DOB</div>
      <p className="hint" style={{ marginBottom: '0.9rem' }}>
        Permanently destroy a Spore DOB. The locked CKB is returned to your wallet.
      </p>

      {status !== 'done' && (
        <>
          <input
            type="text"
            className="input font-mono"
            placeholder="Spore ID (0x…64 hex chars)"
            value={sporeId}
            onChange={e => { setSporeId(e.target.value); reset(); }}
            style={{ marginBottom: '0.75rem', width: '100%' }}
          />

          {status === 'confirming' && (
            <div style={{
              background: 'rgba(255,69,96,0.08)',
              border: '1px solid rgba(255,69,96,0.35)',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              marginBottom: '0.75rem',
              fontSize: '0.84rem',
              color: '#ff4560',
            }}>
              <strong>⚠️ This is permanent and irreversible.</strong><br />
              The DOB will be destroyed forever. The CKB locked in the cell will be returned to your wallet.
              <br /><br />
              Spore ID: <code style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{sporeId}</code>
            </div>
          )}

          {status === 'error' && error && (
            <div className="error-msg" style={{ marginBottom: '0.75rem' }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {status === 'confirming' ? (
              <>
                <button
                  className="btn-primary"
                  style={{ background: '#ff4560', borderColor: '#ff4560' }}
                  onClick={doBurn}
                  disabled={!signer}
                >
                  Confirm Burn
                </button>
                <button className="btn-ghost" onClick={reset}>Cancel</button>
              </>
            ) : (
              <button
                className="btn-primary"
                style={{ background: 'rgba(255,69,96,0.15)', border: '1px solid rgba(255,69,96,0.5)', color: '#ff4560' }}
                onClick={handleBurn}
                disabled={!signer || !sporeId.trim()}
              >
                🔥 Burn DOB
              </button>
            )}
          </div>

          {!signer && (
            <p className="hint" style={{ marginTop: '0.5rem' }}>Connect your wallet above to burn.</p>
          )}
        </>
      )}

      {status === 'done' && (
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
            TX: <a href={`${explorerBase}/${txHash}`} target="_blank" rel="noreferrer"
              style={{ color: '#00c8ff', fontFamily: 'monospace' }}>
              {txHash.slice(0,12)}…{txHash.slice(-8)} ↗
            </a>
          </div>
          <button className="btn-ghost" style={{ marginTop: '0.75rem', fontSize: '0.82rem' }}
            onClick={() => { reset(); setSporeId(''); }}>
            Burn another
          </button>
        </div>
      )}

      {status === 'burning' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#ff4560', fontSize: '0.85rem' }}>
          <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2, borderTopColor: '#ff4560' }} />
          Burning… waiting for JoyID signature
        </div>
      )}
    </div>
  );
}
