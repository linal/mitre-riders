import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'src-server/**/*.{test,spec}.ts',
      'tests/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: ['node_modules', 'tests/e2e/**', 'client', 'dist', 'dist-server'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['**/node_modules/**', 'tests/**', '**/*.config.{js,ts}', 'dist*/**'],
    },
    environmentMatchGlobs: [
      ['src-server/**', 'node'],
      ['tests/server/**', 'node'],
    ],
  },
});
