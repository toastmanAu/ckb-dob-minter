/**
 * node-finder.js
 * Thin wrapper — tries known local CKB RPC ports, falls back to custom URL.
 * Framework-agnostic. Can be used standalone or as a module.
 */

const DEFAULTS = [
  'http://localhost:8114',
  'http://127.0.0.1:8114',
  'http://localhost:8117',   // light client
];

const PUBLIC_FALLBACK = 'https://mainnet.ckbapp.dev/rpc';
const TESTNET_RPC     = 'https://testnet.ckbapp.dev/rpc';
const STORAGE_KEY     = 'ckb_dob_node_url';
const TIMEOUT_MS      = 3000;

async function probeCKBNode(url) {
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res   = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'get_tip_block_number', params: [] }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.result) return null;
    return { url, tipBlock: parseInt(data.result, 16), isLocal: !url.startsWith('https://') };
  } catch { return null; }
}

export async function discoverNode() {
  // 1. saved
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const info = await probeCKBNode(saved);
      if (info) return info;
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}

  // 2. local defaults
  for (const url of DEFAULTS) {
    const info = await probeCKBNode(url);
    if (info) {
      try { localStorage.setItem(STORAGE_KEY, url); } catch {}
      return info;
    }
  }

  // 3. Nothing local — return null so UI can prompt
  return null;
}

export async function tryCustomURL(url) {
  url = url.trim().replace(/\/$/, '');
  const info = await probeCKBNode(url);
  if (info) {
    try { localStorage.setItem(STORAGE_KEY, url); } catch {}
    return info;
  }
  return null;
}

export function getPublicFallback(network = 'mainnet') {
  return network === 'testnet' ? TESTNET_RPC : PUBLIC_FALLBACK;
}

export function forgetNode() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}
