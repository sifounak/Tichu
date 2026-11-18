import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // REQ-NF-UC02: Bound jsdom concurrency to avoid contention with package builds/tests.
    maxWorkers: 2,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/app/**/*.tsx',      // Route composition has focused mocked component tests; no browser coverage.
        'src/types/**',          // Type declarations only
        'src/**/index.ts',       // Barrel exports
      ],
      reporter: ['text', 'html', 'json'],
      thresholds: {
        statements: 80,
        // REQ-NF-UC01: Stronger critical-flow gates.
        'src/stores/authStore.ts': { statements: 90, branches: 80 },
        'src/components/AuthGuard.tsx': { statements: 90, branches: 80 },
        'src/hooks/useNavigationBlock.ts': { statements: 90, branches: 80 },
        'src/components/game/ActionBar.tsx': { statements: 90, branches: 80 },
        'src/components/game/PreRoomView.tsx': { statements: 90, branches: 80 },
        'src/components/game/VoteOverlay.tsx': { statements: 90, branches: 80 },
        'src/components/game/KickDialog.tsx': { statements: 90, branches: 80 },
        'src/components/game/LeaveConfirmDialog.tsx': { statements: 90, branches: 80 },
        'src/components/game/WaitingForReconnectOverlay.tsx': { statements: 90, branches: 80 },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
