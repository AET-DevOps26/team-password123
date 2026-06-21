import { defineConfig } from 'vitest/config';

// Lightweight, pure-function unit test config.
// 'node' environment: no jsdom / DOM needed for the targets under test.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
