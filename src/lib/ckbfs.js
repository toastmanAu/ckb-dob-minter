/**
 * ckbfs.js — Pure JavaScript CKBFS publisher for CKB
 *
 * Implements the CKBFS v2 protocol (RFC: github.com/code-monad/ckbfs)
 * Witnesses-based file storage — file content goes in tx witnesses,
 * only a small index cell (cell data) is stored on-chain permanently.
 *
 * Protocol:
 *   - Witness format: 0x434b424653 ("CKBFS") + 0x00 (version) + <file bytes>
 *   - Cell data: molecule-encoded CKBFSData { indexes, checksum, content_type, filename, backlinks }
 *   - Type script: TypeID + CKBFS contract (code_hash below)
 *   - Cost: ~194 CKB index cell (permanent) — flat regardless of file size
 */

import { ccc } from '@ckb-ccc/core';

// ── Contract addresses ──────────────────────────────────────────────────────

const CKBFS_SCRIPTS = {
  mainnet: {
    // Version 20241025.db973a8e8032
    codeHash: '0x31e6376287d223b8c0410d562fb422f04d1d617b2947596a14c3d2efb7218d3a',
    hashType: 'data1',
    depTxHash: '0xfab07962ed7178ed88d450774e2a6ecd50bae856bdb9b692980be8c5147d1bfa',
    depIndex: 0,
    depType: 'depGroup',
  },
  testnet: {
    // Version 20241025.db973a8e8032 on testnet
    codeHash: '0x31e6376287d223b8c0410d562fb422f04d1d617b2947596a14c3d2efb7218d3a',
    hashType: 'data1',
    depTxHash: '0x469af0d961dcaaedd872968a9388b546717a6ccfa47b3165b3f9c981e9d66aaa',
    depIndex: 0,
    depType: 'depGroup',
  },
};

// ── Adler-32 checksum ───────────────────────────────────────────────────────

const ADLER_MOD = 65521;

/**
 * Compute Adler-32 checksum over bytes.
 * Optionally recover from a prior state (for append).
 */
function adler32(bytes, priorState = null) {
  let a = 1, b = 0;

  if (priorState !== null) {
    // Recover from prior checksum: high 16 bits = B, low 16 bits = A
    a = priorState & 0xffff;
    b = (priorState >>> 16) & 0xffff;
  }

  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % ADLER_MOD;
    b = (b + a) % ADLER_MOD;
  }

  return ((b << 16) | a) >>> 0;
}

// ── Molecule encoding ────────────────────────────────────────────────────────
// Minimal molecule encoder — just enough for CKBFSData
// Molecule: https://github.com/nervosnetwork/molecule

function molBytes(bytes) {
  // vector Bytes <byte>: 4-byte LE length + data
  const len = bytes.length;
  const buf = new Uint8Array(4 + len);
  new DataView(buf.buffer).setUint32(0, 4 + len, true);
  buf.set(bytes, 4);
  return buf;
}

function molUint32LE(n) {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, n >>> 0, true);
  return buf;
}

function molIndexes(indexArray) {
  // vector Indexes <index> where index = Uint32
  // Each element is 4 bytes LE; prefix with total byte length (4 bytes LE)
  const count = indexArray.length;
  const total = 4 + count * 4;
  const buf = new Uint8Array(total);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, total, true);
  for (let i = 0; i < count; i++) {
    dv.setUint32(4 + i * 4, indexArray[i] >>> 0, true);
  }
  return buf;
}

function molBackLinks() {
  // empty BackLinks vector: just 4-byte length = 4
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, 4, true);
  return buf;
}

