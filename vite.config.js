import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// GitHub Pages serves this project at https://<user>.github.io/arforge/
// so production assets are rooted there. Dev stays at "/".
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/arforge/' : '/',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        notfound: resolve(import.meta.dirname, '404.html'),
      },
    },
  },
  server: { port: 5173, host: true },
}));
