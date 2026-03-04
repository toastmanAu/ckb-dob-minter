export function WalletPanel({ signer, address, onDisconnect, onOpen }) {
  if (signer && address) {
    return (
      <div className="card">
        <div className="card-step">Step 4</div>
        <div className="card-title">Wallet</div>
        <div className="wallet-connected">
          <span className="wallet-badge"><span className="badge-dot" />Connected</span>
          <code className="wallet-address" title={address}>{address ? `${address.slice(0,12)}…${address.slice(-8)}` : ""}</code>
          <button className="btn-ghost btn-sm" onClick={onDisconnect}>Disconnect</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-step">Step 4</div>
      <div className="card-title">Wallet</div>
      <p className="hint" style={{ marginBottom: '0.8rem' }}>
        Sign the mint transaction with JoyID (passkey — no seed phrase) or MetaMask.
      </p>
      <button className="btn-primary btn-wallet" onClick={onOpen}>
        Connect Wallet
      </button>
    </div>
  );
}
