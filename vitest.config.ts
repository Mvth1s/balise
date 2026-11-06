import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/web', 'server'],
    coverage: {
      provider: 'v8',
      include: ['packages/analyzer/src/**', 'packages/rgaa-mapping/src/**'],
      exclude: ['**/*.test.ts', '**/*.d.ts', '**/data/**', '**/test-utils/**'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
      reporter: ['text', 'html', 'lcov', 'json-summary'],
    },
  },
});
