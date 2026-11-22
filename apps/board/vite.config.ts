import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { createSyncServer } from './src/lib/server/sync.ts';

/** Attaches the realtime sync server to Vite's dev and preview servers. */
function realtime(): Plugin {
  const attach = (server: {
    httpServer: import('node:http').Server | null;
  }) => {
    const sync = createSyncServer({ log: console.warn });
    server.httpServer?.on('upgrade', (req, socket, head) => {
      sync.handleUpgrade(req, socket, head);
    });
  };
  return {
    name: 'board-realtime',
    configureServer: (s) => attach(s as never),
    configurePreviewServer: (s) => attach(s as never),
  };
}

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/board',
  server: { port: 4600, host: 'localhost' },
  preview: { port: 4601, host: 'localhost' },
  plugins: [
    tailwindcss(),
    sveltekit({ adapter: adapter({ out: 'build' }) }),
    realtime(),
  ],
});
