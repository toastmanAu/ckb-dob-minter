/**
 * ckbfs.js — CKBFS publisher wrapping the official @ckbfs/api SDK
 *
 * Uses V2 (witnesses-based, ~225 CKB index cell) for mainnet DOB minting.
 * V3 is the new default but uses a different cell structure — we explicitly
 * pin to V2 for compatibility with our DOB minter content type reference.
 *
 * Protocol: CKBFS V2 (code_hash 0x31e637... deployed 20241025)
 */

import { CKBFS, ProtocolVersion } from '@ckbfs/api';

/**
 * Publish a file to CKBFS using the official SDK.
 *
 * @param {object} opts
 * @param {string} opts.privateKey  - raw private key hex
 * @param {Uint8Array} opts.fileBytes
 * @param {string} opts.contentType
 * @param {string} opts.filename
 * @param {boolean} [opts.mainnet]
 *
 * @returns {{ txHash, typeId, explorerUrl, capacityCkb }}
 */
export async function ckbfsPublish({ privateKey, fileBytes, contentType, filename, mainnet = false }) {
  const network = mainnet ? 'mainnet' : 'testnet';
  const explorer = mainnet
    ? 'https://explorer.nervos.org/transaction'
    : 'https://pudge.explorer.nervos.org/transaction';

  // Constructor: (privateKey, network, options)
  const sdk = new CKBFS(privateKey, network, {
    version: ProtocolVersion.V2,  // pin to V2 — well-tested, DOB minter uses ckbfs:// URI
  });

  const txHash = await sdk.publishContent(fileBytes, { contentType, filename });
  console.log(`  CKBFS tx: ${txHash}`);
  console.log(`  Waiting for confirmation...`);

  // Wait for confirmation before fetching type ID
  await waitForTx(txHash, network);

  const typeId = await getTypeIdFromTx(txHash, network, ProtocolVersion.V2);

  return {
    txHash,
    typeId,
    explorerUrl: `${explorer}/${txHash}`,
    capacityCkb: 225,
  };
}

async function waitForTx(txHash, network, maxWaitMs = 120000) {
  const rpc = network === 'mainnet' ? 'https://mainnet.ckbapp.dev' : 'https://testnet.ckbapp.dev';
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'get_transaction', params: [txHash] }),
    });
    const data = await res.json();
    const status = data?.result?.tx_status?.status;
    if (status === 'committed') return;
    if (status === 'rejected') throw new Error(`CKBFS tx rejected: ${data?.result?.tx_status?.reason}`);
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error(`CKBFS tx not confirmed after ${maxWaitMs/1000}s`);
}

async function getTypeIdFromTx(txHash, network, version = ProtocolVersion.V2) {
  const rpc = network === 'mainnet' ? 'https://mainnet.ckbapp.dev' : 'https://testnet.ckbapp.dev';

  // V2 code hash (mainnet)
  const CKBFS_CODE_HASH_V2_MAINNET = '0x31e6376287d223b8c0410d562fb422f04d1d617b2947596a14c3d2efb7218d3a';
  // V2 code hash (testnet)
  const CKBFS_CODE_HASH_V2_TESTNET = '0x2138683f76944437c0c643664120d620bdb5858dd6c9d1d156805e279c2c536f';
  const targetCodeHash = network === 'mainnet' ? CKBFS_CODE_HASH_V2_MAINNET : CKBFS_CODE_HASH_V2_TESTNET;

  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'get_transaction', params: [txHash] }),
  });
  const data = await res.json();
  const outputs = data?.result?.transaction?.outputs || [];
  for (const output of outputs) {
    if (output.type?.code_hash === targetCodeHash) {
      return output.type.args;
    }
  }
  throw new Error(`CKBFS cell not found in tx ${txHash} (checked ${outputs.length} outputs)`);
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
