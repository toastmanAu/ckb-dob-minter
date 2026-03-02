/**
 * MetaPanel — all user-editable DOB metadata fields
 * Every field is exposed. Nothing is locked away.
 */
export function MetaPanel({ meta, onChange }) {
  const set = (key, val) => onChange({ ...meta, [key]: val });

  return (
    <div className="card">
      <div className="card-step">Step 3</div>
      <div className="card-title">DOB Metadata</div>

      <div className="fields">

        {/* Recipient address */}
        <div className="field-group">
          <label className="field-label">
            Recipient Address
            <span className="field-hint">leave blank to mint to your own wallet</span>
          </label>
          <input
            type="text" className="input"
            value={meta.recipient}
            onChange={e => set('recipient', e.target.value)}
            placeholder="ckb1q... (leave blank = your address)"
          />
        </div>

        {/* Cluster / Collection ID */}
        <div className="field-group">
          <label className="field-label">
            Cluster ID (Collection)
            <span className="field-hint">optional — links DOB to a collection</span>
          </label>
          <input
            type="text" className="input"
            value={meta.clusterId}
            onChange={e => set('clusterId', e.target.value)}
            placeholder="0x... (leave blank for standalone DOB)"
          />
        </div>

        {/* Extra capacity */}
        <div className="field-group">
          <label className="field-label">
            Extra CKB to lock in DOB
            <span className="field-hint">adds value beyond storage cost — redeemable when melted</span>
          </label>
          <div className="input-with-unit">
            <input
              type="number" className="input"
              value={meta.extraCKB}
              min="0" step="1"
              onChange={e => set('extraCKB', e.target.value)}
              placeholder="0"
            />
            <span className="input-unit">CKB</span>
          </div>
        </div>

        {/* Tx fee rate */}
        <div className="field-group">
          <label className="field-label">
            Fee Rate
            <span className="field-hint">shannons per KB — higher = faster confirmation</span>
          </label>
          <div className="input-with-unit">
            <input
              type="number" className="input"
              value={meta.feeRate}
              min="1000" step="100"
              onChange={e => set('feeRate', e.target.value)}
              placeholder="1000"
            />
            <span className="input-unit">shannons/KB</span>
          </div>
        </div>

        {/* Immortal toggle */}
        <div className="field-group field-group-row">
          <label className="field-label" style={{ marginBottom: 0 }}>
            Immortal (cannot be melted)
            <span className="field-hint">removes the ability to reclaim CKB — permanent</span>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={meta.immortal}
              onChange={e => set('immortal', e.target.checked)}
            />
            <span className="toggle-track" />
          </label>
        </div>

        {/* Advanced: raw args */}
        <details className="advanced-section">
          <summary className="advanced-toggle">Advanced</summary>
          <div className="advanced-body">

            <div className="field-group">
              <label className="field-label">
                Spore Type Args override
                <span className="field-hint">hex — leave blank for auto-generated Spore ID</span>
              </label>
              <input
                type="text" className="input font-mono"
                value={meta.sporeArgs}
                onChange={e => set('sporeArgs', e.target.value)}
                placeholder="0x... (auto)"
              />
            </div>

            <div className="field-group">
              <label className="field-label">
                Additional witness data
                <span className="field-hint">hex — appended to WitnessArgs.inputType</span>
              </label>
              <input
                type="text" className="input font-mono"
                value={meta.witnessExtra}
                onChange={e => set('witnessExtra', e.target.value)}
                placeholder="0x (none)"
              />
            </div>

            <div className="field-group">
              <label className="field-label">
                CKB Indexer URL override
                <span className="field-hint">if your indexer runs on a different port than the RPC</span>
              </label>
              <input
                type="text" className="input"
                value={meta.indexerURL}
                onChange={e => set('indexerURL', e.target.value)}
                placeholder="http://localhost:8116 (leave blank = same as RPC)"
              />
            </div>

          </div>
        </details>

      </div>
    </div>
  );
}

export const DEFAULT_META = {
  recipient:    '',
  clusterId:    '',
  extraCKB:     '0',
  feeRate:      '1000',
  immortal:     false,
  sporeArgs:    '',
  witnessExtra: '',
  indexerURL:   '',
};
