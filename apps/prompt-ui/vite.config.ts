import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/prompt-ui',
  server: { port: 4400, host: 'localhost' },
  preview: { port: 4401, host: 'localhost' },
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), tanstackStart(), react()],
  test: {
    name: 'prompt-ui',
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
