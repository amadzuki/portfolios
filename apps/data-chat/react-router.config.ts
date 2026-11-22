import type { Config } from '@react-router/dev/config';

export default {
  // Server rendering for the dataset pages (they have a server action), while the landing
  // page is prerendered to static HTML at build time.
  ssr: true,
  prerender: ['/'],
} satisfies Config;
