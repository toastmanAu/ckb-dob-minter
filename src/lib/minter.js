/**
 * lib/minter.js — DOB minting logic
 *
 * Wraps @spore-sdk/core createSpore.
 * spore-sdk 0.2.x returns a txSkeleton — we sign + send separately via CKB-CCC.
 */

import { createSpore, predefinedSporeConfigs } from '@spore-sdk/core';
import { Transaction } from '@ckb-ccc/core';
import { helpers, RPC }  from '@ckb-lumos/lumos';
import { common }        from '@ckb-lumos/lumos/common-scripts';
import { initializeConfig } from '@ckb-lumos/lumos/config';

export const BASE_OVERHEAD_BYTES = 96;

export function estimateCost(contentBytes) {
  return BASE_OVERHEAD_BYTES + contentBytes;
}

export function buildSporeConfig(rpcURL, network = 'mainnet') {
  const base = network === 'testnet'
    ? predefinedSporeConfigs.Testnet
    : predefinedSporeConfigs.Mainnet;
  return {
    ...base,
    ckbNodeUrl:    rpcURL,
    ckbIndexerUrl: rpcURL,
  };
}

/**
 * mintDOB
 *
 * @param {object} p
 *   p.rpcURL       {string}      CKB RPC URL
 *   p.network      {string}      'mainnet' | 'testnet'
 *   p.contentType  {string}      MIME type
 *   p.content      {Uint8Array}  file bytes
 *   p.clusterId    {string?}     hex cluster ID
 *   p.toLock       {Script}      recipient lock script (Lumos Script object)
 *   p.fromAddress  {string}      sender CKB address
 *   p.feeRate      {number}      shannons/KB (default 1000)
 *   p.signer       {ccc.Signer}  CKB-CCC signer
 *   p.onProgress   {fn?}         (msg) => void
 *
 * @returns {{ txHash: string, outputIndex: number, sporeId: string }}
 */
export async function mintDOB(p) {
  const log      = p.onProgress || (() => {});
  const feeRate  = BigInt(p.feeRate || 1000);
  const config   = buildSporeConfig(p.rpcURL, p.network);

  // Init Lumos config for this network
  initializeConfig(config.lumos);

  log('Building Spore transaction…');

  const sporeData = {
    contentType: p.contentType,
    content:     p.content,
    ...(p.clusterId?.trim() ? { clusterId: p.clusterId.trim() } : {}),
  };

  // createSpore returns a txSkeleton + outputIndex
  const { txSkeleton: rawSkeleton, outputIndex } = await createSpore({
    data:      sporeData,
    toLock:    p.toLock,
    fromInfos: [p.fromAddress],
    feeRate,
    config,
  });

  log('Paying fee…');

  // Pay fee using common scripts
  let txSkeleton = await common.payFeeByFeeRate(
    rawSkeleton,
    [p.fromAddress],
    feeRate,
    undefined,
    { config: config.lumos }
  );

  log('Preparing signatures…');

  // Prep for signing
  txSkeleton = common.prepareSigningEntries(txSkeleton, { config: config.lumos });

  // Convert skeleton to a signable transaction via CKB-CCC
  // CKB-CCC signer.signTransaction expects a ccc.Transaction
  // We build it from the Lumos skeleton
  const lumosTransaction = helpers.createTransactionFromSkeleton(txSkeleton);

  log('Signing with wallet…');

  // Use signer to sign — CKB-CCC handles the wallet interaction
  // Transaction imported at top
  const cccTx     = Transaction.fromLumosSkeleton(txSkeleton);
  const signedTx  = await p.signer.signTransaction(cccTx);

  log('Broadcasting…');

  const rpc     = new RPC(p.rpcURL);
  const txHash  = await rpc.sendTransaction(signedTx, 'passthrough');

  // Spore ID = type script args of the new spore output
  const sporeOutput = txSkeleton.get('outputs').get(outputIndex);
  const sporeId     = sporeOutput?.cellOutput?.type?.args || `${txHash}:${outputIndex}`;

  return { txHash, outputIndex, sporeId };
}
