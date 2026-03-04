/**
 * lib/ckbfs-resolver.js
 * Core CKBFS resolution logic — no framework deps, works in browser + Node.
 *
 * Protocol: CKBFS V2, code_hash 0x31e637...
 */

// All known CKBFS code hashes (V1/V2/V3, same on mainnet + testnet)
export const CKBFS_CODE_HASHES = [
  '0x31e6376287d223b8c0410d562fb422f04d1d617b2947596a14c3d2efb7218d3a', // V2 (20241025)
  '0xb5d13ffe0547c78021c01fe24dce2e959a1ed8edbca3cb93dd2e9f57fb56d695', // V3 (20250821)
  '0xe8905ad29a02cf8befa9c258f4f941773839a618d75a64afc22059de9413f712', // V1 testnet
  '0x685a60219309029d01182c8d57c12166e6d39ea4e18a5b0a4b7e4c42fde851cb', // V1 mainnet (if exists)
];
export const CKBFS_CODE_HASH = CKBFS_CODE_HASHES[0]; // default (V2)

export const RPC_ENDPOINTS = {
  testnet: 'https://testnet.ckbapp.dev',
  mainnet: 'https://mainnet.ckbapp.dev',
};

export const EXPLORER = {
  testnet: 'https://pudge.explorer.nervos.org/transaction',
  mainnet: 'https://explorer.nervos.org/transaction',
};

// ── RPC ───────────────────────────────────────────────────────────────────────

async function ckbRpc(network, method, params) {
  const res = await fetch(RPC_ENDPOINTS[network], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`RPC error: ${data.error.message}`);
  return data.result;
}

// ── Identifier parser ─────────────────────────────────────────────────────────

export function parseIdentifier(input) {
  let typeId = input.trim();
  if (typeId.startsWith('ckbfs://')) typeId = typeId.slice('ckbfs://'.length);
  if (!typeId.startsWith('0x')) typeId = '0x' + typeId;
  if (typeId.length !== 66) throw new Error('Invalid TypeID — expected 32-byte hex (0x + 64 chars)');
  return typeId;
}

// ── Molecule decoder ──────────────────────────────────────────────────────────
// Handles 4-field (index: Uint32) and 5-field (indexes: Vec<Uint32>) schemas.

function decodeCKBFSData(hex) {
  // Use a fresh ArrayBuffer copy — Safari is strict about DataView byteOffset
  const raw = hexToBytes(hex);
  const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const data = new Uint8Array(buf);
  const dv = new DataView(buf);

  const totalSize = dv.getUint32(0, true);
  const firstOffset = dv.getUint32(4, true);
  const fieldCount = (firstOffset / 4) - 1;

  const offsets = [];
  for (let i = 0; i < fieldCount; i++) offsets.push(dv.getUint32(4 + i * 4, true));
  offsets.push(totalSize);

  const readStr = (off) => {
    const len = dv.getUint32(off, true);
    return new TextDecoder().decode(data.slice(off + 4, off + 4 + len));
  };

  if (fieldCount === 4) {
    // V3 format: { index, checksum, contentType, filename }
    // index is the witness start index; chain is followed via nextIndex in witness
    return {
      index:       dv.getUint32(offsets[0], true),
      indexes:     null, // V3 uses nextIndex chaining, not explicit indexes array
      checksum:    dv.getUint32(offsets[1], true),
      contentType: readStr(offsets[2]),
      filename:    readStr(offsets[3]),
    };
  } else {
    // Vec<Uint32>: 4-byte item count + N×4-byte items
    const idxBuf = buf.slice(offsets[0], offsets[1]);
    const idxDv = new DataView(idxBuf);
    const indexCount = idxDv.getUint32(0, true);
    const indexes = [];
    for (let i = 0; i < indexCount; i++) indexes.push(idxDv.getUint32(4 + i * 4, true));
    return {
      indexes,
      checksum:    dv.getUint32(offsets[1], true),
      contentType: readStr(offsets[2]),
      filename:    readStr(offsets[3]),
    };
  }
}

// ── Witness content extractor ─────────────────────────────────────────────────

function extractChunkFromWitness(witnessHex, isContinuation = false) {
  const bytes = hexToBytes(witnessHex);
  if (isContinuation) {
    // V3 continuation: 4-byte nextIndex + content
    return bytes.slice(4);
  }
  const magic = new TextDecoder().decode(bytes.slice(0, 5));
  if (magic !== 'CKBFS') throw new Error('Witness missing CKBFS magic header');
  const version = bytes[5];
  // v2 (0x00): content at byte 6
  // v3 (0x03): content at byte 50 (6 + 32 prev_tx_hash + 4 prev_idx + 4 prev_checksum + 4 next_idx)
  return bytes.slice(version === 0x03 ? 50 : 6);
}

