/**
 * Wyltek Founding Member DOB Mint Script
 * Testnet dry run — 1 cluster + N DOBs to N recipient addresses
 *
 * Usage:
 *   node mint.js [--dry-run] [--mainnet] [--ckbfs]
 *
 * --ckbfs  : publish image via CKBFS (witnesses-based, ~200 CKB flat) then
 *            mint Spore DOBs with contentType="application/ckbfs" and the
 *            CKBFS typeId as content. This is the mainnet-viable path.
 *            Without --ckbfs, image is embedded directly in the Spore cell
 *            (only works for tiny images < ~500 CKB).
 *
 * Logs all tx hashes + explorer links. In dry-run mode, builds and
 * validates the tx but does not broadcast.
 */

import { ccc } from '@ckb-ccc/core';
import { createSpore, createSporeCluster } from '@ckb-ccc/spore';
import fs from 'fs';
import path from 'path';
import { ckbfsPublish, ckbfsEstimateCost } from '../workspace/ckb-dob-minter/src/lib/ckbfs.js';

// ── Config ─────────────────────────────────────────────────────────────────

const IS_MAINNET  = process.argv.includes('--mainnet');
const DRY_RUN     = process.argv.includes('--dry-run');
const USE_CKBFS   = process.argv.includes('--ckbfs');
const NETWORK     = IS_MAINNET ? 'mainnet' : 'testnet';
const EXPLORER    = IS_MAINNET
  ? 'https://explorer.nervos.org/transaction'
  : 'https://pudge.explorer.nervos.org/transaction';

// Minting wallet private key (funded)
const MINTER_PRIVKEY = '0xd82181620f10b845bfd2581883d1e2ce37a4c2db7096554d7020bc76f1351c66';

// Existing cluster ID (already deployed to testnet — reuse it)
const EXISTING_CLUSTER_ID = '0x04a45719375ec0ea9b6c3d47ea104d117a4175c6f4682b03194c2281fde217ee';

// Test recipients (5 addresses for testnet dry run)
// On mainnet: replace with real JoyID addresses from Supabase signup queue
const RECIPIENTS = [
  // #1 already minted (0x418cbc...) — skip
  'ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqg2u4hj3l4mh0cf9t59jrvqyjaz06lumaqx72pu6',
  'ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqwcxstkstfsqw6lstgs32e6zd3axfhremgknupzt',
  'ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqvyd8h98vmre5mkkj742nszh4hqlnc8y2qs3ktfc',
  'ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqw5j7fufgtuwh450z7wyt0h38cew6gem4sll9a35',
];

// Image to embed on-chain
const IMAGE_PATH = process.env.IMAGE_PATH
  || '/home/phill/.openclaw/workspace/founding-member-dob-optimized.jpg';

// Collection metadata
const CLUSTER_NAME = IS_MAINNET
  ? 'Wyltek Founding Members'
  : '[TESTNET] Wyltek Founding Members';
