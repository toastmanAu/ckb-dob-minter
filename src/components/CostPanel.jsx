/**
 * CostPanel — live cost calculator
 * Updates instantly as files, storage mode, cluster, network change.
 *
 * Storage modes:
 *   'inline'  — full content embedded in Spore cell (molecule encoding ~2.2x)
 *   'ckbfs'   — content in witnesses, Spore stores ckbfs:// URI (~100 bytes)
 *   'ipfs'    — content on IPFS, Spore stores ipfs:// URI (~100 bytes)
 *   'arweave' — content on Arweave, Spore stores ar:// URI (~100 bytes)
 */
import React, { useMemo } from 'react';
import { MOLECULE_MULTIPLIER, FIXED_OVERHEAD_CKB, estimateCostCKB } from '../lib/minter.js';

// External storage: only the URI is stored in the Spore cell (~100 bytes)
const URI_BYTES = 100;

// Approx upload costs for external providers (USD per MB)
const UPLOAD_COST_USD = {
  ckbfs:   null,   // CKB-based, denominated in CKB — calculated separately
  ipfs:    0,      // Pinata free tier 1GB, then ~$0.15/GB
  arweave: 0.012,  // Irys ~$0.012/MB (varies with AR price)
};

// CKB/USD approximate (live price would be better but we use a static estimate)
const CKB_USD = 0.005;

function bytesLabel(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

export function CostPanel({ files, storageMode = 'inline', cluster, network, ckbPrice }) {
  const pricePerCKB = ckbPrice || CKB_USD;

  const breakdown = useMemo(() => {
    if (!files || files.length === 0) return null;

    const totalRawBytes = files.reduce((s, f) => s + f.size, 0);

    // Per-DOB Spore cell CKB cost
    let ckbPerDOB;
    if (storageMode === 'inline') {
      // Molecule encoding doubles content + fixed overhead
      ckbPerDOB = Math.ceil(totalRawBytes * MOLECULE_MULTIPLIER / files.length / 100) + FIXED_OVERHEAD_CKB;
    } else {
      // Only the URI is stored in the Spore cell
      ckbPerDOB = estimateCostCKB(URI_BYTES);
    }

    // Cluster creation cost (one-time, ~300 CKB for metadata)
    const clusterCKB = cluster && !cluster.id ? 300 : 0;

    // Total CKB
    const totalCKB = ckbPerDOB * files.length + clusterCKB;
    const totalUSD = totalCKB * pricePerCKB;

    // Upload cost (external providers)
    let uploadCostUSD = 0;
    let uploadNote = '';
    if (storageMode === 'ckbfs') {
      uploadNote = 'CKBFS upload cost varies (CKB capacity)';
    } else if (storageMode === 'ipfs') {
      uploadNote = 'Free via Pinata (up to 1 GB)';
    } else if (storageMode === 'arweave') {
      const mb = totalRawBytes / 1024 / 1024;
      uploadCostUSD = mb * UPLOAD_COST_USD.arweave;
      uploadNote = `~$${uploadCostUSD.toFixed(3)} USD via Irys`;
    }

    // Savings vs inline (if external selected)
    let savingsCKB = 0;
    if (storageMode !== 'inline') {
      const inlineCost = files.reduce((s, f) => s + estimateCostCKB(f.size), 0) + clusterCKB;
      savingsCKB = inlineCost - totalCKB;
    }

    return {
      files: files.length,
      totalRawBytes,
      ckbPerDOB,
      clusterCKB,
      totalCKB,
      totalUSD,
      uploadCostUSD,
      uploadNote,
      savingsCKB,
      storageMode,
    };
  }, [files, storageMode, cluster, pricePerCKB]);

  if (!breakdown) {
    return (
      <div className="card cost-panel cost-panel-empty">
        <div className="card-step">Cost</div>
        <div className="card-title">Estimated Cost</div>
        <p className="cost-hint">Add files to see cost estimate.</p>
      </div>
    );
  }

  const { files: nFiles, totalRawBytes, ckbPerDOB, clusterCKB,
          totalCKB, totalUSD, uploadCostUSD, uploadNote, savingsCKB } = breakdown;

  const isMainnet = network === 'mainnet';

  return (
    <div className="card cost-panel">
      <div className="card-step">Cost</div>
      <div className="card-title">Estimated Cost</div>

      {/* Big total */}
      <div className="cost-total">
        <span className="cost-ckb">{totalCKB.toLocaleString()} CKB</span>
        {isMainnet && (
          <span className="cost-usd">≈ ${totalUSD.toFixed(2)} USD</span>
        )}
        {!isMainnet && (
          <span className="cost-testnet">testnet — no real cost</span>
        )}
      </div>

      {/* Breakdown rows */}
      <div className="cost-rows">
        <CostRow label="Files" value={nFiles} />
        <CostRow label="Content size" value={bytesLabel(totalRawBytes)} />
        <CostRow label="Storage mode" value={storageModeLabel(storageMode)} accent />
        <CostRow label="CKB per DOB" value={`~${ckbPerDOB.toLocaleString()} CKB`} />
        {clusterCKB > 0 && (
          <CostRow label="New cluster" value={`+${clusterCKB} CKB (one-time)`} muted />
        )}
        {storageMode !== 'inline' && uploadNote && (
          <CostRow label="Upload cost" value={uploadNote} muted />
        )}
      </div>

      {/* Savings callout */}
      {savingsCKB > 500 && (
        <div className="cost-savings">
          💡 {storageMode !== 'inline' ? `Saves ~${savingsCKB.toLocaleString()} CKB vs inline storage` : ''}
        </div>
      )}

      {/* Note about CKB being locked, not spent */}
      <p className="cost-note">
        CKB is <strong>locked</strong> as storage deposit — not spent.
        Melt the DOB any time to reclaim it.
      </p>
    </div>
  );
}

function CostRow({ label, value, accent, muted }) {
  return (
    <div className={`cost-row${accent ? ' cost-row-accent' : ''}${muted ? ' cost-row-muted' : ''}`}>
      <span className="cost-label">{label}</span>
      <span className="cost-value">{value}</span>
    </div>
  );
}

function storageModeLabel(mode) {
  return {
    inline:  '⛓️ On-chain (inline)',
    ckbfs:   '🗄️ CKBFS',
    ipfs:    '📌 IPFS (Pinata)',
    arweave: '♾️ Arweave (Irys)',
  }[mode] || mode;
}