function getNextIndex(witnessHex, isContinuation = false) {
  const bytes = hexToBytes(witnessHex);
  if (isContinuation) {
    return new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true);
  }
  // V3 head: nextIndex at offset 46
  if (bytes[5] === 0x03) {
    return new DataView(bytes.buffer, bytes.byteOffset + 46, 4).getUint32(0, true);
  }
  return 0; // V2 — no nextIndex chaining needed
}

// ── Main resolve ──────────────────────────────────────────────────────────────

/**
 * Resolve a CKBFS TypeID to its file content and metadata.
 * Handles multi-chunk files (content split across multiple witnesses).
 */
export async function resolveCKBFS(typeId, network, onProgress = () => {}) {
  onProgress('Searching for CKBFS cell…');

  // Try all known CKBFS code hashes (V1/V2/V3)
  let cells = [];
  let foundCodeHash = null;
  for (const codeHash of CKBFS_CODE_HASHES) {
    const result = await ckbRpc(network, 'get_cells', [{
      script: { code_hash: codeHash, hash_type: 'data1', args: typeId },
      script_type: 'type',
      filter: null,
    }, 'asc', '0x1']);
    cells = result?.objects || [];
    if (cells.length) { foundCodeHash = codeHash; break; }
  }
  if (!cells.length) throw new Error(`No CKBFS cell found for ${typeId.slice(0,18)}… on ${network}`);

  const cell = cells[0];
  const meta = decodeCKBFSData(cell.output_data || '0x');

  onProgress('Fetching publish transaction…');
  const txResult = await ckbRpc(network, 'get_transaction', [cell.out_point.tx_hash]);
  const tx = txResult?.transaction;
  if (!tx) throw new Error('Transaction not found');

  const witnesses = tx.witnesses || [];

  // Reassemble all chunks in order
  // Assemble chunks — V3 uses nextIndex chaining; V2 uses indexes array
  const chunks = [];
  if (meta.indexes && meta.indexes.length > 0) {
    // V2 style: explicit indexes array
    onProgress(`Extracting ${meta.filename || 'file'} (${meta.indexes.length} chunk${meta.indexes.length !== 1 ? 's' : ''})…`);
    for (const idx of meta.indexes) {
      if (idx >= witnesses.length) throw new Error(`Witness index ${idx} out of range`);
      chunks.push(extractChunkFromWitness(witnesses[idx]));
    }
  } else {
    // V3 style: follow nextIndex chain starting from meta.index
    let idx = meta.index ?? 1;
    let isFirst = true;
    const visited = new Set();
    while (idx !== 0 && !visited.has(idx)) {
      visited.add(idx);
      if (idx >= witnesses.length) throw new Error(`Witness index ${idx} out of range (${witnesses.length} witnesses)`);
      const isCont = !isFirst;
      chunks.push(extractChunkFromWitness(witnesses[idx], isCont));
      const next = getNextIndex(witnesses[idx], isCont);
      isFirst = false;
      idx = next;
    }
    // If only one chunk (nextIndex=0 from the start), we already extracted it
    if (chunks.length === 0) {
      chunks.push(extractChunkFromWitness(witnesses[meta.index ?? 1], false));
    }
    onProgress(`Extracting ${meta.filename || 'file'} (${chunks.length} chunk${chunks.length !== 1 ? 's' : ''})…`);
  }

  // Concatenate chunks into a fresh owned ArrayBuffer (Safari Blob compat)
  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const fileBuf = new ArrayBuffer(totalLen);
  const fileBytes = new Uint8Array(fileBuf);
  let offset = 0;
  for (const chunk of chunks) { fileBytes.set(chunk, offset); offset += chunk.length; }

  return {
    fileBytes,
    contentType: meta.contentType,
    filename:    meta.filename,
    checksum:    meta.checksum,
    witnessIdx:  meta.indexes ? meta.indexes[0] : (meta.index ?? 1),
    chunkCount:  meta.indexes ? meta.indexes.length : chunks.length,
    txHash:      cell.out_point.tx_hash,
  };
}

// ── Utils ─────────────────────────────────────────────────────────────────────

export function hexToBytes(hex) {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const buf = new ArrayBuffer(h.length / 2);
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return b;
}

export function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}
