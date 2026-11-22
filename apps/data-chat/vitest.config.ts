import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  test: {
    name: 'data-chat',
    environment: 'node',
    include: ['app/**/*.spec.ts'],
  },
});
