/**
 * lib/minter.js — DOB minting logic
 *
 * Wraps @spore-sdk/core createSpore.
 * All user-facing fields are explicit parameters — nothing is hidden.
 */

import { createSpore, predefinedSporeConfigs } from '@spore-sdk/core';

export const BASE_OVERHEAD_BYTES = 96; // spore cell base capacity (bytes = CKB)

/** Estimate CKB needed. Returns number (CKB, not shannons). */
export function estimateCost(contentBytes) {
  return BASE_OVERHEAD_BYTES + contentBytes;
}

/** Build Spore SDK config pointing at the user's node. */
export function buildSporeConfig(rpcURL, network = 'mainnet') {
  const base = network === 'testnet'
    ? predefinedSporeConfigs.Testnet
    : predefinedSporeConfigs.Mainnet;
  return {
    ...base,
    ckbNodeUrl:    rpcURL,
    ckbIndexerUrl: rpcURL, // CKB v0.100+ indexer is built into main RPC
  };
}

/**
 * mintDOB — build, sign, broadcast a Spore mint transaction.
 *
 * @param {object} p
 *   p.rpcURL       {string}      CKB node RPC URL
 *   p.network      {string}      'mainnet' | 'testnet'
 *   p.contentType  {string}      MIME type e.g. 'image/png'
 *   p.content      {Uint8Array}  file bytes
 *   p.clusterId    {string?}     hex cluster/collection ID (0x...)
 *   p.toLock       {object}      recipient lock script (from CKB-CCC address)
 *   p.fromAddress  {string}      sender CKB address (fees + capacity come from here)
 *   p.signer       {object}      CKB-CCC signer
 *   p.onProgress   {function?}   (msg: string) => void
 *
 * @returns {{ txHash: string, outputIndex: number }}
 */
export async function mintDOB(p) {
  const log = p.onProgress || (() => {});

  log('Building transaction…');

  const config   = buildSporeConfig(p.rpcURL, p.network);
  const sporeData = {
    contentType: p.contentType,
    content:     p.content,
    ...(p.clusterId?.trim() ? { clusterId: p.clusterId.trim() } : {}),
  };

  log('Signing with wallet…');

  const { txHash, outputIndex } = await createSpore({
    data:      sporeData,
    toLock:    p.toLock,
    fromInfos: [p.fromAddress],
    config,
    // CKB-CCC signer is Lumos-compatible via signTransaction
    signatureProvider: async tx => p.signer.signTransaction(tx),
  });

  log('Broadcasting…');
  return { txHash, outputIndex };
}
