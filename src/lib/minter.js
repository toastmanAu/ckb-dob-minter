/**
 * lib/minter.js — DOB minting via @ckb-ccc/spore
 *
 * Key learnings from testnet debugging (2026-03-03):
 * 1. `to` must be a Script object, not an Address object
 * 2. clusterMode: 'clusterCell' is required when using a cluster
 * 3. Molecule encoding roughly doubles the content byte size — use 2.2x
 * 4. completeFeeBy must be called after createSpore/createSporeCluster
 */
import { spore as sporeLib } from '@ckb-ccc/spore';
import { uploadToProvider } from './storage/index.js';

export const MOLECULE_MULTIPLIER = 2.2;
export const FIXED_OVERHEAD_CKB  = 300;

export function estimateCostCKB(contentBytes) {
  return Math.ceil(contentBytes * MOLECULE_MULTIPLIER / 100) + FIXED_OVERHEAD_CKB;
}

/**
 * Create a cluster (collection) on-chain.
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
 * @param {object}     p.signer
 * @param {string}     p.contentType
 * @param {Uint8Array} p.content
 * @param {string}     [p.filename]
 * @param {string}     [p.clusterId]
 * @param {object}     [p.toLock]       recipient lock Script
 * @param {string}     [p.storageMode]  'inline'|'ipfs'|'arweave'|'ckbfs'
 * @param {object}     [p.storageConfig] provider API keys etc
 * @param {function}   [p.onProgress]
 */
export async function mintDOB(p) {
  const log = p.onProgress || (() => {});

  let sporeContent     = p.content;
  let sporeContentType = p.contentType;

  // ── External storage upload ─────────────────────────────────────────────
  let ckbfsTypeId = null;
  if (p.storageMode && p.storageMode !== 'inline') {
    log(`Uploading to ${p.storageMode}…`);
    const result = await uploadToProvider({
      provider:    p.storageMode,
      content:     p.content,
      contentType: p.contentType,
      filename:    p.filename,
      config:      p.storageConfig,
      onProgress:  (_pct, msg) => log(msg),
    });
    sporeContent     = new TextEncoder().encode(result.uri);
    sporeContentType = 'text/uri-list';
    log(`Stored at ${result.uri}`);
    // Capture CKBFS TypeID for post-mint viewer
    if (p.storageMode === 'ckbfs' && result.meta?.typeId) {
      ckbfsTypeId = result.meta.typeId;
    }
  }

  // ── Build Spore tx ──────────────────────────────────────────────────────
  log('Building Spore transaction…');
  const data = {
    contentType: sporeContentType,
    content:     sporeContent,
    ...(p.clusterId?.trim() ? { clusterId: p.clusterId.trim() } : {}),
  };
  const { tx, id } = await sporeLib.createSpore({
    signer: p.signer,
    data,
    ...(data.clusterId ? { clusterMode: 'clusterCell' } : {}),
    ...(p.toLock ? { to: p.toLock } : {}),
  });
  log('Completing fee…');
  await tx.completeFeeBy(p.signer, 1000n);
  log('Signing & broadcasting…');
  const txHash = await p.signer.sendTransaction(tx);
  return { txHash, sporeId: id, ckbfsTypeId };
}

/**
 * Mint multiple DOBs sequentially.
 */
export async function mintDOBs({ signer, files, clusterId, toLock, storageMode, storageConfig, onProgress }) {
  const log = onProgress || (() => {});
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    log(i, files.length, `Minting ${f.name} (${i + 1}/${files.length})…`);
    const result = await mintDOB({
      signer,
      contentType:   f.type,
      content:       f.content,
      filename:      f.name,
      clusterId,
      toLock,
      storageMode:   storageMode || 'inline',
      storageConfig,
      onProgress:    msg => log(i, files.length, msg),
    });
    results.push({ ...result, name: f.name });
    log(i + 1, files.length, `✅ ${f.name} minted`);
  }
  return results;
}
