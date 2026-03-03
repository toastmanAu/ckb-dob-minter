/**
 * lib/minter.js — DOB minting via @ckb-ccc/spore
 */
import { spore } from '@ckb-ccc/spore';

export const BASE_OVERHEAD_BYTES = 96;
export function estimateCost(contentBytes) { return BASE_OVERHEAD_BYTES + contentBytes; }

/**
 * Mint a single DOB.
 */
export async function mintDOB(p) {
  const log = p.onProgress || (() => {});

  log('Building Spore transaction…');

  const data = {
    contentType: p.contentType,
    content:     p.content,
    ...(p.clusterId?.trim() ? { clusterId: p.clusterId.trim() } : {}),
  };

  const { tx, id } = await spore.createSpore({
    signer: p.signer,
    data,
    ...(p.toLock ? { to: p.toLock } : {}),
  });

  log('Balancing fee…');
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
export async function mintDOBs({ signer, files, clusterId, onProgress }) {
  const log = onProgress || (() => {});
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    log(i, files.length, `Minting ${f.name} (${i + 1}/${files.length})…`);

    const result = await mintDOB({
      signer,
      contentType: f.type,
      content:     f.content,
      clusterId,
      onProgress:  msg => log(i, files.length, msg),
    });

    results.push({ ...result, name: f.name });
    log(i + 1, files.length, `✅ ${f.name} minted`);
  }

  return results;
}
