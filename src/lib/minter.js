/**
 * lib/minter.js — DOB minting via @ckb-ccc/spore
 *
 * Key learnings from testnet debugging (2026-03-03):
 * 1. `to` must be a Script object, not an Address object
 * 2. clusterMode: 'clusterCell' is required when using a cluster —
 *    the cluster cell is spent+recreated in the same tx to prove ownership
 * 3. Molecule encoding roughly doubles the content byte size for CKB capacity
 *    estimation — use 2.2x multiplier for accuracy
 * 4. completeFeeBy must be called after createSpore/createSporeCluster
 */
import { spore as sporeLib } from '@ckb-ccc/spore';
import { ccc } from '@ckb-ccc/core';

// Molecule encoding overhead: content is double-encoded + type/cluster ID fields
// Real observed: 76KB image → 155KB on-chain. Use 2.2x + 300 CKB fixed overhead.
export const MOLECULE_MULTIPLIER = 2.2;
export const FIXED_OVERHEAD_CKB  = 300;

export function estimateCostCKB(contentBytes) {
  return Math.ceil(contentBytes * MOLECULE_MULTIPLIER / 100) + FIXED_OVERHEAD_CKB;
}

/**
 * Create a cluster (collection) on-chain.
 * Returns { clusterId, txHash }
 */
export async function createCluster({ signer, name, description, onProgress }) {
  const log = onProgress || (() => {});
  log('Building cluster transaction…');

  const { tx, id } = await sporeLib.createSporeCluster({
    signer,
    data: { name: name.trim(), description: (description || '').trim() },
  });

  log('Completing fee…');
  await tx.completeFeeBy(signer, 1000n);

  log('Signing & broadcasting…');
  const txHash = await signer.sendTransaction(tx);

  return { clusterId: id, txHash };
}

/**
 * Mint a single DOB.
 *
 * @param {object} p
 * @param {object} p.signer        — CCC signer
 * @param {string} p.contentType   — MIME type e.g. 'image/jpeg'
 * @param {Uint8Array} p.content   — raw file bytes
 * @param {string} [p.clusterId]   — 0x... cluster ID (omit for standalone)
 * @param {object} [p.toLock]      — recipient lock Script (omit = sender keeps)
 * @param {function} [p.onProgress] — (msg: string) => void
 */
export async function mintDOB(p) {
  const log = p.onProgress || (() => {});

  log('Building Spore transaction…');

  const data = {
    contentType: p.contentType,
    content: p.content,
    ...(p.clusterId?.trim() ? { clusterId: p.clusterId.trim() } : {}),
  };

  const sporeParams = {
    signer: p.signer,
    data,
    // clusterCell: spend+recreate cluster cell to prove ownership.
    // Required when clusterId is set — without it createSpore throws.
    ...(data.clusterId ? { clusterMode: 'clusterCell' } : {}),
    // toLock must be a Script object, not an Address
    ...(p.toLock ? { to: p.toLock } : {}),
  };

  const { tx, id } = await sporeLib.createSpore(sporeParams);

  log('Completing fee…');
  await tx.completeFeeBy(p.signer, 1000n);

  log('Signing & broadcasting…');
  const txHash = await p.signer.sendTransaction(tx);

  return { txHash, sporeId: id };
}

/**
 * Mint multiple DOBs sequentially into the same cluster (or standalone).
 * Calls onProgress(index, total, message) after each mint.
 * Returns array of { txHash, sporeId, name } — one per file.
 */
export async function mintDOBs({ signer, files, clusterId, toLock, onProgress }) {
  const log = onProgress || (() => {});
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    log(i, files.length, `Minting ${f.name} (${i + 1}/${files.length})…`);

    const result = await mintDOB({
      signer,
      contentType: f.type,
      content: f.content,
      clusterId,
      toLock,
      onProgress: msg => log(i, files.length, msg),
    });

    results.push({ ...result, name: f.name });
    log(i + 1, files.length, `✅ ${f.name} minted`);
  }

  return results;
}
