/**
 * Production entry: SvelteKit's Node handler plus the Yjs WebSocket sync server on one port.
 * Run with `node server.ts` (Node strips the types) after `vite build`.
 *
 * Env: PORT (default 4601), ORIGIN (public URL, needed for SvelteKit's CSRF check; defaults
 * to localhost), BOARD_DATA_DIR (optional, persists boards to disk).
 */
import { createServer } from 'node:http';
import { createSyncServer } from './src/lib/server/sync.ts';

const port = Number(process.env.PORT ?? 4601);
process.env.ORIGIN ??= `http://localhost:${port}`;
// Imported after ORIGIN is set, because the adapter reads it on load. The specifier is a
// variable so type-checking works before `vite build` has generated the file.
const entry = './build/handler.js';
const { handler } = (await import(entry)) as {
  handler: import('node:http').RequestListener;
};

const sync = createSyncServer({
  dataDir: process.env.BOARD_DATA_DIR,
  log: console.warn,
});
const server = createServer(handler);
server.on('upgrade', (req, socket, head) => {
  if (!sync.handleUpgrade(req, socket, head)) socket.destroy();
});
server.listen(port, () => console.log(`board on ${process.env.ORIGIN}`));

const stop = () => {
  sync.close();
  server.close(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
