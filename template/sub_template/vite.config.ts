import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORTAL_BASE = '/apps/template/';
const WEB_OUT_DIR = path.resolve(__dirname, 'dist/web');

export default defineConfig({
  base: PORTAL_BASE,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    outDir: WEB_OUT_DIR,
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    watch: process.env.DISABLE_HMR === 'true' ? null : {
      ignored: ['**/logs/**', '**/uploads/**', '**/dbs/**'],
    },
  },
});
