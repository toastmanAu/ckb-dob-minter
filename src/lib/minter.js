/**
 * lib/minter.js — DOB minting via @ckb-ccc/spore
 *
 * Uses CCC-native Spore SDK — no Lumos fromInfos, works with JoyID and any lock type.
 */
import { spore } from '@ckb-ccc/spore';

export const BASE_OVERHEAD_BYTES = 96;

export function estimateCost(contentBytes) {
  return BASE_OVERHEAD_BYTES + contentBytes;
}

/**
 * mintDOB
 *
 * @param {object} p
 *   p.signer       {ccc.Signer}   CKB-CCC signer (from useCcc())
 *   p.contentType  {string}       MIME type
 *   p.content      {Uint8Array}   file bytes
 *   p.clusterId    {string?}      hex cluster ID
 *   p.toLock       {ccc.ScriptLike?} recipient lock (defaults to signer's lock)
 *   p.onProgress   {fn?}          (msg) => void
 *
 * @returns {{ txHash: string, sporeId: string }}
 */
export async function mintDOB(p) {
  const log = p.onProgress || (() => {});

  log('Building Spore transaction…');

  const data = {
    contentType: p.contentType,
    content:     p.content,
    ...(p.clusterId?.trim() ? { clusterId: p.clusterId.trim() } : {}),
  };

  const params = {
    signer: p.signer,
    data,
    ...(p.toLock ? { to: p.toLock } : {}),
  };

  const { tx, id } = await spore.createSpore(params);

  log('Signing & broadcasting…');

  const txHash = await p.signer.sendTransaction(tx);

  return { txHash, sporeId: id };
}