function molCKBFSData({ indexes, checksum, contentType, filename }) {
  /**
   * table CKBFSData {
   *   index: Indexes,
   *   checksum: Uint32,
   *   content_type: Bytes,
   *   filename: Bytes,
   *   backlinks: BackLinks,
   * }
   *
   * Molecule table encoding:
   *   [total_size: u32][offsets: u32 * field_count][field_data...]
   */
  const fields = [
    molIndexes(indexes),              // field 0: index
    molUint32LE(checksum),            // field 1: checksum
    molBytes(new TextEncoder().encode(contentType)), // field 2: content_type
    molBytes(new TextEncoder().encode(filename)),    // field 3: filename
    molBackLinks(),                   // field 4: backlinks (empty)
  ];

  const FIELD_COUNT = 5;
  const headerSize = 4 + FIELD_COUNT * 4; // total_size + offsets
  const dataSize = fields.reduce((s, f) => s + f.length, 0);
  const totalSize = headerSize + dataSize;

  const buf = new Uint8Array(totalSize);
  const dv = new DataView(buf.buffer);

  dv.setUint32(0, totalSize, true);

  let offset = headerSize;
  for (let i = 0; i < FIELD_COUNT; i++) {
    dv.setUint32(4 + i * 4, offset, true);
    buf.set(fields[i], offset);
    offset += fields[i].length;
  }

  return buf;
}

// ── Witness builder ──────────────────────────────────────────────────────────

const CKBFS_MAGIC = new Uint8Array([0x43, 0x4b, 0x42, 0x46, 0x53]); // "CKBFS"
const CKBFS_VERSION = new Uint8Array([0x00]);

function buildWitness(fileBytes) {
  // Witness: "CKBFS" + 0x00 + <file bytes>
  const witness = new Uint8Array(CKBFS_MAGIC.length + 1 + fileBytes.length);
  witness.set(CKBFS_MAGIC, 0);
  witness.set(CKBFS_VERSION, 5);
  witness.set(fileBytes, 6);
  return witness;
}

// ── TypeID generation ────────────────────────────────────────────────────────

/**
 * TypeID args = blake2b(first_input_out_point_bytes + output_index_u64_le)
 * CCC provides this via tx.getTypeId() but we can also compute it manually.
 */
async function computeTypeId(firstInputOutPoint, outputIndex) {
  const txHash = ccc.bytesFrom(firstInputOutPoint.txHash);
  const idxBuf = new Uint8Array(8);
  new DataView(idxBuf.buffer).setBigUint64(0, BigInt(firstInputOutPoint.index), true);
  const outIdxBuf = new Uint8Array(8);
  new DataView(outIdxBuf.buffer).setBigUint64(0, BigInt(outputIndex), true);

  const preimage = new Uint8Array(txHash.length + idxBuf.length + outIdxBuf.length);
  preimage.set(txHash, 0);
  preimage.set(idxBuf, txHash.length);
  preimage.set(outIdxBuf, txHash.length + idxBuf.length);

  return ccc.hashCkb(preimage);
}

// ── Main publish function ────────────────────────────────────────────────────

/**
 * Publish a file to CKBFS.
 *
 * @param {object} opts
 * @param {ccc.Signer} opts.signer       - CCC signer (private key or JoyID)
 * @param {Uint8Array} opts.fileBytes    - Raw file content
 * @param {string}     opts.contentType  - MIME type e.g. "image/jpeg"
 * @param {string}     opts.filename     - e.g. "founding-member.jpg"
 * @param {boolean}    [opts.mainnet]    - true for mainnet, default testnet
 *
 * @returns {{ txHash: string, typeId: string, explorerUrl: string }}
 */
