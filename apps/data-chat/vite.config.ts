import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/data-chat',
  server: { port: 4500, host: 'localhost' },
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), reactRouter()],
  worker: { format: 'es' },
});
