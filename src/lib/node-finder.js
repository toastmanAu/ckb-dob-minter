/**
 * lib/node-finder.js  v0.2
 * CKB RPC node discovery — tries localhost, then LAN scan, then prompts.
 */

const LOCALHOST_CANDIDATES = [
  'http://localhost:8114',
  'http://127.0.0.1:8114',
  'http://localhost:8117',
  'http://localhost:9000',
  'http://localhost:28114',
];

const LAN_PORTS    = [8114, 28114];
const LAN_PREFIXES = ['192.168.68', '192.168.1', '192.168.0', '10.0.0', '10.0.1'];
const LAN_SUFFIXES = [1, 2, 50, 87, 88, 91, 93, 100, 105, 200, 254];
const BATCH_SIZE   = 10;

const TIMEOUT_LOCAL = 2500;
const TIMEOUT_LAN   = 1500;
const STORAGE_KEY   = 'ckb_dob_node_url';

export const PUBLIC_RPC   = 'https://mainnet.ckbapp.dev/rpc';
export const TESTNET_RPC  = 'https://testnet.ckbapp.dev/rpc';

async function probe(url, timeoutMs) {
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res   = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'get_tip_block_number', params: [] }),
      signal:  ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const { result } = await res.json();
    if (!result) return null;
    return {
      url,
      tipBlock: parseInt(result, 16),
      isLocal:  url.includes('localhost') || url.includes('127.0.0.1'),
    };
  } catch { return null; }
}

export async function discoverNode(onProgress = () => {}) {
  // 1. saved
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      onProgress('Checking saved node…');
      const info = await probe(saved, TIMEOUT_LOCAL);
      if (info) return info;
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}

  // 2. localhost
  onProgress('Scanning localhost…');
  for (const url of LOCALHOST_CANDIDATES) {
    const info = await probe(url, TIMEOUT_LOCAL);
    if (info) { try { localStorage.setItem(STORAGE_KEY, url); } catch {} return info; }
  }

  // 3. LAN scan — skipped on Brave (blocks cross-origin LAN requests silently)
  const isBrave = !!(navigator.brave && await navigator.brave.isBrave().catch(() => false));
  if (!isBrave) {
    onProgress('Scanning local network…');
    const candidates = [];
    for (const prefix of LAN_PREFIXES)
      for (const suffix of LAN_SUFFIXES)
        for (const port of LAN_PORTS)
          candidates.push(`http://${prefix}.${suffix}:${port}`);

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch   = candidates.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(u => probe(u, TIMEOUT_LAN)));
      for (let j = 0; j < results.length; j++) {
        if (results[j].value) {
          const info = results[j].value;
          try { localStorage.setItem(STORAGE_KEY, batch[j]); } catch {}
          return info;
        }
      }
    }
  }

  return { isBrave }; // null-ish signal to show prompt; isBrave flag for UI
}

export async function tryCustomURL(url) {
  url = url.trim().replace(/\/$/, '');
  if (!url.startsWith('http')) url = 'http://' + url;
  const info = await probe(url, TIMEOUT_LOCAL);
  if (info) { try { localStorage.setItem(STORAGE_KEY, url); } catch {} }
  return info;
}

export function getPublicFallback(network = 'mainnet') {
  return network === 'testnet' ? TESTNET_RPC : PUBLIC_RPC;
}

export function forgetNode() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}
