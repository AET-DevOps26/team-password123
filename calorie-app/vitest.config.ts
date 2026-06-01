import { defineConfig } from 'vitest/config';

// Lightweight, pure-function unit test config.
// - 'node' environment: no jsdom / DOM needed for the targets under test.
// - 'define' stubs the Vite feature-flag env vars so that any transitive
//   import of shared/config/flags.ts (which reads import.meta.env) resolves
//   to plain booleans instead of throwing at import time.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  define: {
    'import.meta.env.VITE_MOCK_MODE': JSON.stringify('false'),
    'import.meta.env.VITE_OFFLINE_MODE': JSON.stringify('false'),
    'import.meta.env.VITE_API_URL': JSON.stringify('http://localhost:8081'),
  },
});
