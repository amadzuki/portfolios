import { defineConfig } from 'vite';

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/game',
  server: { port: 4300, host: 'localhost' },
  preview: { port: 4301, host: 'localhost' },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
  test: {
    name: 'game',
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
