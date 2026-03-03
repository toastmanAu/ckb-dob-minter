# CKB DOB Minter

A fully open-source, self-hostable minting UI for [Spore Protocol](https://docs.spore.pro) DOBs (Digital Objects) on Nervos CKB.

Content is stored **fully on-chain** inside the CKB cell — no IPFS, no external URLs, no links that rot. Backed by real CKB capacity, redeemable when melted.

**[Live demo →](https://wyltekindustries.com/dob-minter)** (Wyltek Industries deployment)

![CKB DOB Minter screenshot](docs/screenshot.png)

---

## Features

- 🖼️ **Single & batch mint** — drop multiple files, mint them all in one session
- 📦 **Collections** — create a new cluster or attach to an existing one
- 👛 **JoyID + any CKB wallet** via CCC connector (MetaMask, hardware wallets, etc.)
- 🌐 **Your own node** — connects to your local CKB node, no third-party RPC
- 🎨 **Fully themeable** — change colours, logo, footer, feature flags in one file
- 🔓 **MIT licensed** — fork it, white-label it, ship it

---

## Fork & customise

### 1. Clone
```bash
git clone https://github.com/toastmanAu/ckb-dob-minter
cd ckb-dob-minter
npm install
```

### 2. Edit `theme.config.js`

Everything visual lives here — no React knowledge required:

```js
// theme.config.js
export default {
  siteName: 'My NFT Minter',
  logoText: 'My NFT Minter',
  logoIcon: '/my-logo.png',       // drop your logo in /public/

  colors: {
    accent:  '#ff6b35',           // your brand colour
    bg:      '#0a0a0a',
    surface: '#141414',
    // ...full list in the file
  },

  links: {
    site:   'https://mysite.com',
    github: 'https://github.com/me/my-minter',
  },

  footer: {
    show: true,
    text: 'Powered by Nervos CKB',
    links: [
      { label: 'My Site', url: 'https://mysite.com' },
    ],
  },

  features: {
    showExplainer:  true,
    defaultNetwork: 'mainnet',   // start on mainnet
    allowTestnet:   false,       // hide testnet toggle
  },
};
```

### 3. Run dev server
```bash
npm run dev
```

### 4. Deploy
```bash
npm run build
# dist/ folder → deploy to GitHub Pages, Vercel, Netlify, Cloudflare Pages, your own server
```

---

## Cost estimates

Spore Protocol stores content using CKB's capacity model (1 byte on-chain = 1 CKB locked).
Molecule encoding roughly doubles the content byte size:

| Image size | CKB locked per DOB | At $0.005/CKB |
|------------|-------------------|---------------|
| 10 KB      | ~520 CKB          | ~$2.60        |
| 50 KB      | ~2,400 CKB        | ~$12          |
| 80 KB      | ~3,820 CKB        | ~$19          |
| 100 KB     | ~4,700 CKB        | ~$23.50       |

CKB is **not spent** — it's locked inside the DOB cell. Melt the DOB to reclaim it.

---

## Architecture

```
src/
  App.jsx                  — main layout, mint orchestration
  components/
    NodePanel.jsx          — CKB node connection
    FilesPanel.jsx         — file drop zone, multi-file
    ClusterPanel.jsx       — collection create/use
    MetaPanel.jsx          — recipient, cluster ID, fee rate
    WalletPanel.jsx        — CCC wallet connector
    MintPanel.jsx          — single-file review + mint
  hooks/
    useFilesInput.js       — file selection + cost estimate
    useNodeFinder.js       — node auto-discovery
  lib/
    minter.js              — core mint logic (createCluster, mintDOB, mintDOBs)
    theme.js               — applies theme.config.js to CSS variables
theme.config.js            — ← edit this to customise your deployment
```

### Key implementation notes

- **`clusterMode: 'clusterCell'`** — required when minting into a cluster. The cluster cell is spent and recreated in the same tx to prove ownership. Without this, `createSpore` throws.
- **`to` must be a `Script`** — pass `(await ccc.Address.fromString(addr, client)).script`, not the Address object.
- **Molecule encoding** — on-chain storage is ~2.2× the raw file bytes. The cost estimator accounts for this.
- **`completeFeeBy`** — must be called after `createSpore`/`createSporeCluster` and before `sendTransaction`.

---

## Local development

Requires a running CKB node or use the public testnet RPC. The app auto-discovers local nodes on common ports (8114, 8115).

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
```

---

## License

MIT — fork it, ship it, white-label it. Attribution appreciated but not required.

Built by [Wyltek Industries](https://wyltekindustries.com) on Nervos CKB.
