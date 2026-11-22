import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  test: { name: 'board', environment: 'node', include: ['src/**/*.spec.ts'] },
});
