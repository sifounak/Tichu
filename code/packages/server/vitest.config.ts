import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/app.ts', 'src/ws/index.ts'],
      thresholds: {
        statements: 80,
        // REQ-NF-SJ03: per-file thresholds for seat-validation modules
        // (M2 & M3 scope).
        'src/room/seat-eligibility.ts': {
          statements: 80,
        },
        'src/room/seat-queue.ts': {
          statements: 80,
        },
      },
    },
  },
});
