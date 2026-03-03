/**
 * ckbfs.js — CKBFS publisher wrapping the official @ckbfs/api SDK
 *
 * The official SDK handles all molecule encoding, witness format, and
 * contract interaction correctly. This module provides a clean interface
 * for the DOB minter and React hook.
 *
 * Protocol: CKBFS V2 (code_hash 0x31e637... deployed 20241025)
 * Image stored in witnesses (prunable) — only ~225 CKB index cell locked permanently.
 */

import { CKBFS, ProtocolVersion } from '@ckbfs/api';

/**
 * Publish a file to CKBFS using the official SDK.
 *
 * @param {object} opts
 * @param {object} opts.signer     - CCC signer (used to extract private key for SDK)
 * @param {Uint8Array} opts.fileBytes
 * @param {string} opts.contentType
 * @param {string} opts.filename
 * @param {boolean} [opts.mainnet]
 * @param {string} [opts.privateKey] - raw private key hex (required — CCC signer doesn't expose it)
 *
 * @returns {{ txHash, typeId, explorerUrl, capacityCkb }}
 */
export async function ckbfsPublish({ privateKey, fileBytes, contentType, filename, mainnet = false }) {
  const network = mainnet ? 'mainnet' : 'testnet';
  const explorer = mainnet
    ? 'https://explorer.nervos.org/transaction'
    : 'https://pudge.explorer.nervos.org/transaction';

  const sdk = new CKBFS(privateKey, { network, version: ProtocolVersion.V2 });

  const txHash = await sdk.publishContent(fileBytes, { contentType, filename });

  // Fetch the CKBFS cell typeId from the published tx
  const typeId = await getTypeIdFromTx(txHash, network);

  return {
    txHash,
    typeId,
    explorerUrl: `${explorer}/${txHash}`,
    capacityCkb: 225, // approximate — actual varies by cell size
  };
}

async function getTypeIdFromTx(txHash, network) {
  const rpc = network === 'mainnet'
    ? 'https://mainnet.ckbapp.dev'
    : 'https://testnet.ckbapp.dev';

  const CKBFS_CODE_HASH = '0x31e6376287d223b8c0410d562fb422f04d1d617b2947596a14c3d2efb7218d3a';

  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'get_transaction', params: [txHash] }),
  });
  const data = await res.json();
  const outputs = data?.result?.transaction?.outputs || [];
  for (const output of outputs) {
    if (output.type?.code_hash === CKBFS_CODE_HASH) {
      return output.type.args;
    }
  }
  throw new Error('CKBFS cell not found in tx ' + txHash);
}

export function ckbfsEstimateCost(fileBytes) {
  return {
    witnessBytes: 50 + fileBytes.length,
    cellCapacityCkb: 225,
    txFeeCkb: 0.01,
    totalCkb: 225.01,
    note: 'File in witnesses (prunable). Only index cell (~225 CKB) locked permanently.',
  };
}
