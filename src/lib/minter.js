/**
 * lib/minter.js — DOB minting via @ckb-ccc/spore
 */
import { spore } from '@ckb-ccc/spore';

export const BASE_OVERHEAD_BYTES = 96;
export function estimateCost(contentBytes) { return BASE_OVERHEAD_BYTES + contentBytes; }

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

  // completeFeeBy collects more inputs if needed to cover outputs + fee
  await tx.completeFeeBy(p.signer, 1000n);

  log('Signing & broadcasting…');

  const txHash = await p.signer.sendTransaction(tx);

  return { txHash, sporeId: id };
}