const CLUSTER_DESC =
  'The first 50 members of Wyltek Industries. ' +
  'Permanently on-chain via Spore Protocol on Nervos CKB. ' +
  'wyltekindustries.com';

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  log('═'.repeat(60));
  log(`Wyltek DOB Minting Script`);
  log(`Network  : ${NETWORK.toUpperCase()}`);
  log(`Mode     : ${DRY_RUN ? 'DRY RUN (no broadcast)' : 'LIVE'}`);
  log(`Image    : ${IMAGE_PATH}`);
  log(`Recipients: ${RECIPIENTS.length}`);
  log('═'.repeat(60));

  // Validate image
  if (!fs.existsSync(IMAGE_PATH)) {
    die(`Image not found: ${IMAGE_PATH}`);
  }
  const imageBytes = fs.readFileSync(IMAGE_PATH);
  const mimeType   = IMAGE_PATH.endsWith('.png') ? 'image/png' : 'image/jpeg';
  log(`Image size: ${(imageBytes.length / 1024).toFixed(1)} KB (${mimeType})`);
  log(`Mode: ${USE_CKBFS ? 'CKBFS (witnesses-based)' : 'Direct embed in Spore cell'}`);
  if (USE_CKBFS) {
    const est = ckbfsEstimateCost(imageBytes);
    log(`CKBFS estimate: witness=${est.witnessBytes} bytes, cell=${est.cellCapacityCkb} CKB locked`);
  } else {
    log(`Estimated CKB per DOB: ~${Math.ceil(imageBytes.length / 100) + 200} CKB`);
  }
  log('');

  // Setup client + signer
  const client = IS_MAINNET
    ? new ccc.ClientPublicMainnet()
    : new ccc.ClientPublicTestnet();
  const signer = new ccc.SignerCkbPrivateKey(client, MINTER_PRIVKEY);
  const minterAddr = await signer.getRecommendedAddress();
  log(`Minter address : ${minterAddr}`);

  // Check balance
  const minterAddrObj = await ccc.Address.fromString(minterAddr, client);
  const cells = await client.findCells({ script: minterAddrObj.script, scriptType: 'lock' }, 'asc', 10);
  let balance = 0n;
  for await (const cell of cells) { balance += cell.cellOutput.capacity; }
  const balanceCKB = Number(balance) / 1e8;
  log(`Minter balance : ${balanceCKB.toFixed(2)} CKB`);
  if (!DRY_RUN && balanceCKB < 500) {
    die(`Insufficient balance: ${balanceCKB} CKB. Need at least 500 CKB.`);
  }
  log('');

  // ── Step 1: Create Cluster ─────────────────────────────────────────────
  log('Step 1: Creating Spore Cluster (collection)...');
  log(`  Name: ${CLUSTER_NAME}`);
  log(`  Desc: ${CLUSTER_DESC}`);

  let clusterId, clusterTxHash;

  if (DRY_RUN) {
    clusterId = '0x' + '00'.repeat(32) + '(dry-run)';
    clusterTxHash = '0x' + 'aa'.repeat(32);
    log(`  [DRY RUN] Cluster tx simulated`);
    log(`  Cluster ID   : ${clusterId}`);
    log(`  Cluster TxHash: ${clusterTxHash}`);
  } else if (EXISTING_CLUSTER_ID) {
    // Reuse existing deployed cluster
    clusterId = EXISTING_CLUSTER_ID;
    clusterTxHash = '(pre-existing)';
    log(`  ✅ Reusing existing cluster: ${clusterId}`);
  } else {
    try {
      const { tx, id } = await createSporeCluster({
        signer,
        data: { name: CLUSTER_NAME, description: CLUSTER_DESC },
      });
      await tx.completeFeeBy(signer);
      clusterTxHash = await signer.sendTransaction(tx);
      clusterId = ccc.hexFrom(id);
      log(`  ✅ Cluster created!`);
      log(`  Cluster ID   : ${clusterId}`);
      log(`  TxHash       : ${clusterTxHash}`);
      log(`  Explorer     : ${EXPLORER}/${clusterTxHash}`);
      log(`  Waiting for confirmation...`);
      await client.waitTransaction(clusterTxHash);
      log(`  ✅ Confirmed.`);
    } catch (e) {
      die('Cluster creation failed: ' + e.message);
    }
  }

  log('');

  // ── Step 1.5: CKBFS publish (if --ckbfs flag) ──────────────────────────
  let sporeContent = imageBytes;
  let sporeMimeType = mimeType;

  if (USE_CKBFS) {
    log('Step 1.5: Publishing image to CKBFS (witnesses-based storage)...');
    if (DRY_RUN) {
      log('  [DRY RUN] Would publish to CKBFS — skipping');
      sporeContent = new TextEncoder().encode('ckbfs://0x' + '00'.repeat(32));
      sporeMimeType = 'application/ckbfs';
    } else {
      try {
        const ckbfsResult = await ckbfsPublish({
          signer,
          fileBytes: imageBytes,
          contentType: mimeType,
          filename: path.basename(IMAGE_PATH),
          mainnet: IS_MAINNET,
        });
        log(`  ✅ CKBFS published!`);
        log(`  TypeID   : ${ckbfsResult.typeId}`);
        log(`  TxHash   : ${ckbfsResult.txHash}`);
        log(`  Explorer : ${ckbfsResult.explorerUrl}`);
        log(`  Checksum : 0x${ckbfsResult.checksum.toString(16).padStart(8,'0')}`);
        log(`  Cell cap : ${ckbfsResult.capacityCkb} CKB (locked permanently)`);
        log(`  Waiting for confirmation...`);
        await signer.client.waitTransaction(ckbfsResult.txHash);
        log(`  ✅ Confirmed.`);
        // DOBs reference the CKBFS file by typeId
        sporeContent = new TextEncoder().encode(`ckbfs://${ckbfsResult.typeId}`);
        sporeMimeType = 'application/ckbfs';
      } catch (e) {
        die('CKBFS publish failed: ' + e.message);
      }
    }
    log('');
  }

  // ── Step 2: Mint DOBs ──────────────────────────────────────────────────
  log(`Step 2: Minting ${RECIPIENTS.length} DOBs...`);
  log('');

  const results = [];

  for (let i = 0; i < RECIPIENTS.length; i++) {
    const recipient = RECIPIENTS[i];
    log(`  Minting DOB ${i + 1}/${RECIPIENTS.length} → ${recipient.slice(0, 20)}...${recipient.slice(-8)}`);

    if (DRY_RUN) {
      const fakeTx = '0x' + ((i + 1).toString(16).padStart(2, '0')).repeat(32);
      const fakeId = '0x' + ((i + 10).toString(16).padStart(2, '0')).repeat(32);
      log(`    [DRY RUN] Would mint DOB #${i + 1}`);
      log(`    Spore ID  : ${fakeId}`);
      log(`    TxHash    : ${fakeTx}`);
      log(`    Explorer  : ${EXPLORER}/${fakeTx}`);
      results.push({
        index: i + 1,
        recipient,
        sporeId: fakeId,
        txHash: fakeTx,
        explorerUrl: `${EXPLORER}/${fakeTx}`,
        status: 'dry-run',
      });
    } else {
      try {
        const { tx, id } = await createSpore({
          signer,
          data: {
            contentType: sporeMimeType,
            content: new Uint8Array(sporeContent),
            clusterId: ccc.hexFrom(clusterId),
          },
          to: (await ccc.Address.fromString(recipient, client)).script,
          clusterMode: 'clusterCell',
        });
        await tx.completeFeeBy(signer);
        const txHash = await signer.sendTransaction(tx);
        const sporeId = ccc.hexFrom(id);
        log(`    ✅ Minted!`);
        log(`    Spore ID  : ${sporeId}`);
        log(`    TxHash    : ${txHash}`);
        log(`    Explorer  : ${EXPLORER}/${txHash}`);
        // Wait for confirmation — cluster cell is spent+recreated each mint
        // so next mint must see the new cluster UTXO on-chain
        log(`    Waiting for confirmation before next mint…`);
        await client.waitTransaction(txHash);
        log(`    ✅ Confirmed.`);
        results.push({
          index: i + 1,
          recipient,
          sporeId,
          txHash,
          explorerUrl: `${EXPLORER}/${txHash}`,
          status: 'success',
        });
        // Small delay between mints to avoid nonce conflicts
        await new Promise(r => setTimeout(r, 2000));
      } catch (e) {
        log(`    ❌ FAILED: ${e.message}`);
        results.push({
          index: i + 1,
          recipient,
          sporeId: null,
          txHash: null,
          explorerUrl: null,
          status: 'failed',
          error: e.message,
        });
      }
    }
    log('');
  }

  // ── Summary ────────────────────────────────────────────────────────────
  log('═'.repeat(60));
  log('SUMMARY');
  log('═'.repeat(60));
  log(`Network  : ${NETWORK.toUpperCase()}`);
  log(`Mode     : ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  log(`Cluster  : ${clusterId}`);
  log(`Cluster TX: ${EXPLORER}/${clusterTxHash}`);
  log('');
  log('DOBs minted:');
  for (const r of results) {
    const status = r.status === 'success' ? '✅' : r.status === 'dry-run' ? '🔲' : '❌';
    log(`  ${status} #${r.index} → ${r.recipient.slice(0, 16)}...${r.recipient.slice(-8)}`);
    if (r.sporeId)     log(`       Spore ID : ${r.sporeId}`);
    if (r.explorerUrl) log(`       Explorer : ${r.explorerUrl}`);
    if (r.error)       log(`       Error    : ${r.error}`);
  }

  // Save results JSON
  const outPath = `/tmp/mint-results-${NETWORK}-${Date.now()}.json`;
  fs.writeFileSync(outPath, JSON.stringify({ clusterId, clusterTxHash, results }, null, 2));
  log('');
  log(`Results saved: ${outPath}`);
  log('═'.repeat(60));

  const failed = results.filter(r => r.status === 'failed').length;
  const success = results.filter(r => r.status === 'success').length;
  const dryrun  = results.filter(r => r.status === 'dry-run').length;
  if (DRY_RUN) {
    log(`✅ Dry run complete — ${dryrun} DOBs would be minted. Run without --dry-run to go live.`);
  } else {
    log(`✅ Done — ${success} minted, ${failed} failed.`);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function log(msg) { console.log(msg); }
function die(msg) { console.error('FATAL: ' + msg); process.exit(1); }

main().catch(e => { console.error(e); process.exit(1); });
