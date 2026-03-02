# ckb-dob-minter

Browser-based DOB (Digital Object) minting tool for Nervos CKB.

Mint fully on-chain digital objects from your own CKB node — no reliance on third-party infrastructure.

## What it does

- Auto-discovers your local CKB node (localhost:8114 / :8117 / custom URL)
- Falls back to public RPC if no local node is found
- Accepts any file up to 500KB (image, text, JSON, binary)
- Stores content **fully on-chain** in a Spore Protocol cell
- Shows estimated CKB cost before minting
- Connects via JoyID (passkey) or MetaMask

## Stack

| Layer | Package |
|-------|---------|
| Minting | `@spore-sdk/core` (Spore Protocol TypeScript SDK) |
| Wallet | `@ckb-ccc/connector-react` (JoyID + MetaMask) |
| Node discovery | custom `node-finder.js` |
| Build | Vite + `vite-plugin-node-polyfills` (Lumos needs Node polyfills in browser) |

## DOB Cell Structure

```
data:
  content-type: "image/png"   # MIME type
  content: <bytes>            # your file, fully on-chain
  cluster_id: <optional>      # collection ID
type:
  code_hash: SPORE_TYPE_DATA_HASH
  args: SPORE_ID
lock:
  <your lock script>
```

## Dev

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/
```

## Cost

1 byte of content ≈ 1 CKB capacity. Base overhead ≈ 96 CKB.
- 10KB image → ~106 CKB (~$0.05)
- All redeemable — burn the DOB to get CKB back.

## Wyltek Hardware DOB Format

For hardware provenance DOBs, use `content-type: application/json` with:

```json
{
  "device": "ESP32-2432S028R",
  "serial": "WY-2026-001",
  "firmware": "0.1.0",
  "firmware_hash": "0x...",
  "test_results": { "flash": "ok", "wifi": "ok" },
  "minted_by": "ckb1q..."
}
```

## Status

- [x] UI shell — node panel, file drop, wallet slot, mint button
- [x] Node auto-discovery (`node-finder.js`)
- [x] Cost estimation
- [x] Minting logic scaffold (`minter.js`)
- [ ] Wallet connection (CKB-CCC wiring)
- [ ] End-to-end testnet mint
- [ ] Cluster / collection support
- [ ] Hardware provenance JSON template
- [ ] wyltekindustries.com integration

## Reference

- [Spore Protocol docs](https://docs.spore.pro)
- [spore-sdk](https://github.com/sporeprotocol/spore-sdk)
- [Create DOB tutorial — Nervos docs](https://docs.nervos.org/docs/dapp/create-dob)
- [DOB Cookbook](https://github.com/sporeprotocol/dob-cookbook)

## First mint

First DOB minted on CKB Testnet — 2026-03-03

- **TX:** `0x74bf8469fd4e2533df6432eb70cc8616e5facffffc63a0c62cc8a9d33b48b62b`
- **Spore ID:** `0xc7a3c0aa498bed3417580201bdc2508a7e48d13fe79e1c2bcf1e40a357f781a6`
- Explorer: https://testnet.explorer.nervos.org/nft-info/0xc7a3c0aa498bed3417580201bdc2508a7e48d13fe79e1c2bcf1e40a357f781a6
