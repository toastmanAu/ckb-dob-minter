/**
 * lib/theme.js — applies theme.config.js values to CSS custom properties
 * Called once at app startup in main.jsx
 */
import theme from '../../theme.config.js';

export function applyTheme() {
  const root = document.documentElement;
  const c = theme.colors || {};

  const map = {
    '--accent':      c.accent,
    '--accent-hover':c.accentHover,
    '--bg':          c.bg,
    '--surface':     c.surface,
    '--border':      c.border,
    '--text':        c.text,
    '--muted':       c.textMuted,
    '--green':       c.success,
    '--red':         c.error,
    '--orange':      c.warning,
  };

  for (const [prop, val] of Object.entries(map)) {
    if (val) root.style.setProperty(prop, val);
  }

  // Page title + favicon
  if (theme.siteName) document.title = theme.siteName;
  if (theme.favicon) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = theme.favicon;
  }
}

export { theme };
