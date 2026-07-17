import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Mirrors tsconfig.json's "@/*" -> "./*" path mapping. Kept as a plain
// alias (not vite-tsconfig-paths) so the test runner has zero dependency
// on tsconfig resolution quirks — one less thing to drift.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
    globals: false,
    // Money- and compliance-critical logic (passport assembly, payment
    // reconciliation, intake deliveries) all live in server-only modules
    // that import `server-only` and `next/headers`. Those are stubbed in
    // tests/setup.ts rather than pulled in for real, since this is a unit
    // layer around pure logic and mocked Supabase clients, not an
    // integration test against a live database.
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'lib/activate-subscription.ts',
        'lib/passport/passport.service.ts',
        'lib/safe-query.ts',
        'lib/reports/farm-statement-pdf.ts',
        'app/dashboard/cooperative/intake/actions.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
