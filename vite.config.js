import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    nodePolyfills({
      // Lumos needs these Node core module polyfills in the browser
      include: ['buffer', 'crypto', 'stream', 'util'],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
  build: {
    target: 'es2020',
  },
});
