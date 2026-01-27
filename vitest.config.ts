import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Global test settings
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/helpers/setup.ts'],

    // Include patterns
    include: ['tests/**/*.test.{ts,tsx}'],

    // Exclude patterns
    exclude: ['node_modules', 'e2e'],

    // Use node environment for API tests
    environmentMatchGlobs: [
      ['tests/**/api.test.ts', 'node'],
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      enabled: true,

      // What to measure
      include: [
        'client/src/**/*.{ts,tsx}',
        'server/src/**/*.ts',
      ],

      // What to exclude
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/node_modules/**',
        '**/index.ts',           // Re-export files
        '**/*.d.ts',             // Type definitions
        'client/src/main.tsx',   // Entry point
        'client/src/vite-env.d.ts',
        'server/src/index.ts',   // Server entry
        'server/src/swagger.ts', // Swagger config
      ],

      // Report formats
      reporter: [
        'text',           // Console output
        'text-summary',   // Summary in console
        'html',           // Browsable HTML report
        'lcov',           // For CI tools (Codecov, Coveralls)
        'json',           // Programmatic access
        'json-summary',   // Summary JSON
      ],

      // Output directory
      reportsDirectory: './coverage',

      // Coverage thresholds - fail if below these
      // Note: Start with lower thresholds and increase as coverage improves
      thresholds: {
        global: {
          statements: 30,
          branches: 50,
          functions: 15,
          lines: 30,
        },
        // Per-file thresholds for critical files (increase as you add tests)
        'client/src/components/features/setup/SetupForm.tsx': {
          statements: 60,
          branches: 50,
          functions: 60,
          lines: 60,
        },
        'server/src/routes/config.ts': {
          statements: 70,
          branches: 65,
          functions: 45,
          lines: 70,
        },
      },

      // Show uncovered lines in console
      all: true,

      // Clean coverage directory before running
      clean: true,
    },

    // Reporter configuration
    reporters: ['default', 'html'],
    outputFile: {
      html: './test-results/index.html',
    },

    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,
  },

  // Path aliases (match client tsconfig)
  resolve: {
    alias: {
      '@client': path.resolve(__dirname, './client/src'),
      '@server': path.resolve(__dirname, './server/src'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
});