export async function ckbfsPublish({ signer, fileBytes, contentType, filename, mainnet = false }) {
  const network = mainnet ? 'mainnet' : 'testnet';
  const script = CKBFS_SCRIPTS[network];
  const explorer = mainnet
    ? 'https://explorer.nervos.org/transaction'
    : 'https://pudge.explorer.nervos.org/transaction';

  // 1. Build witness
  const witness = buildWitness(fileBytes);

  // 2. Compute Adler-32 checksum over file bytes (content starts at offset 6)
  const checksum = adler32(fileBytes);

  // 3. Get signer address + lock script
  const senderAddress = await signer.getRecommendedAddress();
  const { script: lockScript } = await ccc.Address.fromString(senderAddress, signer.client);

  // 4. Collect a live input cell to derive TypeID
  //    We need at least one input to compute the TypeID args
  const inputCells = [];
  for await (const cell of signer.client.findCells(
    { script: lockScript, scriptType: 'lock' },
    'asc',
    1
  )) {
    inputCells.push(cell);
    break;
  }
  if (inputCells.length === 0) throw new Error('No live cells found for signer');

  const firstInput = inputCells[0];
  // The CKBFS cell will be output index 0
  const typeIdArgs = await computeTypeId(firstInput.outPoint, 0);

  // 5. Build CKBFS cell data (molecule encoded)
  const cellData = molCKBFSData({
    indexes: [0], // witness index 0 contains file content
    checksum,
    contentType,
    filename,
  });

  // 6. Calculate required capacity:
  //    lock (33+) + type (33+) + data (cellData.length) + overhead (8 bytes capacity field)
  //    Minimum: 1 byte = 1 CKB (1e8 shannon)
  //    Standard cell overhead = 61 bytes (lock + type + capacity field)
  //    Plus cell data length
  const lockBytes = 32 + 1 + lockScript.args.length / 2 - 1; // rough estimate
  const typeScriptBytes = 32 + 1 + 32; // code_hash + hash_type + args(typeId=32bytes)
  const overheadBytes = 8 + 17 + lockBytes + typeScriptBytes; // capacity + cell_header + lock + type
  const capacityBytes = overheadBytes + cellData.length;
  const capacityShannon = BigInt(capacityBytes) * 100_000_000n; // 1 CKB = 1e8 shannon

  // Use a safe minimum: 200 CKB should cover any reasonable cell overhead
  const MIN_CAPACITY = 200n * 100_000_000n;
  const finalCapacity = capacityShannon < MIN_CAPACITY ? MIN_CAPACITY : capacityShannon;

  console.log(`CKBFS: file=${fileBytes.length} bytes, checksum=0x${checksum.toString(16).padStart(8,'0')}`);
  console.log(`CKBFS: cell capacity=${Number(finalCapacity)/1e8} CKB, typeId=${typeIdArgs}`);

  // 7. Build the transaction using CCC
  const tx = ccc.Transaction.from({
    inputs: [
      { previousOutput: firstInput.outPoint },
    ],
    outputs: [
      {
        capacity: finalCapacity,
        lock: lockScript, // owner = signer
        type: {
          codeHash: script.codeHash,
          hashType: script.hashType,
          args: typeIdArgs,
        },
      },
    ],
    outputsData: [
      ccc.hexFrom(cellData),
    ],
    witnesses: [
      '0x', // placeholder for signer witness (index 0 for input)
      ccc.hexFrom(witness), // index 1: CKBFS content witness
    ],
    cellDeps: [
      {
        outPoint: { txHash: script.depTxHash, index: script.depIndex },
        depType: script.depType,
      },
    ],
  });

  // Update CKBFS cell data: indexes should reference the correct witness index
  // Witness 0 = input lock witness, Witness 1 = CKBFS content
  // So index = 1 in the indexes field
  const cellDataFinal = molCKBFSData({
    indexes: [1],
    checksum,
    contentType,
    filename,
  });
  tx.outputsData[0] = ccc.hexFrom(cellDataFinal);

  // 8. Complete fee + extra inputs if needed
  await tx.completeFeeBy(signer, 1000n);

  // 9. Send
  const txHash = await signer.sendTransaction(tx);

  return {
    txHash,
    typeId: typeIdArgs,
    explorerUrl: `${explorer}/${txHash}`,
    checksum,
    capacityCkb: Number(finalCapacity) / 1e8,
  };
}

/**
 * Estimate cost before publishing (no transaction sent).
 */
export function ckbfsEstimateCost(fileBytes) {
  // File goes in witness (prunable) — only cell overhead locked permanently
  // Rough estimate: 200 CKB flat (the index cell)
  const witnessSizeBytes = 6 + fileBytes.length; // CKBFS header + content
  return {
    witnessBytes: witnessSizeBytes,
    cellCapacityCkb: 200, // locked permanently
    txFeeCkb: 0.01,       // approximate
    totalCkb: 200.01,
    note: 'File stored in witnesses (prunable). Only index cell (~200 CKB) locked permanently.',
  };
}

export { adler32, buildWitness, molCKBFSData };
