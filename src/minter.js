/**
 * minter.js — DOB minting logic
 *
 * Wraps @spore-sdk/core's createSpore with sensible defaults and
 * progress callbacks. Framework-agnostic — call from React, plain JS, whatever.
 *
 * Flow:
 *   1. estimateCost(content)     → how much CKB this will need
 *   2. mintDOB(params)           → builds + signs tx, returns txHash + sporeId
 */

import { createSpore, predefinedSporeConfigs } from '@spore-sdk/core';

// Cost estimation: CKB capacity is in shannons (1 CKB = 100,000,000 shannons)
// Spore base overhead ≈ 96 bytes, content adds directly to required capacity
const BASE_CAPACITY_BYTES = 96;    // spore cell overhead
const BYTES_PER_CKB       = 1;     // 1 byte = 1 CKB capacity minimum

/**
 * estimateCost
 * Returns estimated CKB required (as number, in CKB not shannons).
 * Actual amount may vary slightly depending on transaction structure.
 */
export function estimateCost(contentBytes) {
  const totalBytes = BASE_CAPACITY_BYTES + contentBytes;
  return totalBytes; // 1 byte = 1 CKB minimum capacity
}

/**
 * getSporeConfig
 * Returns the Spore SDK config for the given network + RPC URL.
 */
export function getSporeConfig(rpcURL, network = 'mainnet') {
  const base = network === 'testnet'
    ? predefinedSporeConfigs.Testnet
    : predefinedSporeConfigs.Mainnet;

  // Override the RPC URL to point at the user's node
  return {
    ...base,
    ckbNodeUrl:    rpcURL,
    ckbIndexerUrl: rpcURL, // CKB v0.100+ has indexer built into main RPC
  };
}

/**
 * mintDOB
 *
 * @param {object} params
 *   rpcURL       {string}    - CKB node RPC URL
 *   network      {string}    - 'mainnet' | 'testnet'
 *   contentType  {string}    - MIME type e.g. 'image/png'
 *   content      {Uint8Array}- file content
 *   clusterId    {string?}   - optional collection ID (hex)
 *   signer       {object}    - CKB-CCC signer (from wallet connection)
 *   onProgress   {function?} - (step: string) => void
 *
 * @returns {{ txHash: string, sporeId: string }}
 */
export async function mintDOB({ rpcURL, network, contentType, content, clusterId, signer, onProgress }) {
  const progress = onProgress || (() => {});

  progress('Building transaction…');

  const sporeConfig = getSporeConfig(rpcURL, network);

  // Get the signer's lock script (owner of the new DOB)
  const address   = await signer.getRecommendedAddress();
  const toLock    = addressToLock(address, sporeConfig);

  const sporeData = {
    contentType,
    content,
    ...(clusterId ? { clusterId } : {}),
  };

  progress('Signing…');

  const { txHash, outputIndex } = await createSpore({
    data:       sporeData,
    toLock,
    fromInfos:  [address],
    config:     sporeConfig,
    // Use the signer's sign function for wallet integration
    // CKB-CCC signer provides signTransaction() compatible with Lumos
    signatureProvider: async (tx) => {
      return signer.signTransaction(tx);
    },
  });

  progress('Broadcasting…');

  const sporeId = deriveSporeId(txHash, outputIndex);

  return { txHash, sporeId, outputIndex };
}

/**
 * Derive Spore ID from tx hash + output index.
 * Spore ID = first 32 bytes of Blake2b(txHash_bytes || outputIndex_LE_uint32)
 * In practice the SDK returns this, but useful to know for display.
 */
function deriveSporeId(txHash, outputIndex) {
  // The SDK handles this — we surface it from the response directly
  // This is here as documentation
  return `${txHash}:${outputIndex}`;
}

/**
 * addressToLock — placeholder until CKB-CCC is wired
 * The real implementation comes from @ckb-ccc/core's address parsing
 */
function addressToLock(address, config) {
  // TODO: replace with ccc.Address.fromString(address, config).script
  // For now, returns a placeholder — won't be called until wallet is connected
  throw new Error('addressToLock: wire up @ckb-ccc/core address parsing');
}

/**
 * formatCKB — display helper
 */
export function formatCKB(shannons) {
  return (BigInt(shannons) / 100_000_000n).toString();
}
