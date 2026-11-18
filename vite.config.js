import { defineConfig } from 'vite';
import { storyAssets } from './scripts/story-assets.js';

export default defineConfig({
  plugins: [storyAssets()],
  server: {
    fs: {
      strict: true,
      deny: ['**/.env', '**/.env.*', '**/*.{crt,pem,key,p12,pfx,cer,der}', '**/.npmrc', '**/.yarnrc.yml', '**/.git/**', '**/server/**', '**/tests/**', '**/data/**', '**/supabase/**', '**/script.md', '**/*.sqlite*']
    }
  },
  build: {
    rollupOptions: {
      output: { manualChunks: { phaser: ['phaser'] } }
    },
    // Phaser's renderer is a large, deliberately separate vendor bundle.
    chunkSizeWarningLimit: 1600
  }
});
