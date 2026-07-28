import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Type-only module: erased at runtime, so it has no branches to cover.
      exclude: ['src/types.ts'],
      // The rule set is the product. Anything less than full branch coverage
      // here means an untested path can hand a disabled player a wrong verdict.
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
