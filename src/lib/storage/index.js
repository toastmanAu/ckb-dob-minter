/**
 * lib/storage/index.js — Storage provider abstraction
 *
 * Each provider implements:
 *   upload({ file, contentType, onProgress }) → { uri, provider, size, meta }
 *
 * The returned `uri` is what gets stored in the Spore cell as content,
 * with contentType set to 'text/uri-list'.
 *
 * Adding a new provider: create lib/storage/<name>.js implementing the
 * interface below, then register it in PROVIDERS.
 */

export const STORAGE_MODES = {
  inline:  { id: 'inline',  label: 'On-chain (inline)', icon: '⛓️', external: false },
  ipfs:    { id: 'ipfs',    label: 'IPFS (Pinata)',      icon: '📌', external: true  },
  arweave: { id: 'arweave', label: 'Arweave (Irys)',     icon: '♾️', external: true  },
  ckbfs:   { id: 'ckbfs',   label: 'CKBFS',              icon: '🗄️', external: true  },
};

/**
 * Upload a file to an external storage provider.
 * Returns { uri, provider, size, meta }
 *
 * @param {object} params
 * @param {'ipfs'|'arweave'|'ckbfs'} params.provider
 * @param {Uint8Array} params.content       raw file bytes
 * @param {string}     params.contentType   MIME type
 * @param {string}     params.filename
 * @param {object}     [params.config]      provider-specific config (API keys etc)
 * @param {function}   [params.onProgress]  (pct: number, msg: string) => void
 */
export async function uploadToProvider({ provider, content, contentType, filename, config, onProgress }) {
  const log = onProgress || (() => {});

  switch (provider) {
    case 'ipfs':    return uploadIPFS({ content, contentType, filename, config, onProgress: log });
    case 'arweave': return uploadArweave({ content, contentType, filename, config, onProgress: log });
    case 'ckbfs':   return uploadCKBFS({ content, contentType, filename, config, onProgress: log });
    default: throw new Error(`Unknown storage provider: ${provider}`);
  }
}

// ── IPFS via Pinata ──────────────────────────────────────────────────────────

async function uploadIPFS({ content, contentType, filename, config, onProgress }) {
  const apiKey = config?.pinataApiKey || config?.apiKey;
  const jwt    = config?.pinataJwt    || config?.jwt;

  if (!jwt && !apiKey) {
    throw new Error('Pinata: provide pinataJwt or pinataApiKey in storage config');
  }

  onProgress(10, 'Preparing upload to IPFS…');

  const blob = new Blob([content], { type: contentType });
  const form = new FormData();
  form.append('file', blob, filename || 'dob-content');

  // Optional: set pinata metadata
  form.append('pinataMetadata', JSON.stringify({
    name: filename || 'CKB DOB Content',
  }));

  onProgress(20, 'Uploading to Pinata…');

  const headers = jwt
    ? { Authorization: `Bearer ${jwt}` }
    : { pinata_api_key: apiKey, pinata_secret_api_key: config.pinataSecretKey };

  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers,
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinata upload failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  const cid  = data.IpfsHash;

  onProgress(100, 'Uploaded to IPFS ✅');

  return {
    uri:      `ipfs://${cid}`,
    provider: 'ipfs',
    size:     content.length,
    meta:     { cid, gateway: `https://gateway.pinata.cloud/ipfs/${cid}` },
  };
}

// ── Arweave via Irys (Bundlr) ────────────────────────────────────────────────

async function uploadArweave({ content, contentType, filename, config, onProgress }) {
  // Irys supports browser uploads via their SDK or direct REST
  // We use the REST endpoint which accepts raw bytes + tags
  const node = config?.irysNode || 'https://node2.irys.xyz';

  onProgress(10, 'Preparing Arweave upload via Irys…');

  // Check price first
  const priceRes = await fetch(`${node}/price/${content.length}`);
  if (!priceRes.ok) throw new Error('Irys: could not fetch price');
  const price = await priceRes.text(); // in winston (Arweave units)

  onProgress(20, `Arweave storage cost: ${(Number(price) / 1e12).toFixed(6)} AR`);

  // Upload — requires a funded Irys account or use their funded endpoint
  // For free uploads <100KB, use Irys devnet or their free tier
  const uploadUrl = content.length < 100 * 1024
    ? 'https://devnet.irys.xyz/upload'  // free for small files on devnet
    : `${node}/upload`;

  onProgress(40, 'Uploading to Arweave…');

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      'x-chunking-threshold': '25000000',
      ...(config?.irysToken ? { Authorization: `Bearer ${config.irysToken}` } : {}),
    },
    body: content,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Irys upload failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  const id   = data.id;

  onProgress(100, 'Uploaded to Arweave ✅');

  return {
    uri:      `ar://${id}`,
    provider: 'arweave',
    size:     content.length,
    meta:     { id, gateway: `https://arweave.net/${id}` },
  };
}

// ── CKBFS via browser-native publisher ──────────────────────────────────────

async function uploadCKBFS({ content, contentType, filename, config, onProgress }) {
  const { publishCKBFS } = await import('@wyltek/ckbfs-browser');
  const ccc = await import('@ckb-ccc/core');

  const signer = config?.signer;
  if (!signer) throw new Error('CKBFS: connect your wallet first — a CKB signer is required');

  const result = await publishCKBFS({
    signer,
    ccc,
    content,
    contentType,
    filename,
    mainnet: config?.mainnet ?? false,
    onProgress: (pct, msg) => onProgress(pct, msg),
  });

  return {
    uri:      result.uri,
    provider: 'ckbfs',
    size:     content.length,
    meta: {
      typeId:      result.typeId,
      txHash:      result.txHash,
      capacityCkb: result.capacityCkb,
    },
  };
}
