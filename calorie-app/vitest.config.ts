import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Default 'node' environment keeps the pure-function unit tests fast.
// Component tests (React Testing Library) opt into jsdom per-file via a
// `// @vitest-environment jsdom` docblock at the top of the test file.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
