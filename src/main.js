/**
 * main.js — DOB Minter UI controller
 *
 * Wires together:
 *   - node-finder.js  (RPC discovery)
 *   - minter.js       (transaction building)
 *   - index.html      (UI elements)
 *
 * Wallet integration (CKB-CCC) is stubbed — connect() currently
 * shows a "not yet wired" message. Full wallet wiring is next step.
 */

import { discoverNode, tryCustomURL, getPublicFallback, forgetNode } from './node-finder.js';
import { estimateCost, mintDOB, formatCKB } from './minter.js';

// ── State ─────────────────────────────────────────────────────────
let nodeInfo    = null;  // { url, tipBlock, isLocal }
let fileContent = null;  // Uint8Array
let fileType    = null;  // MIME string
let fileName    = null;
let wallet      = null;  // CKB-CCC signer (null until connected)
let network     = 'mainnet';

// ── DOM refs ──────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Boot ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setupFileInput();
  setupNodePanel();
  setupNetworkToggle();
  setupWalletButton();
  setupMintButton();

  // Auto-discover node
  setNodeStatus('scanning', 'Scanning for local CKB node…');
  nodeInfo = await discoverNode();

  if (nodeInfo) {
    setNodeStatus('connected', `${nodeInfo.url} · block #${nodeInfo.tipBlock.toLocaleString()}`);
  } else {
    setNodeStatus('prompt', 'No local node found — enter RPC URL or use public node');
    showNodePrompt();
  }
});

// ── Node panel ────────────────────────────────────────────────────
function setupNodePanel() {
  $('btn-use-public')?.addEventListener('click', () => {
    const url = getPublicFallback(network);
    nodeInfo = { url, tipBlock: 0, isLocal: false };
    setNodeStatus('connected', `${url} (public)`);
    hideNodePrompt();
    updateMintButton();
  });

  $('btn-connect-custom')?.addEventListener('click', async () => {
    const url = $('input-node-url')?.value?.trim();
    if (!url) return;
    setNodeStatus('scanning', 'Connecting…');
    const info = await tryCustomURL(url);
    if (info) {
      nodeInfo = info;
      setNodeStatus('connected', `${info.url} · block #${info.tipBlock.toLocaleString()}`);
      hideNodePrompt();
      updateMintButton();
    } else {
      setNodeStatus('error', `Could not connect to ${url}`);
    }
  });

  $('btn-change-node')?.addEventListener('click', () => {
    forgetNode();
    nodeInfo = null;
    setNodeStatus('prompt', 'Enter your CKB RPC URL');
    showNodePrompt();
    updateMintButton();
  });
}

function setNodeStatus(state, message) {
  const dot  = $('node-dot');
  const msg  = $('node-msg');
  const btn  = $('btn-change-node');
  if (!dot || !msg) return;

  const colors = { scanning: '#ff8c42', connected: '#00e5a0', prompt: '#64748b', error: '#ff4560' };
  dot.style.background  = colors[state] || '#64748b';
  dot.style.animation   = state === 'scanning' ? 'pulse 1.5s infinite' : 'none';
  msg.textContent        = message;
  if (btn) btn.style.display = state === 'connected' ? 'inline-block' : 'none';
}

function showNodePrompt() { $('node-prompt')?.style && ($('node-prompt').style.display = 'block'); }
function hideNodePrompt() { $('node-prompt')?.style && ($('node-prompt').style.display = 'none'); }

// ── File input ────────────────────────────────────────────────────
function setupFileInput() {
  const input   = $('file-input');
  const dropzone = $('dropzone');

  if (input) input.addEventListener('change', e => handleFile(e.target.files[0]));

  if (dropzone) {
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      handleFile(e.dataTransfer.files[0]);
    });
    dropzone.addEventListener('click', () => input?.click());
  }
}

function handleFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    fileContent = new Uint8Array(reader.result);
    fileType    = file.type || 'application/octet-stream';
    fileName    = file.name;

    const kb   = (fileContent.length / 1024).toFixed(1);
    const cost = estimateCost(fileContent.length);
    $('file-info').textContent   = `${fileName} · ${kb} KB · ${fileType}`;
    $('cost-estimate').textContent = `~${cost} CKB required`;
    $('file-preview-wrap').style.display = fileType.startsWith('image/') ? 'block' : 'none';
    if (fileType.startsWith('image/')) {
      $('file-preview').src = URL.createObjectURL(file);
    }
    updateMintButton();
  };
  reader.readAsArrayBuffer(file);
}

// ── Network toggle ────────────────────────────────────────────────
function setupNetworkToggle() {
  document.querySelectorAll('[data-network]').forEach(btn => {
    btn.addEventListener('click', () => {
      network = btn.dataset.network;
      document.querySelectorAll('[data-network]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // If using public node, update URL
      if (nodeInfo && !nodeInfo.isLocal) {
        nodeInfo.url = getPublicFallback(network);
        setNodeStatus('connected', `${nodeInfo.url} (public)`);
      }
    });
  });
}

// ── Wallet ────────────────────────────────────────────────────────
function setupWalletButton() {
  $('btn-connect-wallet')?.addEventListener('click', async () => {
    // TODO: wire @ckb-ccc/connector-react or vanilla CKB-CCC
    // For now, show a placeholder
    showStatus('Wallet connection coming next — JoyID + MetaMask via @ckb-ccc', 'info');
    // wallet = await connectWallet();
  });
}

// ── Mint ──────────────────────────────────────────────────────────
function setupMintButton() {
  $('btn-mint')?.addEventListener('click', handleMint);
}

async function handleMint() {
  if (!nodeInfo)    return showStatus('Connect a node first', 'error');
  if (!fileContent) return showStatus('Choose a file first', 'error');
  if (!wallet)      return showStatus('Connect your wallet first', 'error');

  $('btn-mint').disabled = true;
  showStatus('', '');

  try {
    const { txHash, sporeId } = await mintDOB({
      rpcURL:      nodeInfo.url,
      network,
      contentType: fileType,
      content:     fileContent,
      signer:      wallet,
      onProgress:  step => showStatus(step, 'info'),
    });

    showStatus(
      `Minted! TX: <a href="https://explorer.nervos.org/transaction/${txHash}" target="_blank">${txHash.slice(0,16)}…</a>`,
      'success'
    );
    $('result-box').style.display = 'block';
    $('result-txhash').textContent = txHash;
    $('result-sporeid').textContent = sporeId;

  } catch (err) {
    showStatus(`Error: ${err.message}`, 'error');
    console.error(err);
  } finally {
    $('btn-mint').disabled = false;
  }
}

function updateMintButton() {
  const ready = !!(nodeInfo && fileContent);
  const btn = $('btn-mint');
  if (btn) {
    btn.disabled = !ready;
    btn.textContent = ready ? 'Mint DOB' : wallet ? 'Choose a file' : 'Connect Wallet + File';
  }
}

function showStatus(msg, type) {
  const el = $('status-msg');
  if (!el) return;
  el.innerHTML = msg;
  el.className = `status-msg status-${type}`;
  el.style.display = msg ? 'block' : 'none';
}
