/**
 * theme.config.js — Customise the DOB Minter for your own deployment
 *
 * Fork this repo, edit this file, deploy. No React knowledge needed.
 * All fields are optional — defaults fall back to Wyltek values.
 */

export default {
  // ── Branding ─────────────────────────────────────────────────────────────
  siteName:    'CKB DOB Minter',
  logoText:    'CKB DOB Minter',       // text shown in header
  logoIcon:    null,                    // path to logo image e.g. '/logo.png'
  favicon:     '/favicon.ico',
  description: 'Mint fully on-chain NFTs on Nervos CKB. Content lives inside the cell — no IPFS, no broken links.',

  // ── Colours (CSS custom properties) ──────────────────────────────────────
  colors: {
    accent:      '#00c8ff',   // primary highlight — buttons, links, focus rings
    accentHover: '#00a8d8',   // button hover state
    bg:          '#0d1018',   // page background
    surface:     '#131720',   // card background
    border:      '#1e2430',   // card/input borders
    text:        '#e2e8f0',   // body text
    textMuted:   '#64748b',   // hints, labels, secondary text
    success:     '#00e5a0',   // success states
    error:       '#f43f5e',   // error states
    warning:     '#fbbf24',   // warning states
  },

  // ── Header links ─────────────────────────────────────────────────────────
  links: {
    site:   'https://wyltekindustries.com',
    github: 'https://github.com/toastmanAu/ckb-dob-minter',
    docs:   null,             // optional docs URL
  },

  // ── Footer ───────────────────────────────────────────────────────────────
  footer: {
    show:  true,
    text:  'Built on Nervos CKB · Spore Protocol',
    links: [
      { label: 'Spore Docs',    url: 'https://docs.spore.pro' },
      { label: 'CKB Explorer',  url: 'https://explorer.nervos.org' },
      { label: 'GitHub',        url: 'https://github.com/toastmanAu/ckb-dob-minter' },
    ],
  },

  // ── Feature flags ────────────────────────────────────────────────────────
  features: {
    showExplainer:   true,   // show the "why DOBs" card at the bottom
    showNodePanel:   true,   // show the custom node connector
    allowMainnet:    true,   // show mainnet option in network toggle
    allowTestnet:    true,   // show testnet option
    defaultNetwork: 'testnet',
  },

  // ── Explainer card (shown at bottom) ─────────────────────────────────────
  // Set to null to use defaults. Override any or all items.
  explainerItems: null,
  // Example override:
  // explainerItems: [
  //   { icon: '⛓️', title: 'Fully on-chain', desc: 'Your content, forever.' },
  //   { icon: '💎', title: 'Real value',      desc: 'Backed by CKB.' },
  // ],
};
